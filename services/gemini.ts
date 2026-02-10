import { GoogleGenerativeAI } from "@google/generative-ai";
import { fal } from "@fal-ai/client";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const FAL_KEY = import.meta.env.VITE_FAL_KEY; 

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
  
  if (engine === 'google') {
    if (!GEMINI_API_KEY) throw new Error("VITE_GEMINI_API_KEY is not set in Vercel.");
    
    // 修复：确保 genAI 只声明一次
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-flash" },
      { apiVersion: "v1" } // 解决 404 问题的关键
    );
    
    // 修复：确保获取图片数据并正确命名变量
    const imageData = await getGeminiImageData(petImageSource);
    
    try {
      const result = await model.generateContent([
        { 
          inlineData: { 
            data: imageData.data, // 引用 imageData 下的 data
            mimeType: imageData.mimeType 
          } 
        },
        { text: `Based on this pet image, describe in detail how it would look wearing: ${description}. Keep it realistic.` }
      ]);
      
      const response = await result.response;
      console.log("Gemini Description:", response.text());
      
      // 逻辑流转：Gemini 生成描述后交给 fal 渲染图片
      engine = 'fal'; 
    } catch (error: any) {
      throw new Error(`Gemini Error: ${error.message}`);
    }
  }

  if (engine === 'fal') {
    if (!FAL_KEY) throw new Error("VITE_FAL_KEY is not set in Vercel.");
    
    fal.config({ credentials: FAL_KEY });
    
    try {
      const result: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: {
          image_url: petImageSource,
          prompt: `A professional studio photograph of the pet from the source image, but now wearing ${description}. High resolution, 8k, realistic fur and fabric texture, perfect fit.`,
          strength: 0.65,
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
