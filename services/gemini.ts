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
 * 将图片 URL 转换为 Gemini 需要的 Base64 格式
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
 * 步骤 2: 使用最新的 SAM 2 提取宠物轮廓
 * 增加了 20 秒超时机制，解决 VPN 环境下的卡死问题
 */
async function generatePetMask(imageUrl: string): Promise<string> {
  const start = performance.now();
  fal.config({ credentials: FAL_KEY });

  try {
    // 使用 Promise.race 防止请求由于网络原因永久 Pending
    const result: any = await Promise.race([
      fal.subscribe("fal-ai/sam2", {
        input: {
          image_url: imageUrl,
          prompt: "the full body of the animal, torso, clothing area", // SAM2 使用 prompt 字段
          mask_limit: 1
        }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("SAM 2 识别超时，请尝试切换 VPN 节点")), 20000)
      )
    ]);

    logStep("步骤 2: SAM 2 遮罩获取完成", start);
    // SAM 2 返回的字段可能在 masks 或 image 中
    return result?.masks?.[0]?.url || result?.image?.url || "";
  } catch (error: any) {
    console.error("SAM Error:", error);
    throw new Error(error.message || "无法识别宠物轮廓");
  }
}

/**
 * 步骤 4: Flux Fill 局部重绘
 */
async function executeInpaint(imageUrl: string, maskUrl: string, prompt: string): Promise<string> {
  const start = performance.now();
  const result: any = await fal.subscribe("fal-ai/flux/dev/fill", {
    input: {
      image_url: imageUrl,
      mask_url: maskUrl,
      prompt: `${prompt}, high quality professional studio shot, plain white background`,
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
 * 主函数：生成试衣结果
 */
export const generateFitting = async (
  engine: 'doubao' | 'fal' | 'google', 
  petImageSource: string,
  description: string,
  style: string = 'Studio'
): Promise<string> => {
  const totalStart = performance.now();
  console.clear();
  console.log("%c🚀 任务启动", "color: white; background: #ea580c; padding: 2px 8px; border-radius: 4px;");

  // --- 引擎 1: 豆包 ---
  if (engine === 'doubao') {
    const openai = new OpenAI({ apiKey: DOUBAO_API_KEY, baseURL: "https://ark.cn-beijing.volces.com/api/v3", dangerouslyAllowBrowser: true });
    const response = await openai.images.generate({
      model: "doubao-seedream-4-5-251128",
      prompt: `A pet wearing ${description}. Solid white background.`,
    });
    return response.data[0]?.url || "";
  } 

  // --- 引擎 2: Google 联合逻辑 (串行诊断模式) ---
  if (engine === 'google') {
    if (!GEMINI_API_KEY) throw new Error("GOOGLE_AUTH_ERROR");

    // 步骤 1: 图片数据准备
    const imgStart = performance.now();
    const imgData = await getGeminiImageData(petImageSource);
    logStep("步骤 1: 图片转换完成", imgStart);

    // 步骤 2: 提取掩码 (SAM 2)
    const maskUrl = await generatePetMask(petImageSource);
    if (!maskUrl) throw new Error("未能生成有效的宠物遮罩");

    // 步骤 3: Gemini 分析 (升级到最新版 Gemini 3 Flash 以获得更强性能)
    const geminiStart = performance.now();
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    // 提示：gemini-3-flash 是 2026 年的主力模型，性能远超 1.5
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash" });

    const geminiPrompt = `Look at the pet. Generate an inpainting prompt to replace its body with: "${description}". Keep the head and breed identical. Background MUST be solid white.`;
    const result = await model.generateContent([
      { inlineData: { data: imgData.data, mimeType: imgData.mimeType } },
      { text: geminiPrompt }
    ]);
    const optimizedPrompt = result.response.text();
    logStep("步骤 3: Gemini 分析完成", geminiStart);

    // 步骤 4: Flux 最终渲染
    const resUrl = await executeInpaint(petImageSource, maskUrl, optimizedPrompt);
    logStep("✨ 全流程总计耗时", totalStart);
    return resUrl;
  }

  // --- 引擎 3: FAL 直接渲染 ---
  const maskUrl = await generatePetMask(petImageSource);
  const finalUrl = await executeInpaint(petImageSource, maskUrl, description);
  logStep("✨ 全流程总计耗时", totalStart);
  return finalUrl;
};
