import { useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import {
  FINANCIAL_CENTERS,
  fetchIndex,
  type FinancialCenter,
  type IndexQuote,
  type QuoteData,
} from "../lib/financialCenters";
import {
  getSessionStatus,
  statusLabel,
  statusColor,
  type SessionInfo,
  type SessionStatus,
} from "../lib/marketHours";
import { sunDirectionVector } from "../lib/solar";
import { CHOKEPOINTS, CONFLICT_ZONES } from "../lib/geoRisk";

interface PointProps extends Record<string, unknown> {
  lat: number;
  lng: number;
  size: number;
  color: string;
  center: FinancialCenter;
  status: SessionStatus;
}

interface HtmlMarkerData extends Record<string, unknown> {
  kind: "chokepoint" | "conflict";
  lat: number;
  lng: number;
  id: string;
  name: string;
  detail: string;
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
  const terminatorMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const [size, setSize] = useState({ w: 600, h: 600 });
  const [selected, setSelected] = useState<FinancialCenter | null>(null);
  const [quotes, setQuotes] = useState<Map<string, QuoteData | { error: true }>>(
    new Map()
  );
  const [hovered, setHovered] = useState<FinancialCenter | null>(null);

  // 层级开关
  const [layers, setLayers] = useState({
    terminator: true,
    chokepoints: true,
    conflicts: true,
  });

  // 全局时钟，每 30 秒滴答一次，驱动开盘状态刷新
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // 各市场会话状态
  const sessions = useMemo(() => {
    const m = new Map<string, SessionInfo>();
    FINANCIAL_CENTERS.forEach((c) => m.set(c.id, getSessionStatus(c.id, now)));
    return m;
  }, [now]);

  const openCount = useMemo(() => {
    let n = 0;
    sessions.forEach((s) => {
      if (s.status === "OPEN" || s.status === "ALWAYS") n++;
    });
    return n;
  }, [sessions]);

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
    globeRef.current.pointOfView({ lat: 30, lng: 105, altitude: 2.6 }, 0);
  }, []);

  // 昼夜 shader 层（自定义 Three.js mesh，附加到地球场景）
  useEffect(() => {
    if (!globeRef.current) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    const init = () => {
      if (cancelled) return;
      const scene = globeRef.current?.scene();
      if (!scene) {
        requestAnimationFrame(init);
        return;
      }
      const GLOBE_R = 100;
      const geometry = new THREE.SphereGeometry(GLOBE_R * 1.003, 96, 96);
      const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          sunDir: { value: new THREE.Vector3(0, 0, 1) },
          enabled: { value: 1 },
        },
        vertexShader: `
          varying vec3 vWorld;
          void main() {
            vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 sunDir;
          uniform float enabled;
          varying vec3 vWorld;
          void main() {
            if (enabled < 0.5) discard;
            vec3 n = normalize(vWorld);
            float d = dot(n, sunDir);
            // 日侧叠加暖青光，夜侧（d<0）保持暗
            float dayGlow = smoothstep(-0.04, 0.18, d);
            vec3 dayColor = vec3(0.32, 0.62, 0.92) * dayGlow * 0.45;
            // 在 terminator（晨昏线）窄带处增加一点高光
            float twilight = smoothstep(0.0, 0.06, d) - smoothstep(0.06, 0.18, d);
            vec3 twilightCol = vec3(1.0, 0.55, 0.30) * max(twilight, 0.0) * 0.55;
            gl_FragColor = vec4(dayColor + twilightCol, 1.0);
          }
        `,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.renderOrder = 1;
      scene.add(mesh);
      terminatorMatRef.current = material;

      const updateSun = () => {
        const [x, y, z] = sunDirectionVector(new Date());
        material.uniforms.sunDir.value.set(x, y, z);
      };
      updateSun();
      const tickId = setInterval(updateSun, 60_000);

      cleanup = () => {
        clearInterval(tickId);
        scene.remove(mesh);
        geometry.dispose();
        material.dispose();
        terminatorMatRef.current = null;
      };
    };

    init();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  // 切换昼夜可见性
  useEffect(() => {
    if (terminatorMatRef.current) {
      terminatorMatRef.current.uniforms.enabled.value = layers.terminator ? 1 : 0;
    }
  }, [layers.terminator]);

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
    setQuotes(new Map());
    Promise.allSettled(selected.indices.map((idx) => fetchIndex(idx))).then(
      (results) => {
        if (cancelled) return;
        const next = new Map<string, QuoteData | { error: true }>();
        results.forEach((r, i) => {
          const key =
            selected.indices[i].secid ?? selected.indices[i].coingeckoId ?? `${i}`;
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
      FINANCIAL_CENTERS.map((c) => {
        const sess = sessions.get(c.id);
        const status = sess?.status ?? "CLOSED";
        const isOpen = status === "OPEN" || status === "ALWAYS";
        return {
          lat: c.lat,
          lng: c.lng,
          size: c.weight * (isOpen ? 0.75 : 0.45),
          color: isOpen ? c.color : dimColor(c.color),
          center: c,
          status,
        };
      }),
    [sessions]
  );

  // 仅"OPEN"或"ALWAYS"的市场显示脉冲环
  const ringsData = useMemo(() => {
    return FINANCIAL_CENTERS.filter((c) => {
      const s = sessions.get(c.id)?.status;
      return (s === "OPEN" || s === "ALWAYS") && c.weight >= 0.8;
    }).map((c) => ({
      lat: c.lat,
      lng: c.lng,
      maxR: 4 * c.weight,
      propagationSpeed: 1.5,
      repeatPeriod: 1800,
      color: c.color,
    }));
  }, [sessions]);

  // 风险层数据合并
  const htmlMarkers: HtmlMarkerData[] = useMemo(() => {
    const arr: HtmlMarkerData[] = [];
    if (layers.chokepoints) {
      CHOKEPOINTS.forEach((c) =>
        arr.push({
          kind: "chokepoint",
          id: c.id,
          lat: c.lat,
          lng: c.lng,
          name: c.name,
          detail: c.importance,
        })
      );
    }
    if (layers.conflicts) {
      CONFLICT_ZONES.forEach((c) =>
        arr.push({
          kind: "conflict",
          id: c.id,
          lat: c.lat,
          lng: c.lng,
          name: c.name,
          detail: `${c.kind}：${c.note}`,
        })
      );
    }
    return arr;
  }, [layers.chokepoints, layers.conflicts]);

  return (
    <div className="relative w-full">
      {/* 顶部状态条 + 层级切换 */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-accent/10 border border-emerald-accent/30 text-emerald-accent font-mono">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-accent animate-pulse"></span>
            {openCount} 个市场交易中
          </span>
          <span className="text-text-muted font-mono">
            UTC {now.toISOString().slice(11, 16)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <LayerToggle
            label="昼夜"
            icon="🌓"
            active={layers.terminator}
            onClick={() =>
              setLayers((l) => ({ ...l, terminator: !l.terminator }))
            }
          />
          <LayerToggle
            label="航运要道"
            icon="⚓"
            active={layers.chokepoints}
            onClick={() =>
              setLayers((l) => ({ ...l, chokepoints: !l.chokepoints }))
            }
          />
          <LayerToggle
            label="冲突区"
            icon="⚠"
            active={layers.conflicts}
            onClick={() =>
              setLayers((l) => ({ ...l, conflicts: !l.conflicts }))
            }
          />
        </div>
      </div>

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
              const sess = sessions.get(pt.center.id);
              const sLabel = statusLabel(pt.status);
              const sCol = statusColor(pt.status);
              return `<div style="font-family:'HarmonyOS Sans SC',-apple-system,sans-serif;background:rgba(13,18,32,0.95);color:#e8eef7;padding:10px 14px;border-radius:8px;border:1px solid rgba(34,211,238,0.3);backdrop-filter:blur(10px);box-shadow:0 8px 32px rgba(0,0,0,0.5);max-width:260px"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><div style="font-weight:600;color:#22d3ee">${pt.center.flag}&nbsp;&nbsp;${pt.center.name}</div><div style="font-size:10px;padding:2px 6px;border-radius:4px;background:${sCol}22;color:${sCol};border:1px solid ${sCol}55;font-weight:600;letter-spacing:0.04em">${sLabel}</div></div><div style="font-size:11px;color:#94a3b8;margin-top:4px">${pt.center.tagline}</div><div style="font-size:10px;color:#64748b;margin-top:6px;font-family:ui-monospace,monospace">本地 ${sess?.localTime ?? "—"} · 点击查看 ${pt.center.indices.length} 项指数</div></div>`;
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
            htmlElementsData={htmlMarkers}
            htmlLat="lat"
            htmlLng="lng"
            htmlAltitude={0.005}
            htmlElement={(d: object) => buildRiskMarker(d as HtmlMarkerData)}
          />

          {/* 操作提示 */}
          <div className="absolute bottom-3 left-3 text-[10px] text-text-muted font-mono pointer-events-none">
            <div>🖱 拖拽旋转 · 滚轮缩放</div>
            <div>📍 {FINANCIAL_CENTERS.length} 个金融中心 · 点击查看本地市场</div>
          </div>

          {/* 当前 hover 提示 */}
          {hovered && !selected && (
            <div className="absolute top-3 right-3 glass px-3 py-2 text-xs animate-[fadeIn_0.15s_ease-out] pointer-events-none">
              <span className="text-cyan-accent font-semibold">
                {hovered.flag} {hovered.name}
              </span>
            </div>
          )}
        </div>

        {/* 侧边面板 */}
        <SidePanel
          center={selected}
          quotes={quotes}
          sessions={sessions}
          onClose={() => setSelected(null)}
        />
      </div>

      {/* 风险层说明（开启时显示） */}
      {(layers.chokepoints || layers.conflicts) && (
        <div className="mt-3 glass px-4 py-2.5 text-[11px] text-text-muted leading-relaxed">
          {layers.chokepoints && (
            <span>
              <span className="text-cyan-accent">⚓ 航运要道</span>：影响全球能源 / 商品物流的关键水道。
            </span>
          )}
          {layers.chokepoints && layers.conflicts && (
            <span className="mx-2 text-border-default">·</span>
          )}
          {layers.conflicts && (
            <span>
              <span className="text-rose-accent">⚠ 冲突区</span>：基于国际媒体公开报道整理，仅供研究讨论参考，状态可能随时变化。
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function LayerToggle({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs border transition-all flex items-center gap-1.5 ${
        active
          ? "border-cyan-accent bg-cyan-accent/10 text-cyan-accent"
          : "border-border-default text-text-muted hover:border-cyan-accent/40 hover:text-text-secondary"
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function buildRiskMarker(d: HtmlMarkerData): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = `
    position: relative;
    transform: translate(-50%, -50%);
    pointer-events: auto;
    cursor: help;
  `;
  const isChoke = d.kind === "chokepoint";
  const color = isChoke ? "#22d3ee" : "#fb7185";
  const icon = isChoke ? "⚓" : "⚠";
  wrap.innerHTML = `
    <div style="
      width: 18px; height: 18px; border-radius: 50%;
      background: ${color}33;
      border: 1.5px solid ${color};
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; line-height: 1;
      box-shadow: 0 0 12px ${color}88;
      position: relative;
      ${isChoke ? "" : "animation: riskPulse 1.8s ease-out infinite;"}
    ">${icon}</div>
    <div class="risk-tooltip" style="
      position: absolute;
      left: 50%;
      bottom: calc(100% + 8px);
      transform: translateX(-50%);
      background: rgba(13,18,32,0.96);
      color: #e8eef7;
      font-family: 'HarmonyOS Sans SC',-apple-system,sans-serif;
      padding: 8px 10px;
      border-radius: 6px;
      border: 1px solid ${color}55;
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      white-space: normal;
      width: max-content;
      max-width: 200px;
      font-size: 11px;
      line-height: 1.45;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.18s;
    ">
      <div style="font-weight:600;color:${color};margin-bottom:2px">${d.name}</div>
      <div style="color:#94a3b8;font-size:10px">${d.detail}</div>
    </div>
  `;
  const tip = wrap.querySelector(".risk-tooltip") as HTMLElement;
  wrap.addEventListener("mouseenter", () => {
    if (tip) tip.style.opacity = "1";
  });
  wrap.addEventListener("mouseleave", () => {
    if (tip) tip.style.opacity = "0";
  });
  return wrap;
}

function dimColor(hex: string): string {
  // 把颜色淡化到 50% 饱和（处理 #rrggbb）
  if (!hex.startsWith("#") || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const dr = Math.round(r * 0.45 + 80 * 0.55);
  const dg = Math.round(g * 0.45 + 95 * 0.55);
  const db = Math.round(b * 0.45 + 116 * 0.55);
  return `#${dr.toString(16).padStart(2, "0")}${dg.toString(16).padStart(2, "0")}${db.toString(16).padStart(2, "0")}`;
}

function SidePanel({
  center,
  quotes,
  sessions,
  onClose,
}: {
  center: FinancialCenter | null;
  quotes: Map<string, QuoteData | { error: true }>;
  sessions: Map<string, SessionInfo>;
  onClose: () => void;
}) {
  if (!center) {
    return (
      <div className="glass p-6 flex flex-col items-center justify-center text-center min-h-[400px] lg:min-h-[640px]">
        <div className="text-6xl mb-4 animate-[float_3s_ease-in-out_infinite]">
          🌍
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          点击地球任意金融中心
        </h3>
        <p className="text-sm text-text-secondary leading-relaxed max-w-xs">
          {FINANCIAL_CENTERS.length} 个主要市场，
          <br />
          实时拉取该地区代表性指数
        </p>
        <div className="mt-6 grid grid-cols-2 gap-2 w-full max-w-xs">
          {FINANCIAL_CENTERS.slice(0, 6).map((c) => {
            const s = sessions.get(c.id)?.status;
            const sCol = s ? statusColor(s) : "#64748b";
            return (
              <div
                key={c.id}
                className="text-xs text-text-muted flex items-center gap-1.5 px-2 py-1 rounded border border-border-subtle"
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: sCol }}
                ></span>
                <span>{c.flag}</span>
                <span className="truncate">{c.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const sess = sessions.get(center.id);
  const sCol = sess ? statusColor(sess.status) : "#64748b";
  const sLabel = sess ? statusLabel(sess.status) : "—";

  return (
    <div className="glass p-5 min-h-[400px] lg:min-h-[640px] lg:max-h-[640px] overflow-y-auto">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-3xl mb-1">{center.flag}</div>
          <h3 className="text-xl font-bold text-text-primary leading-tight">
            {center.name}
          </h3>
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

      {/* 状态徽章 */}
      <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border-subtle">
        <span
          className="text-xs px-2.5 py-1 rounded-full font-mono font-semibold tracking-wider"
          style={{
            color: sCol,
            background: `${sCol}1a`,
            border: `1px solid ${sCol}55`,
          }}
        >
          {sLabel}
        </span>
        <span className="text-xs text-text-muted font-mono">
          本地 {sess?.localTime ?? "—"}
        </span>
      </div>

      <p className="text-xs text-text-secondary leading-relaxed mb-5">
        {center.tagline}
      </p>

      <div className="text-xs text-cyan-accent font-mono tracking-wider mb-3">
        关键指数 · {center.indices.length} 项
      </div>

      <div className="space-y-2">
        {center.indices.map((idx, i) => {
          const key = idx.secid ?? idx.coingeckoId ?? `${i}`;
          const q = quotes.get(key);
          return <IndexRow key={key} idx={idx} quote={q} />;
        })}
      </div>

      <div className="mt-5 pt-4 border-t border-border-subtle text-xs text-text-muted">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-accent animate-pulse"></span>
          数据 30 秒前 · 点击其他点切换
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
        <div className="text-sm text-text-primary font-medium truncate">
          {idx.label}
        </div>
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
