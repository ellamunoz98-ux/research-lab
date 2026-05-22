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
      <MethodologyCard />
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

/* ============== 方法论卡片（默认骨架，可展开看详解） ============== */
function MethodologyCard() {
  const [open, setOpen] = useState(false);

  const signals = [
    { name: "监管节奏", weight: 0.32, color: "#22d3ee",
      desc: "受理 + 推进 + 批文 滚动 4 周事件数（按板块）", invert: false },
    { name: "撤否率", weight: 0.10, color: "#fb7185",
      desc: "(撤回 + 否决) / 同期受理", invert: true },
    { name: "行业估值", weight: 0.18, color: "#a78bfa",
      desc: "申万一级行业 PE 当前值（按板块×行业）", invert: false },
    { name: "新股不破发", weight: 0.12, color: "#34d399",
      desc: "近 90 天上市新股「现价 ≥ 发行价」占比", invert: false },
    { name: "流动性", weight: 0.16, color: "#3b82f6",
      desc: "两融余额 + 沪深 300 成交额 + 新发基金（等权 z 合成）", invert: false },
    { name: "波动率", weight: 0.12, color: "#f59e0b",
      desc: "300ETF / 创业板 ETF 期权 QVIX 隐含波动率", invert: true },
  ];

  return (
    <div className="glass p-6 md:p-7">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="text-[10px] text-cyan-accent tracking-[0.3em] font-mono mb-1">
            METHODOLOGY
          </div>
          <h3 className="text-lg font-semibold text-text-primary">指数怎么算的</h3>
        </div>
        <div className="text-xs text-text-muted font-mono tabular">
          composite = z_to_score( Σ wᵢ · zᵢ / Σ wᵢ )
        </div>
      </div>

      {/* 信号清单 + 权重条 */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        {signals.map((s) => (
          <div
            key={s.name}
            className="p-3 rounded-lg border border-border-subtle bg-bg-card/40"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-text-primary">{s.name}</span>
                {s.invert && (
                  <span className="text-[9px] px-1 py-px rounded bg-rose-accent/15 text-rose-accent font-mono">
                    反向
                  </span>
                )}
              </div>
              <span
                className="text-xs font-mono font-semibold tabular"
                style={{ color: s.color }}
              >
                {(s.weight * 100).toFixed(0)}%
              </span>
            </div>
            <div className="h-1 w-full rounded-full bg-bg-card overflow-hidden mb-2">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(100, (s.weight / 0.32) * 100)}%`, background: s.color }}
              />
            </div>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              {s.desc}
            </p>
          </div>
        ))}
      </div>

      {/* regime 阈值带 */}
      <div className="flex items-center gap-0 rounded-lg overflow-hidden border border-border-subtle text-xs mb-4">
        <div className="flex-1 px-3 py-2 text-rose-accent" style={{ background: "rgba(251,113,133,0.18)" }}>
          <span className="font-mono font-semibold">&lt; 45</span> · 关闭 CLOSED
        </div>
        <div className="flex-1 px-3 py-2" style={{ background: "rgba(245,158,11,0.18)", color: "#f59e0b" }}>
          <span className="font-mono font-semibold">45–60</span> · 收窄 NARROWING
        </div>
        <div className="flex-1 px-3 py-2 text-emerald-accent" style={{ background: "rgba(52,211,153,0.18)" }}>
          <span className="font-mono font-semibold">≥ 60</span> · 开放 OPEN
        </div>
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-xs text-cyan-accent hover:text-text-primary transition-colors py-2 border-t border-border-subtle flex items-center justify-center gap-2"
      >
        {open ? "收起方法论详解" : "展开完整方法论详解"}
        <svg
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-4 pt-4 border-t border-border-subtle text-sm text-text-secondary leading-relaxed space-y-4 animate-[fadeIn_0.18s_ease-out]">
          <Section title="为什么做这个">
            <p>
              一级 PE / VC 在投决时最大的不确定性是 <strong className="text-text-primary">退出</strong>：
              项目走到 D 轮、Pre-IPO 后能否顺利在二级市场退出，
              直接决定 DPI 何时回正。A 股的特殊性在于退出节奏不只受市场决定，
              <strong className="text-text-primary">监管审核节奏</strong>（受理 → 问询 → 上会 → 注册 → 批文）
              是显著前置变量 —— 这跟美股市场化 S-1 完全不同。
            </p>
            <p>
              本指数是一个 <strong className="text-text-primary">前瞻信号</strong>，
              不是回顾型统计；它把"二级估值情绪 + 一级监管节奏 + 流动性 / 波动率"压缩到一个 0–100 的标量，
              用来给 GP 在做投决时提供「这个赛道的项目在 12–18 个月内
              <strong className="text-text-primary">大概率能 / 可能能 / 大概率不能</strong>退出」的方向感。
            </p>
          </Section>

          <Section title="信号选择 & 权重逻辑">
            <p>
              <strong className="text-text-primary">监管节奏权重 0.32 是最高的</strong>，
              因为 A 股 IPO 在数量层面长期由证监会 + 交易所通过审核进度调控。
              历史上 2012–13 暂停 IPO、2023 阶段性收紧、2024 大撤否潮 ——
              这些都在监管侧能更早被观察到。
            </p>
            <p>
              <strong className="text-text-primary">行业估值（0.18）</strong>排第二 —— PE 高的时候 IPO 更容易获得高定价，
              反推估值低位 = 发行人观望、券商建议撤回；
              <strong className="text-text-primary">流动性（0.16）</strong> 反映场内承接能力（两融 + 成交 + 新发基金）；
              <strong className="text-text-primary">新股不破发率（0.12）</strong> 是窗口好坏的滞后但直接证据；
              <strong className="text-text-primary">波动率（0.12，反向）</strong> 高了发行人会等；
              <strong className="text-text-primary">撤否率（0.10，反向）</strong> 是监管节奏的负向补充。
            </p>
          </Section>

          <Section title="合成方式">
            <p>
              对每个 <strong className="text-text-primary">(板块 × 行业)</strong> 切片：
            </p>
            <ul className="pl-5 list-disc space-y-1.5 text-text-secondary marker:text-cyan-accent">
              <li>原始信号按板块 / 全市场各自抓周频原始值（review 按板块、QVIX 全市场广播 等）</li>
              <li>每条信号做 <strong className="text-text-primary">78 周滚动 z-score</strong>（约 1.5 年窗口，去掉绝对量级，只看相对位置）</li>
              <li>反向信号取负 z；按上面权重加权求和 → composite_z</li>
              <li>通过 sigmoid 映射到 0–100：<code className="text-cyan-accent">100 / (1 + e^(-1.1·z))</code></li>
              <li>按 60 / 45 阈值分类为 OPEN / NARROWING / CLOSED</li>
            </ul>
          </Section>

          <Section title="前瞻外推（Forward Projection）">
            <p>
              未来 4 季的虚线点是基于<strong className="text-text-primary">动量 + 均值回归</strong>启发式：
              <code className="text-cyan-accent">L_{`{t+1}`} = L_t + 0.55·drift + 0.20·(anchor − L_t)</code>，
              drift 取近 6 周变化、anchor 取 78 周均值。这只是一阶外推，
              <strong className="text-text-primary">不是真正的预测</strong>，
              更稳的做法（Phase 2）是用"历史窗口指数 → 后续 2 季实际过会 + 发行量"做 lead-lag 回归替换。
            </p>
          </Section>

          <Section title="已知局限">
            <ul className="pl-5 list-disc space-y-1.5 text-text-secondary marker:text-rose-accent">
              <li>
                <strong className="text-text-primary">监管节奏需要时间累积</strong>：
                AkShare 审核接口只返回当前在审快照（无历史），系统每周存一份快照、对相邻两周做 diff 才能形成事件流。
                上线起 4–8 周内监管节奏信号读数为 0。
              </li>
              <li>
                <strong className="text-text-primary">z-score 基线 1.5 年才稳</strong>：
                估值 / 新股不破发率这两个本期才入库的信号需要累计 78 周才能形成可靠 z 基线。
              </li>
              <li>
                <strong className="text-text-primary">跨板块不可直接横向比</strong>：
                科创板允许未盈利、北交所偏专精特新 —— 同一分数在不同板块语义不同，
                只在同板块内做时序比较才有意义。
              </li>
              <li>
                <strong className="text-text-primary">不构成投资建议</strong>。
                数据源自公开接口，仅供研究参考。
              </li>
            </ul>
          </Section>

          <Section title="数据 & 更新">
            <p>
              数据源：AkShare（封装东方财富 / 申万 / 沪深北交易所 / 巨潮公开接口）。
              更新频率：<strong className="text-text-primary">每周六 18:00 自动跑一次</strong>，
              通过 Windows 任务计划触发本地 pipeline → 拷贝 JSON 到本仓库 → git push → Cloudflare Pages 自动构建。
              全部代码 + 构造规格已开源在本地工程 <code className="text-cyan-accent">ashare_ipo_window/</code>。
            </p>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-cyan-accent font-semibold text-sm mb-2">{title}</h4>
      <div className="space-y-2">{children}</div>
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
