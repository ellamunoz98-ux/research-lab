/**
 * 8 个核心行业 + 各自的热门子板块
 * sub-board 名按"东方财富概念板块/行业板块"在线列表里的名称设置，
 * 在数据加载时做模糊匹配查找对应板块代码（BK 开头）
 */

/**
 * 子板块视觉符号 — 用于热力图方格水印，做"一眼识别行业画像"
 * 优先用语义直接的 emoji（如人形机器人 → 🦾、商业航天 → 🚀）
 * key 是 eastmoney 在线板块名，未命中的会回退到行业级 icon
 */
export const BOARD_EMOJI: Record<string, string> = {
  // AI 算力
  算力概念: "⚡",
  CPO概念: "💠",
  PCB: "🔌",
  液冷概念: "❄️",
  存储芯片: "💾",
  数据中心: "🏢",
  // 半导体
  半导体设备: "⚙️",
  半导体材料: "🧪",
  集成电路制造: "🔬",
  集成电路封测: "📦",
  第三代半导体: "💡",
  先进封装: "🧩",
  // 机器人
  人形机器人: "🦾",
  机器人执行器: "🔧",
  减速器: "⚙️",
  机器视觉: "👁️",
  无人机: "🚁",
  // 新能源车
  新能源车: "🚗",
  固态电池: "🔋",
  锂电池概念: "⚡",
  锂电池: "🔋",
  // 创新药
  创新药: "💊",
  减肥药: "💉",
  医疗器械概念: "🩺",
  医疗器械: "🏥",
  // 军工 / 低空
  商业航天: "🚀",
  低空经济: "🚁",
  卫星互联网: "🛰️",
  北斗导航: "📡",
  军工: "🛡️",
  // 消费电子
  苹果概念: "🍎",
  智能穿戴: "⌚",
  "柔性屏(折叠屏)": "📱",
  消费电子: "📲",
  // 大消费
  白酒: "🍶",
  食品饮料: "🍱",
  白色家电: "🧊",
  旅游酒店: "🏨",
  免税概念: "🛍️",
};

/** 板块名 → emoji，未命中给行业级回退 */
export function getBoardEmoji(boardName: string, industryFallback?: string): string {
  if (BOARD_EMOJI[boardName]) return BOARD_EMOJI[boardName];
  // 模糊查找（处理"白酒Ⅱ" / "锂电池ETF" 等变体）
  for (const key of Object.keys(BOARD_EMOJI)) {
    if (boardName.includes(key) || key.includes(boardName)) {
      return BOARD_EMOJI[key];
    }
  }
  return industryFallback ?? "📊";
}

export interface IndustryDef {
  id: string;
  name: string;
  icon: string;
  /** 一句话定位 */
  tagline: string;
  /** 子板块名（按 eastmoney 板块名近似匹配） */
  subBoards: string[];
}

export const INDUSTRIES: IndustryDef[] = [
  {
    id: "ai-compute",
    name: "AI 算力",
    icon: "🚀",
    tagline: "训练 + 推理算力链：硬件 / 互联 / 散热",
    subBoards: ["算力概念", "CPO概念", "PCB", "液冷概念", "存储芯片", "数据中心"],
  },
  {
    id: "semiconductor",
    name: "半导体",
    icon: "🔬",
    tagline: "国产替代主线，从设备材料到设计封测全链条",
    subBoards: [
      "半导体设备",
      "半导体材料",
      "集成电路制造",
      "集成电路封测",
      "第三代半导体",
      "先进封装",
    ],
  },
  {
    id: "robotics",
    name: "机器人",
    icon: "🤖",
    tagline: "人形机器人产业化拐点 + 工业自动化升级",
    subBoards: ["人形机器人", "机器人执行器", "减速器", "机器视觉", "无人机"],
  },
  {
    id: "new-energy-vehicle",
    name: "新能源车",
    icon: "🚗",
    tagline: "整车 + 智驾 + 电池新一轮技术迭代",
    subBoards: ["新能源车", "固态电池", "锂电池概念", "锂电池"],
  },
  {
    id: "innovative-medicine",
    name: "创新药",
    icon: "💊",
    tagline: "减肥药 / ADC / 小核酸驱动的新一轮创新周期",
    subBoards: ["创新药", "减肥药", "医疗器械概念", "医疗器械"],
  },
  {
    id: "defense-aerospace",
    name: "军工 / 低空",
    icon: "🛰",
    tagline: "国防装备 + 商业航天 + 低空经济",
    subBoards: ["商业航天", "低空经济", "卫星互联网", "北斗导航", "军工"],
  },
  {
    id: "consumer-electronics",
    name: "消费电子",
    icon: "📱",
    tagline: "AI 终端落地 + 苹果链景气复苏",
    subBoards: ["苹果概念", "智能穿戴", "柔性屏(折叠屏)", "消费电子"],
  },
  {
    id: "big-consumer",
    name: "大消费",
    icon: "🍷",
    tagline: "食饮 / 白酒 / 家电 / 旅游 — 内需修复",
    subBoards: ["白酒", "食品饮料", "白色家电", "旅游酒店", "免税概念"],
  },
];
