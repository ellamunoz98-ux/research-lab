import { useEffect, useMemo, useRef, useState } from "react";
import { hierarchy, treemap as d3treemap } from "d3-hierarchy";
import type { HierarchyRectangularNode } from "d3-hierarchy";
import {
  INDUSTRIES,
  getBoardEmoji,
  getBoardImage,
  type IndustryDef,
} from "../lib/industries";
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

interface CellNode {
  name: string;
  value?: number;
  children?: CellNode[];
  /** leaf 才有 */
  board?: BoardQuote;
  /** group 才有 */
  industry?: IndustryDef;
  /** group 内本行业的整体涨跌（用于 header tint） */
  groupChange?: number;
}

export default function IndustryTreemap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 720 });
  const [boards, setBoards] = useState<BoardQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [selected, setSelected] = useState<BoardQuote | null>(null);

  // 容器尺寸
  useEffect(() => {
    if (!containerRef.current) return;
    const onResize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const w = Math.max(rect.width, 320);
      // 高度按宽度计算：宽 → 高 = 5:3
      const h = w < 700 ? Math.round(w * 1.4) : Math.max(640, Math.round(w * 0.55));
      setSize({ w, h });
    };
    onResize();
    const ro = new ResizeObserver(onResize);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const load = async () => {
    try {
      const all = await fetchAllBoards();
      setBoards(all);
      setError(all.length === 0 ? "板块数据暂时拉不到" : null);
      setLastFetch(new Date());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // 行业级聚合
  const industryRows = useMemo(() => {
    return INDUSTRIES.map((ind) => {
      const claimed = new Set<string>();
      const subs = ind.subBoards
        .map((name) => {
          const b = matchBoard(name, boards);
          if (!b || claimed.has(b.code)) return null;
          claimed.add(b.code);
          return { defName: name, board: b, score: calcHeatScore(b) };
        })
        .filter((s): s is { defName: string; board: BoardQuote; score: number } => s !== null);
      const totalFlow = subs.reduce((a, s) => a + s.board.netFlow, 0);
      const avgChange =
        subs.length > 0
          ? subs.reduce((a, s) => a + s.board.changePct, 0) / subs.length
          : 0;
      const avgScore =
        subs.length > 0
          ? Math.round(subs.reduce((a, s) => a + s.score, 0) / subs.length)
          : 0;
      return { ind, subs, totalFlow, avgChange, avgScore };
    }).filter((r) => r.subs.length > 0);
  }, [boards]);

  // 总市场温度：所有匹配子板块净流入加和
  const marketStats = useMemo(() => {
    const allSubs = industryRows.flatMap((r) => r.subs);
    const upN = allSubs.filter((s) => s.board.changePct > 0).length;
    const downN = allSubs.filter((s) => s.board.changePct < 0).length;
    const flatN = allSubs.length - upN - downN;
    return { upN, downN, flatN, total: allSubs.length };
  }, [industryRows]);

  // 构造 d3-hierarchy 布局
  const root = useMemo(() => {
    if (industryRows.length === 0) return null;
    const data: CellNode = {
      name: "root",
      children: industryRows.map((r) => ({
        name: r.ind.name,
        industry: r.ind,
        groupChange: r.avgChange,
        children: r.subs.map((s) => ({
          name: s.defName,
          board: s.board,
          // 用主力净流入绝对值（亿元）作为格子大小，最小 0.5 保可见
          value: Math.max(Math.abs(s.board.netFlow) / 1e8, 0.5),
        })),
      })),
    };
    const h = hierarchy(data).sum((d) => d.value ?? 0);
    const layout = d3treemap<CellNode>()
      .size([size.w, size.h])
      .paddingTop(26) // 行业标题条
      .paddingInner(2)
      .paddingOuter(3)
      .round(true);
    return layout(h);
  }, [industryRows, size]);

  return (
    <div className="space-y-5">
      {/* 顶部状态条 */}
      <div className="flex items-center justify-between flex-wrap gap-3 text-xs">
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
        {marketStats.total > 0 && (
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="px-2 py-0.5 rounded bg-rose-accent/15 text-rose-accent border border-rose-accent/30">
              ↑ {marketStats.upN}
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-accent/15 text-emerald-accent border border-emerald-accent/30">
              ↓ {marketStats.downN}
            </span>
            <span className="px-2 py-0.5 rounded bg-text-muted/10 text-text-muted border border-text-muted/30">
              — {marketStats.flatN}
            </span>
            <span className="text-text-muted ml-1">/ {marketStats.total} 个板块</span>
          </div>
        )}
        {error && <span className="text-rose-accent font-mono">⚠ {error}</span>}
      </div>

      {/* 主热力图 */}
      <div
        ref={containerRef}
        className="relative w-full rounded-xl overflow-hidden border border-border-subtle bg-bg-base/50"
        style={{ height: size.h }}
      >
        {root &&
          root.descendants().map((node, i) => {
            if (node.depth === 0) return null;
            return (
              <TreemapCell
                key={`${node.depth}-${i}`}
                node={node}
                onSelect={setSelected}
                isSelected={
                  selected !== null &&
                  node.data.board?.code === selected.code
                }
              />
            );
          })}
        {!loading && industryRows.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-text-muted text-sm">
            没有可显示的板块
          </div>
        )}
      </div>

      {/* 选中板块的详情 */}
      {selected && (
        <div className="glass p-5 animate-[fadeIn_0.2s_ease-out]">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border-subtle">
            <div>
              <div className="text-xs text-cyan-accent font-mono tracking-wider mb-1">
                SELECTED · {selected.kind === "concept" ? "概念板块" : "行业板块"}
              </div>
              <h3 className="text-2xl font-bold text-text-primary">
                {selected.name}
              </h3>
              <div className="flex items-center gap-3 mt-2 text-sm">
                <span
                  className={`font-mono font-semibold ${
                    selected.changePct > 0
                      ? "text-rose-accent"
                      : selected.changePct < 0
                        ? "text-emerald-accent"
                        : "text-text-secondary"
                  }`}
                >
                  {selected.changePct > 0 ? "+" : ""}
                  {selected.changePct.toFixed(2)}%
                </span>
                <span
                  className={`font-mono ${
                    selected.netFlow > 0
                      ? "text-rose-accent"
                      : selected.netFlow < 0
                        ? "text-emerald-accent"
                        : "text-text-muted"
                  }`}
                >
                  主力 {formatFlow(selected.netFlow)}
                </span>
                <span className="text-text-muted font-mono">
                  热度 {calcHeatScore(selected)}
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="w-8 h-8 rounded-full hover:bg-bg-card flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
          <ExpandedDetail board={selected} />
        </div>
      )}

      {/* 数据说明 */}
      <div className="glass p-4 text-[11px] text-text-muted leading-relaxed">
        <strong className="text-text-secondary">读图：</strong>
        方格<strong className="text-text-primary">大小 = 主力净流入绝对值</strong>（资金越大格子越大）
        ；
        <strong className="text-text-primary">颜色 = 当日涨跌</strong>（红涨绿跌，A 股惯例）
        ；
        亮度联动板块热度。
        点击任一格 → 查看该板块龙头股动向 + 媒体讨论焦点。
        数据来自东方财富，5 分钟自动刷新，<strong>不构成投资建议</strong>。
      </div>
    </div>
  );
}

function TreemapCell({
  node,
  onSelect,
  isSelected,
}: {
  node: HierarchyRectangularNode<CellNode>;
  onSelect: (b: BoardQuote) => void;
  isSelected: boolean;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const x = node.x0;
  const y = node.y0;
  const w = node.x1 - node.x0;
  const h = node.y1 - node.y0;
  if (w <= 0 || h <= 0) return null;

  const isGroup = node.depth === 1;
  const isLeaf = node.depth === 2;

  if (isGroup) {
    const ind = node.data.industry!;
    const groupCh = node.data.groupChange ?? 0;
    const tint =
      groupCh > 0.3
        ? "rgba(244,63,94,0.10)"
        : groupCh < -0.3
          ? "rgba(16,185,129,0.10)"
          : "rgba(148,163,184,0.06)";
    return (
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: w,
          height: 26,
          padding: "5px 10px",
          color: "#cbd5e1",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.02em",
          background: tint,
          borderBottom: "1px solid rgba(148,163,184,0.12)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          pointerEvents: "none",
          fontFamily: "'HarmonyOS Sans SC',-apple-system,sans-serif",
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: 13 }}>{ind.icon}</span>
        <span>{ind.name}</span>
        <span
          style={{
            marginLeft: "auto",
            color: groupCh > 0 ? "#fb7185" : groupCh < 0 ? "#10b981" : "#94a3b8",
            fontFamily: "ui-monospace,monospace",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {groupCh > 0 ? "+" : ""}
          {groupCh.toFixed(2)}%
        </span>
      </div>
    );
  }

  if (!isLeaf) return null;

  const board = node.data.board!;
  const heat = calcHeatScore(board);
  const { bg, text, accent } = cellStyle(board.changePct, heat);
  const small = w < 70 || h < 50;
  const tiny = w < 45 || h < 35;
  const industryIcon = node.parent?.data.industry?.icon;
  const emoji = getBoardEmoji(board.name, industryIcon);
  // emoji 大小：跟方格短边联动，最大 88、最小 18 才显示
  const emojiSize = Math.min(Math.min(w, h) * 0.65, w * 0.45, 88);
  const showEmoji = emojiSize >= 18;
  const imageUrl = getBoardImage(board.name);
  // 涨跌色（在图片模式下用作 accent 色 + 边框）
  const directionAccent =
    board.changePct > 0.05
      ? "#fb7185"
      : board.changePct < -0.05
        ? "#10b981"
        : "#94a3b8";

  return (
    <button
      onClick={() => onSelect(board)}
      title={`${board.name}\n${board.changePct > 0 ? "+" : ""}${board.changePct.toFixed(2)}%\n主力 ${formatFlow(board.netFlow)}\n热度 ${heat}`}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        background: bg,
        color: text,
        border: isSelected
          ? "2px solid #22d3ee"
          : "1px solid rgba(255,255,255,0.04)",
        boxShadow: isSelected
          ? "0 0 0 2px rgba(34,211,238,0.4), 0 8px 32px rgba(0,0,0,0.5)"
          : "inset 0 1px 0 rgba(255,255,255,0.05)",
        padding: tiny ? 0 : small ? 4 : 8,
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        cursor: "pointer",
        fontFamily: "'HarmonyOS Sans SC',-apple-system,sans-serif",
        overflow: "hidden",
        transition: "transform 0.18s, box-shadow 0.18s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.02)";
        e.currentTarget.style.zIndex = "10";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.zIndex = "auto";
      }}
    >
      {/* 行业符号水印（emoji），无图时显示，有图时被图片盖住 */}
      {showEmoji && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            right: -emojiSize * 0.08,
            bottom: -emojiSize * 0.1,
            fontSize: emojiSize,
            lineHeight: 1,
            opacity: tiny ? 0.55 : 0.26,
            pointerEvents: "none",
            userSelect: "none",
            filter: "saturate(1.1)",
            zIndex: 0,
          }}
        >
          {emoji}
        </div>
      )}
      {/* 行业图片（如果有就铺满，做"杂志封面"感）— 不论格子多小都渲染，
          小格子只是缩成迷你缩略图，仍然有视觉提示 */}
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgLoaded(false)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: imgLoaded ? (tiny ? 0.85 : 0.78) : 0,
            transition: "opacity 0.4s ease-out",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
      )}
      {/* 图片之上的暗色渐变蒙层，让文字读起来 */}
      {imgLoaded && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.55) 100%)",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />
      )}
      {/* 涨跌方向色边（图片模式下提供方向信号） */}
      {imgLoaded && !isSelected && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background: directionAccent,
            opacity: 0.8,
            pointerEvents: "none",
            zIndex: 3,
          }}
        />
      )}
      {!tiny && (
        <div
          style={{
            fontSize: small ? 10 : 12,
            fontWeight: 600,
            lineHeight: 1.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            opacity: 0.95,
            position: "relative",
            zIndex: 4,
          }}
        >
          {board.name}
        </div>
      )}
      {!small && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 4,
            position: "relative",
            zIndex: 4,
          }}
        >
          <div
            style={{
              fontFamily: "ui-monospace,monospace",
              fontSize: w > 130 ? 18 : 14,
              fontWeight: 700,
              color: accent,
              lineHeight: 1,
              textShadow: "0 1px 2px rgba(0,0,0,0.5)",
            }}
          >
            {board.changePct > 0 ? "+" : ""}
            {board.changePct.toFixed(2)}%
          </div>
          <div
            style={{
              fontFamily: "ui-monospace,monospace",
              fontSize: 9,
              opacity: 0.85,
              padding: "1px 5px",
              borderRadius: 3,
              background: "rgba(0,0,0,0.4)",
              whiteSpace: "nowrap",
              backdropFilter: "blur(4px)",
            }}
          >
            热 {heat}
          </div>
        </div>
      )}
      {small && !tiny && (
        <div
          style={{
            fontFamily: "ui-monospace,monospace",
            fontSize: 10,
            fontWeight: 700,
            color: accent,
            position: "relative",
            zIndex: 4,
            textShadow: "0 1px 2px rgba(0,0,0,0.5)",
          }}
        >
          {board.changePct > 0 ? "+" : ""}
          {board.changePct.toFixed(1)}%
        </div>
      )}
    </button>
  );
}

/**
 * 单元格配色：A 股惯例红涨绿跌，亮度联动热度
 */
function cellStyle(
  changePct: number,
  heat: number
): { bg: string; text: string; accent: string } {
  const ch = Math.max(-1, Math.min(1, changePct / 5)); // -5%..+5% → -1..1
  const heatBoost = (heat - 50) / 100; // -0.5..+0.5
  const flat = Math.abs(ch) < 0.04;
  let h: number, s: number, l: number;
  let accent: string;
  if (flat) {
    h = 220;
    s = 10;
    l = 22 + heat / 8;
    accent = "#cbd5e1";
  } else if (ch > 0) {
    h = 8; // 玫红/橙红
    s = 55 + Math.abs(ch) * 35;
    l = 26 + Math.abs(ch) * 14 + heatBoost * 10;
    accent = "#fecaca";
  } else {
    h = 152;
    s = 50 + Math.abs(ch) * 32;
    l = 22 + Math.abs(ch) * 12 + heatBoost * 8;
    accent = "#a7f3d0";
  }
  l = Math.max(18, Math.min(58, l));
  const text = l > 50 ? "#0d1220" : "#e8eef7";
  return { bg: `hsl(${h}, ${s}%, ${l}%)`, text, accent };
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
    <div className="grid md:grid-cols-2 gap-5">
      {/* 龙头股 */}
      <div>
        <div className="text-[10px] text-cyan-accent font-mono tracking-wider mb-2">
          龙头股动向 · 用脚投票
        </div>
        {loading ? (
          <div className="space-y-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-7 bg-text-muted/10 rounded animate-pulse"></div>
            ))}
          </div>
        ) : stocks && stocks.length > 0 ? (
          <div className="space-y-1.5">
            {stocks.slice(0, 5).map((s) => (
              <a
                key={s.code}
                href={`https://quote.eastmoney.com/${stockUrl(s.code)}.html`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 px-3 py-1.5 rounded bg-bg-card/40 border border-border-subtle hover:border-cyan-accent/40 group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-text-primary group-hover:text-cyan-accent truncate">
                    {s.name}
                  </span>
                  <span className="text-[10px] text-text-muted font-mono">
                    {s.code}
                  </span>
                </div>
                <span
                  className={`text-xs font-mono font-semibold tabular shrink-0 ${
                    s.changePct > 0
                      ? "text-rose-accent"
                      : s.changePct < 0
                        ? "text-emerald-accent"
                        : "text-text-secondary"
                  }`}
                >
                  {s.changePct > 0 ? "+" : ""}
                  {s.changePct.toFixed(2)}%
                </span>
              </a>
            ))}
          </div>
        ) : (
          <div className="text-xs text-text-muted px-3 py-2">暂无成分股数据</div>
        )}
      </div>

      {/* 板块新闻 */}
      <div>
        <div className="text-[10px] text-purple-accent font-mono tracking-wider mb-2">
          市场近期讨论 · 媒体共识
        </div>
        {loading ? (
          <div className="space-y-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 bg-text-muted/10 rounded animate-pulse"></div>
            ))}
          </div>
        ) : news && news.length > 0 ? (
          <div className="space-y-2">
            {news.slice(0, 5).map((n, i) => (
              <a
                key={i}
                href={n.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <div className="text-xs text-text-secondary group-hover:text-cyan-accent leading-relaxed line-clamp-2">
                  {n.title}
                </div>
                <div className="text-[10px] text-text-muted font-mono mt-0.5">
                  {n.source} · {timeAgo(n.time)}
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="text-xs text-text-muted px-3 py-2">该板块暂无新闻</div>
        )}
      </div>
    </div>
  );
}

function stockUrl(code: string): string {
  if (code.startsWith("6")) return `sh${code}`;
  if (code.startsWith("4") || code.startsWith("8")) return `bj${code}`;
  return `sz${code}`;
}
