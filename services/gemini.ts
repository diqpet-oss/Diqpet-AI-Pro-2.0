import OpenAI from "openai";
import { fal } from "@fal-ai/client";
import { GoogleGenerativeAI } from "@google/generative-ai";

// 环境变量获取
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const FAL_KEY = import.meta.env.VITE_FAL_KEY;
const DOUBAO_API_KEY = import.meta.env.VITE_DOUBAO_API_KEY;

/**
 * 调试辅助：在控制台打印带时间的步骤日志
 */
const logStep = (stepName: string, startTime: number) => {
  const duration = ((performance.now() - startTime) / 1000).toFixed(2);
  console.log(
    `%c[AI TIMING] ${stepName}: ${duration}s`, 
    "color: #ea580c; font-weight: bold; background: #fff3e0; padding: 2px 5px; border-radius: 4px;"
  );
  return performance.now(); // 返回当前时间作为下一步的起点
};

/**
 * 辅助函数：将 URL 转换为 Gemini 接受的 Base64 格式
 */
const getGeminiImageData = async (source: string): Promise<{ data: string; mimeType: string }> => {
  const res = await fetch(source);
  const blob = await res.blob();
  const base64 = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(blob);
  });
  return { data: base64, mimeType: blob.type || 'image/jpeg' };
};

/**
 * 内部函数：使用 SAM 自动生成宠物身体掩码 (Mask)
 */
async function generatePetMask(imageUrl: string): Promise<string> {
  const start = performance.now();
  fal.config({ credentials: FAL_KEY });
  
  try {
    const result: any = await fal.subscribe("fal-ai/sam", {
      input: {
        image_url: imageUrl,
        selection_type: "text",
        text_prompt: "the body of the animal, the torso, the clothing area", 
      }
    });
    
    const maskUrl = result?.masks?.[0]?.url;
    if (!maskUrl) throw new Error("Mask generation failed");
    logStep("SAM 遮罩生成完成", start);
    return maskUrl;
  } catch (error) {
    console.error("SAM Error:", error);
    throw new Error("无法识别宠物身体区域，请检查图片或 FAL_KEY 余额。");
  }
}

/**
 * 内部函数：执行 Flux 局部重绘 (Inpainting)
 */
async function executeInpaint(imageUrl: string, maskUrl: string, prompt: string): Promise<string> {
  const start = performance.now();
  
  // 核心优化：锁定白底，降低步数至 18 步以提速
  try {
    const result: any = await fal.subscribe("fal-ai/flux/dev/fill", {
      input: {
        image_url: imageUrl,
        mask_url: maskUrl,
        prompt: `${prompt}, professional studio product shot, plain solid white background, high quality, realistic`,
        strength: 0.85, 
        num_inference_steps: 18, 
        guidance_scale: 25,
        enable_safety_checker: false // 关闭安全检查可节省约 2-3 秒
      }
    });
    
    logStep("Flux 局部重绘渲染完成", start);
    return result?.images?.[0]?.url || "";
  } catch (error) {
    console.error("Flux Error:", error);
    throw new Error("Flux 渲染超时，可能是 Base64 图片过大或服务端拥堵。");
  }
}

/**
 * 主导出函数：AI 试衣间入口
 */
export const generateFitting = async (
  engine: 'doubao' | 'fal' | 'google', 
  petImageSource: string,
  description: string,
  style: string = 'Studio'
): Promise<string> => {
  const totalStart = performance.now();
  console.clear();
  console.log("%c🚀 开始 AI 试衣任务...", "color: #fff; background: #ea580c; padding: 4px 10px; border-radius: 5px;");

  // --- 1. 豆包逻辑 (原生生图 - 无法保持长相) ---
  if (engine === 'doubao') {
    const dbStart = performance.now();
    const openai = new OpenAI({
      apiKey: DOUBAO_API_KEY,
      baseURL: "https://ark.cn-beijing.volces.com/api/v3",
      dangerouslyAllowBrowser: true 
    });

    const response = await openai.images.generate({
      model: "doubao-seedream-4-5-251128",
      prompt: `Professional pet photography. A pet wearing ${description}. Solid white background. Photorealistic, 8k.`,
    });
    logStep("豆包生成完成 (注意：不保持原图长相)", dbStart);
    return response.data[0]?.url || "";
  } 

  // --- 2. Google + Fal 联合逻辑 (保持长相的最佳方案) ---
  else if (engine === 'google') {
    if (!GEMINI_API_KEY) throw new Error("GOOGLE_AUTH_ERROR");
    
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // A. 同时并行：Gemini 图片转换 + SAM 生成 Mask (节省 4-6 秒)
    const parallelStart = performance.now();
    const [imgData, maskUrl] = await Promise.all([
      getGeminiImageData(petImageSource),
      generatePetMask(petImageSource)
    ]);
    logStep("Gemini 预处理 & SAM 遮罩并行阶段", parallelStart);

    // B. Gemini 语义分析
    const geminiStart = performance.now();
    const geminiPrompt = `
      Analyze this pet image. 
      Task: Create a prompt for an inpainting model to replace its body with: "${description}".
      Identify the breed and fur texture to ensure the new clothing fits naturally.
      
      CRITICAL CONSTRAINTS:
      1. Background MUST be plain solid white (Studio shot).
      2. The output must focus strictly on the ${description}.
      3. Keep the animal's head and expression exactly as in the original.
    `;

    const result = await model.generateContent([
      { inlineData: { data: imgData.data, mimeType: imgData.mimeType } },
      { text: geminiPrompt }
    ]);

    const optimizedPrompt = result.response.text();
    logStep("Gemini 语义分析完成", geminiStart);

    // C. 执行重绘
    const finalUrl = await executeInpaint(petImageSource, maskUrl, optimizedPrompt);
    logStep("✨ 任务总计耗时", totalStart);
    return finalUrl;
  }

  // --- 3. 纯 Fal 逻辑 (快连方案) ---
  else {
    const falModeStart = performance.now();
    const maskUrl = await generatePetMask(petImageSource);
    const basicPrompt = `A professional photo of a pet wearing ${description}, plain white background, high quality.`;
    const finalUrl = await executeInpaint(petImageSource, maskUrl, basicPrompt);
    logStep("✨ 任务总计耗时", totalStart);
    return finalUrl;
  }
};
