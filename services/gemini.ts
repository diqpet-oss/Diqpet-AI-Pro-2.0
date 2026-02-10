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
 * 图像处理：将 URL 转换为 Base64 (解决 ApiError 的关键)
 */
const getBase64Data = async (source: string): Promise<string> => {
  try {
    const res = await fetch(source);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    throw new Error("图片预处理失败，请检查网络连接");
  }
};

/**
 * 步骤 2: 模特轮廓提取
 * 修正方案：上传 Data URI 格式的图片，并对齐 SAM 2 接口参数
 */
async function generatePetMask(imageDataUri: string): Promise<string> {
  const start = performance.now();
  fal.config({ credentials: FAL_KEY });

  try {
    console.log("正在识别模特轮廓 (SAM 2)...");
    
    // 使用 fal.run 且直接传输 Base64 数据，避开 URL 读取限制
    const result: any = await fal.run("fal-ai/sam2", {
      input: {
        image_url: imageDataUri, // 传入 Base64
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
    
    // 自动回退方案：Fast-SAM
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
 * 步骤 4: Flux Fill 局部重绘
 */
async function executeInpaint(imageDataUri: string, maskUrl: string, prompt: string): Promise<string> {
  const start = performance.now();
  const result: any = await fal.subscribe("fal-ai/flux/dev/fill", {
    input: {
      image_url: imageDataUri,
      mask_url: maskUrl,
      prompt: `${prompt}, professional photography, white background`,
      strength: 0.85, 
      num_inference_steps: 20, 
      guidance_scale: 3.5
    }
  });
  logStep("步骤 4: Flux 渲染完成", start);
  return result?.images?.[0]?.url || "";
}

/**
 * 主逻辑
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

  // 预先将图片转为 Base64，确保后续所有 API 都能稳定读取
  const imageDataUri = await getBase64Data(petImageSource);

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

    // 1. 获取轮廓
    const maskUrl = await generatePetMask(imageDataUri);

    // 2. Gemini 视觉分析
    const geminiStart = performance.now();
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const geminiPrompt = `Analyze this pet. Generate an English inpainting prompt to replace the body with: "${description}". Background must be white. Output only the prompt text.`;

    const result = await model.generateContent([
      { inlineData: { data: imageDataUri.split(',')[1], mimeType: "image/jpeg" } },
      { text: geminiPrompt }
    ]);
    const optimizedPrompt = result.response.text();
    logStep("步骤 3: Gemini 视觉分析完成", geminiStart);

    // 3. 渲染
    const resUrl = await executeInpaint(imageDataUri, maskUrl, optimizedPrompt);
    logStep("✨ 全流程总计耗时", totalStart);
    return resUrl;
  }

  const maskUrl = await generatePetMask(imageDataUri);
  const finalUrl = await executeInpaint(imageDataUri, maskUrl, description);
  logStep("✨ 全流程总计耗时", totalStart);
  return finalUrl;
};
