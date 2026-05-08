/**
 * 全球金融中心数据 + 对应的关键指数列表
 * 数据源代号：
 *   - eastmoney 的 secid (1.000001 = 上证指数等)
 *   - coingecko id (bitcoin / ethereum 等)
 *   - er-api currency code (USD / EUR 等，由组件转换)
 */

import { proxied } from "./proxy";

export interface IndexQuote {
  /** 东方财富 secid（A股/港股/美股/日股/欧股/部分商品） */
  secid?: string;
  /** CoinGecko id（加密货币） */
  coingeckoId?: string;
  label: string;
  /** 显示前缀，如 "$" "¥" "€" "£" */
  prefix?: string;
  /** 小数位 */
  decimals?: number;
  /** 副标签（可选） */
  hint?: string;
}

export interface FinancialCenter {
  id: string;
  name: string;       // 区域中文名
  city: string;       // 主要金融城市
  country: string;
  /** 国旗 emoji 或图标 */
  flag: string;
  /** 地理坐标 */
  lat: number;
  lng: number;
  /** 标记颜色（暗色科技配色） */
  color: string;
  /** 标记权重（影响视觉大小） */
  weight: number;
  /** 该区域关键金融资产 */
  indices: IndexQuote[];
  /** 一句话定位 */
  tagline: string;
}

export const FINANCIAL_CENTERS: FinancialCenter[] = [
  {
    id: "cn-mainland",
    name: "中国大陆",
    city: "上海 / 深圳",
    country: "China",
    flag: "🇨🇳",
    lat: 31.23,
    lng: 121.47,
    color: "#fb7185",
    weight: 1.2,
    tagline: "全球第二大股票市场，A 股双轨上市制度",
    indices: [
      { secid: "1.000001", label: "上证指数", decimals: 2 },
      { secid: "0.399001", label: "深证成指", decimals: 2 },
      { secid: "0.399006", label: "创业板指", decimals: 2 },
      { secid: "1.000300", label: "沪深 300", decimals: 2 },
      { secid: "0.399905", label: "中证 500", decimals: 2 },
    ],
  },
  {
    id: "hk",
    name: "中国香港",
    city: "Hong Kong",
    country: "Hong Kong",
    flag: "🇭🇰",
    lat: 22.32,
    lng: 114.17,
    color: "#a78bfa",
    weight: 1.0,
    tagline: "亚洲最重要的国际金融中心之一",
    indices: [
      { secid: "100.HSI", label: "恒生指数", decimals: 2 },
      { secid: "100.HSCEI", label: "恒生中国企业指数", decimals: 2 },
      { secid: "100.HSTECH", label: "恒生科技指数", decimals: 2 },
    ],
  },
  {
    id: "us-east",
    name: "美国 · 纽约",
    city: "New York",
    country: "United States",
    flag: "🇺🇸",
    lat: 40.71,
    lng: -74.0,
    color: "#22d3ee",
    weight: 1.4,
    tagline: "全球最大资本市场，纽交所与纳斯达克所在地",
    indices: [
      { secid: "100.DJIA", label: "道琼斯工业指数", decimals: 2 },
      { secid: "100.SPX", label: "标普 500", decimals: 2 },
      { secid: "100.NDX", label: "纳斯达克 100", decimals: 2 },
      { secid: "100.RUT", label: "罗素 2000", decimals: 2 },
    ],
  },
  {
    id: "uk",
    name: "英国 · 伦敦",
    city: "London",
    country: "United Kingdom",
    flag: "🇬🇧",
    lat: 51.51,
    lng: -0.13,
    color: "#3b82f6",
    weight: 1.0,
    tagline: "欧洲最大金融中心，外汇之都",
    indices: [
      { secid: "100.FTSE", label: "富时 100", decimals: 2 },
    ],
  },
  {
    id: "de",
    name: "德国 · 法兰克福",
    city: "Frankfurt",
    country: "Germany",
    flag: "🇩🇪",
    lat: 50.11,
    lng: 8.68,
    color: "#34d399",
    weight: 0.9,
    tagline: "欧元区核心资本市场",
    indices: [
      { secid: "100.GDAXI", label: "DAX 30", decimals: 2 },
    ],
  },
  {
    id: "fr",
    name: "法国 · 巴黎",
    city: "Paris",
    country: "France",
    flag: "🇫🇷",
    lat: 48.85,
    lng: 2.35,
    color: "#a78bfa",
    weight: 0.8,
    tagline: "巴黎泛欧交易所",
    indices: [
      { secid: "100.FCHI", label: "CAC 40", decimals: 2 },
    ],
  },
  {
    id: "jp",
    name: "日本 · 东京",
    city: "Tokyo",
    country: "Japan",
    flag: "🇯🇵",
    lat: 35.68,
    lng: 139.69,
    color: "#fb7185",
    weight: 1.0,
    tagline: "亚洲最大成熟资本市场",
    indices: [
      { secid: "100.N225", label: "日经 225", decimals: 2 },
      { secid: "100.TOPX", label: "东证指数", decimals: 2 },
    ],
  },
  {
    id: "kr",
    name: "韩国 · 首尔",
    city: "Seoul",
    country: "South Korea",
    flag: "🇰🇷",
    lat: 37.57,
    lng: 126.98,
    color: "#22d3ee",
    weight: 0.7,
    tagline: "科技股 / 半导体重要市场",
    indices: [
      { secid: "100.KS11", label: "韩国综合指数", decimals: 2 },
    ],
  },
  {
    id: "in",
    name: "印度 · 孟买",
    city: "Mumbai",
    country: "India",
    flag: "🇮🇳",
    lat: 19.08,
    lng: 72.88,
    color: "#f59e0b",
    weight: 0.8,
    tagline: "新兴市场最大权重",
    indices: [
      { secid: "100.SENSEX", label: "孟买 SENSEX", decimals: 2 },
    ],
  },
  {
    id: "sg",
    name: "新加坡",
    city: "Singapore",
    country: "Singapore",
    flag: "🇸🇬",
    lat: 1.35,
    lng: 103.82,
    color: "#34d399",
    weight: 0.7,
    tagline: "东南亚金融枢纽",
    indices: [
      { secid: "100.STI", label: "海峡时报指数", decimals: 2 },
    ],
  },
  {
    id: "au",
    name: "澳洲 · 悉尼",
    city: "Sydney",
    country: "Australia",
    flag: "🇦🇺",
    lat: -33.87,
    lng: 151.21,
    color: "#3b82f6",
    weight: 0.7,
    tagline: "大宗商品挂钩市场",
    indices: [
      { secid: "100.AS51", label: "澳洲 ASX 200", decimals: 2 },
    ],
  },
  {
    id: "br",
    name: "巴西 · 圣保罗",
    city: "São Paulo",
    country: "Brazil",
    flag: "🇧🇷",
    lat: -23.55,
    lng: -46.63,
    color: "#34d399",
    weight: 0.6,
    tagline: "拉美最大资本市场",
    indices: [
      { secid: "100.IBOV", label: "巴西 BOVESPA", decimals: 0 },
    ],
  },
  {
    id: "ca",
    name: "加拿大 · 多伦多",
    city: "Toronto",
    country: "Canada",
    flag: "🇨🇦",
    lat: 43.65,
    lng: -79.38,
    color: "#fb7185",
    weight: 0.7,
    tagline: "资源能源股密集",
    indices: [
      { secid: "100.GSPTSE", label: "S&P/TSX", decimals: 2 },
    ],
  },
  {
    id: "ru",
    name: "俄罗斯 · 莫斯科",
    city: "Moscow",
    country: "Russia",
    flag: "🇷🇺",
    lat: 55.75,
    lng: 37.62,
    color: "#f59e0b",
    weight: 0.5,
    tagline: "能源大国资本市场",
    indices: [
      { secid: "100.IMOEX", label: "MOEX 俄罗斯指数", decimals: 2 },
    ],
  },
  // 加密货币 / 全球资产 — 没有"中心"，但放一个特殊点
  {
    id: "crypto",
    name: "全球加密资产",
    city: "去中心化",
    country: "Global",
    flag: "₿",
    lat: 0,
    lng: -30,
    color: "#f59e0b",
    weight: 1.1,
    tagline: "无主权资产，7×24 小时交易",
    indices: [
      { coingeckoId: "bitcoin", label: "比特币 BTC", prefix: "$", decimals: 0 },
      { coingeckoId: "ethereum", label: "以太坊 ETH", prefix: "$", decimals: 0 },
      { coingeckoId: "solana", label: "Solana SOL", prefix: "$", decimals: 2 },
    ],
  },
];

export interface QuoteData {
  price: number;
  change: number;
  changePct: number;
  name?: string;
}

export async function fetchEastMoneyQuote(secid: string): Promise<QuoteData> {
  const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f58,f169,f170`;
  const res = await fetch(proxied(url));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json?.data) throw new Error("无数据");
  const { f43, f58, f169, f170 } = json.data;
  return {
    price: f43 / 100,
    change: f169 / 100,
    changePct: f170 / 100,
    name: f58,
  };
}

export async function fetchCoinGeckoQuote(id: string): Promise<QuoteData> {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(proxied(url));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const data = json?.[id];
  if (!data) throw new Error("无数据");
  return {
    price: data.usd,
    change: (data.usd * (data.usd_24h_change ?? 0)) / 100,
    changePct: data.usd_24h_change ?? 0,
  };
}

export async function fetchIndex(idx: IndexQuote): Promise<QuoteData> {
  if (idx.secid) return fetchEastMoneyQuote(idx.secid);
  if (idx.coingeckoId) return fetchCoinGeckoQuote(idx.coingeckoId);
  throw new Error("缺少数据源标识");
}
