/**
 * 静态匹配逻辑：从 Coupang 复杂输入映射到本地成品图
 * 目标：将长 URL 和长描述 简化为 [模特ID]_[产品ID].jpg
 */

const ASSET_BASE_PATH = '/assets/fittings';

// 1. 模特映射表：从 URL 或名称中提取关键词
const PET_MAP: Record<string, string> = {
  'golden': 'golden',
  'retriever': 'golden',
  'poodle': 'poodle',
  'maltese': 'maltese',
  'bichon': 'bichon'
};

// 2. 产品映射表：从 Coupang 描述或 ID 中提取关键词
const APPAREL_MAP: Record<string, string> = {
  '바람막이': 'B',    // 风衣/冲锋衣 映射为 B
  'windbreaker': 'B',
  '패딩': 'A',       // 羽绒服/填棉服 映射为 A
  'padding': 'A',
  '우비': 'C',       // 雨衣 映射为 C
  'raincoat': 'C'
};

/**
 * 主映射函数
 */
export const generateFitting = async (
  _engine: string,
  petSource: string,
  description: string,
  _style: string = 'Studio'
): Promise<string> => {
  
  console.log("%c🔍 Coupang 数据解析中...", "color: #2563eb;");

  // --- 逻辑 A: 解析模特 ID ---
  let finalPetId = 'golden'; // 默认值
  const lowSource = petSource.toLowerCase();
  for (const [key, value] of Object.entries(PET_MAP)) {
    if (lowSource.includes(key)) {
      finalPetId = value;
      break;
    }
  }

  // --- 逻辑 B: 解析产品 ID ---
  let finalApparelId = 'B'; // 默认值
  const lowDesc = description.toLowerCase();
  for (const [key, value] of Object.entries(APPAREL_MAP)) {
    if (lowDesc.includes(key)) {
      finalApparelId = value;
      break;
    }
  }

  // --- 逻辑 C: 构造干净路径 ---
  // 无论输入多乱，输出永远是 /assets/fittings/golden_B.jpg 这种格式
  const finalImageUrl = `${ASSET_BASE_PATH}/${finalPetId}_${finalApparelId}.jpg`;

  console.log(`%c✅ 映射成功: ${finalImageUrl}`, "color: white; background: #10b981; padding: 2px 8px; border-radius: 4px;");

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(finalImageUrl);
    }, 400);
  });
};
