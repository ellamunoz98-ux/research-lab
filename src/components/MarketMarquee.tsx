import { useEffect, useState } from "react";

/**
 * 顶部滚动行情条（marquee）
 * 拉取多市场指数 + 加密货币，无缝循环滚动
 */

interface Ticker {
  source: "eastmoney" | "coingecko";
  symbol: string;       // EM secid 或 CG id
  label: string;
  prefix?: string;
  decimals?: number;
}

const TICKERS: Ticker[] = [
  { source: "eastmoney", symbol: "1.000001", label: "上证" },
  { source: "eastmoney", symbol: "0.399001", label: "深证" },
  { source: "eastmoney", symbol: "0.399006", label: "创业板" },
  { source: "eastmoney", symbol: "1.000300", label: "沪深300" },
  { source: "eastmoney", symbol: "100.HSI", label: "恒生" },
  { source: "eastmoney", symbol: "100.HSTECH", label: "恒科" },
  { source: "eastmoney", symbol: "100.DJIA", label: "道指" },
  { source: "eastmoney", symbol: "100.SPX", label: "标普500" },
  { source: "eastmoney", symbol: "100.NDX", label: "纳指100" },
  { source: "eastmoney", symbol: "100.FTSE", label: "富时100" },
  { source: "eastmoney", symbol: "100.GDAXI", label: "DAX" },
  { source: "eastmoney", symbol: "100.N225", label: "日经225" },
  { source: "coingecko", symbol: "bitcoin", label: "BTC", prefix: "$", decimals: 0 },
  { source: "coingecko", symbol: "ethereum", label: "ETH", prefix: "$", decimals: 0 },
];

interface Quote {
  price: number;
  changePct: number;
}

async function fetchOne(t: Ticker): Promise<Quote | null> {
  try {
    if (t.source === "eastmoney") {
      const r = await fetch(
        `https://push2.eastmoney.com/api/qt/stock/get?secid=${t.symbol}&fields=f43,f170`
      );
      const j = await r.json();
      if (!j?.data) return null;
      return { price: j.data.f43 / 100, changePct: j.data.f170 / 100 };
    }
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${t.symbol}&vs_currencies=usd&include_24hr_change=true`
    );
    const j = await r.json();
    const d = j?.[t.symbol];
    if (!d) return null;
    return { price: d.usd, changePct: d.usd_24h_change ?? 0 };
  } catch {
    return null;
  }
}

function formatPrice(value: number, decimals: number, prefix?: string) {
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return prefix ? `${prefix}${formatted}` : formatted;
}

export default function MarketMarquee() {
  const [quotes, setQuotes] = useState<(Quote | null)[]>(
    TICKERS.map(() => null)
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const results = await Promise.all(TICKERS.map(fetchOne));
      if (!cancelled) setQuotes(results);
    }
    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // 渲染单条 ticker 项
  const items = TICKERS.map((t, i) => {
    const q = quotes[i];
    const decimals = t.decimals ?? 2;
    const pct = q?.changePct ?? 0;
    const colorClass = q
      ? pct > 0
        ? "text-emerald-accent"
        : pct < 0
          ? "text-rose-accent"
          : "text-text-secondary"
      : "text-text-muted";
    const arrow = q ? (pct > 0 ? "▲" : pct < 0 ? "▼" : "—") : "";
    return (
      <div key={t.symbol + i} className="flex items-center gap-2 shrink-0 px-5 font-mono text-xs">
        <span className="text-text-secondary">{t.label}</span>
        <span className={`tabular ${colorClass}`}>
          {q ? formatPrice(q.price, decimals, t.prefix) : "—"}
        </span>
        {q && (
          <span className={`tabular text-[10px] ${colorClass}`}>
            {arrow} {pct > 0 ? "+" : ""}
            {pct.toFixed(2)}%
          </span>
        )}
        <span className="text-border-default">·</span>
      </div>
    );
  });

  return (
    <div className="market-marquee bg-bg-base/80 backdrop-blur-xl border-b border-border-subtle py-1.5 overflow-hidden relative z-40">
      <div className="market-marquee-track flex items-center" aria-hidden>
        {items}
        {/* 复制一份用于无缝循环 */}
        {items.map((el, i) => (
          <div key={"dup-" + i} className="contents">{el}</div>
        ))}
      </div>
      <style>{`
        .market-marquee-track {
          width: max-content;
          animation: marquee 60s linear infinite;
        }
        .market-marquee:hover .market-marquee-track {
          animation-play-state: paused;
        }
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .market-marquee-track { animation: none; }
        }
      `}</style>
    </div>
  );
}
