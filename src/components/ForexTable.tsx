import { useEffect, useMemo, useState } from "react";

interface PairConfig {
  id: string;
  base: string;
  quote: string;
  label: string;
  flag: [string, string]; // [base flag, quote flag]
  highlight?: boolean;
}

const PAIRS: PairConfig[] = [
  { id: "eurusd", base: "EUR", quote: "USD", label: "欧元 / 美元", flag: ["🇪🇺", "🇺🇸"], highlight: true },
  { id: "usdjpy", base: "USD", quote: "JPY", label: "美元 / 日元", flag: ["🇺🇸", "🇯🇵"], highlight: true },
  { id: "gbpusd", base: "GBP", quote: "USD", label: "英镑 / 美元", flag: ["🇬🇧", "🇺🇸"] },
  { id: "audusd", base: "AUD", quote: "USD", label: "澳元 / 美元", flag: ["🇦🇺", "🇺🇸"] },
  { id: "usdcad", base: "USD", quote: "CAD", label: "美元 / 加元", flag: ["🇺🇸", "🇨🇦"] },
  { id: "usdchf", base: "USD", quote: "CHF", label: "美元 / 瑞郎", flag: ["🇺🇸", "🇨🇭"] },
  { id: "usdcny", base: "USD", quote: "CNY", label: "美元 / 人民币", flag: ["🇺🇸", "🇨🇳"], highlight: true },
  { id: "eurcny", base: "EUR", quote: "CNY", label: "欧元 / 人民币", flag: ["🇪🇺", "🇨🇳"] },
  { id: "gbpcny", base: "GBP", quote: "CNY", label: "英镑 / 人民币", flag: ["🇬🇧", "🇨🇳"] },
  { id: "jpycny", base: "JPY", quote: "CNY", label: "日元 / 人民币", flag: ["🇯🇵", "🇨🇳"] },
  { id: "hkdcny", base: "HKD", quote: "CNY", label: "港币 / 人民币", flag: ["🇭🇰", "🇨🇳"] },
  { id: "usdkrw", base: "USD", quote: "KRW", label: "美元 / 韩元", flag: ["🇺🇸", "🇰🇷"] },
];

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

export default function ForexTable() {
  const [usdRates, setUsdRates] = useState<RateData | null>(null);
  const [eurRates, setEurRates] = useState<RateData | null>(null);
  const [gbpRates, setGbpRates] = useState<RateData | null>(null);
  const [jpyRates, setJpyRates] = useState<RateData | null>(null);
  const [hkdRates, setHkdRates] = useState<RateData | null>(null);
  const [audRates, setAudRates] = useState<RateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // 平行加载多基础货币（不同 base 各请求一次）
        const [usd, eur, gbp, jpy, hkd, aud] = await Promise.all([
          fetchRates("USD"),
          fetchRates("EUR"),
          fetchRates("GBP"),
          fetchRates("JPY"),
          fetchRates("HKD"),
          fetchRates("AUD"),
        ]);
        if (cancelled) return;
        setUsdRates(usd);
        setEurRates(eur);
        setGbpRates(gbp);
        setJpyRates(jpy);
        setHkdRates(hkd);
        setAudRates(aud);
        setError(null);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 30 * 60 * 1000); // 30 分钟刷新（ER-API 自身约 24 小时刷新）
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const computed = useMemo(() => {
    if (loading) return [];
    return PAIRS.map((p) => {
      const baseRates =
        p.base === "USD"
          ? usdRates
          : p.base === "EUR"
            ? eurRates
            : p.base === "GBP"
              ? gbpRates
              : p.base === "JPY"
                ? jpyRates
                : p.base === "HKD"
                  ? hkdRates
                  : p.base === "AUD"
                    ? audRates
                    : null;
      if (!baseRates) return { ...p, rate: null };
      const rate = baseRates.rates[p.quote];
      return { ...p, rate };
    });
  }, [loading, usdRates, eurRates, gbpRates, jpyRates, hkdRates, audRates]);

  const updatedAt = usdRates?.updatedAt ?? null;

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="text-xs text-cyan-accent tracking-[0.3em] font-mono mb-2">FOREX</div>
          <h2 className="text-2xl font-bold text-text-primary">主要货币对</h2>
          <p className="text-xs text-text-secondary mt-1">数据来源：ExchangeRate-API（每日更新）</p>
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

      {error && !usdRates ? (
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
            <div
              key={p.id}
              className={`glass p-4 ${p.highlight ? "border-cyan-accent/30" : ""}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-text-secondary text-xs font-mono flex items-center gap-1.5">
                  <span className="text-base">{p.flag[0]}</span>
                  <span className="text-text-muted">→</span>
                  <span className="text-base">{p.flag[1]}</span>
                </div>
                {p.highlight && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-accent/10 text-cyan-accent border border-cyan-accent/30">
                    主要
                  </span>
                )}
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
          ))}
        </div>
      )}
    </div>
  );
}
