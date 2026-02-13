/**
 * 静态资源管理服务 - Diqpet-AI-Pro-2.0
 */

// 定义根路径
const ASSET_PATHS = {
  MODELS: '/models',
  APPAREL: '/apparel',
  FITTINGS: '/assets/fittings'
};

/**
 * Coupang 产品 ID 到本地 A/B/C 级别的映射关系
 */
const PRODUCT_ID_MAP: Record<string, string> = {
  "9286790289": "A",
  "9312183755": "B",
  "9325810280": "C"
};

/**
 * 核心试衣函数：返回预生成的成品图路径
 */
export const generateFitting = async (
  _engine: string,
  petId: string,
  coupangInput: string
): Promise<string> => {
  const productIdMatch = coupangInput.match(/\d+/);
  const productId = productIdMatch ? productIdMatch[0] : "";
  const productLevel = PRODUCT_ID_MAP[productId] || "A";
  
  // 统一转为小写以匹配文件系统
  const finalPath = `${ASSET_PATHS.FITTINGS}/${petId.toLowerCase()}_${productLevel.toLowerCase()}.png`;

  console.log(`%c🎨 静态调取成功: ${finalPath}`, "color: white; background: #10b981; padding: 2px 8px; border-radius: 4px;");

  return new Promise((resolve) => {
    setTimeout(() => resolve(finalPath), 300); 
  });
};

/**
 * 获取本地模特图路径
 */
export const getLocalModelImage = (petId: string): string => {
  return `${ASSET_PATHS.MODELS}/${petId.toLowerCase()}.png`;
};

/**
 * 获取本地衣服产品图路径
 * (修复点：确保此处有 export 关键字)
 */
export const getLocalApparelImage = (coupangInput: string): string => {
  const productIdMatch = coupangInput.match(/\d+/);
  const productId = productIdMatch ? productIdMatch[0] : "";
  const productLevel = PRODUCT_ID_MAP[productId] || "A";
  return `${ASSET_PATHS.APPAREL}/${productLevel}.png`;
};
