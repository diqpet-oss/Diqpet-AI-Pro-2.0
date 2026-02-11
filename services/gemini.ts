/**
 * 静态匹配逻辑：基于固定命名规则返回成品图
 * 规则：/assets/fittings/[模特ID]_[产品ID].jpg
 */

// 基础路径映射（对应项目中的 public/assets/fittings/ 文件夹）
const ASSET_BASE_PATH = '/assets/fittings';

/**
 * 试衣生成函数（静态版）
 * @param _engine - 兼容现有参数，不再发起 AI 请求
 * @param petId - 模特 ID，例如 'golden'
 * @param apparelId - 产品 ID，例如 'B'
 */
export const generateFitting = async (
  _engine: string,
  petId: string,
  apparelId: string,
  _style: string = 'Studio'
): Promise<string> => {
  
  // 1. 清理输入参数（去除空格，确保匹配严谨）
  const modelName = petId.trim();     // 'golden'
  const productName = apparelId.trim(); // 'B'

  console.log(`%c🎨 静态成品匹配: 模特(${modelName}) + 产品(${productName})`, "color: white; background: #10b981; padding: 2px 8px; border-radius: 4px;");

  // 2. 拼接最终文件名
  // 对应本地文件：public/assets/fittings/golden_B.jpg
  const finalImageUrl = `${ASSET_BASE_PATH}/${modelName}_${productName}.jpg`;

  return new Promise((resolve) => {
    // 模拟 600ms 加载感，让用户觉得系统在“处理”
    setTimeout(() => {
      console.log("✅ 路径生成成功:", finalImageUrl);
      resolve(finalImageUrl);
    }, 600);
  });
};
