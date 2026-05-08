import { useEffect, useMemo, useState } from "react";
import { proxied } from "../lib/proxy";

/**
 * 国际金融时事 / 资讯快线
 * 数据源：rss2json.com（CORS 开放免费代理）+ 多个 RSS 源聚合
 * 5 分钟自动刷新
 */

interface FeedSource {
  id: string;
  name: string;
  rss: string;
  category: "global" | "crypto" | "stocks" | "forex" | "commodities";
  badgeColor: string;
}

const SOURCES: FeedSource[] = [
  {
    id: "investing-stocks",
    name: "Investing · 股市",
    rss: "https://www.investing.com/rss/news_25.rss",
    category: "stocks",
    badgeColor: "text-cyan-accent border-cyan-accent/40 bg-cyan-accent/5",
  },
  {
    id: "investing-economy",
    name: "Investing · 经济",
    rss: "https://www.investing.com/rss/news_14.rss",
    category: "global",
    badgeColor: "text-purple-accent border-purple-accent/40 bg-purple-accent/5",
  },
  {
    id: "investing-forex",
    name: "Investing · 外汇",
    rss: "https://www.investing.com/rss/news_1.rss",
    category: "forex",
    badgeColor: "text-blue-accent border-blue-accent/40 bg-blue-accent/5",
  },
  {
    id: "investing-commodity",
    name: "Investing · 商品",
    rss: "https://www.investing.com/rss/news_11.rss",
    category: "commodities",
    badgeColor: "text-amber-400 border-amber-400/40 bg-amber-400/5",
  },
  {
    id: "coindesk",
    name: "CoinDesk · 加密",
    rss: "https://www.coindesk.com/arc/outboundfeeds/rss",
    category: "crypto",
    badgeColor: "text-emerald-accent border-emerald-accent/40 bg-emerald-accent/5",
  },
  {
    id: "cointelegraph",
    name: "CoinTelegraph",
    rss: "https://cointelegraph.com/rss",
    category: "crypto",
    badgeColor: "text-emerald-accent border-emerald-accent/40 bg-emerald-accent/5",
  },
];

interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: FeedSource;
  pubDate: Date;
  description: string;
  thumbnail?: string;
  author?: string;
}

const CATEGORIES = [
  { id: "all" as const, label: "全部" },
  { id: "global" as const, label: "宏观 / 经济" },
  { id: "stocks" as const, label: "股市" },
  { id: "forex" as const, label: "外汇" },
  { id: "commodities" as const, label: "商品" },
  { id: "crypto" as const, label: "加密资产" },
];

type CategoryFilter = (typeof CATEGORIES)[number]["id"];

async function fetchSource(s: FeedSource): Promise<NewsItem[]> {
  const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(s.rss)}`;
  const res = await fetch(proxied(url));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.status !== "ok" || !Array.isArray(json.items)) {
    throw new Error(json.message || "feed error");
  }
  return json.items.slice(0, 12).map((it: Record<string, string | undefined>) => ({
    id: `${s.id}-${it.guid || it.link}`,
    title: it.title || "(无标题)",
    link: it.link || "#",
    source: s,
    pubDate: new Date(it.pubDate || Date.now()),
    description: stripHtml(it.description || it.content || ""),
    thumbnail: extractThumb(it),
    author: it.author || undefined,
  }));
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function extractThumb(item: Record<string, unknown>): string | undefined {
  const t = item.thumbnail as string | undefined;
  if (t && t.startsWith("http")) return t;
  const enc = item.enclosure as { link?: string } | undefined;
  if (enc?.link?.startsWith("http")) return enc.link;
  return undefined;
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} 天前`;
  return date.toLocaleDateString("zh-CN");
}

export default function NewsFeed() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  // 拉取所有源
  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      const results = await Promise.allSettled(SOURCES.map(fetchSource));
      if (cancelled) return;
      const all: NewsItem[] = [];
      let okCount = 0;
      results.forEach((r) => {
        if (r.status === "fulfilled") {
          all.push(...r.value);
          okCount++;
        }
      });
      // 按时间倒序
      all.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
      setItems(all);
      setLoading(false);
      setLastFetch(new Date());
      if (okCount === 0) setError("全部数据源暂时不可用，请稍后再试");
      else setError(null);
    }

    loadAll();
    const id = setInterval(loadAll, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((it) => it.source.category === filter);
  }, [items, filter]);

  const categoryCount = (cat: CategoryFilter) => {
    if (cat === "all") return items.length;
    return items.filter((it) => it.source.category === cat).length;
  };

  return (
    <div>
      {/* 筛选 + 状态 */}
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const active = filter === c.id;
            const count = categoryCount(c.id);
            return (
              <button
                key={c.id}
                onClick={() => setFilter(c.id)}
                className={`px-3.5 py-1.5 text-sm rounded-full border transition-all ${
                  active
                    ? "border-cyan-accent bg-cyan-accent/10 text-cyan-accent"
                    : "border-border-default text-text-secondary hover:border-cyan-accent/50 hover:text-text-primary"
                }`}
              >
                {c.label}
                <span className="ml-1.5 text-xs opacity-70 tabular">{count}</span>
              </button>
            );
          })}
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
          {loading
            ? "加载中..."
            : lastFetch
              ? `${timeAgo(lastFetch)}更新 · 5分钟自动刷新`
              : "等待数据"}
        </div>
      </div>

      {/* 主列表 */}
      {loading && items.length === 0 ? (
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass p-5 animate-pulse">
              <div className="h-4 bg-text-muted/10 rounded w-1/3 mb-3"></div>
              <div className="h-5 bg-text-muted/10 rounded w-full mb-2"></div>
              <div className="h-4 bg-text-muted/10 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : error && items.length === 0 ? (
        <div className="glass p-8 text-center">
          <div className="text-2xl mb-2">⚠</div>
          <div className="text-rose-accent text-sm mb-2">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-cyan-accent hover:underline"
          >
            刷新重试
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass p-8 text-center text-text-muted text-sm">
          当前分类暂无内容
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="glass p-5 group flex flex-col gap-2.5 h-full"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[10px] px-2 py-0.5 rounded font-mono border ${item.source.badgeColor} truncate`}
        >
          {item.source.name}
        </span>
        <span className="text-xs text-text-muted font-mono shrink-0">
          {timeAgo(item.pubDate)}
        </span>
      </div>

      <h3 className="text-base font-semibold text-text-primary group-hover:text-cyan-accent transition-colors leading-snug line-clamp-2">
        {item.title}
      </h3>

      {item.description && (
        <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
          {item.description}
        </p>
      )}

      {item.author && (
        <div className="text-[10px] text-text-muted font-mono mt-auto pt-1">
          {item.author}
        </div>
      )}
    </a>
  );
}
