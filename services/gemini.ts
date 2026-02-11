/**
 * 静态匹配逻辑：根据选择的宠物和衣服 ID 直接返回成品图
 * 优点：0 成本、秒开、画质完美稳定
 */

/**
 * 建议的资源存放规则：
 * 所有的成品图存放在：/public/assets/fittings/
 * 命名规则：[宠物ID]_[衣服ID].jpg
 * 例如：golden_retriever_yellow_raincoat.jpg
 */
const ASSET_BASE_PATH = '/assets/fittings';

/**
 * 主映射函数
 */
export const generateFitting = async (
  engine: 'doubao' | 'fal' | 'google', // 保留参数以兼容现有 UI 调用
  petId: string,                       // 传入模特的唯一 ID (如 'golden')
  apparelId: string,                   // 传入衣服的唯一 ID (如 'jacket')
  style: string = 'Studio'
): Promise<string> => {
  
  console.log(`%c🚀 静态调用启动: 模特(${petId}) + 产品(${apparelId})`, "color: white; background: #10b981; padding: 2px 8px; border-radius: 4px;");

  // 1. 构建图片路径
  // 如果你的 petId 是 'golden'，apparelId 是 'raincoat'
  // 则生成的路径为 /assets/fittings/golden_raincoat.jpg
  const finalImageUrl = `${ASSET_BASE_PATH}/${petId}_${apparelId}.jpg`;

  /**
   * 2. 模拟加载动画（可选）
   * 为了保留一点“AI 生成中”的仪式感，我们加一个 0.8 秒的延迟
   */
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("✅ 匹配图片成功:", finalImageUrl);
      resolve(finalImageUrl);
    }, 800); 
  });
};
