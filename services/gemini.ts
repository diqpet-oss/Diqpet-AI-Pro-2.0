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
    
    // 关键修复：确保 genAI 只声明一次，并明确使用 v1beta 版本
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-flash" },
      { apiVersion: "v1beta" } 
    );
    
    // 关键修复：确保定义了 imageData，解决 "DATA IS NOT DEFINED" 错误
    const imageData = await getGeminiImageData(petImageSource);
    
    try {
      const result = await model.generateContent([
        { 
          inlineData: { 
            data: imageData.data, 
            mimeType: imageData.mimeType 
          } 
        },
        { text: `Based on this pet image, describe in detail how it would look wearing: ${description}. Keep it realistic.` }
      ]);
      
      const response = await result.response;
      console.log("Gemini Description:", response.text());
      
      engine = 'fal'; // 描述完成后切换到渲染引擎
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
