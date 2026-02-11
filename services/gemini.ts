/**
 * 静态试衣映射逻辑
 * 功能：解析 Coupang 链接/ID，匹配本地精修成品图
 */

// 基础资源路径（对应项目中的 public/assets/fittings/ 文件夹）
const ASSET_BASE_PATH = '/assets/fittings';

/**
 * Coupang 产品 ID 与本地 A/B/C 级别的映射关系
 * 产品 A: 9286790289
 * 产品 B: 9312183755
 * 产品 C: 9325810280
 */
const COUPANG_MAPPING: Record<string, string> = {
  "9286790289": "A",
  "9312183755": "B",
  "9325810280": "C"
};

/**
 * 主映射函数
 * @param _engine - 兼容旧代码参数，已不再发起 AI 请求
 * @param petId - 模特 ID (如: 'golden', 'bichon', 'poodle', 'jindo')
 * @param coupangInput - 输入的产品链接或 ID 字符串
 */
export const generateFitting = async (
  _engine: string,
  petId: string,
  coupangInput: string,
  _style: string = 'Studio'
): Promise<string> => {
  
  console.log("%c🔍 正在解析 Coupang 产品 ID...", "color: #2563eb; font-weight: bold;");

  // 1. 从输入中提取数字 ID (支持完整链接或纯数字字符串)
  const productIdMatch = coupangInput.match(/\d+/);
  const productId = productIdMatch ? productIdMatch[0] : "";

  // 2. 匹配产品级别 (A, B 或 C)
  // 如果 ID 不在映射表中，默认返回 A 级产品图
  const productLevel = COUPANG_MAPPING[productId] || "A";

  // 3. 确定模特名称 (统一转为小写，确保路径匹配)
  const modelName = petId.toLowerCase();

  // 4. 拼接最终本地路径
  // 命名规则：品种_级别.png (例如: golden_A.png)
  const finalImageUrl = `${ASSET_BASE_PATH}/${modelName}_${productLevel}.png`;

  console.log(`%c✅ 映射成功: Coupang[${productId}] -> 本地资源[${finalImageUrl}]`, "color: white; background: #10b981; padding: 2px 8px; border-radius: 4px;");

  // 返回 Promise 以保持与原有异步 UI 的兼容性
  return new Promise((resolve) => {
    // 模拟 300ms 快速响应
    setTimeout(() => {
      resolve(finalImageUrl);
    }, 300);
  });
};
