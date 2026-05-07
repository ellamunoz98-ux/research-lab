import { useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import {
  FINANCIAL_CENTERS,
  fetchIndex,
  type FinancialCenter,
  type IndexQuote,
  type QuoteData,
} from "../lib/financialCenters";

interface PointProps extends Record<string, unknown> {
  lat: number;
  lng: number;
  size: number;
  color: string;
  center: FinancialCenter;
}

function formatPrice(value: number, decimals: number, prefix?: string) {
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return prefix ? `${prefix}${formatted}` : formatted;
}

function formatPct(pct: number) {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export default function FinancialGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [size, setSize] = useState({ w: 600, h: 600 });
  const [selected, setSelected] = useState<FinancialCenter | null>(null);
  const [quotes, setQuotes] = useState<Map<string, QuoteData | { error: true }>>(
    new Map()
  );
  const [hovered, setHovered] = useState<FinancialCenter | null>(null);

  // 容器大小
  useEffect(() => {
    if (!containerRef.current) return;
    const resize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setSize({
        w: Math.max(rect.width, 320),
        h: Math.max(rect.height, 400),
      });
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // 初始化：自动旋转 + 调整初始视角
  useEffect(() => {
    if (!globeRef.current) return;
    const controls = globeRef.current.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.4;
      controls.enableZoom = true;
      controls.minDistance = 200;
      controls.maxDistance = 800;
    }
    // 初始视角对准中国大陆
    globeRef.current.pointOfView(
      { lat: 30, lng: 105, altitude: 2.6 },
      0
    );
  }, []);

  // 选中切换：暂停自转 + 旋转到目标
  useEffect(() => {
    if (!globeRef.current) return;
    const controls = globeRef.current.controls();
    if (!controls) return;
    if (selected) {
      controls.autoRotate = false;
      globeRef.current.pointOfView(
        { lat: selected.lat + 5, lng: selected.lng, altitude: 1.8 },
        1500
      );
    } else {
      controls.autoRotate = true;
    }
  }, [selected]);

  // 拉取选中区域的行情
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setQuotes(new Map()); // 清空，显示加载状态
    Promise.allSettled(selected.indices.map((idx) => fetchIndex(idx))).then(
      (results) => {
        if (cancelled) return;
        const next = new Map<string, QuoteData | { error: true }>();
        results.forEach((r, i) => {
          const key = selected.indices[i].secid ?? selected.indices[i].coingeckoId ?? `${i}`;
          if (r.status === "fulfilled") next.set(key, r.value);
          else next.set(key, { error: true });
        });
        setQuotes(next);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const points: PointProps[] = useMemo(
    () =>
      FINANCIAL_CENTERS.map((c) => ({
        lat: c.lat,
        lng: c.lng,
        size: c.weight * 0.6,
        color: c.color,
        center: c,
      })),
    []
  );

  const ringsData = useMemo(() => {
    // 给主要中心点加脉冲环（视觉强调）
    return FINANCIAL_CENTERS.filter((c) => c.weight >= 1.0).map((c) => ({
      lat: c.lat,
      lng: c.lng,
      maxR: 4 * c.weight,
      propagationSpeed: 1.5,
      repeatPeriod: 1800,
      color: c.color,
    }));
  }, []);

  return (
    <div className="relative w-full">
      <div className="grid lg:grid-cols-[1fr_380px] gap-4">
        {/* 地球容器 */}
        <div
          ref={containerRef}
          className="relative aspect-square lg:aspect-auto lg:h-[640px] rounded-2xl overflow-hidden bg-gradient-to-br from-bg-elevated to-bg-base border border-border-subtle"
        >
          <Globe
            ref={globeRef}
            width={size.w}
            height={size.h}
            backgroundColor="rgba(0,0,0,0)"
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
            atmosphereColor="#22d3ee"
            atmosphereAltitude={0.18}
            pointsData={points}
            pointLat="lat"
            pointLng="lng"
            pointAltitude={(p: object) => (p as PointProps).size * 0.04}
            pointRadius={(p: object) => (p as PointProps).size * 0.6}
            pointColor={(p: object) => (p as PointProps).color}
            pointResolution={20}
            pointLabel={(p: object) => {
              const pt = p as PointProps;
              return `<div style="font-family:'HarmonyOS Sans SC',-apple-system,sans-serif;background:rgba(13,18,32,0.95);color:#e8eef7;padding:10px 14px;border-radius:8px;border:1px solid rgba(34,211,238,0.3);backdrop-filter:blur(10px);box-shadow:0 8px 32px rgba(0,0,0,0.5);max-width:240px"><div style="font-weight:600;color:#22d3ee">${pt.center.flag}&nbsp;&nbsp;${pt.center.name}</div><div style="font-size:11px;color:#94a3b8;margin-top:4px">${pt.center.tagline}</div><div style="font-size:11px;color:#64748b;margin-top:6px">点击查看 ${pt.center.indices.length} 项指数</div></div>`;
            }}
            onPointClick={(p: object) => {
              setSelected((p as PointProps).center);
            }}
            onPointHover={(p: object | null) =>
              setHovered(p ? (p as PointProps).center : null)
            }
            ringsData={ringsData}
            ringLat="lat"
            ringLng="lng"
            ringMaxRadius="maxR"
            ringPropagationSpeed="propagationSpeed"
            ringRepeatPeriod="repeatPeriod"
            ringColor={(d: object) => () =>
              `${(d as { color: string }).color}88`
            }
          />

          {/* 操作提示（右下角） */}
          <div className="absolute bottom-3 left-3 text-[10px] text-text-muted font-mono pointer-events-none">
            <div>🖱 拖拽旋转 · 滚轮缩放</div>
            <div>📍 {FINANCIAL_CENTERS.length} 个金融中心 · 点击查看本地市场</div>
          </div>

          {/* 当前 hover 提示（左上角） */}
          {hovered && !selected && (
            <div className="absolute top-3 right-3 glass px-3 py-2 text-xs animate-[fadeIn_0.15s_ease-out] pointer-events-none">
              <span className="text-cyan-accent font-semibold">{hovered.flag} {hovered.name}</span>
            </div>
          )}
        </div>

        {/* 侧边面板 */}
        <SidePanel
          center={selected}
          quotes={quotes}
          onClose={() => setSelected(null)}
        />
      </div>
    </div>
  );
}

function SidePanel({
  center,
  quotes,
  onClose,
}: {
  center: FinancialCenter | null;
  quotes: Map<string, QuoteData | { error: true }>;
  onClose: () => void;
}) {
  if (!center) {
    return (
      <div className="glass p-6 flex flex-col items-center justify-center text-center min-h-[400px] lg:min-h-[640px]">
        <div className="text-6xl mb-4 animate-[float_3s_ease-in-out_infinite]">🌍</div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">点击地球任意金融中心</h3>
        <p className="text-sm text-text-secondary leading-relaxed max-w-xs">
          {FINANCIAL_CENTERS.length} 个主要市场，
          <br />实时拉取该地区代表性指数
        </p>
        <div className="mt-6 grid grid-cols-2 gap-2 w-full max-w-xs">
          {FINANCIAL_CENTERS.slice(0, 6).map((c) => (
            <div key={c.id} className="text-xs text-text-muted flex items-center gap-1.5 px-2 py-1 rounded border border-border-subtle">
              <span>{c.flag}</span>
              <span className="truncate">{c.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-5 min-h-[400px] lg:min-h-[640px] lg:max-h-[640px] overflow-y-auto">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-3xl mb-1">{center.flag}</div>
          <h3 className="text-xl font-bold text-text-primary leading-tight">{center.name}</h3>
          <div className="text-xs text-text-muted font-mono mt-0.5">
            {center.city} · {center.country}
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full hover:bg-bg-card flex items-center justify-center text-text-muted hover:text-text-primary text-sm transition-colors"
          aria-label="关闭"
        >
          ✕
        </button>
      </div>

      <p className="text-xs text-text-secondary leading-relaxed mb-5 pb-4 border-b border-border-subtle">
        {center.tagline}
      </p>

      <div className="text-xs text-cyan-accent font-mono tracking-wider mb-3">
        关键指数 · {center.indices.length} 项
      </div>

      <div className="space-y-2">
        {center.indices.map((idx, i) => {
          const key = idx.secid ?? idx.coingeckoId ?? `${i}`;
          const q = quotes.get(key);
          return (
            <IndexRow key={key} idx={idx} quote={q} />
          );
        })}
      </div>

      <div className="mt-5 pt-4 border-t border-border-subtle text-xs text-text-muted">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-accent animate-pulse"></span>
          数据 30 秒前·点击其他点切换
        </div>
      </div>
    </div>
  );
}

function IndexRow({
  idx,
  quote,
}: {
  idx: IndexQuote;
  quote: QuoteData | { error: true } | undefined;
}) {
  const isLoading = !quote;
  const isError = quote && "error" in quote;
  const data = quote && !("error" in quote) ? quote : null;
  const decimals = idx.decimals ?? 2;

  const colorClass = data
    ? data.changePct > 0
      ? "text-emerald-accent"
      : data.changePct < 0
        ? "text-rose-accent"
        : "text-text-secondary"
    : "text-text-muted";

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-bg-card/40 border border-border-subtle hover:border-cyan-accent/30 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="text-sm text-text-primary font-medium truncate">{idx.label}</div>
        {idx.hint && <div className="text-[10px] text-text-muted">{idx.hint}</div>}
      </div>
      <div className="text-right shrink-0">
        {isLoading && (
          <div className="w-16 h-5 bg-text-muted/10 rounded animate-pulse"></div>
        )}
        {isError && (
          <div className="text-text-muted text-xs">数据暂不可用</div>
        )}
        {data && (
          <>
            <div className={`tabular text-base font-semibold ${colorClass}`}>
              {formatPrice(data.price, decimals, idx.prefix)}
            </div>
            <div className={`tabular text-xs ${colorClass}`}>
              {formatPct(data.changePct)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
