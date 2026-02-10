import OpenAI from "openai";
import { fal } from "@fal-ai/client";
import { GoogleGenerativeAI } from "@google/generative-ai";

// 环境变量获取
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const FAL_KEY = import.meta.env.VITE_FAL_KEY;
const DOUBAO_API_KEY = import.meta.env.VITE_DOUBAO_API_KEY;

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
 * 这是实现“长相不变”的核心：只对身体区域进行重绘
 */
async function generatePetMask(imageUrl: string): Promise<string> {
  fal.config({ credentials: FAL_KEY });
  
  try {
    const result: any = await fal.subscribe("fal-ai/sam", {
      input: {
        image_url: imageUrl,
        selection_type: "text",
        // 精准定位：只选择躯干和服装区域，避开头部
        text_prompt: "the body of the animal, the torso, the clothing area", 
      }
    });
    
    const maskUrl = result?.masks?.[0]?.url;
    if (!maskUrl) throw new Error("Mask generation failed");
    return maskUrl;
  } catch (error) {
    console.error("SAM Error:", error);
    throw new Error("无法识别宠物身体区域，请检查图片。");
  }
}

/**
 * 内部函数：执行 Flux 局部重绘 (Inpainting)
 */

async function executeInpaint(imageUrl: string, maskUrl: string, productDesc: string): Promise<string> {
  // 强制白底/简约背景的提示词，减少 AI 思考环境的时间
  const cleanPrompt = `A professional studio product shot of a pet wearing ${productDesc}, standing on a plain solid white background, high quality, realistic.`;

  const result: any = await fal.subscribe("fal-ai/flux/dev/fill", {
    input: {
      image_url: imageUrl,
      mask_url: maskUrl,
      prompt: cleanPrompt,
      strength: 0.85, 
      // 💡 关键提速：将步数降至 15-20，白底图不需要太多细节迭代
      num_inference_steps: 18, 
      guidance_scale: 20,
      // 这里的尺寸可以根据原图比例微调，保持默认即可
    }
  });
  
  return result?.images?.[0]?.url || "";
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
  
  // --- 1. 豆包逻辑 (原生生图) ---
  if (engine === 'doubao') {
    const openai = new OpenAI({
      apiKey: DOUBAO_API_KEY,
      baseURL: "https://ark.cn-beijing.volces.com/api/v3",
      dangerouslyAllowBrowser: true 
    });

    const response = await openai.images.generate({
      model: "doubao-seedream-4-5-251128",
      prompt: `Professional pet photography. A pet wearing ${description}. Background: ${style}. Photorealistic, 8k.`,
    });
    return response.data[0]?.url || "";
  } 

  // --- 2. Google + Fal 联合逻辑 (真正的局部换装) ---
  else if (engine === 'google') {
    if (!GEMINI_API_KEY) throw new Error("GOOGLE_AUTH_ERROR");
    
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // A. 同时并行：Gemini 分析图像 + SAM 生成 Mask
    const [{ data, mimeType }, maskUrl] = await Promise.all([
      getGeminiImageData(petImageSource),
      generatePetMask(petImageSource)
    ]);

    // B. Gemini 优化 Prompt：提取品种特征并描述新衣服
    const geminiPrompt = `
      Analyze this pet image. 
      Task: Create a prompt for an inpainting model to replace its body with: "${description}".
      Identify the breed and fur texture to ensure the new clothing fits naturally around the neck and limbs.
      Original Style: ${style}.
      Constraint: Ensure the output focuses on the fabric of the ${description} while keeping the head identical.
    `;

    const result = await model.generateContent([
      { inlineData: { data, mimeType } },
      { text: geminiPrompt }
    ]);

    const optimizedPrompt = result.response.text();

    // C. 执行重绘
    return await executeInpaint(petImageSource, maskUrl, optimizedPrompt);
  }

  // --- 3. 纯 Fal 逻辑 ---
  else {
    const maskUrl = await generatePetMask(petImageSource);
    const basicPrompt = `A professional photo of a pet wearing ${description}, ${style} background, high quality.`;
    return await executeInpaint(petImageSource, maskUrl, basicPrompt);
  }
};
