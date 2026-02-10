import OpenAI from "openai";
import { fal } from "@fal-ai/client";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const FAL_KEY = import.meta.env.VITE_FAL_KEY;
const DOUBAO_API_KEY = import.meta.env.VITE_DOUBAO_API_KEY;

// 增强版调试日志
const logStep = (stepName: string, startTime: number) => {
  const duration = ((performance.now() - startTime) / 1000).toFixed(2);
  console.log(
    `%c[AI TIMING] ${stepName}: ${duration}s`, 
    "color: #ea580c; font-weight: bold; background: #fff3e0; padding: 2px 5px; border-radius: 4px;"
  );
  return performance.now();
};

/**
 * 辅助函数：将 URL 转换为 Base64
 * 增加了对大图的内存保护
 */
const getGeminiImageData = async (source: string): Promise<{ data: string; mimeType: string }> => {
  try {
    const res = await fetch(source);
    const blob = await res.blob();
    
    // 如果图片超过 3MB，在控制台发出警告，这通常是卡死的主因
    if (blob.size > 3 * 1024 * 1024) {
      console.warn("检测到超大图片 (" + (blob.size/1024/1024).toFixed(2) + "MB)，正在尝试转换...");
    }

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return { data: base64, mimeType: blob.type || 'image/jpeg' };
  } catch (e) {
    console.error("图片转换失败:", e);
    throw new Error("图片预处理失败，请尝试更换较小的图片。");
  }
};

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
      prompt: `${prompt}, professional studio product shot, white background, high quality`,
      strength: 0.85, 
      num_inference_steps: 18, 
      guidance_scale: 25,
      enable_safety_checker: false
    }
  });
  logStep("Flux 渲染完成", start);
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
  console.log("%c🚀 任务启动", "color: white; background: #ea580c; padding: 2px 8px; border-radius: 4px;");

  // --- 1. 豆包逻辑 (不保持长相) ---
  if (engine === 'doubao') {
    const openai = new OpenAI({ apiKey: DOUBAO_API_KEY, baseURL: "https://ark.cn-beijing.volces.com/api/v3", dangerouslyAllowBrowser: true });
    const response = await openai.images.generate({
      model: "doubao-seedream-4-5-251128",
      prompt: `A pet wearing ${description}. Solid white background.`,
    });
    return response.data[0]?.url || "";
  } 

  // --- 2. Google 联合逻辑 (串行化处理防止卡死) ---
  if (engine === 'google') {
    if (!GEMINI_API_KEY) throw new Error("GOOGLE_AUTH_ERROR");

    // 修改点 1：取消 Promise.all，改为串行执行。
    // 虽然理论上慢一点，但能保证浏览器不假死。
    const imgStart = performance.now();
    const imgData = await getGeminiImageData(petImageSource);
    logStep("步骤 1: 图片 Base64 转换完成", imgStart);

    const maskStart = performance.now();
    const maskUrl = await generatePetMask(petImageSource);
    logStep("步骤 2: SAM 遮罩获取完成", maskStart);

    const geminiStart = performance.now();
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const geminiPrompt = `Analyze pet. Replace body with: "${description}". White background. Keep head same.`;
    const result = await model.generateContent([
      { inlineData: { data: imgData.data, mimeType: imgData.mimeType } },
      { text: geminiPrompt }
    ]);
    const optimizedPrompt = result.response.text();
    logStep("步骤 3: Gemini 分析完成", geminiStart);

    const resUrl = await executeInpaint(petImageSource, maskUrl, optimizedPrompt);
    logStep("✨ 任务总计耗时", totalStart);
    return resUrl;
  }

  // --- 3. FAL 逻辑 ---
  const maskUrl = await generatePetMask(petImageSource);
  const finalUrl = await executeInpaint(petImageSource, maskUrl, description);
  logStep("✨ 任务总计耗时", totalStart);
  return finalUrl;
};
