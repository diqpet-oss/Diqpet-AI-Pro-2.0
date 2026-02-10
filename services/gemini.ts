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
    
    // --- 修正点：移除 apiVersion 选项，直接获取模型 ---
    // SDK 会根据模型名称自动选择最稳定的 API 路径
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash" 
    });

    try {
      const { data, mimeType } = await getGeminiImageData(petImageSource);
      
      const prompt = `
        Analyze this pet image and the following clothing description: "${description}".
        Generate a highly detailed, technical image-to-image prompt for an AI artist.
        Style: ${style}. 
        Requirements: Keep the original pet's face and breed, but replace its torso with the described clothing.
        High resolution, cinematic lighting, photorealistic.
      `;

      // 执行内容生成
      const result = await model.generateContent([
        { inlineData: { data, mimeType } },
        { text: prompt }
      ]);

      const response = await result.response;
      const optimizedPrompt = response.text();
      
      console.log("Gemini Optimized Prompt:", optimizedPrompt);
      
      // 继续交给 FAL 渲染
      return await generateFitting('fal', petImageSource, optimizedPrompt, style);
      
    } catch (error: any) {
      // 捕获 404 或 429 错误并给出清晰提示
      if (error.message?.includes("404")) {
        throw new Error("Google 模型路径配置错误，请尝试使用 gemini-1.5-flash-latest 或切换引擎");
      }
      if (error.message?.includes("429")) {
        throw new Error("Google API 免费额度已耗尽，请切换至 'DOUBAO' 或 'FAL'");
      }
      throw new Error(`Google 引擎异常: ${error.message}`);
    }
  }


 // 3. Fal.ai Flux 引擎
  else {
    fal.config({ credentials: FAL_KEY });
    try {
      // 使用 subscribe 调用 image-to-image 模型
      const result: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: {
          image_url: petImageSource, 
          // 增强的 Prompt，确保 AI 理解是给宠物穿衣服
          prompt: `A professional photo of a dog wearing ${description}. The dog is in a ${style} setting. The outfit fits perfectly on the pet body, maintaining original pet head and features, 8k resolution, highly detailed fashion photography.`,
          // 降低强度到 0.55，防止宠物长相走样
          strength: 0.55, 
          response_format: "url"
        }
      });

      // 调试输出，如果还是空，可以在浏览器控制台看这个 Log
      console.log("FAL 完整响应:", result);

      // 兼容性取值：尝试多种可能的路径获取 URL
      const imageUrl = result?.images?.[0]?.url || result?.image?.url || "";
      
      if (!imageUrl) {
        throw new Error("FAL 引擎未返回有效图片地址");
      }

      return imageUrl;

    } catch (err: any) {
      console.error("FAL 详细错误:", err);
      if (err.message?.includes("402")) {
        throw new Error("FAL.ai 账户余额不足，请充值");
      }
      throw new Error(`渲染失败: ${err.message}`);
    }
  }
};
