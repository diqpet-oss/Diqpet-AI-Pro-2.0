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
    // 必须使用 v1beta 接口调用最新的 2.0 模型
    const model = genAI.getGenerativeModel(
      { model: "gemini-2.0-flash" },
      { apiVersion: "v1beta" }
    );

    try {
      const { data, mimeType } = await getGeminiImageData(petImageSource);
      const result = await model.generateContent([
        { inlineData: { data, mimeType } },
        { text: `Render this pet wearing: ${description}. Style: ${style}. Photorealistic, 8k.` }
      ]);

      const response = await result.response;
      // 注意：Gemini 2.0 目前主要通过文本返回或生成描述，
      // 如果 Gemini 无法直接生成图片文件，建议此处逻辑改为“生成描述后再传给 FAL”
      console.log("Gemini Response:", response.text());
      
      // 如果你的需求是“试穿”，Gemini 通常作为 Prompt 优化器
      // 这里暂时演示切换到 FAL 进行最终渲染
      return await generateFitting('fal', petImageSource, description, style);
    } catch (error: any) {
      if (error.message.includes("429")) throw new Error("Google API 配额超限，请稍后重试");
      throw new Error(`Google 逻辑失败: ${error.message}`);
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
