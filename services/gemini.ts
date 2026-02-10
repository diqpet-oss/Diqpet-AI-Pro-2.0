import OpenAI from "openai";
import { fal } from "@fal-ai/client";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const FAL_KEY = import.meta.env.VITE_FAL_KEY;
const DOUBAO_API_KEY = import.meta.env.VITE_DOUBAO_API_KEY;

/**
 * 调试日志助手
 */
const logStep = (stepName: string, startTime: number) => {
  const duration = ((performance.now() - startTime) / 1000).toFixed(2);
  console.log(
    `%c[AI TIMING] ${stepName}: ${duration}s`, 
    "color: #ea580c; font-weight: bold; background: #fff3e0; padding: 2px 5px; border-radius: 4px;"
  );
  return performance.now();
};

/**
 * 图像处理逻辑
 */
const getGeminiImageData = async (source: string): Promise<{ data: string; mimeType: string }> => {
  try {
    const res = await fetch(source);
    const blob = await res.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return { data: base64, mimeType: blob.type || 'image/jpeg' };
  } catch (e) {
    console.error("图片转换失败:", e);
    throw new Error("图片转换失败，请检查网络");
  }
};

/**
 * 步骤 2: 修正后的 SAM 2 识别 [使用 fal.run 替代 subscribe]
 */
async function generatePetMask(imageUrl: string): Promise<string> {
  const start = performance.now();
  fal.config({ credentials: FAL_KEY });

  try {
    console.log("正在识别模特轮廓 (SAM 2)...");
    
    // 关键修正：SAM 2 的参数是 'prompt' 而不是 'text_prompt'
    // 关键修正：使用 fal.run 模式，解决 ApiError 导致的订阅失败
    const result: any = await fal.run("fal-ai/sam2", {
      input: {
        image_url: imageUrl,
        prompt: "the full body of the animal, everything except the head",
        mask_limit: 1
      }
    });

    // 适配 SAM 2 返回的对象结构
    const maskUrl = result?.masks?.[0]?.url || result?.image?.url;
    
    if (!maskUrl) {
      console.warn("SAM 2 返回结果中没有掩码 URL:", result);
      throw new Error("识别成功但未生成遮罩图");
    }

    logStep("步骤 2: SAM 2 识别完成", start);
    return maskUrl;
  } catch (error: any) {
    console.error("SAM 2 报错详情:", error);
    throw new Error("识别服务异常: " + (error.message || "ApiError"));
  }
}

/**
 * 步骤 4: Flux Fill 局部重绘
 */
async function executeInpaint(imageUrl: string, maskUrl: string, prompt: string): Promise<string> {
  const start = performance.now();
  // 注意：Fill 逻辑依然建议使用 subscribe 以获取进度
  const result: any = await fal.subscribe("fal-ai/flux/dev/fill", {
    input: {
      image_url: imageUrl,
      mask_url: maskUrl,
      prompt: `${prompt}, high-end product shot, studio lighting, solid white background`,
      strength: 0.85, 
      num_inference_steps: 20, 
      guidance_scale: 3.5,
      enable_safety_checker: false
    }
  });
  logStep("步骤 4: Flux 渲染完成", start);
  return result?.images?.[0]?.url || "";
}

/**
 * 主逻辑入口
 */
export const generateFitting = async (
  engine: 'doubao' | 'fal' | 'google', 
  petImageSource: string,
  description: string,
  style: string = 'Studio'
): Promise<string> => {
  const totalStart = performance.now();
  console.clear();
  console.log("%c🚀 任务启动: " + engine.toUpperCase(), "color: white; background: #2563eb; padding: 2px 8px; border-radius: 4px;");

  if (engine === 'doubao') {
    const openai = new OpenAI({ apiKey: DOUBAO_API_KEY, baseURL: "https://ark.cn-beijing.volces.com/api/v3", dangerouslyAllowBrowser: true });
    const response = await openai.images.generate({
      model: "doubao-seedream-4-5-251128",
      prompt: `A professional pet photo wearing ${description}, white background`,
    });
    return response.data[0]?.url || "";
  } 

  if (engine === 'google') {
    if (!GEMINI_API_KEY) throw new Error("GOOGLE_AUTH_ERROR");

    // 1. 处理图片
    const imgData = await getGeminiImageData(petImageSource);
    logStep("步骤 1: 图片转换完成", performance.now());

    // 2. 识别遮罩
    const maskUrl = await generatePetMask(petImageSource);

    // 3. AI 分析
    const geminiStart = performance.now();
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const geminiPrompt = `Analyze this pet. Keep the head identical. Generate an inpainting prompt to replace the body with: "${description}". The background MUST be pure white. Output only the prompt text.`;

    const result = await model.generateContent([
      { inlineData: { data: imgData.data, mimeType: imgData.mimeType } },
      { text: geminiPrompt }
    ]);
    const optimizedPrompt = result.response.text();
    logStep("步骤 3: Gemini 视觉分析完成", geminiStart);

    // 4. 渲染
    const resUrl = await executeInpaint(petImageSource, maskUrl, optimizedPrompt);
    logStep("✨ 全流程总计耗时", totalStart);
    return resUrl;
  }

  // FAL 快速通道
  const maskUrl = await generatePetMask(petImageSource);
  const finalUrl = await executeInpaint(petImageSource, maskUrl, description);
  logStep("✨ 全流程总计耗时", totalStart);
  return finalUrl;
};
