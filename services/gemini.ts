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
 * 关键函数：将图片 URL 转换为 Data URI (Base64)
 * 这能确保 FAL 和 Gemini 服务器直接收到数据，而不是去尝试下载可能失败的远程 URL
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
    console.error("图片转换 Data URI 失败:", e);
    throw new Error("无法加载宠物图片，请检查网络或图片链接");
  }
};

/**
 * 步骤 2: 模特轮廓提取
 * 修正了 ApiError：改用 Data URI 上传，并精确对齐 SAM 2 参数
 */
async function generatePetMask(imageDataUri: string): Promise<string> {
  const start = performance.now();
  fal.config({ credentials: FAL_KEY });

  try {
    console.log("正在识别模特轮廓 (SAM 2)...");
    
    const result: any = await fal.run("fal-ai/sam2", {
      input: {
        image_url: imageDataUri, // 直接发送 Base64 数据流
        selection_type: "text", 
        prompt: "the body of the animal, including torso and legs",
        mask_limit: 1
      }
    });

    const maskUrl = result?.masks?.[0]?.url || result?.image?.url;
    if (!maskUrl) throw new Error("SAM 2 未返回有效掩码");

    logStep("步骤 2: SAM 2 识别完成", start);
    return maskUrl;
  } catch (error: any) {
    console.warn("SAM 2 识别异常，尝试切换至 Fast-SAM...", error);
    
    // 自动备选方案：Fast-SAM
    const fallback: any = await fal.run("fal-ai/fast-sam", {
      input: {
        image_url: imageDataUri,
        text_prompt: "the torso of the animal"
      }
    });
    const fallbackUrl = fallback?.masks?.[0]?.url;
    if (!fallbackUrl) throw new Error("所有识别模型均不可用");
    
    logStep("步骤 2: Fast-SAM 识别完成 (备选方案)", start);
    return fallbackUrl;
  }
}

/**
 * 步骤 4: Flux Fill 局部重绘
 */
async function executeInpaint(imageDataUri: string, maskUrl: string, prompt: string): Promise<string> {
  const start = performance.now();
  const result: any = await fal.subscribe("fal-ai/flux/dev/fill", {
    input: {
      image_url: imageDataUri,
      mask_url: maskUrl,
      prompt: `${prompt}, professional photography, high-end studio lighting, white background`,
      strength: 0.85, 
      num_inference_steps: 25, 
      guidance_scale: 3.5,
      enable_safety_checker: false
    }
  });
  logStep("步骤 4: Flux 最终渲染完成", start);
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

  // 预处理：先转为 Base64，确保后面所有 API 调用都稳定
  const imageDataUri = await toDataUri(petImageSource);

  if (engine === 'doubao') {
    const openai = new OpenAI({ apiKey: DOUBAO_API_KEY, baseURL: "https://ark.cn-beijing.volces.com/api/v3", dangerouslyAllowBrowser: true });
    const response = await openai.images.generate({
      model: "doubao-seedream-4-5-251128",
      prompt: `A high quality photo of a pet wearing ${description}, white background`,
    });
    return response.data[0]?.url || "";
  } 

  if (engine === 'google') {
    if (!GEMINI_API_KEY) throw new Error("GOOGLE_AUTH_ERROR");

    // 1. 获取遮罩
    const maskUrl = await generatePetMask(imageDataUri);

    // 2. Gemini 2.0 Flash 视觉分析
    const geminiStart = performance.now();
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // 从 Data URI 中提取纯 Base64 字符串
    const base64Content = imageDataUri.split(',')[1];

    const geminiPrompt = `Analyze this pet. Goal: Keep the head/breed identical. Replace the body with: "${description}". The final output MUST have a studio white background. Generate a concise English prompt for image inpainting. Output only the prompt.`;

    const result = await model.generateContent([
      { inlineData: { data: base64Content, mimeType: "image/jpeg" } },
      { text: geminiPrompt }
    ]);
    const optimizedPrompt = result.response.text();
    logStep("步骤 3: Gemini 视觉分析完成", geminiStart);

    // 3. 执行最终渲染
    const resUrl = await executeInpaint(imageDataUri, maskUrl, optimizedPrompt);
    logStep("✨ 全流程总计耗时", totalStart);
    return resUrl;
  }

  // FAL 快速模式
  const maskUrl = await generatePetMask(imageDataUri);
  const finalUrl = await executeInpaint(imageDataUri, maskUrl, description);
  logStep("✨ 全流程总计耗时", totalStart);
  return finalUrl;
};
