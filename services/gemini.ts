import OpenAI from "openai";
import { fal } from "@fal-ai/client";
import { GoogleGenerativeAI } from "@google/generative-ai"; // 修正包名

// 环境变量获取 (确保在 Vercel 中已配置这些 Key)
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const FAL_KEY = import.meta.env.VITE_FAL_KEY;
const DOUBAO_API_KEY = import.meta.env.VITE_DOUBAO_API_KEY; 

/**
 * 辅助函数：将 URL 转换为 Gemini 接受的 Base64
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

export const generateFitting = async (
  engine: 'doubao' | 'fal' | 'google', 
  petImageSource: string,
  description: string,
  style: string = 'Studio'
): Promise<string> => {
  
  // 1. 豆包逻辑
  if (engine === 'doubao') {
    const openai = new OpenAI({
      apiKey: DOUBAO_API_KEY,
      baseURL: "https://ark.cn-beijing.volces.com/api/v3",
      dangerouslyAllowBrowser: true 
    });

    try {
      const response = await openai.images.generate({
        model: "doubao-seedream-4-5-251128",
        prompt: `专业宠物摄影。一只宠物穿着：${description}。背景：${style}。写实，8k精细画质。`,
        size: "2048x2048" as any,
      });
      return response.data[0]?.url || "";
    } catch (error: any) {
      throw new Error(`豆包生图失败: ${error.message}`);
    }
  } 

  // 2. Google Gemini 逻辑
  else if (engine === 'google') {
    if (!GEMINI_API_KEY) throw new Error("GOOGLE_AUTH_ERROR");

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    // --- 修改点 1: 切换到更轻量的 1.5-flash，它的免费配额比 2.0 高得多 ---
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-flash" } // 1.5-flash 是目前最稳定且配额最足的
    );

    try {
      const { data, mimeType } = await getGeminiImageData(petImageSource);
      
      // --- 修改点 2: 优化 Prompt，让 Gemini 作为一个精准的“试衣指令翻译官” ---
      const prompt = `
        Analyze this pet image and the following clothing description: "${description}".
        Generate a highly detailed, technical image-to-image prompt for an AI artist.
        Style: ${style}. 
        Requirements: Keep the original pet's face and breed, but replace its torso with the described clothing.
        High resolution, cinematic lighting, photorealistic.
      `;

      const result = await model.generateContent([
        { inlineData: { data, mimeType } },
        { text: prompt }
      ]);

      const response = await result.response;
      const optimizedPrompt = response.text();
      
      console.log("Gemini Optimized Prompt:", optimizedPrompt);
      
      // --- 修改点 3: 将 Gemini 生成的“专业描述”传给 FAL 进行绘图 ---
      // 这样即便 Gemini 免费版有限制，Flash 模型也能抗住更多请求
      return await generateFitting('fal', petImageSource, optimizedPrompt, style);
      
    } catch (error: any) {
      // --- 修改点 4: 增加更详细的错误捕获 ---
      if (error.message?.includes("429")) {
        throw new Error("Google API 免费额度已耗尽。请在上方切换至 'DOUBAO' 或 'FAL' 引擎继续使用。");
      }
      throw new Error(`Google 引擎暂不可用: ${error.message}`);
    }
  }

  // 3. Fal.ai Flux 引擎
  else {
    fal.config({ credentials: FAL_KEY });
    try {
      const result: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: {
          image_url: petImageSource, 
          prompt: `High-end pet fashion, wearing ${description}, ${style} background, 8k photorealistic`,
          strength: 0.65, 
        }
      });
      return result?.images?.[0]?.url || "";
    } catch (err: any) {
      throw new Error(`Fal.ai 错误: ${err.message}`);
    }
  }
};
