/**
 * 货币对配置 + 利差与叙事数据
 */

export interface CurrencyMeta {
  /** 当前主要政策利率（%） */
  policyRate: number;
  /** 央行简称 */
  centralBank: string;
  /** 中文全名 */
  name: string;
}

/** 主要货币的政策利率（用于计算利差，与 centralBanks.ts 同步） */
export const CURRENCY_META: Record<string, CurrencyMeta> = {
  USD: { policyRate: 4.25, centralBank: "Fed", name: "美元" },
  EUR: { policyRate: 2.5, centralBank: "ECB", name: "欧元" },
  GBP: { policyRate: 4.25, centralBank: "BoE", name: "英镑" },
  JPY: { policyRate: 0.5, centralBank: "BoJ", name: "日元" },
  CNY: { policyRate: 3.1, centralBank: "PBoC", name: "人民币" },
  AUD: { policyRate: 3.85, centralBank: "RBA", name: "澳元" },
  CAD: { policyRate: 2.75, centralBank: "BoC", name: "加元" },
  CHF: { policyRate: 0.25, centralBank: "SNB", name: "瑞郎" },
  HKD: { policyRate: 4.5, centralBank: "HKMA", name: "港币" },
  KRW: { policyRate: 2.75, centralBank: "BoK", name: "韩元" },
};

export interface PairConfig {
  id: string;
  base: string;
  quote: string;
  label: string;
  flag: [string, string];
  highlight?: boolean;
  /** 叙事性描述：是什么 / 受什么驱动 / 看什么 */
  driver: string;
  /** 典型波动幅度 / 历史区间提示 */
  range: string;
}

export const PAIRS: PairConfig[] = [
  {
    id: "eurusd",
    base: "EUR",
    quote: "USD",
    label: "欧元 / 美元",
    flag: ["🇪🇺", "🇺🇸"],
    highlight: true,
    driver:
      "全球流动性最大的货币对，单日成交占外汇交易量约 28%。主要由美欧利差、欧元区经济差、美元广义强弱（DXY）驱动。在风险偏好回升时通常欧元相对走强。",
    range: "近 5 年区间 0.95–1.25，2026 年中枢 1.10–1.18",
  },
  {
    id: "usdjpy",
    base: "USD",
    quote: "JPY",
    label: "美元 / 日元",
    flag: ["🇺🇸", "🇯🇵"],
    highlight: true,
    driver:
      "美日 10Y 利差是核心驱动——日元 carry 交易最大对手。BoJ 自 2024 年退出 NIRP 后，日元贬值压力反复引发 BoJ 干预。同时日元仍是避险货币，风险事件时反向走强。",
    range: "近 5 年区间 100–162，2026 年在 145–160 间震荡",
  },
  {
    id: "gbpusd",
    base: "GBP",
    quote: "USD",
    label: "英镑 / 美元",
    flag: ["🇬🇧", "🇺🇸"],
    driver:
      "英镑波动比欧元大（'Cable'）。受英国通胀粘性、BoE 政策、能源价格、政治风险（脱欧后遗）综合影响。流动性不及 EUR/USD 但日内振幅常更大。",
    range: "近 5 年区间 1.05–1.42，当前在 1.30–1.40",
  },
  {
    id: "audusd",
    base: "AUD",
    quote: "USD",
    label: "澳元 / 美元",
    flag: ["🇦🇺", "🇺🇸"],
    driver:
      "典型大宗商品货币——铁矿石、煤炭出口高度集中，对中国需求敏感。同时是高 beta 风险偏好指标（市场避险时澳元跌得最猛）。",
    range: "近 5 年区间 0.55–0.80，当前 0.65–0.75",
  },
  {
    id: "usdcad",
    base: "USD",
    quote: "CAD",
    label: "美元 / 加元",
    flag: ["🇺🇸", "🇨🇦"],
    driver:
      "油价主导（WTI / Brent）。美加贸易关系（2026 关税摩擦）+ BoC 较激进降息形成加元贬值压力。加元被称为'Loonie'，与油价正相关性高。",
    range: "近 5 年区间 1.20–1.48",
  },
  {
    id: "usdchf",
    base: "USD",
    quote: "CHF",
    label: "美元 / 瑞郎",
    flag: ["🇺🇸", "🇨🇭"],
    driver:
      "瑞郎是终极避险货币——地缘冲突、欧债危机时资金涌入瑞士。SNB 因瑞郎过强反复降息（甚至重启 NIRP 风险）。瑞士贸易顺差 + 政治稳定 + 银行业秘密文化共同支撑。",
    range: "近 5 年区间 0.78–1.00",
  },
  {
    id: "usdcny",
    base: "USD",
    quote: "CNY",
    label: "美元 / 人民币",
    flag: ["🇺🇸", "🇨🇳"],
    highlight: true,
    driver:
      "中美利差 + PBoC 中间价定价是核心。人民币不是完全自由浮动——央行对每日中间价有逆周期调节。当前中美利差倒挂约 100bp 给人民币贬值压力，但出口顺差 + 资本流入对冲。",
    range: "近 5 年区间 6.30–7.35，当前 7.10–7.25",
  },
  {
    id: "eurcny",
    base: "EUR",
    quote: "CNY",
    label: "欧元 / 人民币",
    flag: ["🇪🇺", "🇨🇳"],
    driver:
      "中欧贸易往来直接定价。受 EUR/USD 与 USD/CNY 双重影响（EUR/CNY ≈ EUR/USD × USD/CNY）。中欧关税、电动车贸易争端是关键变量。",
    range: "近 5 年区间 7.0–8.5",
  },
  {
    id: "gbpcny",
    base: "GBP",
    quote: "CNY",
    label: "英镑 / 人民币",
    flag: ["🇬🇧", "🇨🇳"],
    driver:
      "通过 GBP/USD 与 USD/CNY 间接定价。中英直接贸易体量小于中欧，因此波动主要来自伦敦市场。",
    range: "近 5 年区间 8.3–10.1",
  },
  {
    id: "jpycny",
    base: "JPY",
    quote: "CNY",
    label: "日元 / 人民币",
    flag: ["🇯🇵", "🇨🇳"],
    driver:
      "中日贸易以中间品为主（半导体、汽车零部件）。日元贬值对中国出口构成竞争压力（同样面向欧美市场）。",
    range: "近 5 年区间 0.040–0.075",
  },
  {
    id: "hkdcny",
    base: "HKD",
    quote: "CNY",
    label: "港币 / 人民币",
    flag: ["🇭🇰", "🇨🇳"],
    driver:
      "港币与美元挂钩（联系汇率制度，1 USD ≈ 7.75-7.85 HKD）。因此 HKD/CNY 实质上跟随 USD/CNY。香港金管局通过外汇基金维护联汇制。",
    range: "近 5 年区间 0.83–0.95",
  },
  {
    id: "usdkrw",
    base: "USD",
    quote: "KRW",
    label: "美元 / 韩元",
    flag: ["🇺🇸", "🇰🇷"],
    driver:
      "韩国是出口导向经济，韩元波动与全球科技周期高度相关。半导体周期、中美贸易摩擦是关键。BoK 长期与 Fed 政策同步，但 2025-2026 已出现脱钩（韩国先降息）。",
    range: "近 5 年区间 1100–1480",
  },
];

/** 给定 base/quote，计算利差（base 利率 - quote 利率，单位 % ） */
export function rateDiff(base: string, quote: string): number {
  const b = CURRENCY_META[base]?.policyRate ?? 0;
  const q = CURRENCY_META[quote]?.policyRate ?? 0;
  return b - q;
}
