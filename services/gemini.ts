import OpenAI from "openai";
import { fal } from "@fal-ai/client";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ... 原有的环境变量和辅助函数保持不变 ...

export const generateFitting = async (
  engine: 'doubao' | 'fal' | 'google', 
  petImageSource: string,
  description: string,
  style: string = 'Studio'
): Promise<string> => {
  
  // --- 1. 豆包逻辑 (保持原样，因为豆包 API 目前对 Inpainting 的封装较闭塞) ---
  if (engine === 'doubao') {
    // ... 原有逻辑 ...
  } 

  // --- 2. Google + Fal 联合逻辑 (最高质量方案) ---
  else if (engine === 'google') {
    if (!GEMINI_API_KEY) throw new Error("GOOGLE_AUTH_ERROR");
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    try {
      const { data, mimeType } = await getGeminiImageData(petImageSource);
      
      // 让 Gemini 生成一个极其精准的描述，重点在于“保留头部，重绘身体”
      const prompt = `
        Context: I'm doing an AI pet try-on. 
        Pet Image Analysis: Describe the pet's breed, fur texture, and color in detail.
        Task: Create a prompt for an Inpainting model to replace the pet's body clothing with: "${description}".
        Instruction: Explicitly state that the head, eyes, and facial features must remain IDENTICAL to the original. 
        Focus on the fabric texture of the ${description} and ${style} background.
      `;

      const result = await model.generateContent([
        { inlineData: { data, mimeType } },
        { text: prompt }
      ]);

      const optimizedPrompt = (await result.response).text();
      
      // 核心改变：调用 Fal 的 Inpainting 逻辑
      return await executeFalInpaint(petImageSource, optimizedPrompt);
      
    } catch (error: any) {
      // ... 错误处理 ...
    }
  }

  // --- 3. 直接调用 Fal 逻辑 ---
  else {
    return await executeFalInpaint(petImageSource, `A professional pet photo, wearing ${description}, ${style} background, highly detailed.`);
  }
};

/**
 * 核心：执行局部重绘逻辑
 * 使用 Fal.ai 的 Flux Fill 模型实现真正的身份保持
 */
async function executeFalInpaint(imageUrl: string, prompt: string): Promise<string> {
  fal.config({ credentials: FAL_KEY });

  try {
    // 第一步：自动生成 Mask (使用 Segment Anything)
    // 注意：这里假设使用 fal-ai/sam 或者是 Flux Fill 自带的自动掩码功能
    // 为了代码简洁，我们直接调用支持 Auto-Mask 或传入特定 Mask 的模型
    
    const result: any = await fal.subscribe("fal-ai/flux/dev/fill", {
      input: {
        image_url: imageUrl,
        prompt: prompt,
        // 关键：我们需要告诉 AI 哪里是需要改变的。
        // 如果没有手动 Mask，Flux Fill 也可以根据 Prompt 尝试识别，
        // 但最稳妥是配合一个生成的 mask_url。
        // 这里演示 Flux Fill 的标准用法：
        mask_url: await generatePetBodyMask(imageUrl), 
        strength: 0.95, // 在 Mask 区域内，我们可以放心调高强度
        guidance_scale: 3.5,
        num_inference_steps: 30,
      }
    });

    return result?.images?.[0]?.url || "";
  } catch (err: any) {
    throw new Error(`局部重绘失败: ${err.message}`);
  }
}

/**
 * 辅助：使用 SAM (Segment Anything) 自动提取宠物身体作为 Mask
 */
async function generatePetBodyMask(targetImageUrl: string): Promise<string> {
  // 调用 Fal 的 Segment Anything 模型
  // 逻辑：识别 "the body of the animal excluding the head"
  const samResult: any = await fal.subscribe("fal-ai/sam", {
    input: {
      image_url: targetImageUrl,
      selection_type: "text",
      text_prompt: "the body of the animal, clothing area", // 避开 head
    }
  });
  
  return samResult?.masks?.[0]?.url || ""; 
}
