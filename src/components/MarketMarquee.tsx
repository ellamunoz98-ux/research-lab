import { useEffect, useState } from "react";
import { proxied } from "../lib/proxy";

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

/**
 * 一次性批量拉取：东方财富 12 个指数走 ulist.np/get（1 个请求），
 * CoinGecko BTC/ETH 走批量 simple/price（1 个请求）。
 * 14 个请求合并为 2 个，首屏速度提升 5-10 倍。
 */
async function fetchAll(): Promise<Map<string, Quote>> {
  const result = new Map<string, Quote>();
  const emTickers = TICKERS.filter((t) => t.source === "eastmoney");
  const cgTickers = TICKERS.filter((t) => t.source === "coingecko");

  // —— 东方财富批量（ulist.np 用 f2 最新价 / f3 涨跌幅，与单 stock/get 的 f43/f170 不同）
  const emPromise = (async () => {
    if (emTickers.length === 0) return;
    const secids = emTickers.map((t) => t.symbol).join(",");
    try {
      const r = await fetch(
        proxied(
          `https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${secids}&fields=f2,f3,f12`
        )
      );
      const j = await r.json();
      const diff = j?.data?.diff;
      if (!diff) return;
      const items = Array.isArray(diff) ? diff : Object.values(diff);
      // ulist 保留请求顺序，按下标对应即可
      items.forEach((it: { f2?: number; f3?: number }, i: number) => {
        const t = emTickers[i];
        if (!t || typeof it.f2 !== "number") return;
        result.set(t.symbol, {
          price: it.f2 / 100,
          changePct: typeof it.f3 === "number" ? it.f3 / 100 : 0,
        });
      });
    } catch {
      /* swallow — 显示 — */
    }
  })();

  // —— CoinGecko 批量
  const cgPromise = (async () => {
    if (cgTickers.length === 0) return;
    const ids = cgTickers.map((t) => t.symbol).join(",");
    try {
      const r = await fetch(
        proxied(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
        )
      );
      const j = await r.json();
      cgTickers.forEach((t) => {
        const d = j?.[t.symbol];
        if (!d) return;
        result.set(t.symbol, {
          price: d.usd,
          changePct: d.usd_24h_change ?? 0,
        });
      });
    } catch {
      /* swallow */
    }
  })();

  await Promise.all([emPromise, cgPromise]);
  return result;
}

function formatPrice(value: number, decimals: number, prefix?: string) {
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return prefix ? `${prefix}${formatted}` : formatted;
}

export default function MarketMarquee() {
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const m = await fetchAll();
      if (!cancelled) setQuotes(m);
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
    const q = quotes.get(t.symbol) ?? null;
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
