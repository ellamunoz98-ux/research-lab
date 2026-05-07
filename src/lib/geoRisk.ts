/**
 * 地缘风险层数据
 * - 航运要道（chokepoints）：影响全球能源/商品物流的关键水道
 * - 冲突区（conflict zones）：基于国际媒体公开报道整理的活跃冲突区域
 *
 * 数据为示意性 / 静态整理，仅用于地图可视化讨论，不代表本站观点
 */

export interface Chokepoint {
  id: string;
  name: string;
  enName: string;
  lat: number;
  lng: number;
  /** 一句话说明其重要性 */
  importance: string;
  /** 主要承担的物流类别 */
  category: "energy" | "shipping" | "dual";
}

export interface ConflictZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** 冲突类型概括 */
  kind: string;
  /** 简要说明（可在 hover 时显示） */
  note: string;
}

/** 全球主要海运咽喉点 */
export const CHOKEPOINTS: Chokepoint[] = [
  {
    id: "hormuz",
    name: "霍尔木兹海峡",
    enName: "Strait of Hormuz",
    lat: 26.5,
    lng: 56.5,
    importance: "全球约 1/5 海运原油经此通过",
    category: "energy",
  },
  {
    id: "malacca",
    name: "马六甲海峡",
    enName: "Strait of Malacca",
    lat: 2.5,
    lng: 101.5,
    importance: "中日韩进口能源生命线，年通过约 9 万艘次",
    category: "dual",
  },
  {
    id: "suez",
    name: "苏伊士运河",
    enName: "Suez Canal",
    lat: 30.4,
    lng: 32.55,
    importance: "欧亚海运主干道，全球约 12% 贸易量经此",
    category: "shipping",
  },
  {
    id: "bab-el-mandeb",
    name: "曼德海峡",
    enName: "Bab-el-Mandeb",
    lat: 12.6,
    lng: 43.3,
    importance: "红海南端入口，连通苏伊士航线",
    category: "shipping",
  },
  {
    id: "panama",
    name: "巴拿马运河",
    enName: "Panama Canal",
    lat: 9.1,
    lng: -79.7,
    importance: "美洲东西海岸 + 亚洲贸易枢纽",
    category: "shipping",
  },
  {
    id: "bosphorus",
    name: "博斯普鲁斯海峡",
    enName: "Bosphorus Strait",
    lat: 41.1,
    lng: 29.05,
    importance: "黑海能源（粮食/原油）出海唯一通道",
    category: "energy",
  },
  {
    id: "gibraltar",
    name: "直布罗陀海峡",
    enName: "Strait of Gibraltar",
    lat: 35.95,
    lng: -5.5,
    importance: "地中海与大西洋之间唯一通道",
    category: "shipping",
  },
  {
    id: "dover",
    name: "多佛海峡",
    enName: "Strait of Dover",
    lat: 51.0,
    lng: 1.5,
    importance: "北海主要航运通道，欧洲门户",
    category: "shipping",
  },
  {
    id: "good-hope",
    name: "好望角航线",
    enName: "Cape of Good Hope",
    lat: -34.4,
    lng: 18.5,
    importance: "苏伊士替代路线，红海危机期承担分流",
    category: "shipping",
  },
];

/**
 * 主要活跃冲突区域
 * ⚠ 以下基于国际媒体公开报道整理，状态可能随时变化
 *    数据用于研究讨论目的，不代表本站立场
 */
export const CONFLICT_ZONES: ConflictZone[] = [
  {
    id: "ukraine-east",
    name: "乌克兰东部",
    lat: 48.5,
    lng: 37.8,
    kind: "国家间冲突",
    note: "持续影响全球能源、粮食、化肥供应链",
  },
  {
    id: "gaza",
    name: "加沙地带",
    lat: 31.5,
    lng: 34.45,
    kind: "区域冲突",
    note: "影响地中海东岸地缘格局与海运路线",
  },
  {
    id: "yemen",
    name: "也门 / 红海航运区",
    lat: 15.5,
    lng: 47.5,
    kind: "海上袭扰",
    note: "胡塞武装袭击红海商船，导致苏伊士航线阻断",
  },
  {
    id: "sudan",
    name: "苏丹",
    lat: 15.6,
    lng: 32.5,
    kind: "内战",
    note: "RSF 与正规军内战，影响非洲粮食与红海西岸",
  },
  {
    id: "sahel",
    name: "萨赫勒地区",
    lat: 14.5,
    lng: -1.0,
    kind: "区域不稳定",
    note: "马里 / 布基纳法索 / 尼日尔等政权更迭与武装活动",
  },
  {
    id: "haiti",
    name: "海地",
    lat: 18.5,
    lng: -72.3,
    kind: "国内危机",
    note: "持续帮派暴力与人道危机，加勒比航运受影响",
  },
];
