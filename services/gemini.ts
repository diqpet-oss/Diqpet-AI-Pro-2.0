/**
 * 静态资源管理服务 - Diqpet-AI-Pro-2.0
 * 规则：所有资源路径强制转换为小写，确保与 Linux 文件系统兼容
 */

// 1. 定义根路径
const ASSET_PATHS = {
  MODELS: '/models',
  APPAREL: '/apparel',
  FITTINGS: '/assets/fittings'
};

/**
 * Coupang 产品 ID 到本地 A/B/C 级别的映射关系
 */
const PRODUCT_ID_MAP: Record<string, string> = {
  "9286790289": "a",
  "9312183755": "b",
  "9325810280": "c"
};

/**
 * 核心试衣函数：返回预生成的成品图路径
 * 生成规则：/assets/fittings/品种_级别.png
 */
export const generateFitting = async (
  _engine: string,
  petId: string,
  coupangInput: string
): Promise<string> => {
  // 提取产品 ID
  const productIdMatch = coupangInput.match(/\d+/);
  const productId = productIdMatch ? productIdMatch[0] : "";
  
  // 确定产品级别 (a/b/c)，默认为 a
  const productLevel = PRODUCT_ID_MAP[productId] || "a";
  
  // 强制全小写处理，确保匹配 bichon_a.png
  const finalPath = `${ASSET_PATHS.FITTINGS}/${petId.toLowerCase()}_${productLevel.toLowerCase()}.png`;

  console.log(`%c🎨 Diqpet 试衣路径调取: ${finalPath}`, "color: white; background: #10b981; padding: 2px 8px; border-radius: 4px;");

  return new Promise((resolve) => {
    // 模拟 300ms 加载感
    setTimeout(() => resolve(finalPath), 300);
  });
};

/**
 * 获取本地模特图路径
 * 示例：/models/pomeranian.png
 */
export const getLocalModelImage = (petId: string): string => {
  return `${ASSET_PATHS.MODELS}/${petId.toLowerCase()}.png`;
};

/**
 * 获取本地衣服产品图路径
 * 示例：/apparel/a.png
 */
export const getLocalApparelImage = (coupangInput: string): string => {
  const productIdMatch = coupangInput.match(/\d+/);
  const productId = productIdMatch ? productIdMatch[0] : "";
  const productLevel = (PRODUCT_ID_MAP[productId] || "a").toLowerCase();
  
  return `${ASSET_PATHS.APPAREL}/${productLevel}.png`;
};
