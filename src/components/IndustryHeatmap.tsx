import { useEffect, useMemo, useState } from "react";
import { INDUSTRIES, type IndustryDef } from "../lib/industries";
import {
  fetchAllBoards,
  fetchBoardStocks,
  fetchBoardNews,
  matchBoard,
  calcHeatScore,
  formatFlow,
  timeAgo,
  type BoardQuote,
  type StockQuote,
  type BoardNews,
} from "../lib/industryData";

interface SubResult {
  /** 子板块定义名 */
  defName: string;
  /** 在线匹配到的板块（可能为 null） */
  board: BoardQuote | null;
  /** 热度分 */
  score: number;
}

export default function IndustryHeatmap() {
  const [boards, setBoards] = useState<BoardQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null); // board code

  const load = async () => {
    try {
      const all = await fetchAllBoards();
      setBoards(all);
      if (all.length === 0) {
        setError("板块数据暂时拉不到");
      } else {
        setError(null);
      }
      setLastFetch(new Date());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // 30 分钟刷新一次（数据源 Worker 端缓存 30 分钟，更频繁也只是 cache HIT）
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // 把每个行业的子板块解析成 SubResult
  const industryRows = useMemo(() => {
    return INDUSTRIES.map((ind) => {
      // 行业内同 board.code 只保留第一次出现，避免多个子板块名映射到同一板块
      const claimedCodes = new Set<string>();
      const subs: SubResult[] = ind.subBoards.map((name) => {
        const b = matchBoard(name, boards);
        if (b && claimedCodes.has(b.code)) {
          return { defName: name, board: null, score: 0 };
        }
        if (b) claimedCodes.add(b.code);
        return {
          defName: name,
          board: b,
          score: b ? calcHeatScore(b) : 0,
        };
      });
      const matched = subs.filter((s) => s.board);
      const indScore = matched.length
        ? Math.round(
            matched.reduce((a, b) => a + b.score, 0) / matched.length
          )
        : 0;
      return { ind, subs, score: indScore };
    });
  }, [boards]);

  return (
    <div>
      {/* 顶部状态条 */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-2 text-text-muted">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${
              loading
                ? "bg-cyan-accent animate-pulse"
                : error
                  ? "bg-rose-accent/60"
                  : "bg-emerald-accent"
            }`}
          ></span>
          {loading
            ? "加载板块行情..."
            : lastFetch
              ? `${timeAgo(lastFetch.getTime())}更新 · 5 分钟自动刷新`
              : "等待数据"}
        </div>
        {error && (
          <span className="text-rose-accent font-mono">⚠ {error}</span>
        )}
      </div>

      {/* 行业卡片网格 */}
      <div className="grid md:grid-cols-2 gap-5">
        {industryRows.map(({ ind, subs, score }) => (
          <IndustryCard
            key={ind.id}
            ind={ind}
            subs={subs}
            score={score}
            expanded={expanded}
            onExpand={setExpanded}
          />
        ))}
      </div>

      {/* 数据说明 */}
      <div className="mt-8 glass p-4 text-[11px] text-text-muted leading-relaxed">
        <strong className="text-text-secondary">数据说明：</strong>
        热度 = 涨跌幅 60% + 主力净流入 40% 加权（0-100 分）。
        子板块按东方财富概念 / 行业板块在线匹配，未匹配的标灰。
        点击任一子板块展开"龙头股动向 + 板块新闻"——这就是当下市场对该方向的<strong className="text-text-primary">用脚投票 + 媒体共识</strong>。
        所有数据来自东方财富公开接口，<strong className="text-text-primary">不构成投资建议</strong>。
      </div>
    </div>
  );
}

function IndustryCard({
  ind,
  subs,
  score,
  expanded,
  onExpand,
}: {
  ind: IndustryDef;
  subs: SubResult[];
  score: number;
  expanded: string | null;
  onExpand: (code: string | null) => void;
}) {
  const heatColor = scoreColor(score);
  return (
    <div className="glass p-5 flex flex-col">
      <div className="flex items-start gap-3 mb-3">
        <div className="text-3xl shrink-0">{ind.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-lg font-bold text-text-primary">{ind.name}</h3>
            <div
              className="text-xs font-mono font-semibold tabular px-2 py-0.5 rounded-full"
              style={{
                color: heatColor,
                background: `${heatColor}15`,
                border: `1px solid ${heatColor}40`,
              }}
            >
              热度 {score}
            </div>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            {ind.tagline}
          </p>
        </div>
      </div>

      {/* 行业级热度条 */}
      <div className="mb-4">
        <div className="h-1 w-full rounded-full bg-bg-card overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${score}%`,
              background: `linear-gradient(to right, #64748b, ${heatColor})`,
            }}
          />
        </div>
      </div>

      {/* 子板块列表 */}
      <div className="space-y-1.5">
        {subs.map((s) => (
          <SubBoardRow
            key={s.defName}
            sub={s}
            expanded={expanded === s.board?.code}
            onToggle={() => {
              if (!s.board) return;
              onExpand(expanded === s.board.code ? null : s.board.code);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SubBoardRow({
  sub,
  expanded,
  onToggle,
}: {
  sub: SubResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (!sub.board) {
    // 没匹配到，灰色禁用态
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border-subtle bg-bg-card/30 opacity-50">
        <div className="text-sm text-text-muted">{sub.defName}</div>
        <div className="text-[10px] text-text-muted">未匹配</div>
      </div>
    );
  }

  const b = sub.board;
  const ch = b.changePct;
  const chColor =
    ch > 0 ? "text-rose-accent" : ch < 0 ? "text-emerald-accent" : "text-text-secondary";
  const flowColor =
    b.netFlow > 0
      ? "text-rose-accent"
      : b.netFlow < 0
        ? "text-emerald-accent"
        : "text-text-muted";
  const heatColor = scoreColor(sub.score);

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border-subtle bg-bg-card/40 hover:border-cyan-accent/40 hover:bg-bg-card transition-all text-left"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className="inline-block w-1 h-3.5 rounded-sm shrink-0"
            style={{ background: heatColor }}
          ></span>
          <span className="text-sm text-text-primary font-medium truncate">
            {b.name}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs tabular">
          <span className={`font-semibold ${chColor}`}>
            {ch > 0 ? "+" : ""}
            {ch.toFixed(2)}%
          </span>
          <span className={`font-mono ${flowColor}`}>
            {formatFlow(b.netFlow)}
          </span>
          <span className="font-mono text-text-muted w-7 text-right">
            {sub.score}
          </span>
          <svg
            className={`w-3 h-3 text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {expanded && <ExpandedDetail board={b} />}
    </div>
  );
}

function ExpandedDetail({ board }: { board: BoardQuote }) {
  const [stocks, setStocks] = useState<StockQuote[] | null>(null);
  const [news, setNews] = useState<BoardNews[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      fetchBoardStocks(board.code, 5),
      fetchBoardNews(board.name),
    ]).then(([s, n]) => {
      if (cancelled) return;
      setStocks(s.status === "fulfilled" ? s.value : []);
      setNews(n.status === "fulfilled" ? n.value : []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [board.code, board.name]);

  return (
    <div className="mt-1.5 pl-5 pr-3 py-3 rounded-lg bg-bg-base/60 border border-border-subtle space-y-3 animate-[fadeIn_0.18s_ease-out]">
      {/* 龙头股 */}
      <div>
        <div className="text-[10px] text-cyan-accent font-mono tracking-wider mb-1.5">
          龙头股动向 · 用脚投票
        </div>
        {loading ? (
          <div className="space-y-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-5 bg-text-muted/10 rounded animate-pulse"
              ></div>
            ))}
          </div>
        ) : stocks && stocks.length > 0 ? (
          <div className="space-y-1">
            {stocks.slice(0, 5).map((s) => (
              <div
                key={s.code}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <a
                  href={`https://quote.eastmoney.com/${stockUrl(s.code)}.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-primary hover:text-cyan-accent truncate flex-1"
                >
                  {s.name}
                  <span className="text-text-muted font-mono ml-1.5">
                    {s.code}
                  </span>
                </a>
                <div className="flex items-center gap-2 shrink-0 tabular">
                  <span
                    className={
                      s.changePct > 0
                        ? "text-rose-accent font-semibold"
                        : s.changePct < 0
                          ? "text-emerald-accent font-semibold"
                          : "text-text-secondary"
                    }
                  >
                    {s.changePct > 0 ? "+" : ""}
                    {s.changePct.toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <a
            href={`https://quote.eastmoney.com/center/boardlist.html#boards2-90.${board.code}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-cyan-accent transition-colors"
          >
            <span>在东方财富查看龙头股</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              className="w-3 h-3"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          </a>
        )}
      </div>

      {/* 板块新闻 */}
      <div>
        <div className="text-[10px] text-purple-accent font-mono tracking-wider mb-1.5">
          市场近期讨论 · 媒体共识
        </div>
        {loading ? (
          <div className="space-y-1">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="h-4 bg-text-muted/10 rounded animate-pulse"
              ></div>
            ))}
          </div>
        ) : news && news.length > 0 ? (
          <div className="space-y-1.5">
            {news.slice(0, 4).map((n, i) => (
              <a
                key={i}
                href={n.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 text-xs hover:text-cyan-accent group"
              >
                <span className="text-text-muted mt-0.5">·</span>
                <div className="flex-1 min-w-0">
                  <div className="text-text-secondary group-hover:text-cyan-accent leading-relaxed line-clamp-2">
                    {n.title}
                  </div>
                  <div className="text-[10px] text-text-muted font-mono mt-0.5">
                    {n.source} · {timeAgo(n.time)}
                  </div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="text-xs text-text-muted">该板块暂无新闻</div>
        )}
      </div>
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 75) return "#fb7185"; // rose - 火热
  if (score >= 60) return "#f59e0b"; // amber - 偏热
  if (score >= 45) return "#22d3ee"; // cyan - 中性
  if (score >= 30) return "#3b82f6"; // blue - 偏冷
  return "#64748b"; // slate - 冷
}

/** 把 6 位代码 → eastmoney 行情页路径段 */
function stockUrl(code: string): string {
  // 沪市以 6 开头 = sh，深市以 0/3 开头 = sz，60xxxx → sh，
  // 科创 688/689 也是 sh，北交所 8/9 = bj
  if (code.startsWith("6")) return `sh${code}`;
  if (code.startsWith("4") || code.startsWith("8")) return `bj${code}`;
  return `sz${code}`;
}
