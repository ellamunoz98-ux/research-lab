/**
 * 数据源代理（绕过浏览器 CORS / Referer 反爬）
 *
 * 所有外部 API 请求都通过自家 Cloudflare Worker 转发：
 *   浏览器 → research-lab-comments.workers.dev/proxy/<service>/...
 *           → 真实 API host
 *
 * 这样浏览器视角是同 origin（无 CORS），上游看到的是 Worker IP +
 * 合理 Referer（无反爬），ERR_EMPTY_RESPONSE / CORS error 一并解决。
 *
 * 未识别的域名会原样返回，方便本地直连调试。
 */

const PROXY_BASE = "https://research-lab-comments.ellamunoz98.workers.dev";

/** hostname → Worker 路由前缀里的 service 标识，须与 worker/src/index.ts 中的 PROXY_TARGETS 对齐 */
const SERVICE_MAP: Record<string, string> = {
  "push2.eastmoney.com": "em",
  "search-api-web.eastmoney.com": "em-search",
  "api.coingecko.com": "cg",
  "open.er-api.com": "er",
  "api.rss2json.com": "rss",
  "api.binance.com": "bnb",
};

/**
 * 把外部 URL 改写为 Worker 代理 URL。
 * 不识别的 host 原样返回。
 *
 * @example
 * proxied("https://push2.eastmoney.com/api/qt/stock/get?secid=1.000001")
 * // → "https://research-lab-comments.ellamunoz98.workers.dev/proxy/em/api/qt/stock/get?secid=1.000001"
 */
export function proxied(url: string): string {
  try {
    const u = new URL(url);
    const service = SERVICE_MAP[u.hostname];
    if (!service) return url;
    return `${PROXY_BASE}/proxy/${service}${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

/**
 * Worker 自家 RSS 解析端点（绕过 rss2json 限速）。
 * 返回格式与 rss2json 兼容：{ status: "ok", items: [...] }
 */
export function feedProxyUrl(rssUrl: string): string {
  return `${PROXY_BASE}/proxy/feed?rss_url=${encodeURIComponent(rssUrl)}`;
}
