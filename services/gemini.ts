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
 * 图像预处理
 */
const getGeminiImageData = async (source: string): Promise<{ data: string; mimeType: string }> => {
  try {
    const res = await fetch(source);
    const blob = await res.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return { data: base64, mimeType: blob.type || 'image/jpeg' };
  } catch (e) {
    console.error("图片转换失败:", e);
    throw new Error("图片预处理失败，请检查网络连接");
  }
};

/**
 * 步骤 2: 模特轮廓提取
 * 修复了 ApiError：添加了 selection_type 并设置了备选模型逻辑
 */
async function generatePetMask(imageUrl: string): Promise<string> {
  const start = performance.now();
  fal.config({ credentials: FAL_KEY });

  try {
    console.log("正在通过 SAM 2 识别宠物轮廓...");
    
    // SAM 2 核心调用逻辑：必须包含 selection_type: "text"
    const result: any = await fal.run("fal-ai/sam2", {
      input: {
        image_url: imageUrl,
        selection_type: "text", 
        prompt: "the body of the animal, excluding the head",
        mask_limit: 1
      }
    });

    const maskUrl = result?.masks?.[0]?.url || result?.image?.url;
    if (!maskUrl) throw new Error("SAM 2 未返回有效掩码");

    logStep("步骤 2: SAM 2 识别完成", start);
    return maskUrl;
  } catch (error: any) {
    console.warn("SAM 2 报错，正在尝试备选模型 Fast-SAM...", error);
    
    // 自动回退逻辑：如果 SAM 2 失败，尝试更稳健的 Fast-SAM
    try {
      const fallbackResult: any = await fal.run("fal-ai/fast-sam", {
        input: {
          image_url: imageUrl,
          text_prompt: "the torso of the animal"
        }
      });
      const fallbackUrl = fallbackResult?.masks?.[0]?.url;
      if (!fallbackUrl) throw new Error("备选模型也未生成掩码");
      
      logStep("步骤 2: Fast-SAM 识别完成 (备选方案)", start);
      return fallbackUrl;
    } catch (fallbackError) {
      console.error("所有识别模型均失败:", fallbackError);
      throw new Error("识别服务异常 (ApiError)，请确认 VPN 节点是否为美国全局模式");
    }
  }
}

/**
 * 步骤 4: Flux Fill 局部重绘渲染
 */
async function executeInpaint(imageUrl: string, maskUrl: string, prompt: string): Promise<string> {
  const start = performance.now();
  const result: any = await fal.subscribe("fal-ai/flux/dev/fill", {
    input: {
      image_url: imageUrl,
      mask_url: maskUrl,
      prompt: `${prompt}, professional photography, high-quality pet fashion, white background`,
      strength: 0.85, 
      num_inference_steps: 20, 
      guidance_scale: 3.5,
      enable_safety_checker: false
    }
  });
  logStep("步骤 4: Flux 渲染完成", start);
  return result?.images?.[0]?.url || "";
}

/**
 * 主工作流函数
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

  // 1. 豆包逻辑
  if (engine === 'doubao') {
    const openai = new OpenAI({ apiKey: DOUBAO_API_KEY, baseURL: "https://ark.cn-beijing.volces.com/api/v3", dangerouslyAllowBrowser: true });
    const response = await openai.images.generate({
      model: "doubao-seedream-4-5-251128",
      prompt: `A professional pet photo wearing ${description}, white background`,
    });
    return response.data[0]?.url || "";
  } 

  // 2. Google 联合逻辑
  if (engine === 'google') {
    if (!GEMINI_API_KEY) throw new Error("GOOGLE_AUTH_ERROR");

    // 第一步：图片转换
    const imgData = await getGeminiImageData(petImageSource);
    logStep("步骤 1: 图片转换完成", performance.now());

    // 第二步：轮廓识别
    const maskUrl = await generatePetMask(petImageSource);

    // 第三步：Gemini 2.0 视觉分析
    const geminiStart = performance.now();
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const geminiPrompt = `Analyze this pet photo. Action: Keep the head and breed identical. Generate an English inpainting prompt to replace the body with: "${description}". Ensure a studio white background. Output only the prompt text.`;

    const result = await model.generateContent([
      { inlineData: { data: imgData.data, mimeType: imgData.mimeType } },
      { text: geminiPrompt }
    ]);
    const optimizedPrompt = result.response.text();
    logStep("步骤 3: Gemini 视觉分析完成", geminiStart);

    // 第四步：执行渲染
    const resUrl = await executeInpaint(petImageSource, maskUrl, optimizedPrompt);
    logStep("✨ 全流程总计耗时", totalStart);
    return resUrl;
  }

  // 3. FAL 快速通道
  const maskUrl = await generatePetMask(petImageSource);
  const finalUrl = await executeInpaint(petImageSource, maskUrl, description);
  logStep("✨ 全流程总计耗时", totalStart);
  return finalUrl;
};
