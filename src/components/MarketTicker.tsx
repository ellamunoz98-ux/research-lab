import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

/**
 * 实时市场行情浮卡（首页 Hero）
 * 数据源：
 *   - 东方财富 push2 接口（A 股、港股、美股、商品，CORS 全开，~1 分钟延迟）
 *   - CoinGecko（加密货币，CORS 全开）
 * 轮询间隔 30 秒，组件卸载时清理 timer。
 */

type Position = {
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
};

type EastMoneyMarket = {
  source: "eastmoney";
  /** 东方财富 secid，如 "1.000001" 上证 / "0.399006" 创业板 / "100.NDX" 纳指 */
  secid: string;
  label: string;
  prefix?: string;
  decimals?: number;
  position: Position;
};

type CoinGeckoMarket = {
  source: "coingecko";
  /** CoinGecko id，如 "bitcoin" / "ethereum" */
  id: string;
  label: string;
  prefix?: string;
  decimals?: number;
  position: Position;
};

type Market = EastMoneyMarket | CoinGeckoMarket;

const MARKETS: Market[] = [
  {
    source: "eastmoney",
    secid: "1.000001",
    label: "上证指数",
    decimals: 2,
    position: { top: "18%", left: "8%" },
  },
  {
    source: "eastmoney",
    secid: "0.399006",
    label: "创业板指",
    decimals: 2,
    position: { top: "28%", right: "10%" },
  },
  {
    source: "coingecko",
    id: "bitcoin",
    label: "比特币 BTC",
    prefix: "$",
    decimals: 0,
    position: { bottom: "22%", left: "12%" },
  },
  {
    source: "eastmoney",
    secid: "100.NDX",
    label: "纳斯达克 100",
    decimals: 2,
    position: { bottom: "28%", right: "8%" },
  },
];

interface Quote {
  price: number;
  change: number;
  changePct: number;
  name?: string;
}

async function fetchEastMoney(secid: string): Promise<Quote> {
  const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f58,f169,f170`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json?.data) throw new Error("无数据");
  const { f43, f58, f169, f170 } = json.data;
  return {
    price: f43 / 100,
    change: f169 / 100,
    changePct: f170 / 100,
    name: f58,
  };
}

async function fetchCoinGecko(id: string): Promise<Quote> {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const data = json?.[id];
  if (!data) throw new Error("无数据");
  return {
    price: data.usd,
    change: (data.usd * (data.usd_24h_change ?? 0)) / 100,
    changePct: data.usd_24h_change ?? 0,
  };
}

async function fetchQuote(market: Market): Promise<Quote> {
  if (market.source === "eastmoney") return fetchEastMoney(market.secid);
  return fetchCoinGecko(market.id);
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

interface CardState {
  quote: Quote | null;
  error: boolean;
  loading: boolean;
}

export default function MarketTicker() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [states, setStates] = useState<CardState[]>(
    MARKETS.map(() => ({ quote: null, error: false, loading: true }))
  );

  // 拉数据 + 定时刷新
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const results = await Promise.allSettled(MARKETS.map(fetchQuote));
      if (cancelled) return;
      setStates((prev) =>
        results.map((r, i) => {
          if (r.status === "fulfilled") {
            return { quote: r.value, error: false, loading: false };
          }
          return {
            quote: prev[i].quote,
            error: true,
            loading: false,
          };
        })
      );
    }

    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // GSAP 入场 + 持续漂浮
  useEffect(() => {
    if (!containerRef.current) return;
    const els = containerRef.current.querySelectorAll<HTMLElement>("[data-floating]");
    if (els.length === 0) return;

    gsap.fromTo(
      els,
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        duration: 1.2,
        stagger: 0.2,
        delay: 0.4,
        ease: "power2.out",
      }
    );

    const tweens: gsap.core.Tween[] = [];
    els.forEach((el, i) => {
      tweens.push(
        gsap.to(el, {
          y: "+=12",
          duration: 3 + i * 0.4,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: 1.5 + i * 0.2,
        })
      );
    });

    return () => tweens.forEach((t) => t.kill());
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none hidden lg:block"
      aria-hidden="true"
    >
      {MARKETS.map((m, i) => {
        const s = states[i];
        const q = s.quote;
        const up = q && q.changePct > 0;
        const down = q && q.changePct < 0;
        const colorClass = up
          ? "text-emerald-accent"
          : down
            ? "text-rose-accent"
            : "text-text-secondary";

        const decimals = m.decimals ?? 2;
        const prefix = m.prefix;

        return (
          <div
            key={i}
            data-floating
            className="absolute glass px-4 py-3 text-xs font-mono opacity-0 min-w-[140px]"
            style={m.position as React.CSSProperties}
          >
            <div className="text-text-muted mb-1 flex items-center gap-1.5">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${
                  s.error
                    ? "bg-rose-accent/60"
                    : s.loading && !q
                      ? "bg-text-muted/40 animate-pulse"
                      : "bg-emerald-accent/80"
                }`}
              ></span>
              {m.label}
            </div>
            {q ? (
              <div className={`${colorClass} text-base`}>
                {formatPrice(q.price, decimals, prefix)}
                <span className="text-xs ml-1">{formatPct(q.changePct)}</span>
              </div>
            ) : s.error ? (
              <div className="text-text-muted text-base">—</div>
            ) : (
              <div className="text-text-secondary text-base animate-pulse">
                <span className="inline-block w-20 h-4 bg-text-muted/10 rounded"></span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
