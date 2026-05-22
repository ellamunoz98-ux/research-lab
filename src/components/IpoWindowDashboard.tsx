import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

/** echarts 原生包装：避免 echarts-for-react@3 与 React 19 的 hook 不兼容 */
function EChart({
  option, height = 300,
}: { option: EChartsOption; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inst = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    inst.current = echarts.init(ref.current, undefined, { renderer: "canvas" });
    const handle = () => inst.current?.resize();
    window.addEventListener("resize", handle);
    return () => {
      window.removeEventListener("resize", handle);
      inst.current?.dispose();
      inst.current = null;
    };
  }, []);

  useEffect(() => {
    inst.current?.setOption(option, true);
  }, [option]);

  return <div ref={ref} style={{ width: "100%", height }} />;
}

type Regime = "OPEN" | "NARROWING" | "CLOSED";

interface HistoryPoint { week: string; idx: number; vol: number }
interface ForecastPoint { q: string; score: number; regime: Regime }
interface BoardPoint { board: string; score: number; regime: Regime }
interface SectorPoint { board: string; sector: string; score: number; regime: Regime }
interface SignalPoint { name: string; z: number }
interface ReviewSummary {
  accept_4w: number; advance_4w: number; withdraw_4w: number;
  register_4w: number; pass_rate: number; withdraw_rate: number;
}
interface Report {
  as_of: string;
  composite_now: number;
  composite_regime: Regime;
  history: HistoryPoint[];
  forecast: ForecastPoint[];
  boards: BoardPoint[];
  sectors: SectorPoint[];
  signals: SignalPoint[];
  review: ReviewSummary;
}

const REGIME_LABEL: Record<Regime, string> = {
  OPEN: "开放",
  NARROWING: "收窄",
  CLOSED: "关闭",
};

const REGIME_COLOR: Record<Regime, string> = {
  OPEN: "#34d399",       // emerald
  NARROWING: "#f59e0b",  // amber
  CLOSED: "#fb7185",     // rose
};

const SIGNAL_LABEL: Record<string, string> = {
  review_throughput: "监管节奏",
  withdraw_rate: "撤否率(反)",
  valuation_pct: "行业估值",
  breakeven_rate: "新股不破发",
  liquidity: "流动性",
  volatility: "波动率(反)",
  pass_rate: "过会率",
};

const ECHARTS_THEME = {
  textStyle: { color: "#e8eef7", fontFamily: '"HarmonyOS Sans SC", "PingFang SC", sans-serif' },
  tooltip: {
    backgroundColor: "rgba(13, 18, 32, 0.95)",
    borderColor: "rgba(34, 211, 238, 0.3)",
    borderWidth: 1,
    textStyle: { color: "#e8eef7" },
  },
};

function classifyRegime(score: number): Regime {
  if (score >= 60) return "OPEN";
  if (score >= 45) return "NARROWING";
  return "CLOSED";
}

export default function IpoWindowDashboard() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/ipo_window.json", { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setReport)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="glass p-6 text-rose-accent">
        数据加载失败：{error}
        <div className="text-text-muted text-xs mt-2">期望路径：/data/ipo_window.json</div>
      </div>
    );
  }
  if (!report) {
    return (
      <div className="glass p-6 text-text-muted">
        <div className="animate-pulse">加载窗口报告中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <HeroPanel report={report} />
      <MainCurve history={report.history} forecast={report.forecast} />
      <div className="grid lg:grid-cols-2 gap-6">
        <BoardsBar boards={report.boards} />
        <ReviewBar review={report.review} />
      </div>
      <SectorHeatmap sectors={report.sectors} />
      <SignalsRow signals={report.signals} />
      <Footnote report={report} />
    </div>
  );
}

/* ============== Hero：当前 regime 大字 + 关键数 ============== */
function HeroPanel({ report }: { report: Report }) {
  const color = REGIME_COLOR[report.composite_regime];
  return (
    <div className="glass p-8 md:p-10">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <div className="text-xs text-cyan-accent tracking-[0.3em] font-mono mb-3">
            COMPOSITE WINDOW INDEX · {report.as_of}
          </div>
          <div className="flex items-baseline gap-4">
            <div className="text-7xl md:text-8xl font-bold tabular" style={{ color }}>
              {report.composite_now.toFixed(1)}
            </div>
            <div
              className="px-4 py-2 rounded-full text-sm font-semibold"
              style={{
                color,
                background: `${color}1a`,
                border: `1px solid ${color}50`,
              }}
            >
              {REGIME_LABEL[report.composite_regime]} · {report.composite_regime}
            </div>
          </div>
          <p className="text-text-secondary text-sm mt-4 max-w-2xl leading-relaxed">
            综合 6 类信号（监管节奏 / 撤否率 / 行业估值 / 新股不破发 / 流动性 / 波动率）
            合成的 A 股 IPO 退出窗口指数 ——
            <strong className="text-text-primary"> ≥60 开放</strong> ·
            <strong className="text-text-primary"> 45-60 收窄</strong> ·
            <strong className="text-text-primary"> &lt;45 关闭</strong>。
          </p>
        </div>
        <ReviewBadges review={report.review} />
      </div>
    </div>
  );
}

function ReviewBadges({ review }: { review: ReviewSummary }) {
  const items = [
    { label: "新受理", value: review.accept_4w, color: "#22d3ee" },
    { label: "推进", value: review.advance_4w, color: "#a78bfa" },
    { label: "批文", value: review.register_4w, color: "#34d399" },
    { label: "撤否", value: review.withdraw_4w, color: "#fb7185" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
      {items.map((it) => (
        <div
          key={it.label}
          className="px-3 py-2.5 rounded-lg border border-border-subtle bg-bg-card/40 min-w-[80px]"
        >
          <div className="text-[10px] text-text-muted font-mono tracking-wider">
            近 4 周
          </div>
          <div className="text-xl font-semibold tabular" style={{ color: it.color }}>
            {it.value}
          </div>
          <div className="text-xs text-text-secondary mt-0.5">{it.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ============== 主曲线：history 实线 + forecast 虚线延伸 ============== */
function MainCurve({
  history, forecast,
}: { history: HistoryPoint[]; forecast: ForecastPoint[] }) {
  const option = useMemo(() => {
    // 历史最近 156 周（约 3 年），避免太挤
    const hist = history.slice(-156);
    const histX = hist.map((d) => d.week);
    const histY = hist.map((d) => d.idx);

    // forecast 用季度标签，与历史按时间衔接（首点 = 历史最后值，形成连续线）
    const fcX = forecast.map((d) => d.q);
    const fcY = [histY[histY.length - 1] ?? 50, ...forecast.map((d) => d.score)];
    const fcXFull = [histX[histX.length - 1] ?? "", ...fcX];

    return {
      ...ECHARTS_THEME,
      grid: { left: 50, right: 30, top: 40, bottom: 40 },
      xAxis: {
        type: "category",
        data: [...histX, ...fcX],
        boundaryGap: false,
        axisLine: { lineStyle: { color: "rgba(148,163,184,0.2)" } },
        axisLabel: {
          color: "#64748b",
          fontSize: 10,
          interval: Math.floor((histX.length + fcX.length) / 8),
        },
      },
      yAxis: {
        type: "value", min: 0, max: 100,
        splitLine: { lineStyle: { color: "rgba(148,163,184,0.08)" } },
        axisLabel: { color: "#64748b", fontSize: 10 },
      },
      tooltip: { ...ECHARTS_THEME.tooltip, trigger: "axis" },
      // regime 阈值参考线
      visualMap: {
        show: false,
        dimension: 1, min: 0, max: 100,
        inRange: { color: ["#fb7185", "#f59e0b", "#34d399"] },
      },
      series: [
        {
          name: "历史窗口指数",
          type: "line",
          smooth: true,
          symbol: "none",
          lineStyle: { width: 2 },
          areaStyle: {
            color: {
              type: "linear", x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(34,211,238,0.25)" },
                { offset: 1, color: "rgba(34,211,238,0)" },
              ],
            },
          },
          data: [...histY, ...Array(fcX.length).fill(null)],
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { type: "dashed", color: "rgba(148,163,184,0.3)" },
            data: [
              { yAxis: 60, label: { formatter: "开放 60", color: "#34d399", fontSize: 10 } },
              { yAxis: 45, label: { formatter: "关闭 45", color: "#fb7185", fontSize: 10 } },
            ],
          },
        },
        {
          name: "前瞻外推",
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          lineStyle: { width: 2, type: "dashed", color: "#a78bfa" },
          itemStyle: { color: "#a78bfa" },
          data: [
            ...Array(histX.length - 1).fill(null),
            ...fcY,
          ],
        },
      ],
    };
  }, [history, forecast]);

  return (
    <ChartCard title="主指数曲线" subtitle="HISTORICAL × FORWARD PROJECTION">
      <EChart option={option as any} height={360} />
    </ChartCard>
  );
}

/* ============== 板块横向对比 ============== */
function BoardsBar({ boards }: { boards: BoardPoint[] }) {
  const sorted = useMemo(
    () => [...boards].sort((a, b) => a.score - b.score),
    [boards],
  );
  const option = {
    ...ECHARTS_THEME,
    grid: { left: 70, right: 60, top: 20, bottom: 30 },
    xAxis: {
      type: "value", min: 0, max: 100,
      splitLine: { lineStyle: { color: "rgba(148,163,184,0.08)" } },
      axisLabel: { color: "#64748b", fontSize: 10 },
    },
    yAxis: {
      type: "category", data: sorted.map((b) => b.board),
      axisLine: { lineStyle: { color: "rgba(148,163,184,0.2)" } },
      axisLabel: { color: "#e8eef7", fontSize: 12 },
    },
    tooltip: {
      ...ECHARTS_THEME.tooltip, trigger: "axis",
      formatter: (params: any) => {
        const p = params[0];
        const reg = sorted[p.dataIndex].regime;
        return `${p.name}<br/>分数 <b>${p.value.toFixed(1)}</b><br/>状态 ${REGIME_LABEL[reg]}`;
      },
    },
    series: [{
      type: "bar",
      data: sorted.map((b) => ({
        value: b.score,
        itemStyle: {
          color: REGIME_COLOR[b.regime],
          borderRadius: [0, 4, 4, 0],
        },
      })),
      label: {
        show: true, position: "right",
        color: "#e8eef7", fontSize: 11, fontFamily: "var(--font-mono)",
        formatter: (p: any) => p.value.toFixed(1),
      },
      barWidth: 18,
    }],
  };
  return (
    <ChartCard title="按板块" subtitle="BOARD COMPARISON">
      <EChart option={option as any} height={280} />
    </ChartCard>
  );
}

/* ============== 监管节奏柱图 ============== */
function ReviewBar({ review }: { review: ReviewSummary }) {
  const data = [
    { label: "新受理", value: review.accept_4w, color: "#22d3ee" },
    { label: "推进",   value: review.advance_4w, color: "#a78bfa" },
    { label: "批文",   value: review.register_4w, color: "#34d399" },
    { label: "撤否",   value: review.withdraw_4w, color: "#fb7185" },
  ];
  const option = {
    ...ECHARTS_THEME,
    grid: { left: 50, right: 30, top: 30, bottom: 40 },
    xAxis: {
      type: "category", data: data.map((d) => d.label),
      axisLine: { lineStyle: { color: "rgba(148,163,184,0.2)" } },
      axisLabel: { color: "#e8eef7", fontSize: 12 },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "rgba(148,163,184,0.08)" } },
      axisLabel: { color: "#64748b", fontSize: 10 },
    },
    tooltip: { ...ECHARTS_THEME.tooltip, trigger: "axis" },
    series: [{
      type: "bar",
      data: data.map((d) => ({
        value: d.value,
        itemStyle: { color: d.color, borderRadius: [4, 4, 0, 0] },
      })),
      label: {
        show: true, position: "top",
        color: "#e8eef7", fontSize: 11, fontFamily: "var(--font-mono)",
      },
      barWidth: 32,
    }],
  };
  return (
    <ChartCard
      title="监管节奏 · 近 4 周"
      subtitle={`REVIEW PIPELINE · 过会率 ${(review.pass_rate * 100).toFixed(0)}% · 撤否率 ${(review.withdraw_rate * 100).toFixed(0)}%`}
    >
      <EChart option={option as any} height={280} />
    </ChartCard>
  );
}

/* ============== 行业 × 板块 heatmap ============== */
function SectorHeatmap({ sectors }: { sectors: SectorPoint[] }) {
  const { boards, sectorList, dataPoints } = useMemo(() => {
    const boards = Array.from(new Set(sectors.map((s) => s.board)));
    const sectorList = Array.from(new Set(sectors.map((s) => s.sector)));
    const dataPoints: [number, number, number][] = [];
    sectors.forEach((s) => {
      const xi = sectorList.indexOf(s.sector);
      const yi = boards.indexOf(s.board);
      dataPoints.push([xi, yi, s.score]);
    });
    return { boards, sectorList, dataPoints };
  }, [sectors]);

  const option = {
    ...ECHARTS_THEME,
    grid: { left: 80, right: 30, top: 30, bottom: 80 },
    xAxis: {
      type: "category", data: sectorList,
      axisLine: { lineStyle: { color: "rgba(148,163,184,0.2)" } },
      axisLabel: { color: "#e8eef7", fontSize: 11, rotate: 30 },
      splitArea: { show: true, areaStyle: { color: ["transparent"] } },
    },
    yAxis: {
      type: "category", data: boards,
      axisLine: { lineStyle: { color: "rgba(148,163,184,0.2)" } },
      axisLabel: { color: "#e8eef7", fontSize: 12 },
    },
    visualMap: {
      min: 0, max: 100,
      calculable: true, orient: "horizontal", left: "center", bottom: 5,
      textStyle: { color: "#94a3b8", fontSize: 10 },
      inRange: { color: ["#fb7185", "#f59e0b", "#22d3ee", "#34d399"] },
    },
    tooltip: {
      ...ECHARTS_THEME.tooltip,
      formatter: (p: any) => {
        const [xi, yi, v] = p.value;
        return `${boards[yi]} × ${sectorList[xi]}<br/>分数 <b>${v.toFixed(1)}</b><br/>状态 ${REGIME_LABEL[classifyRegime(v)]}`;
      },
    },
    series: [{
      type: "heatmap",
      data: dataPoints,
      label: {
        show: true,
        color: "#0d1220",
        fontSize: 11,
        fontFamily: "var(--font-mono)",
        formatter: (p: any) => p.value[2].toFixed(0),
      },
      itemStyle: { borderColor: "rgba(13,18,32,0.6)", borderWidth: 2 },
    }],
  };
  return (
    <ChartCard title="行业 × 板块 矩阵" subtitle="SECTOR × BOARD HEATMAP">
      <EChart option={option as any} height={360} />
    </ChartCard>
  );
}

/* ============== 信号 z-score 横条 ============== */
function SignalsRow({ signals }: { signals: SignalPoint[] }) {
  if (!signals?.length) return null;
  return (
    <ChartCard title="子信号当前 z-score" subtitle="COMPONENT SIGNALS">
      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-2">
        {signals.map((s) => {
          const label = SIGNAL_LABEL[s.name] ?? s.name;
          const color =
            s.z > 0.3 ? "#34d399"
            : s.z < -0.3 ? "#fb7185"
            : "#94a3b8";
          const pct = Math.max(0, Math.min(100, 50 + s.z * 25));
          return (
            <div
              key={s.name}
              className="p-3 rounded-lg border border-border-subtle bg-bg-card/30"
            >
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-text-primary">{label}</span>
                <span className="tabular font-semibold" style={{ color }}>
                  {s.z > 0 ? "+" : ""}
                  {s.z.toFixed(2)}
                </span>
              </div>
              <div className="h-1 w-full rounded-full bg-bg-card overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}

/* ============== 通用卡片包装 ============== */
function ChartCard({
  title, subtitle, children,
}: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="glass p-5">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
        {subtitle && (
          <div className="text-[10px] text-cyan-accent tracking-[0.25em] font-mono">
            {subtitle}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function Footnote({ report }: { report: Report }) {
  const hasReview = report.review.accept_4w + report.review.register_4w + report.review.withdraw_4w > 0;
  return (
    <div className="glass p-4 text-[11px] text-text-muted leading-relaxed">
      <strong className="text-text-secondary">读图说明：</strong>{" "}
      综合指数 ≥60 视为<strong className="text-emerald-accent">退出窗口开放</strong>，
      45-60 <strong className="text-amber-accent">收窄</strong>，&lt;45{" "}
      <strong className="text-rose-accent">关闭</strong>。
      监管节奏权重最高（0.32），数据来自 AkShare（东财 + 申万 + 沪深交易所公开接口），
      每周六 18:00 自动更新一次。
      {!hasReview && (
        <span className="block mt-2 text-amber-accent">
          ⚠ 监管节奏暂无数据 —— 系统首次跑只有当前快照，下一次抓取后才会产生事件流。
        </span>
      )}
      <span className="block mt-2">
        所有信号均做 78 周滚动 z-score；上线前 1.5 年 z-score 基线未稳，指数仅供方向参考，
        <strong className="text-text-secondary">不构成投资建议</strong>。
      </span>
    </div>
  );
}
