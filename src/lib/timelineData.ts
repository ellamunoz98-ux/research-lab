/**
 * 申请 Timeline 数据源（单一事实源）
 *
 * 编辑指南：
 * - 改完保存后 git push 即可，Cloudflare Pages 会重建
 * - Worker 每日 cron 会从 /timeline.json 拉这份数据，做开放/截止提醒 + URL 变更监控
 * - 日期不确定的填 estimated: true 并给一个估算窗口；正式开放后改成 estimated: false 并填实际日期
 * - 新增条目记得给唯一 id（短横线分隔，全小写）
 */

export type TimelineCategory =
  | "master" // 港大硕士项目
  | "ib-er" // 外资投行 ER
  | "mutual-fund" // 中资公募
  | "private-fund"; // 中资私募 fundamental 多头

export type TimelineRegion = "HK" | "US" | "EU" | "JP" | "CN";
export type TimelineStatus = "upcoming" | "open" | "closed" | "tbd";

export interface TimelinePhase {
  /** 机器友好 id，跨年份一致：round-1 / summer-2027 / fall-2026 ... */
  phase: string;
  /** 中文展示名 */
  label: string;
  /** YYYY-MM-DD；可缺失（status: tbd） */
  opens?: string;
  closes?: string;
  status: TimelineStatus;
  /** 是否估算值（红色提示用户去官网核实） */
  estimated?: boolean;
  notes?: string;
}

export interface TimelineItem {
  id: string;
  type: "program" | "company";
  category: TimelineCategory;
  name: string;
  shortName?: string;
  region: TimelineRegion;
  /** 项目主页或公司 careers 入口 */
  url: string;
  /**
   * Worker 每日 hash diff 这个页面，变化时推送提醒
   * 优先填申请页/招聘公告页（比 careers 入口更稳定指向具体内容）
   */
  monitorUrl?: string;
  timeline: TimelinePhase[];
  notes?: string;
}

export const CATEGORY_LABEL: Record<TimelineCategory, string> = {
  master: "港大硕士",
  "ib-er": "外资投行 ER",
  "mutual-fund": "中资公募",
  "private-fund": "中资私募",
};

export const REGION_LABEL: Record<TimelineRegion, string> = {
  HK: "香港",
  US: "美资",
  EU: "欧资",
  JP: "日资",
  CN: "中国大陆",
};

export const STATUS_LABEL: Record<TimelineStatus, string> = {
  upcoming: "即将开放",
  open: "投递中",
  closed: "已截止",
  tbd: "待定",
};

/** 当前申请季的代号，用于 phase id（每年滚动一次） */
const SEASON_2027_SUMMER = "summer-2027"; // 2026 秋招 → 2027 暑期
const SEASON_2028_FT = "fulltime-2028"; // 2027 秋招 → 2028 全职

export const timelineItems: TimelineItem[] = [
  /* ============================== 港大硕士（3） ============================== */
  {
    id: "hku-mfin",
    type: "program",
    category: "master",
    name: "HKU Master of Finance",
    shortName: "HKU MFin",
    region: "HK",
    url: "https://www.hkubs.hku.hk/programmes/master-of-finance/",
    monitorUrl:
      "https://www.hkubs.hku.hk/programmes/master-of-finance/admissions/",
    timeline: [
      {
        phase: "round-1",
        label: "Round 1（首轮）",
        opens: "2026-09-15",
        closes: "2026-12-01",
        status: "upcoming",
        estimated: true,
      },
      {
        phase: "round-2",
        label: "Round 2（次轮）",
        opens: "2026-12-15",
        closes: "2027-02-28",
        status: "upcoming",
        estimated: true,
      },
      {
        phase: "round-3",
        label: "Round 3（末轮）",
        opens: "2027-03-01",
        closes: "2027-05-31",
        status: "upcoming",
        estimated: true,
      },
    ],
    notes:
      "HKU MFin 含 FinTech / Corporate Finance / Risk Management 三个 stream；轮次基于历年规律估算。",
  },
  {
    id: "hku-mecon",
    type: "program",
    category: "master",
    name: "HKU Master of Economics",
    shortName: "HKU MEcon",
    region: "HK",
    url: "https://www.econ.hku.hk/mecon/",
    monitorUrl: "https://www.econ.hku.hk/mecon/admissions/",
    timeline: [
      {
        phase: "round-1",
        label: "Round 1（首轮）",
        opens: "2026-10-01",
        closes: "2026-12-15",
        status: "upcoming",
        estimated: true,
      },
      {
        phase: "round-2",
        label: "Round 2（末轮）",
        opens: "2026-12-16",
        closes: "2027-04-30",
        status: "upcoming",
        estimated: true,
      },
    ],
  },
  {
    id: "hku-mba-analytics",
    type: "program",
    category: "master",
    name: "HKU MSc in Business Analytics",
    shortName: "HKU MSBA",
    region: "HK",
    url: "https://www.hkubs.hku.hk/programmes/master-of-science-in-business-analytics/",
    monitorUrl:
      "https://www.hkubs.hku.hk/programmes/master-of-science-in-business-analytics/admissions/",
    timeline: [
      {
        phase: "round-1",
        label: "Round 1（首轮）",
        opens: "2026-09-15",
        closes: "2026-11-30",
        status: "upcoming",
        estimated: true,
      },
      {
        phase: "round-2",
        label: "Round 2（次轮）",
        opens: "2026-12-01",
        closes: "2027-02-28",
        status: "upcoming",
        estimated: true,
      },
      {
        phase: "round-3",
        label: "Round 3（末轮）",
        opens: "2027-03-01",
        closes: "2027-05-15",
        status: "upcoming",
        estimated: true,
      },
    ],
  },

  /* ============================== 外资投行 ER（8） ============================== */
  {
    id: "gs",
    type: "company",
    category: "ib-er",
    name: "Goldman Sachs",
    shortName: "GS",
    region: "US",
    url: "https://www.goldmansachs.com/careers/",
    monitorUrl:
      "https://www.goldmansachs.com/careers/students/programs/asia-pacific/summer-analyst/",
    timeline: [
      {
        phase: SEASON_2027_SUMMER,
        label: "APAC Summer Analyst 2027（含 ER）",
        opens: "2026-08-15",
        closes: "2026-10-31",
        status: "upcoming",
        estimated: true,
        notes: "GS APAC summer 通常最早开，关注度最高",
      },
      {
        phase: SEASON_2028_FT,
        label: "Full-Time Analyst 2028",
        opens: "2027-07-01",
        closes: "2027-09-30",
        status: "upcoming",
        estimated: true,
      },
    ],
  },
  {
    id: "ms",
    type: "company",
    category: "ib-er",
    name: "Morgan Stanley",
    shortName: "MS",
    region: "US",
    url: "https://www.morganstanley.com/people-opportunities/students-graduates",
    monitorUrl:
      "https://www.morganstanley.com/people-opportunities/students-graduates/programs",
    timeline: [
      {
        phase: SEASON_2027_SUMMER,
        label: "APAC Summer Associate/Analyst 2027（Research）",
        opens: "2026-08-20",
        closes: "2026-10-31",
        status: "upcoming",
        estimated: true,
      },
      {
        phase: SEASON_2028_FT,
        label: "Full-Time 2028",
        opens: "2027-07-01",
        closes: "2027-10-31",
        status: "upcoming",
        estimated: true,
      },
    ],
  },
  {
    id: "jpm",
    type: "company",
    category: "ib-er",
    name: "J.P. Morgan",
    shortName: "JPM",
    region: "US",
    url: "https://careers.jpmorgan.com/global/en/students/programs",
    monitorUrl:
      "https://careers.jpmorgan.com/global/en/students/programs/summer-analyst-asia-pacific",
    timeline: [
      {
        phase: SEASON_2027_SUMMER,
        label: "APAC Summer Analyst 2027（Equity Research）",
        opens: "2026-09-01",
        closes: "2026-11-15",
        status: "upcoming",
        estimated: true,
      },
      {
        phase: SEASON_2028_FT,
        label: "Full-Time 2028",
        opens: "2027-07-15",
        closes: "2027-10-31",
        status: "upcoming",
        estimated: true,
      },
    ],
  },
  {
    id: "ubs",
    type: "company",
    category: "ib-er",
    name: "UBS",
    region: "EU",
    url: "https://www.ubs.com/global/en/careers/students.html",
    monitorUrl:
      "https://www.ubs.com/global/en/careers/students/internships/asia-pacific.html",
    timeline: [
      {
        phase: SEASON_2027_SUMMER,
        label: "APAC Summer Internship 2027",
        opens: "2026-08-15",
        closes: "2026-10-31",
        status: "upcoming",
        estimated: true,
      },
      {
        phase: SEASON_2028_FT,
        label: "Graduate Programme 2028",
        opens: "2027-07-01",
        closes: "2027-10-31",
        status: "upcoming",
        estimated: true,
      },
    ],
  },
  {
    id: "citi",
    type: "company",
    category: "ib-er",
    name: "Citigroup",
    shortName: "Citi",
    region: "US",
    url: "https://jobs.citi.com/early-careers",
    monitorUrl: "https://jobs.citi.com/asia-pacific-early-careers",
    timeline: [
      {
        phase: SEASON_2027_SUMMER,
        label: "APAC Summer Analyst 2027",
        opens: "2026-09-01",
        closes: "2026-11-15",
        status: "upcoming",
        estimated: true,
      },
      {
        phase: SEASON_2028_FT,
        label: "Full-Time Analyst 2028",
        opens: "2027-07-15",
        closes: "2027-10-31",
        status: "upcoming",
        estimated: true,
      },
    ],
  },
  {
    id: "bofa",
    type: "company",
    category: "ib-er",
    name: "Bank of America",
    shortName: "BofA",
    region: "US",
    url: "https://campus.bankofamerica.com/",
    monitorUrl: "https://campus.bankofamerica.com/careers/asia-pacific.html",
    timeline: [
      {
        phase: SEASON_2027_SUMMER,
        label: "APAC Summer Analyst 2027",
        opens: "2026-09-01",
        closes: "2026-11-15",
        status: "upcoming",
        estimated: true,
      },
      {
        phase: SEASON_2028_FT,
        label: "Full-Time Analyst 2028",
        opens: "2027-07-15",
        closes: "2027-10-31",
        status: "upcoming",
        estimated: true,
      },
    ],
  },
  {
    id: "bnp",
    type: "company",
    category: "ib-er",
    name: "BNP Paribas",
    shortName: "BNP",
    region: "EU",
    url: "https://group.bnpparibas/en/careers",
    monitorUrl:
      "https://group.bnpparibas/en/careers/students-graduates/asia-pacific",
    timeline: [
      {
        phase: SEASON_2027_SUMMER,
        label: "APAC Summer Internship 2027",
        opens: "2026-09-15",
        closes: "2026-11-30",
        status: "upcoming",
        estimated: true,
      },
      {
        phase: SEASON_2028_FT,
        label: "Graduate Programme 2028",
        opens: "2027-08-01",
        closes: "2027-10-31",
        status: "upcoming",
        estimated: true,
      },
    ],
  },
  {
    id: "nomura",
    type: "company",
    category: "ib-er",
    name: "Nomura",
    region: "JP",
    url: "https://www.nomura.com/careers/students-and-graduates/",
    monitorUrl:
      "https://www.nomura.com/careers/students-and-graduates/asia-ex-japan/",
    timeline: [
      {
        phase: SEASON_2027_SUMMER,
        label: "Asia ex-Japan Summer Internship 2027",
        opens: "2026-10-01",
        closes: "2026-12-15",
        status: "upcoming",
        estimated: true,
        notes: "野村节奏通常比美资晚 1-2 个月",
      },
      {
        phase: SEASON_2028_FT,
        label: "Asia ex-Japan Graduate 2028",
        opens: "2027-09-01",
        closes: "2027-11-30",
        status: "upcoming",
        estimated: true,
      },
    ],
  },

  /* ============================== 中资公募（14） ============================== */
  {
    id: "efunds",
    type: "company",
    category: "mutual-fund",
    name: "易方达基金",
    region: "CN",
    url: "https://www.efunds.com.cn/",
    monitorUrl: "https://www.efunds.com.cn/aboutEFunds/recruitment.html",
    timeline: [
      {
        phase: "fall-2026",
        label: "2026 秋招（含研究员）",
        opens: "2026-09-01",
        closes: "2026-10-31",
        status: "upcoming",
        estimated: true,
      },
      {
        phase: "spring-2027",
        label: "2027 春招暑期实习",
        opens: "2027-03-01",
        closes: "2027-04-30",
        status: "upcoming",
        estimated: true,
      },
    ],
  },
  {
    id: "chinaamc",
    type: "company",
    category: "mutual-fund",
    name: "华夏基金",
    region: "CN",
    url: "https://www.chinaamc.com/",
    monitorUrl: "https://www.chinaamc.com/about/joinus.shtml",
    timeline: [
      {
        phase: "fall-2026",
        label: "2026 秋招",
        opens: "2026-09-01",
        closes: "2026-10-31",
        status: "upcoming",
        estimated: true,
      },
      {
        phase: "spring-2027",
        label: "2027 春招暑期实习",
        opens: "2027-03-01",
        closes: "2027-04-30",
        status: "upcoming",
        estimated: true,
      },
    ],
  },
  {
    id: "jsfund",
    type: "company",
    category: "mutual-fund",
    name: "嘉实基金",
    region: "CN",
    url: "https://www.jsfund.cn/",
    monitorUrl: "https://www.jsfund.cn/main/aboutus/recruitment/index.shtml",
    timeline: [
      {
        phase: "fall-2026",
        label: "2026 秋招",
        opens: "2026-09-01",
        closes: "2026-10-31",
        status: "upcoming",
        estimated: true,
      },
    ],
  },
  {
    id: "gffunds",
    type: "company",
    category: "mutual-fund",
    name: "广发基金",
    region: "CN",
    url: "https://www.gffunds.com.cn/",
    monitorUrl: "https://www.gffunds.com.cn/about/recruit.shtml",
    timeline: [
      {
        phase: "fall-2026",
        label: "2026 秋招",
        opens: "2026-09-01",
        closes: "2026-10-31",
        status: "upcoming",
        estimated: true,
      },
    ],
  },
  {
    id: "bosera",
    type: "company",
    category: "mutual-fund",
    name: "博时基金",
    region: "CN",
    url: "https://www.bosera.com/",
    monitorUrl: "https://www.bosera.com/aboutBosera/recruit.html",
    timeline: [
      {
        phase: "fall-2026",
        label: "2026 秋招",
        opens: "2026-09-01",
        closes: "2026-10-31",
        status: "upcoming",
        estimated: true,
      },
    ],
  },
  {
    id: "cmfchina",
    type: "company",
    category: "mutual-fund",
    name: "招商基金",
    region: "CN",
    url: "https://www.cmfchina.com/",
    monitorUrl: "https://www.cmfchina.com/about/recruit/",
    timeline: [
      {
        phase: "fall-2026",
        label: "2026 秋招",
        opens: "2026-09-01",
        closes: "2026-10-31",
        status: "upcoming",
        estimated: true,
      },
    ],
  },
  {
    id: "fullgoal",
    type: "company",
    category: "mutual-fund",
    name: "富国基金",
    region: "CN",
    url: "https://www.fullgoal.com.cn/",
    monitorUrl: "https://www.fullgoal.com.cn/joinUs.html",
    timeline: [
      {
        phase: "fall-2026",
        label: "2026 秋招",
        opens: "2026-09-01",
        closes: "2026-10-31",
        status: "upcoming",
        estimated: true,
      },
    ],
  },
  {
    id: "nffund",
    type: "company",
    category: "mutual-fund",
    name: "南方基金",
    region: "CN",
    url: "https://www.nffund.com/",
    monitorUrl: "https://www.nffund.com/main/aboutNF/joinUs/",
    timeline: [
      {
        phase: "fall-2026",
        label: "2026 秋招",
        opens: "2026-09-01",
        closes: "2026-10-31",
        status: "upcoming",
        estimated: true,
      },
    ],
  },
  {
    id: "99fund",
    type: "company",
    category: "mutual-fund",
    name: "汇添富基金",
    region: "CN",
    url: "https://www.99fund.com/",
    monitorUrl: "https://www.99fund.com/about/joinUs.shtml",
    timeline: [
      {
        phase: "fall-2026",
        label: "2026 秋招",
        opens: "2026-09-01",
        closes: "2026-10-31",
        status: "upcoming",
        estimated: true,
      },
    ],
  },
  {
    id: "icbccs",
    type: "company",
    category: "mutual-fund",
    name: "工银瑞信",
    region: "CN",
    url: "https://www.icbccs.com.cn/",
    monitorUrl: "https://www.icbccs.com.cn/about/recruit/",
    timeline: [
      {
        phase: "fall-2026",
        label: "2026 秋招",
        opens: "2026-09-01",
        closes: "2026-10-31",
        status: "upcoming",
        estimated: true,
      },
    ],
  },
  {
    id: "xyfunds",
    type: "company",
    category: "mutual-fund",
    name: "兴证全球（兴全）",
    region: "CN",
    url: "https://www.xyfunds.com.cn/",
    monitorUrl: "https://www.xyfunds.com.cn/about/joinus/",
    timeline: [
      {
        phase: "fall-2026",
        label: "2026 秋招",
        opens: "2026-09-01",
        closes: "2026-10-31",
        status: "upcoming",
        estimated: true,
      },
    ],
  },
  {
    id: "zofund",
    type: "company",
    category: "mutual-fund",
    name: "中欧基金",
    region: "CN",
    url: "https://www.zofund.com/",
    monitorUrl: "https://www.zofund.com/about/recruitment.html",
    timeline: [
      {
        phase: "fall-2026",
        label: "2026 秋招",
        opens: "2026-09-01",
        closes: "2026-10-31",
        status: "upcoming",
        estimated: true,
      },
    ],
  },
  {
    id: "huaan",
    type: "company",
    category: "mutual-fund",
    name: "华安基金",
    region: "CN",
    url: "https://www.huaan.com.cn/",
    monitorUrl: "https://www.huaan.com.cn/about/joinUs/",
    timeline: [
      {
        phase: "fall-2026",
        label: "2026 秋招",
        opens: "2026-09-01",
        closes: "2026-10-31",
        status: "upcoming",
        estimated: true,
      },
    ],
  },
  {
    id: "phfund",
    type: "company",
    category: "mutual-fund",
    name: "鹏华基金",
    region: "CN",
    url: "https://www.phfund.com.cn/",
    monitorUrl: "https://www.phfund.com.cn/about/joinUs.html",
    timeline: [
      {
        phase: "fall-2026",
        label: "2026 秋招",
        opens: "2026-09-01",
        closes: "2026-10-31",
        status: "upcoming",
        estimated: true,
      },
    ],
  },

  /* ============================== 中资私募（9，fundamental 多头） ============================== */
  {
    id: "gaoyi",
    type: "company",
    category: "private-fund",
    name: "高毅资产",
    region: "CN",
    url: "http://www.gyzcgs.com/",
    monitorUrl: "http://www.gyzcgs.com/joinUs.html",
    timeline: [
      {
        phase: "fall-2026",
        label: "2026 秋招（研究员/投资助理）",
        opens: "2026-09-01",
        closes: "2026-10-31",
        status: "upcoming",
        estimated: true,
      },
    ],
    notes:
      "私募招聘节奏不固定，校招外大量靠 networking + 内推；建议持续关注公众号「高毅资产」。",
  },
  {
    id: "greenwoods",
    type: "company",
    category: "private-fund",
    name: "景林资产",
    region: "CN",
    url: "http://www.greenwoodsasset.com/",
    monitorUrl: "http://www.greenwoodsasset.com/about/career.html",
    timeline: [
      {
        phase: "fall-2026",
        label: "2026 秋招",
        opens: "2026-10-01",
        closes: "2026-11-30",
        status: "upcoming",
        estimated: true,
      },
    ],
    notes: "建议关注公众号「景林资产」+ 校招宣讲。",
  },
  {
    id: "springs",
    type: "company",
    category: "private-fund",
    name: "淡水泉投资",
    region: "CN",
    url: "https://www.springsasset.com/",
    monitorUrl: "https://www.springsasset.com/about/joinus.html",
    timeline: [
      {
        phase: "fall-2026",
        label: "2026 秋招",
        status: "tbd",
        estimated: true,
      },
    ],
    notes: "招聘节奏不固定；关注公众号「淡水泉投资」。",
  },
  {
    id: "chongyang",
    type: "company",
    category: "private-fund",
    name: "重阳投资",
    region: "CN",
    url: "http://www.chongyangcapital.com/",
    monitorUrl: "http://www.chongyangcapital.com/joinus/",
    timeline: [
      {
        phase: "fall-2026",
        label: "2026 秋招",
        status: "tbd",
        estimated: true,
      },
    ],
    notes: "节奏不固定；公众号「重阳投资」。",
  },
  {
    id: "qianhe",
    type: "company",
    category: "private-fund",
    name: "千合资本",
    region: "CN",
    url: "http://www.qianhecapital.com/",
    timeline: [
      {
        phase: "fall-2026",
        label: "2026 秋招",
        status: "tbd",
        estimated: true,
      },
    ],
    notes: "节奏不固定；主要靠 networking 和定向内推。",
  },
  {
    id: "yuanlechen",
    type: "company",
    category: "private-fund",
    name: "源乐晟资产",
    region: "CN",
    url: "http://www.yuanlechen.com/",
    timeline: [
      {
        phase: "fall-2026",
        label: "2026 秋招",
        status: "tbd",
        estimated: true,
      },
    ],
    notes: "节奏不固定；关注公众号「源乐晟」。",
  },
  {
    id: "ningquan",
    type: "company",
    category: "private-fund",
    name: "宁泉资产",
    region: "CN",
    url: "http://www.ningquanasset.com/",
    timeline: [
      {
        phase: "fall-2026",
        label: "2026 秋招",
        status: "tbd",
        estimated: true,
      },
    ],
    notes: "杨东背景，研究氛围浓；招聘信息靠官网/公众号。",
  },
  {
    id: "hxhy",
    type: "company",
    category: "private-fund",
    name: "和谐汇一",
    region: "CN",
    url: "http://www.hxhyinv.com/",
    timeline: [
      {
        phase: "fall-2026",
        label: "2026 秋招",
        status: "tbd",
        estimated: true,
      },
    ],
    notes: "林鹏团队，节奏不固定；关注公众号「和谐汇一」。",
  },
  {
    id: "juming",
    type: "company",
    category: "private-fund",
    name: "聚鸣投资",
    region: "CN",
    url: "http://www.juminginv.com/",
    timeline: [
      {
        phase: "fall-2026",
        label: "2026 秋招",
        status: "tbd",
        estimated: true,
      },
    ],
    notes: "节奏不固定；关注公众号「聚鸣投资」。",
  },
];

/* ------------------------------------------------------------------ */
/*                              工具函数                                */
/* ------------------------------------------------------------------ */

/** 给定日期字符串，返回距今的天数（正数=未来，负数=过去）。无效输入返回 null */
export function daysFromNow(dateStr?: string, today: Date = new Date()): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  const t0 = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  return Math.round((d.getTime() - t0.getTime()) / 86_400_000);
}

/** 根据日期自动推算 status（不覆盖手动设的 closed） */
export function deriveStatus(phase: TimelinePhase, today = new Date()): TimelineStatus {
  if (phase.status === "closed") return "closed";
  const dOpen = daysFromNow(phase.opens, today);
  const dClose = daysFromNow(phase.closes, today);
  if (dOpen === null && dClose === null) return "tbd";
  if (dOpen !== null && dOpen > 0) return "upcoming";
  if (dClose !== null && dClose < 0) return "closed";
  return "open";
}

/** 用于 cron：找出今天起 N 天内会开放或截止的 phase */
export interface UpcomingEvent {
  itemId: string;
  itemName: string;
  category: TimelineCategory;
  phaseLabel: string;
  kind: "opens" | "closes";
  date: string;
  daysAway: number;
  estimated: boolean;
  url: string;
}

export function findUpcomingEvents(
  items: TimelineItem[],
  windowDays: number,
  today: Date = new Date()
): UpcomingEvent[] {
  const out: UpcomingEvent[] = [];
  for (const item of items) {
    for (const phase of item.timeline) {
      for (const kind of ["opens", "closes"] as const) {
        const dateStr = phase[kind];
        if (!dateStr) continue;
        const days = daysFromNow(dateStr, today);
        if (days === null) continue;
        if (days < 0 || days > windowDays) continue;
        out.push({
          itemId: item.id,
          itemName: item.shortName ?? item.name,
          category: item.category,
          phaseLabel: phase.label,
          kind,
          date: dateStr,
          daysAway: days,
          estimated: !!phase.estimated,
          url: item.url,
        });
      }
    }
  }
  return out.sort((a, b) => a.daysAway - b.daysAway);
}
