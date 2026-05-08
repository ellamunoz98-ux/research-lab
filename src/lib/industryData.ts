/**
 * 行业 / 概念板块数据获取层
 * 数据源：东方财富 push2 / np-listapi
 * 接口完全公开免登录，CORS 在浏览器端直连可用
 */

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

async function fetchBoardList(kind: "concept" | "industry"): Promise<BoardQuote[]> {
  // m:90 t:2 = 行业板块；t:3 = 概念板块
  const t = kind === "concept" ? 3 : 2;
  const url = `${PUSH}?fs=m:90+t:${t}&fields=f3,f6,f12,f14,f62&pn=1&pz=300&_=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const items: RawDiff[] = json?.data?.diff ?? [];
  return items
    .filter((it) => it.f12 && it.f14)
    .map((it) => ({
      code: it.f12 as string,
      name: it.f14 as string,
      changePct: typeof it.f3 === "number" ? it.f3 / 100 : 0,
      netFlow: typeof it.f62 === "number" ? it.f62 : 0,
      amount: typeof it.f6 === "number" ? it.f6 : undefined,
      kind,
    }));
}

export async function fetchAllBoards(): Promise<BoardQuote[]> {
  const [concept, industry] = await Promise.all([
    fetchBoardList("concept").catch(() => [] as BoardQuote[]),
    fetchBoardList("industry").catch(() => [] as BoardQuote[]),
  ]);
  // 同名时优先用概念板块（粒度更细）
  const map = new Map<string, BoardQuote>();
  industry.forEach((b) => map.set(b.name, b));
  concept.forEach((b) => map.set(b.name, b));
  return Array.from(map.values());
}

/**
 * 给定一个目标名称，从板块列表里找最匹配的一个
 * 1. 完全相等
 * 2. 包含关系
 * 3. 都没有 → null
 */
export function matchBoard(
  target: string,
  boards: BoardQuote[]
): BoardQuote | null {
  const exact = boards.find((b) => b.name === target);
  if (exact) return exact;
  const contains = boards.find(
    (b) => b.name.includes(target) || target.includes(b.name)
  );
  return contains ?? null;
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
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  const items: Record<string, number | string | undefined>[] = json?.data?.diff ?? [];
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

export async function fetchBoardNews(boardCode: string): Promise<BoardNews[]> {
  // 东方财富板块新闻列表（部分板块代码可能没有新闻接口数据，需做兜底）
  const url = `https://np-listapi.eastmoney.com/comm/web/getListInfo?type=NEWS_TPLATEINFOLIST&order=time&plateCode=${boardCode}&pageIndex=1&pageSize=5&_=${Date.now()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    interface RawNews {
      title?: string;
      url?: string;
      shareUrl?: string;
      mediaName?: string;
      source?: string;
      publishTime?: string | number;
    }
    const items: RawNews[] = json?.data?.list ?? [];
    return items
      .filter((it) => it.title)
      .map((it) => ({
        title: it.title!,
        link: it.url || it.shareUrl || "#",
        source: it.mediaName || it.source || "东方财富",
        time:
          typeof it.publishTime === "string"
            ? new Date(it.publishTime).getTime()
            : (it.publishTime ?? Date.now()),
      }));
  } catch {
    return [];
  }
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
