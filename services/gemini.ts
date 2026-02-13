/**
 * 静态资源管理服务 - Diqpet-AI-Pro-2.0
 * 更新日志：新增 Pomeranian(博美), Maltese(马尔济斯) 品种支持
 */

// 1. 定义根路径（保持不变）
const ASSET_PATHS = {
  MODELS: '/models',
  APPAREL: '/apparel',
  FITTINGS: '/assets/fittings'
};

/**
 * 2. Coupang 产品 ID 到本地 A/B/C 级别的映射关系
 * 运营备注：新增商品 ID 时需在此处手动维护映射
 */
const PRODUCT_ID_MAP: Record<string, string> = {
  "9286790289": "A", // 背心款
  "9312183755": "B", // 带袖款
  "9325810280": "C"  // 四脚衣款
};

/**
 * 核心试衣函数：返回预生成的成品图路径
 * @param petId - 新增支持: pomeranian, maltese (不区分大小写)
 * @param coupangInput - Coupang 链接或产品 ID
 */
export const generateFitting = async (
  _engine: string,
  petId: string,
  coupangInput: string
): Promise<string> => {
  // 提取产品 ID
  const productIdMatch = coupangInput.match(/\d+/);
  const productId = productIdMatch ? productIdMatch[0] : "";
  
  // 确定产品级别 (A/B/C)，默认为 A
  const productLevel = PRODUCT_ID_MAP[productId] || "A";
  
  /**
   * 构造路径逻辑说明：
   * 如果 petId 为 "Pomeranian"，级别为 "B"
   * 路径将指向: /assets/fittings/pomeranian_b.png
   */
  const finalPath = `${ASSET_PATHS.FITTINGS}/${petId.toLowerCase()}_${productLevel.toLowerCase()}.png`;

  console.log(`%c🎨 Diqpet 资产调取: ${petId} | Level: ${productLevel}`, "color: white; background: #10b981; padding: 2px 8px; border-radius: 4px;");

  return new Promise((resolve) => {
    // 维持 300ms 延迟以保持“生成感”体验
    setTimeout(() => resolve(finalPath), 300);
  });
};

/**
 * 获取本地模特图路径 (支持新宠物品种)
 */
export const getLocalModelImage = (petId: string): string => {
  // 确保返回如 /models/pomeranian.png
  return `${ASSET_PATHS.MODELS}/${petId.toLowerCase()}.png`;
};

// ... getLocalApparelImage 逻辑保持一致
