import { useEffect, useMemo, useState } from "react";
import { PAIRS, CURRENCY_META, rateDiff, type PairConfig } from "../lib/forex";
import { flagUrl, preloadFlags } from "../lib/flags";
import { fetchBoardNews, timeAgo, type BoardNews } from "../lib/industryData";

interface RateData {
  base: string;
  rates: Record<string, number>;
  updatedAt: number;
}

async function fetchRates(base: string): Promise<RateData> {
  const url = `https://open.er-api.com/v6/latest/${base}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.result !== "success") throw new Error("rates error");
  return {
    base: json.base_code,
    rates: json.rates,
    updatedAt: json.time_last_update_unix * 1000,
  };
}

interface ComputedPair extends PairConfig {
  rate: number | null;
}

export default function ForexTable() {
  const [allRates, setAllRates] = useState<Record<string, RateData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ComputedPair | null>(null);

  // 预加载所有货币对涉及的国旗
  useEffect(() => {
    const codes = new Set<string>();
    PAIRS.forEach((p) => {
      codes.add(p.base);
      codes.add(p.quote);
    });
    preloadFlags(Array.from(codes), 640);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const bases = ["USD", "EUR", "GBP", "JPY", "HKD", "AUD"];
        const results = await Promise.all(bases.map(fetchRates));
        if (cancelled) return;
        const m: Record<string, RateData> = {};
        bases.forEach((b, i) => (m[b] = results[i]));
        setAllRates(m);
        setError(null);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const computed = useMemo<ComputedPair[]>(() => {
    return PAIRS.map((p) => {
      const baseRates = allRates[p.base];
      const rate = baseRates?.rates?.[p.quote] ?? null;
      return { ...p, rate };
    });
  }, [allRates]);

  const updatedAt = allRates.USD?.updatedAt ?? null;

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="text-xs text-cyan-accent tracking-[0.3em] font-mono mb-2">
            FOREX
          </div>
          <h2 className="text-2xl font-bold text-text-primary">主要货币对</h2>
          <p className="text-xs text-text-secondary mt-1">
            数据来源：ExchangeRate-API（每日更新）· 点击卡片查看驱动因素 + 利差
          </p>
        </div>
        <div className="text-xs text-text-muted font-mono flex items-center gap-2">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${
              loading
                ? "bg-cyan-accent animate-pulse"
                : error
                  ? "bg-rose-accent/60"
                  : "bg-emerald-accent"
            }`}
          ></span>
          {updatedAt
            ? `更新于 ${new Date(updatedAt).toLocaleString("zh-CN", { hour12: false })}`
            : "加载中"}
        </div>
      </div>

      {error && Object.keys(allRates).length === 0 ? (
        <div className="glass p-8 text-center">
          <div className="text-rose-accent text-sm mb-2">⚠ {error}</div>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-cyan-accent hover:underline"
          >
            刷新重试
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {computed.map((p) => (
            <PairCard key={p.id} p={p} onClick={() => setSelected(p)} />
          ))}
        </div>
      )}

      {selected && (
        <ForexDetailModal
          pair={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function PairCard({
  p,
  onClick,
}: {
  p: ComputedPair;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden glass text-left hover:scale-[1.02] hover:border-cyan-accent/50 transition-all flex flex-col ${
        p.highlight ? "border-cyan-accent/30" : ""
      }`}
    >
      {/* 顶部双国旗横幅（base | quote） */}
      <div
        className="relative shrink-0 flex"
        style={{ height: 60, background: "rgba(8,12,22,0.7)" }}
      >
        <div
          className="relative flex-1 border-r border-border-subtle/50"
          style={{ background: "rgba(8,12,22,0.5)" }}
        >
          <img
            src={flagUrl(p.base, 320)}
            alt=""
            loading="lazy"
            decoding="async"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              filter: "saturate(1.15)",
            }}
          />
        </div>
        <div
          className="relative flex-1"
          style={{ background: "rgba(8,12,22,0.5)" }}
        >
          <img
            src={flagUrl(p.quote, 320)}
            alt=""
            loading="lazy"
            decoding="async"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              filter: "saturate(1.15)",
            }}
          />
        </div>
        {p.highlight && (
          <span className="absolute top-1 right-1 text-[9px] px-1.5 py-0.5 rounded bg-cyan-accent/15 text-cyan-accent border border-cyan-accent/30 backdrop-blur-sm">
            主要
          </span>
        )}
      </div>

      <div className="p-4 flex-1">
        <div className="flex items-center gap-1.5 mb-1.5 text-xs text-text-secondary font-mono">
          <span>{p.base}</span>
          <span className="text-text-muted">→</span>
          <span>{p.quote}</span>
        </div>
        <div className="text-xs text-text-muted mb-1">{p.label}</div>
        <div className="text-2xl tabular text-text-primary font-semibold">
          {p.rate != null ? (
            p.rate.toLocaleString(undefined, {
              minimumFractionDigits: p.rate > 100 ? 2 : 4,
              maximumFractionDigits: p.rate > 100 ? 2 : 4,
            })
          ) : (
            <span className="text-text-muted">—</span>
          )}
        </div>
        <div className="text-[10px] text-text-muted font-mono mt-1">
          1 {p.base} = ? {p.quote}
        </div>
      </div>
    </button>
  );
}

function ForexDetailModal({
  pair,
  onClose,
}: {
  pair: ComputedPair;
  onClose: () => void;
}) {
  const [news, setNews] = useState<BoardNews[] | null>(null);
  const [newsLoading, setNewsLoading] = useState(true);

  const baseMeta = CURRENCY_META[pair.base];
  const quoteMeta = CURRENCY_META[pair.quote];
  const diff = rateDiff(pair.base, pair.quote);

  useEffect(() => {
    let cancelled = false;
    setNewsLoading(true);
    // 用本币对名称（如"美元日元"）作关键词搜索
    const kw = `${baseMeta?.name ?? pair.base}${quoteMeta?.name ?? pair.quote}`;
    fetchBoardNews(kw).then((items) => {
      if (cancelled) return;
      setNews(items);
      setNewsLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 py-8 backdrop-blur-md bg-bg-base/80 overflow-y-auto animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        className="relative max-w-3xl w-full glass overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部双国旗横幅 */}
        <div
          className="relative flex"
          style={{ height: 160, background: "rgba(8,12,22,0.85)" }}
        >
          <div className="relative flex-1 border-r border-border-subtle/40">
            <img
              key={pair.base}
              src={flagUrl(pair.base, 640)}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                filter: "saturate(1.1)",
              }}
            />
            <span
              className="absolute bottom-2 left-2 text-[10px] font-mono font-bold tracking-[0.18em] text-text-primary px-1.5 py-0.5 rounded bg-bg-base/65 backdrop-blur-sm"
            >
              {pair.base}
            </span>
          </div>
          <div className="relative flex-1">
            <img
              key={pair.quote}
              src={flagUrl(pair.quote, 640)}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                filter: "saturate(1.1)",
              }}
            />
            <span
              className="absolute bottom-2 right-2 text-[10px] font-mono font-bold tracking-[0.18em] text-text-primary px-1.5 py-0.5 rounded bg-bg-base/65 backdrop-blur-sm"
            >
              {pair.quote}
            </span>
          </div>
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: "30%",
              background:
                "linear-gradient(to bottom, transparent 0%, rgba(13,18,32,0.85) 100%)",
              pointerEvents: "none",
            }}
          />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-bg-base/70 hover:bg-bg-base flex items-center justify-center text-text-muted hover:text-text-primary transition-colors backdrop-blur-sm"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <div className="p-8">
          {/* Header */}
          <div className="flex items-start gap-4 mb-6 pb-5 border-b border-border-subtle">
            <div className="text-4xl">
              {pair.flag[0]} {pair.flag[1]}
            </div>
            <div className="flex-1">
              <div className="text-xs text-cyan-accent tracking-[0.3em] font-mono mb-1">
                FX PAIR · {pair.base}/{pair.quote}
              </div>
              <h2 className="text-3xl font-bold text-text-primary">
                {pair.label}
              </h2>
              <div className="text-sm text-text-secondary mt-1">
                当前汇率{" "}
                <span className="text-text-primary font-mono font-semibold text-lg">
                  {pair.rate != null
                    ? pair.rate.toLocaleString(undefined, {
                        minimumFractionDigits: pair.rate > 100 ? 2 : 4,
                        maximumFractionDigits: pair.rate > 100 ? 2 : 4,
                      })
                    : "—"}
                </span>
                <span className="text-text-muted ml-2">
                  1 {pair.base} = {pair.quote}
                </span>
              </div>
            </div>
          </div>

          {/* 利差对比 */}
          <div className="mb-6">
            <div className="text-[10px] text-cyan-accent font-mono tracking-wider mb-3">
              POLICY RATE DIFF · 利差对比
            </div>
            <div className="grid grid-cols-3 gap-3">
              <RateBlock
                flag={pair.flag[0]}
                code={pair.base}
                name={baseMeta?.name ?? pair.base}
                bank={baseMeta?.centralBank ?? "—"}
                rate={baseMeta?.policyRate ?? 0}
              />
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <div className="text-[10px] text-text-muted font-mono">利差</div>
                  <div
                    className={`text-2xl font-bold tabular ${
                      diff > 0
                        ? "text-rose-accent"
                        : diff < 0
                          ? "text-emerald-accent"
                          : "text-text-secondary"
                    }`}
                  >
                    {diff > 0 ? "+" : ""}
                    {diff.toFixed(2)}%
                  </div>
                  <div className="text-[10px] text-text-muted mt-1">
                    {diff > 0 ? `${pair.base} 利率更高` : diff < 0 ? `${pair.quote} 利率更高` : "持平"}
                  </div>
                </div>
              </div>
              <RateBlock
                flag={pair.flag[1]}
                code={pair.quote}
                name={quoteMeta?.name ?? pair.quote}
                bank={quoteMeta?.centralBank ?? "—"}
                rate={quoteMeta?.policyRate ?? 0}
              />
            </div>
          </div>

          {/* 驱动因素 */}
          <div className="mb-6">
            <div className="text-[10px] text-purple-accent font-mono tracking-wider mb-2">
              DRIVERS · 主要驱动
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              {pair.driver}
            </p>
          </div>

          {/* 历史区间 */}
          <div className="mb-6">
            <div className="text-[10px] text-emerald-accent font-mono tracking-wider mb-2">
              HISTORICAL RANGE · 历史区间
            </div>
            <div className="text-sm text-text-secondary px-3 py-2 rounded bg-bg-card/40 border border-border-subtle">
              {pair.range}
            </div>
          </div>

          {/* 媒体观点 */}
          <div>
            <div className="text-[10px] text-cyan-accent font-mono tracking-wider mb-3">
              RECENT NEWS · 近期媒体讨论
            </div>
            {newsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 bg-text-muted/10 rounded animate-pulse"
                  ></div>
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
                    className="block px-3 py-2 rounded bg-bg-card/40 border border-border-subtle hover:border-cyan-accent/40 group"
                  >
                    <div className="text-sm text-text-secondary group-hover:text-cyan-accent leading-relaxed line-clamp-2">
                      {n.title}
                    </div>
                    <div className="text-[10px] text-text-muted font-mono mt-1">
                      {n.source} · {timeAgo(n.time)}
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-xs text-text-muted px-3 py-3">
                暂无相关报道
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RateBlock({
  flag,
  code,
  name,
  bank,
  rate,
}: {
  flag: string;
  code: string;
  name: string;
  bank: string;
  rate: number;
}) {
  return (
    <div className="rounded-lg p-3 bg-bg-card/40 border border-border-subtle text-center">
      <div className="text-2xl mb-1">{flag}</div>
      <div className="text-xs text-text-primary font-semibold">{name}</div>
      <div className="text-[10px] text-text-muted font-mono mb-2">{code}</div>
      <div className="text-xl font-bold tabular text-text-primary">
        {rate.toFixed(2)}%
      </div>
      <div className="text-[10px] text-text-muted font-mono mt-0.5">{bank}</div>
    </div>
  );
}
