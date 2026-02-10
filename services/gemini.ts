import OpenAI from "openai";
import { fal } from "@fal-ai/client";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const FAL_KEY = import.meta.env.VITE_FAL_KEY;
const DOUBAO_API_KEY = import.meta.env.VITE_DOUBAO_API_KEY;

const logStep = (stepName: string, startTime: number) => {
  const duration = ((performance.now() - startTime) / 1000).toFixed(2);
  console.log(`%c[AI TIMING] ${stepName}: ${duration}s`, "color: #ea580c; font-weight: bold;");
  return performance.now();
};

/**
 * 核心修改 1：增加图片处理容错。
 * 如果图片是 Base64 格式且过大，fetch 会挂起。直接返回 source 减少内存开销。
 */
async function getGeminiImageData(source: string): Promise<{ data: string; mimeType: string }> {
  try {
    const res = await fetch(source);
    const blob = await res.blob();
    // 如果图片超过 2MB，强制限制转换，避免内存溢出
    if (blob.size > 2 * 1024 * 1024) {
      console.warn("警告：上传图片过大，可能导致转换卡死");
    }
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(blob);
    });
    return { data: base64, mimeType: blob.type || 'image/jpeg' };
  } catch (e) {
    throw new Error("图片预处理失败，请尝试更换图片或缩小尺寸。");
  }
}

async function generatePetMask(imageUrl: string): Promise<string> {
  const start = performance.now();
  fal.config({ credentials: FAL_KEY });
  const result: any = await fal.subscribe("fal-ai/sam", {
    input: {
      image_url: imageUrl,
      selection_type: "text",
      text_prompt: "the body of the animal, the torso, the clothing area", 
    }
  });
  logStep("SAM 遮罩生成完成", start);
  return result?.masks?.[0]?.url || "";
}

async function executeInpaint(imageUrl: string, maskUrl: string, prompt: string): Promise<string> {
  const start = performance.now();
  const result: any = await fal.subscribe("fal-ai/flux/dev/fill", {
    input: {
      image_url: imageUrl,
      mask_url: maskUrl,
      prompt: `${prompt}, professional studio product shot, plain solid white background, high quality`,
      strength: 0.85, 
      num_inference_steps: 18, 
      guidance_scale: 25,
      enable_safety_checker: false
    }
  });
  logStep("Flux 局部重绘渲染完成", start);
  return result?.images?.[0]?.url || "";
}

export const generateFitting = async (
  engine: 'doubao' | 'fal' | 'google', 
  petImageSource: string,
  description: string,
  style: string = 'Studio'
): Promise<string> => {
  const totalStart = performance.now();
  console.clear();
  console.log("%c🚀 任务启动", "color: white; background: #ea580c; padding: 2px 5px;");

  // --- 1. 豆包 (跳过逻辑不变) ---
  if (engine === 'doubao') {
    const openai = new OpenAI({ apiKey: DOUBAO_API_KEY, baseURL: "https://ark.cn-beijing.volces.com/api/v3", dangerouslyAllowBrowser: true });
    const response = await openai.images.generate({
      model: "doubao-seedream-4-5-251128",
      prompt: `Professional pet photography. A pet wearing ${description}. Solid white background.`,
    });
    return response.data[0]?.url || "";
  } 

  // --- 2. Google 联合逻辑 (核心修复点) ---
  if (engine === 'google') {
    // 核心修改 2：取消 Promise.all。
    // 图片 Base64 转换非常吃 CPU，并行执行会导致浏览器线程锁死。
    // 先转换图片，再调用 API。
    const imgStart = performance.now();
    const imgData = await getGeminiImageData(petImageSource);
    logStep("步骤 1: 图片转换完成", imgStart);

    const maskStart = performance.now();
    const maskUrl = await generatePetMask(petImageSource);
    logStep("步骤 2: SAM 遮罩完成", maskStart);

    const geminiStart = performance.now();
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const geminiPrompt = `Analyze pet. Create prompt for inpainting to wear: "${description}". White background. Keep head identical.`;
    const result = await model.generateContent([
      { inlineData: { data: imgData.data, mimeType: imgData.mimeType } },
      { text: geminiPrompt }
    ]);
    const optimizedPrompt = result.response.text();
    logStep("步骤 3: Gemini 分析完成", geminiStart);

    const finalUrl = await executeInpaint(petImageSource, maskUrl, optimizedPrompt);
    logStep("✨ 总耗时", totalStart);
    return finalUrl;
  }

  // --- 3. FAL 逻辑 ---
  const maskUrl = await generatePetMask(petImageSource);
  return await executeInpaint(petImageSource, maskUrl, description);
};
