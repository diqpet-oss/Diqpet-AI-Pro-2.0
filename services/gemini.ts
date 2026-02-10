import { GoogleGenerativeAI } from "@google/generative-ai";
import { fal } from "@fal-ai/client";

// 1. 修正环境变量获取方式 (Vite 规范)
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const FAL_KEY = import.meta.env.VITE_FAL_KEY; 

/**
 * 处理图片数据转换为 Gemini 识别的格式
 */
const getGeminiImageData = async (source: string) => {
  if (source.startsWith('data:')) {
    const [mimePart, dataPart] = source.split(',');
    const mimeType = mimePart.match(/:(.*?);/)?.[1] || 'image/jpeg';
    return { data: dataPart, mimeType };
  }
  const res = await fetch(source);
  const blob = await res.blob();
  const base64 = await new Promise<string>((r) => {
    const reader = new FileReader();
    reader.onloadend = () => r((reader.result as string).split(',')[1]);
    reader.readAsDataURL(blob);
  });
  return { data: base64, mimeType: blob.type || 'image/jpeg' };
};

export const generateFitting = async (
  engine: 'doubao' | 'fal' | 'google', 
  petImageSource: string,
  description: string
): Promise<string> => {
  
  // --- Google Gemini 逻辑 ---
  if (engine === 'google') {
    if (!GEMINI_API_KEY) throw new Error("VITE_GEMINI_API_KEY is not set in Vercel.");
    
// 找到这一行：
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// 替换为（明确指定 apiVersion）:
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel(
  { model: "gemini-1.5-flash" },
  { apiVersion: "v1" } // 强制指定 v1 版本，不再走 v1beta
);
    
    // 注意：Gemini 1.5 主要返回文本描述。
    // 如果你要做“试穿”效果，通常是让 Gemini 生成详细 Prompt 再传给图像引擎，
    // 或者目前直接使用 Fal.ai 的 Image-to-Image。
    const result = await model.generateContent([
      { inlineData: { data, mimeType } },
      { text: `Based on this pet image, describe in detail how it would look wearing: ${description}. Keep it realistic.` }
    ]);
    
    const response = await result.response;
    console.log("Gemini Description:", response.text());
    
    // 如果你没有接入专门的图片生成模型，暂时让 Gemini 驱动 Fal.ai 进行渲染
    engine = 'fal'; 
  }

  // --- Fal.ai 逻辑 (真正的图片生成) ---
  if (engine === 'fal') {
    if (!FAL_KEY) throw new Error("VITE_FAL_KEY is not set in Vercel.");
    
    fal.config({ credentials: FAL_KEY });
    
    try {
      const result: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: {
          image_url: petImageSource,
          prompt: `A professional studio photograph of the pet from the source image, but now wearing ${description}. High resolution, 8k, realistic fur and fabric texture, perfect fit.`,
          strength: 0.65, // 保持宠物特征的平衡点
          guidance_scale: 7.5
        }
      });
      return result.images?.[0]?.url || "";
    } catch (error: any) {
      throw new Error(`Fal.ai Error: ${error.message}`);
    }
  }

  return "";
};
