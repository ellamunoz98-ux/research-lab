/**
 * 主要央行数据 + 叙事内容
 * 包含基础事实、历史决议、过去现在未来的研究叙事
 * 数据更新于 2026-05；研究叙事以历史数据 + 主流卖方观点为基础
 */

export type LastAction = "加息" | "降息" | "维持";
export type AccentColor =
  | "cyan"
  | "rose"
  | "purple"
  | "emerald"
  | "blue"
  | "amber";

export interface BankMeeting {
  date: string;
  rateAfter: number;
  changeBp: number; // +25 / -25 / 0
  note?: string;
}

export interface CentralBank {
  id: string;
  flag: string;
  name: string;
  shortName: string;
  rateName: string;
  /** 当前主要利率（%） */
  rate: number;
  /** 上次决议前 */
  prevRate: number;
  /** 最近一次变动日期 */
  lastChange: string;
  lastAction: LastAction;
  /** 下次会议（YYYY-MM-DD 或描述） */
  nextMeeting: string;
  governor: string;
  /** 卡片简短说明 */
  notes: string;
  accent: AccentColor;
  /** 近 6-8 次决议历史（最新在前） */
  history: BankMeeting[];
  /** 长篇叙事 */
  narrative: {
    past: string;
    present: string;
    future: string;
  };
  /** 用于搜索市场观点的关键词 */
  newsKeyword: string;
}

export const BANKS: CentralBank[] = [
  {
    id: "fed",
    flag: "🇺🇸",
    name: "美联储",
    shortName: "Fed",
    rateName: "联邦基金利率",
    rate: 4.25,
    prevRate: 4.5,
    lastChange: "2026-03-19",
    lastAction: "降息",
    nextMeeting: "2026-06-18",
    governor: "Jerome Powell",
    notes:
      "通胀回落但 PCE 仍高于 2% 目标，3 月降息 25bp，市场定价年内还有 1–2 次降息",
    accent: "blue",
    history: [
      { date: "2026-03-19", rateAfter: 4.25, changeBp: -25, note: "三月会议降息 25bp" },
      { date: "2026-01-29", rateAfter: 4.5, changeBp: 0, note: "维持，等待数据" },
      { date: "2025-12-18", rateAfter: 4.5, changeBp: -25 },
      { date: "2025-11-07", rateAfter: 4.75, changeBp: -25 },
      { date: "2025-09-18", rateAfter: 5.0, changeBp: -50, note: "降息周期开启" },
      { date: "2024-07-31", rateAfter: 5.5, changeBp: 0, note: "维持高位" },
    ],
    narrative: {
      past:
        "2022-2023 年累计加息 525bp 至 5.25-5.50% 区间，是上世纪 80 年代以来最快的紧缩周期。2024 全年维持 5.5% 高位以确认通胀回到 2% 路径。2025 年 9 月 50bp 大幅降息，正式开启宽松周期。",
      present:
        "核心 PCE 同比从峰值 5.6% 回落至 2.5% 附近，但服务业（尤其住房与超额服务）通胀仍黏。劳动力市场降温但未崩塌——失业率 4.2% 区间。三月降息 25bp 反映双重使命再平衡：略偏向就业风险。",
      future:
        "市场（联邦基金期货）定价 2026 年内还有 1-2 次 25bp 降息，年终利率落在 3.75-4.00%。关键风险：若关税推升商品通胀重新抬头，可能提前结束降息周期；若就业意外恶化，则可能加快至 50bp 单次降幅。",
    },
    newsKeyword: "美联储",
  },
  {
    id: "ecb",
    flag: "🇪🇺",
    name: "欧洲央行",
    shortName: "ECB",
    rateName: "存款机制利率",
    rate: 2.5,
    prevRate: 2.75,
    lastChange: "2026-04-10",
    lastAction: "降息",
    nextMeeting: "2026-06-05",
    governor: "Christine Lagarde",
    notes: "欧元区通胀回落至 2.1%，但服务业通胀仍高，4 月降息 25bp",
    accent: "purple",
    history: [
      { date: "2026-04-10", rateAfter: 2.5, changeBp: -25 },
      { date: "2026-03-06", rateAfter: 2.75, changeBp: -25 },
      { date: "2026-01-30", rateAfter: 3.0, changeBp: -25 },
      { date: "2025-12-12", rateAfter: 3.25, changeBp: -25 },
      { date: "2025-10-17", rateAfter: 3.5, changeBp: -25 },
      { date: "2025-09-12", rateAfter: 3.75, changeBp: -25 },
    ],
    narrative: {
      past:
        "2022-2023 年累计加息 450bp 至 4.0%，2024 年 6 月开启降息周期，是主要央行中最早转向的之一。截至 2026 Q1 已累计降息 150bp。",
      present:
        "整体 HICP 同比 2.1%，核心通胀 2.4%——服务业通胀（薪资关联）是最后堡垒。德法工业疲软、内需脆弱，4 月再次降息 25bp 反映 ECB 对增长的担忧已超过对通胀的担忧。",
      future:
        "市场预期 2026 年内再有 2-3 次 25bp 降息，终点利率 1.50-1.75%。下次 6 月会议大概率继续降息。变量在于：油价、美欧贸易摩擦走向。",
    },
    newsKeyword: "欧洲央行",
  },
  {
    id: "boe",
    flag: "🇬🇧",
    name: "英格兰银行",
    shortName: "BoE",
    rateName: "银行利率",
    rate: 4.25,
    prevRate: 4.5,
    lastChange: "2026-02-06",
    lastAction: "降息",
    nextMeeting: "2026-05-22",
    governor: "Andrew Bailey",
    notes: "工资增速放缓，2 月降息 25bp，市场预期年内继续宽松",
    accent: "blue",
    history: [
      { date: "2026-02-06", rateAfter: 4.25, changeBp: -25 },
      { date: "2025-12-19", rateAfter: 4.5, changeBp: 0 },
      { date: "2025-11-07", rateAfter: 4.5, changeBp: -25 },
      { date: "2025-08-01", rateAfter: 4.75, changeBp: -25, note: "降息周期开启" },
    ],
    narrative: {
      past:
        "BoE 在 2022-2023 年累计加息 515bp 至 5.25%。2024 年 8 月首次降息，是降息周期最为审慎的主要央行——更担心通胀粘性。",
      present:
        "整体 CPI 2.6%，工资增速从 6% 回落至 4.5% 但仍高于央行 3% 舒适区。私人部门工资仍是关键变量。BoE 内部有显著分歧（投票分裂常见 7-2 或 6-3）。",
      future:
        "市场定价年内还有 2 次降息至 3.75%。Bailey 反复强调'渐进且谨慎'。如果 5 月会议数据进一步放缓，可能加速降息。",
    },
    newsKeyword: "英国央行",
  },
  {
    id: "boj",
    flag: "🇯🇵",
    name: "日本央行",
    shortName: "BoJ",
    rateName: "短期政策利率",
    rate: 0.5,
    prevRate: 0.25,
    lastChange: "2026-01-24",
    lastAction: "加息",
    nextMeeting: "2026-06-17",
    governor: "Kazuo Ueda",
    notes: "工资—物价良性循环成立，1 月加息 25bp，是后零利率时代第三次",
    accent: "rose",
    history: [
      { date: "2026-01-24", rateAfter: 0.5, changeBp: 25, note: "后零利率第三次加息" },
      { date: "2025-07-31", rateAfter: 0.25, changeBp: 25 },
      { date: "2024-03-19", rateAfter: 0.0, changeBp: 10, note: "退出 NIRP 历史性时刻" },
    ],
    narrative: {
      past:
        "BoJ 维持负利率政策（NIRP）长达 8 年，2024 年 3 月在春斗工资创纪录上涨后退出 NIRP，是日本货币政策正常化的转折点。",
      present:
        "春斗工资连续两年 5%+ 增长，CPI 同比稳定在 2-2.5% 区间，BoJ 判断'工资—物价良性循环'已确立。1 月加息 25bp 至 0.5%，是 17 年来最高水平。日元汇率仍然偏弱（USD/JPY 在 155 附近），加息既出于通胀预期，也含汇率防御。",
      future:
        "市场预期 2026 年再加息 1 次至 0.75%。若日元跌破 160 或工资增速维持高位，可能更激进。BoJ 的反向操作（在全球降息周期中加息）使其成为 G7 中最特殊的央行。",
    },
    newsKeyword: "日本央行",
  },
  {
    id: "pboc",
    flag: "🇨🇳",
    name: "中国人民银行",
    shortName: "PBoC",
    rateName: "1 年期 LPR",
    rate: 3.1,
    prevRate: 3.1,
    lastChange: "2025-10-20",
    lastAction: "维持",
    nextMeeting: "2026-05-20",
    governor: "潘功胜",
    notes: "强调结构性工具与逆周期调节并重，5 月可能再降准",
    accent: "rose",
    history: [
      { date: "2025-10-20", rateAfter: 3.1, changeBp: -25, note: "LPR 下调 25bp" },
      { date: "2025-07-22", rateAfter: 3.35, changeBp: -10 },
      { date: "2025-02-20", rateAfter: 3.45, changeBp: 0 },
      { date: "2024-07-22", rateAfter: 3.45, changeBp: -10 },
    ],
    narrative: {
      past:
        "央行政策从 2024 年起进入'适度宽松'阶段（货币政策定调时隔 14 年再次使用），降准降息 + 结构性工具 + 逆周期调节多管齐下。LPR 累计下调约 60bp。",
      present:
        "经济呈现'结构性通缩'：CPI 偏低、PPI 同比为负、地产周期仍在筑底。核心矛盾不是利率水平，而是融资需求疲弱（信贷增速持续下行）。降息边际效用递减，因此央行更多依赖结构性工具（PSL、专项再贷款等）和准备金率工具。",
      future:
        "市场预期 5 月降准 25-50bp 概率较高。LPR 进一步下调取决于内需修复、地产销售、出口情况。中美利差倒挂仍制约人民币贬值压力下的降息空间。",
    },
    newsKeyword: "央行 LPR",
  },
  {
    id: "rba",
    flag: "🇦🇺",
    name: "澳洲联储",
    shortName: "RBA",
    rateName: "现金利率",
    rate: 3.85,
    prevRate: 4.1,
    lastChange: "2026-04-01",
    lastAction: "降息",
    nextMeeting: "2026-05-20",
    governor: "Michele Bullock",
    notes: "通胀进入 2–3% 区间，4 月开启降息周期",
    accent: "emerald",
    history: [
      { date: "2026-04-01", rateAfter: 3.85, changeBp: -25, note: "降息周期开启" },
      { date: "2026-02-18", rateAfter: 4.1, changeBp: 0 },
      { date: "2024-11-05", rateAfter: 4.1, changeBp: 0 },
    ],
    narrative: {
      past:
        "RBA 是发达经济体中最后开始降息的主要央行之一，长期维持 4.35% 高位。原因：澳大利亚通胀粘性（住房 + 服务业），以及就业市场紧绷。2026 年 2 月首次试探性降至 4.10%。",
      present:
        "整体 CPI 进入 2-3% 目标区间，劳动力市场出现降温迹象。4 月正式启动降息周期，幅度 25bp。澳元因此走弱，对铁矿石定价构成支撑。",
      future:
        "市场定价年内再降 50-75bp，终点利率 3.0-3.25%。变量：中国房地产需求、铁矿石价格、美澳利差。",
    },
    newsKeyword: "澳洲联储",
  },
  {
    id: "bsnk",
    flag: "🇨🇭",
    name: "瑞士国家银行",
    shortName: "SNB",
    rateName: "政策利率",
    rate: 0.25,
    prevRate: 0.5,
    lastChange: "2026-03-20",
    lastAction: "降息",
    nextMeeting: "2026-06-20",
    governor: "Martin Schlegel",
    notes: "瑞郎走强压制通胀，3 月降息 25bp 至 0.25%",
    accent: "cyan",
    history: [
      { date: "2026-03-20", rateAfter: 0.25, changeBp: -25 },
      { date: "2025-12-12", rateAfter: 0.5, changeBp: -50 },
      { date: "2025-09-26", rateAfter: 1.0, changeBp: -25 },
      { date: "2025-06-20", rateAfter: 1.25, changeBp: -25 },
    ],
    narrative: {
      past:
        "SNB 降息节奏远超欧元区，因瑞郎避险属性使其走强，输入型通缩压力大。从 2025 年 6 月以来已连续降息 100bp。",
      present:
        "瑞士 CPI 已降至 0.5% 以下，逼近通缩边缘。SNB 多次干预外汇市场（卖瑞郎买外币）但效果有限。3 月再降 25bp 至 0.25%，距离零利率仅一步之遥。",
      future:
        "市场预期年内可能再降 25bp 甚至重返零利率/负利率。如果瑞郎继续走强 + 通胀进一步下行，NIRP 重启不能排除。",
    },
    newsKeyword: "瑞士央行",
  },
  {
    id: "bocan",
    flag: "🇨🇦",
    name: "加拿大央行",
    shortName: "BoC",
    rateName: "隔夜目标利率",
    rate: 2.75,
    prevRate: 3.0,
    lastChange: "2026-03-12",
    lastAction: "降息",
    nextMeeting: "2026-06-04",
    governor: "Tiff Macklem",
    notes: "经济增速放缓，连续降息以缓解房贷压力",
    accent: "rose",
    history: [
      { date: "2026-03-12", rateAfter: 2.75, changeBp: -25 },
      { date: "2026-01-29", rateAfter: 3.0, changeBp: -25 },
      { date: "2025-12-11", rateAfter: 3.25, changeBp: -50 },
      { date: "2025-10-23", rateAfter: 3.75, changeBp: -50 },
      { date: "2024-06-05", rateAfter: 4.75, changeBp: -25, note: "降息周期开启" },
    ],
    narrative: {
      past:
        "BoC 是 G7 中最早降息的（2024 年 6 月），累计降息 200bp+。原因：加拿大对利率敏感度极高（家庭杠杆率全球最高 + 5 年期房贷续约潮）。",
      present:
        "GDP 增速放缓至 1% 区间，失业率升至 6.5%。降息节奏快于预期是为缓解房贷续约冲击：2025-2026 大量 5 年前低利率房贷集中到期续约。",
      future:
        "市场预期年内再降 50bp 至 2.25%。变量：美加贸易摩擦（关税）、加元汇率、油价。",
    },
    newsKeyword: "加拿大央行",
  },
];

export const ACCENT_GRADIENT: Record<AccentColor, string> = {
  cyan: "from-cyan-accent/20 to-cyan-accent/5 border-cyan-accent/30",
  rose: "from-rose-accent/20 to-rose-accent/5 border-rose-accent/30",
  purple: "from-purple-accent/20 to-purple-accent/5 border-purple-accent/30",
  emerald: "from-emerald-accent/20 to-emerald-accent/5 border-emerald-accent/30",
  blue: "from-blue-accent/20 to-blue-accent/5 border-blue-accent/30",
  amber: "from-amber-400/20 to-amber-400/5 border-amber-400/30",
};

export const ACTION_COLOR: Record<LastAction, string> = {
  加息: "text-rose-accent border-rose-accent/40 bg-rose-accent/10",
  降息: "text-emerald-accent border-emerald-accent/40 bg-emerald-accent/10",
  维持: "text-text-secondary border-border-default bg-bg-card",
};
