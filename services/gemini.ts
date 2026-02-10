import OpenAI from "openai";
import { fal } from "@fal-ai/client";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const FAL_KEY = import.meta.env.VITE_FAL_KEY;
const DOUBAO_API_KEY = import.meta.env.VITE_DOUBAO_API_KEY;

/**
 * 调试日志助手：记录每一步的执行时间
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
 * 图片处理：将图片 URL 转换为 Gemini 能够识别的 Base64 数据
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
 * 步骤 2: 使用 SAM 2 提取宠物轮廓
 * 采用 fal.run 模式，比 subscribe 更能抵抗 VPN 抖动导致的 ApiError
 */
async function generatePetMask(imageUrl: string): Promise<string> {
  const start = performance.now();
  fal.config({ credentials: FAL_KEY });

  try {
    console.log("正在通过 SAM 2 识别宠物轮廓...");
    
    // 使用 fal.run 替代 fal.subscribe，直接获取结果
    const result: any = await fal.run("fal-ai/sam2", {
      input: {
        image_url: imageUrl,
        prompt: "the full body of the animal, excluding the head", // SAM 2 的核心识别指令
        mask_limit: 1
      }
    });

    // 适配 SAM 2 返回的字段结构
    const maskUrl = result?.masks?.[0]?.url || result?.image?.url;
    
    if (!maskUrl) {
      throw new Error("识别成功但未获得有效遮罩图");
    }

    logStep("步骤 2: SAM 2 遮罩获取完成", start);
    return maskUrl;
  } catch (error: any) {
    console.error("SAM API 详情:", error);
    // 针对 ApiError 提供更友好的提示
    throw new Error(error.message?.includes("ApiError") 
      ? "识别服务配置错误，请尝试切换至美国 VPN 节点" 
      : "宠物识别超时，请刷新重试");
  }
}

/**
 * 步骤 4: 使用 Flux.1 Dev Fill 进行精准穿衣渲染
 */
async function executeInpaint(imageUrl: string, maskUrl: string, prompt: string): Promise<string> {
  const start = performance.now();
  const result: any = await fal.subscribe("fal-ai/flux/dev/fill", {
    input: {
      image_url: imageUrl,
      mask_url: maskUrl,
      prompt: `${prompt}, professional photography, high-end pet fashion, white background, ultra-detailed`,
      strength: 0.85, 
      num_inference_steps: 25, // 增加步数以获得更高画质
      guidance_scale: 3.5,
      enable_safety_checker: false
    }
  });
  logStep("步骤 4: Flux 最终渲染完成", start);
  return result?.images?.[0]?.url || "";
}

/**
 * 主工作流入口
 */
export const generateFitting = async (
  engine: 'doubao' | 'fal' | 'google', 
  petImageSource: string,
  description: string,
  style: string = 'Studio'
): Promise<string> => {
  const totalStart = performance.now();
  console.clear();
  console.log("%c🚀 任务启动: " + engine.toUpperCase(), "color: white; background: #2563eb; padding: 2px 8px; border-radius: 4px;");

  // --- 引擎 1: 豆包 ---
  if (engine === 'doubao') {
    const openai = new OpenAI({ apiKey: DOUBAO_API_KEY, baseURL: "https://ark.cn-beijing.volces.com/api/v3", dangerouslyAllowBrowser: true });
    const response = await openai.images.generate({
      model: "doubao-seedream-4-5-251128",
      prompt: `A high quality photo of a pet wearing ${description}, white background`,
    });
    return response.data[0]?.url || "";
  } 

  // --- 引擎 2: Google + FAL 联合逻辑 (推荐模式) ---
  if (engine === 'google') {
    if (!GEMINI_API_KEY) throw new Error("GOOGLE_AUTH_ERROR");

    // 1. 转换图片
    const imgStart = performance.now();
    const imgData = await getGeminiImageData(petImageSource);
    logStep("步骤 1: 基础图片处理完成", imgStart);

    // 2. 捕捉模特 (SAM 2)
    const maskUrl = await generatePetMask(petImageSource);

    // 3. AI 视觉分析 (使用 Gemini 2.0 Flash)
    const geminiStart = performance.now();
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const geminiPrompt = `Task: Pet virtual fitting. 
      Original image contains a pet. 
      Action: Keep the head and breed identical. Replace the body with: "${description}". 
      Requirement: Must be professional studio lighting, pure solid white background. 
      Output: Generate a concise English inpainting prompt.`;

    const result = await model.generateContent([
      { inlineData: { data: imgData.data, mimeType: imgData.mimeType } },
      { text: geminiPrompt }
    ]);
    const optimizedPrompt = result.response.text();
    logStep("步骤 3: Gemini 视觉分析完成", geminiStart);

    // 4. 执行渲染
    const resUrl = await executeInpaint(petImageSource, maskUrl, optimizedPrompt);
    logStep("✨ 全流程总计耗时", totalStart);
    return resUrl;
  }

  // --- 引擎 3: FAL 快速模式 ---
  const maskUrl = await generatePetMask(petImageSource);
  const finalUrl = await executeInpaint(petImageSource, maskUrl, description);
  logStep("✨ 全流程总计耗时", totalStart);
  return finalUrl;
};
