/**
 * 行业 / 概念板块数据获取层
 * 数据源：东方财富 push2 / search-api-web
 * 通过自家 Worker 代理转发（绕过 CORS 与 *.pages.dev Referer 反爬）
 */

import { proxied } from "./proxy";

const PUSH = "https://push2.eastmoney.com/api/qt/clist/get";

export interface BoardQuote {
  /** BK1075 等板块代码 */
  code: string;
  name: string;
  /** 涨跌幅（百分比，如 5.23） */
  changePct: number;
  /** 主力净流入金额（元） */
  netFlow: number;
  /** 成交额（元） */
  amount?: number;
  /** 板块类型：concept 概念板块 / industry 行业板块 */
  kind: "concept" | "industry";
}

interface RawDiff {
  f3?: number;
  f6?: number;
  f12?: string;
  f14?: string;
  f62?: number;
}

/** 东方财富的 diff 字段有时是数组，有时是 {"0": {...}, "1": {...}} 对象，统一成数组 */
function normalizeDiff(diff: unknown): RawDiff[] {
  if (!diff) return [];
  if (Array.isArray(diff)) return diff as RawDiff[];
  if (typeof diff === "object") return Object.values(diff as Record<string, RawDiff>);
  return [];
}

/**
 * 拉所有活跃 EM 板块。走自家 Worker 的 /em/boards 聚合端点：
 *   - Worker 内部分批 ulist.np（绕开 clist/get 的 502 反爬）
 *   - Worker 端缓存 30 分钟，多浏览器共用
 *   - 一次请求拉到 ~500 个真实板块（行业 + 概念）
 *
 * BK 代码无法严格区分行业/概念（kind 字段统一标 "concept"，前端按板块名匹配即可）。
 */
const BOARDS_URL =
  "https://research-lab-comments.ellamunoz98.workers.dev/em/boards";

interface RawBoard {
  f3?: number;
  f12?: string;
  f14?: string;
  f62?: number;
}

export async function fetchAllBoards(): Promise<BoardQuote[]> {
  try {
    const res = await fetch(BOARDS_URL);
    if (!res.ok) return [];
    const json = (await res.json()) as { boards?: RawBoard[] };
    const boards = json?.boards;
    if (!Array.isArray(boards)) return [];
    return boards
      .filter((b) => b.f12 && b.f14)
      .map((b) => ({
        code: b.f12 as string,
        name: b.f14 as string,
        changePct: typeof b.f3 === "number" ? b.f3 / 100 : 0,
        netFlow: typeof b.f62 === "number" ? b.f62 : 0,
        kind: "concept" as const,
      }));
  } catch {
    return [];
  }
}

/**
 * 给定一个目标名称，从板块列表里找最匹配的一个
 * 优先级：
 *   1. 完全相等
 *   2. 双向包含（target ⊆ board.name 或 board.name ⊆ target），且要求 ≥3 字符
 *   3. 多个候选时，按"长度差最小"排（避免 "半导体设备" 退化匹配到 "半导体"）
 *   4. 一个也没有 → null
 */
export function matchBoard(
  target: string,
  boards: BoardQuote[]
): BoardQuote | null {
  const exact = boards.find((b) => b.name === target);
  if (exact) return exact;
  const MIN_TOKEN = 3;
  const candidates = boards.filter((b) => {
    const longer = b.name.length >= target.length ? b.name : target;
    const shorter = b.name.length >= target.length ? target : b.name;
    return shorter.length >= MIN_TOKEN && longer.includes(shorter);
  });
  if (candidates.length === 0) return null;
  candidates.sort(
    (a, b) =>
      Math.abs(a.name.length - target.length) -
      Math.abs(b.name.length - target.length)
  );
  return candidates[0];
}

export interface StockQuote {
  code: string;
  name: string;
  /** 元 */
  price: number;
  /** 百分比 */
  changePct: number;
  /** 主力净流入（元） */
  netFlow: number;
}

export async function fetchBoardStocks(
  boardCode: string,
  top = 5
): Promise<StockQuote[]> {
  // f2=最新价 f3=涨幅 f12=代码 f14=名称 f62=主力净流入
  // po=1 降序，按 f3（涨幅）排序
  const url = `${PUSH}?fs=b:${boardCode}&fields=f2,f3,f12,f14,f62&po=1&fid=f3&pn=1&pz=${top}&_=${Date.now()}`;
  const res = await fetch(proxied(url));
  if (!res.ok) return [];
  const json = await res.json();
  const items = normalizeDiff(json?.data?.diff) as Record<string, number | string | undefined>[];
  return items
    .filter((it) => it.f12 && it.f14)
    .slice(0, top)
    .map((it) => ({
      code: String(it.f12),
      name: String(it.f14),
      price: typeof it.f2 === "number" ? it.f2 / 100 : 0,
      changePct: typeof it.f3 === "number" ? it.f3 / 100 : 0,
      netFlow: typeof it.f62 === "number" ? it.f62 : 0,
    }));
}

export interface BoardNews {
  title: string;
  link: string;
  source: string;
  /** ms timestamp */
  time: number;
}

/** 用板块名作为关键词，从东方财富 CMS 搜索最新报道 */
export async function fetchBoardNews(boardName: string): Promise<BoardNews[]> {
  // 关键词：去掉常见尾缀（"概念" / "Ⅱ" / 括号注释）提高召回率
  const keyword = boardName
    .replace(/[\(（].*?[\)）]/g, "")
    .replace(/概念$/, "")
    .replace(/Ⅱ$/, "")
    .trim();
  const param = JSON.stringify({
    uid: "",
    keyword,
    type: ["cmsArticleWebOld"],
    client: "web",
    clientType: "web",
    clientVersion: "curr",
    pageIndex: 1,
    pageSize: 5,
  });
  const url = `https://search-api-web.eastmoney.com/search/jsonp?cb=&param=${encodeURIComponent(param)}`;
  try {
    const res = await fetch(proxied(url));
    if (!res.ok) return [];
    const text = await res.text();
    // 剥离 JSONP 外层括号 — 响应形如 `({...})` 或 `({...});`
    const trimmed = text.replace(/^\s*\(/, "").replace(/\)\s*;?\s*$/, "");
    const json = JSON.parse(trimmed);
    interface RawArticle {
      title?: string;
      url?: string;
      mediaName?: string;
      date?: string;
    }
    const items: RawArticle[] = json?.result?.cmsArticleWebOld ?? [];
    return items
      .filter((a) => a.title)
      .map((a) => ({
        title: stripHighlight(a.title!),
        link: a.url || "#",
        source: a.mediaName || "东方财富",
        time: a.date ? new Date(a.date.replace(" ", "T") + "+08:00").getTime() : Date.now(),
      }));
  } catch {
    return [];
  }
}

function stripHighlight(s: string): string {
  return s
    .replace(/<\/?em>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

/**
 * 板块热度评分（0-100）
 * 综合涨跌幅 + 主力净流入 + 成交额三个维度
 */
export function calcHeatScore(board: BoardQuote): number {
  const ch = board.changePct; // -10 ~ +10 通常
  const flowBn = board.netFlow / 1e8; // 亿元

  // 涨幅维度：-5% → 0, 0 → 50, +5% → 100
  const changeScore = Math.max(0, Math.min(100, 50 + ch * 10));
  // 资金维度：-10亿 → 0, 0 → 50, +10亿 → 100
  const flowScore = Math.max(0, Math.min(100, 50 + flowBn * 5));

  return Math.round(changeScore * 0.6 + flowScore * 0.4);
}

export function formatFlow(rmb: number): string {
  const bn = rmb / 1e8;
  if (Math.abs(bn) >= 1) {
    return `${bn >= 0 ? "+" : ""}${bn.toFixed(1)} 亿`;
  }
  const wan = rmb / 1e4;
  return `${wan >= 0 ? "+" : ""}${(wan / 100).toFixed(1)} 百万`;
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} 天前`;
  return new Date(ts).toLocaleDateString("zh-CN");
}
