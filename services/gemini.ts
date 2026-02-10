import OpenAI from "openai";
import { fal } from "@fal-ai/client";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const FAL_KEY = import.meta.env.VITE_FAL_KEY;
const DOUBAO_API_KEY = import.meta.env.VITE_DOUBAO_API_KEY;

/**
 * 调试日志助手：记录每一步的执行时间
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
 * 关键函数：将图片 URL 转换为 Data URI (Base64)
 * 解决 ApiError 的核心：直接把图片数据喂给 AI，不让它去下载远程 URL
 */
const toDataUri = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("本地转换图片失败:", e);
    throw new Error("无法读取图片数据，请检查网络或图片链接");
  }
};

/**
 * 步骤 2: 模特轮廓提取
 * 修正了 ApiError：改用 Data URI 上传，并精确对齐 SAM 2 接口参数
 */
async function generatePetMask(imageDataUri: string): Promise<string> {
  const start = performance.now();
  fal.config({ credentials: FAL_KEY });

  try {
    console.log("正在识别模特轮廓 (SAM 2)...");
    
    // SAM 2 核心调用逻辑：必须包含 selection_type: "text"
    const result: any = await fal.run("fal-ai/sam2", {
      input: {
        image_url: imageDataUri, // 直接发送 Base64 数据
        selection_type: "text", 
        prompt: "the body of the animal, including torso and legs",
        mask_limit: 1
      }
    });

    const maskUrl = result?.masks?.[0]?.url || result?.image?.url;
    if (!maskUrl) throw new Error("SAM 2 未返回有效遮罩");

    logStep("步骤 2: SAM 2 识别完成", start);
    return maskUrl;
  } catch (error: any) {
    console.warn("SAM 2 异常，正在尝试备选模型 Fast-SAM...", error);
    
    // 自动回退方案：如果 SAM 2 失败，尝试 Fast-SAM
    const fallback: any = await fal.run("fal-ai/fast-sam", {
      input: {
        image_url: imageDataUri,
        text_prompt: "the animal torso"
      }
    });
    const fallbackUrl = fallback?.masks?.[0]?.url;
    if (!fallbackUrl) throw new Error("所有识别模型均不可用");
    
    logStep("步骤 2: Fast-SAM 识别完成 (备选方案)", start);
    return fallbackUrl;
  }
}

/**
 * 步骤 4: Flux Fill 局部重绘渲染
 */
async function executeInpaint(imageDataUri: string, maskUrl: string, prompt: string): Promise<string> {
  const start = performance.now();
  const result: any = await fal.subscribe("fal-ai/flux/dev/fill", {
    input: {
      image_url: imageDataUri,
      mask_url: maskUrl,
      prompt: `${prompt}, professional photography, white background`,
      strength: 0.85, 
      num_inference_steps: 25, 
      guidance_scale: 3.5,
      enable_safety_checker: false
    }
  });
  logStep("步骤 4: Flux 渲染完成", start);
  return result?.images?.[0]?.url || "";
}

/**
 * 主工作流函数
 */
export const generateFitting = async (
  engine: 'doubao' | 'fal' | 'google', 
  petImageSource: string,
  description: string,
  style: string = 'Studio'
): Promise<string> => {
  const totalStart = performance.now();
  console.clear();
  console.log("%c🚀 任务启动", "color: white; background: #2563eb; padding: 2px 8px; border-radius: 4px;");

  // 1. 本地预处理：将图片转为 Base64，确保后面所有 API 调用都稳定
  const imageDataUri = await toDataUri(petImageSource);

  // 2. 豆包逻辑
  if (engine === 'doubao') {
    const openai = new OpenAI({ apiKey: DOUBAO_API_KEY, baseURL: "https://ark.cn-beijing.volces.com/api/v3", dangerouslyAllowBrowser: true });
    const response = await openai.images.generate({
      model: "doubao-seedream-4-5-251128",
      prompt: `A professional pet photo wearing ${description}, white background`,
    });
    return response.data[0]?.url || "";
  } 

  // 3. Google 联合逻辑
  if (engine === 'google') {
    if (!GEMINI_API_KEY) throw new Error("GOOGLE_AUTH_ERROR");

    // 获取轮廓
    const maskUrl = await generatePetMask(imageDataUri);

    // Gemini 2.0 Flash 视觉分析
    const geminiStart = performance.now();
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const base64Content = imageDataUri.split(',')[1];
    const geminiPrompt = `Analyze this pet. Goal: Keep the head identical. Generate an English inpainting prompt to replace the body with: "${description}". Use white background. Output ONLY the prompt text.`;

    const result = await model.generateContent([
      { inlineData: { data: base64Content, mimeType: "image/jpeg" } },
      { text: geminiPrompt }
    ]);
    const optimizedPrompt = result.response.text();
    logStep("步骤 3: Gemini 视觉分析完成", geminiStart);

    // 渲染
    const resUrl = await executeInpaint(imageDataUri, maskUrl, optimizedPrompt);
    logStep("✨ 全流程总计耗时", totalStart);
    return resUrl;
  }

  // 4. FAL 快速通道
  const maskUrl = await generatePetMask(imageDataUri);
  const finalUrl = await executeInpaint(imageDataUri, maskUrl, description);
  logStep("✨ 全流程总计耗时", totalStart);
  return finalUrl;
};
