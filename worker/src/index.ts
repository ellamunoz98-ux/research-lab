/**
 * Research.Lab 评论系统后端 + 数据源代理 + 申请 Timeline 监控
 * 基于 Cloudflare Workers + KV 存储 + Cron Triggers
 *
 * 评论端点：
 *   GET  /comments?path=<page>     列出某页评论
 *   POST /comments                 新增评论 { path, name, role?, email?, body }
 *   DELETE /comments/<id>?path=<>  删除评论（仅站长，需 X-Admin-Token）
 *   GET  /health                   健康检查
 *
 * 数据代理（绕过浏览器 CORS / Referer 反爬）：
 *   GET  /proxy/em/<path>          → push2.eastmoney.com
 *   GET  /proxy/em-search/<path>   → search-api-web.eastmoney.com
 *   GET  /proxy/cg/<path>          → api.coingecko.com
 *   GET  /proxy/er/<path>          → open.er-api.com
 *   GET  /proxy/rss/<path>         → api.rss2json.com
 *
 * 申请 Timeline 监控：
 *   - cron 每天 UTC 0:00（北京 8:00）自动跑
 *   - GET /admin/run-monitor?token=<ADMIN_TOKEN>[&dry=1]  手动触发，dry=1 时不推送
 *
 * 防滥用：
 *   - 每 IP 每分钟最多 5 条评论
 *   - 名字 ≤ 30 字，正文 ≤ 2000 字
 *   - 简单关键词黑名单（可扩展）
 */
import { handleAdminRunMonitor, runMonitor } from "./monitor";
import { handleChat, handleChatIndexClear, handleChatIndexUpsert } from "./chat";

interface Env {
  /** KV Namespace 绑定，存储评论 + monitor 状态（前缀 `monitor:`） */
  COMMENTS: KVNamespace;
  /** 管理员 token，用于删除评论 + 手动触发 monitor + 写入向量库 */
  ADMIN_TOKEN?: string;
  /** 允许的来源（部署后填你的网站域名，如 https://research-lab.pages.dev） */
  ALLOWED_ORIGIN?: string;
  /** Timeline JSON 源，默认 https://shaun-research.pages.dev/timeline.json */
  TIMELINE_JSON_URL?: string;
  /** Server 酱推送 SCKEY */
  SERVERCHAN_KEY?: string;
  /** PushPlus 推送 token */
  PUSHPLUS_TOKEN?: string;
  /** Resend API key + 发件人 + 收件人（逗号分隔） */
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  RESEND_TO?: string;
  /** Workers AI 绑定（嵌入模型 bge-m3） */
  AI: Ai;
  /** Vectorize 向量库（报告库语义索引） */
  VECTORIZE: VectorizeIndex;
  /** DeepSeek API key（生成模型） */
  DEEPSEEK_API_KEY?: string;
}

interface StoredComment {
  id: string;
  path: string;
  name: string;
  role?: string;
  email?: string;
  body: string;
  seed: number; // 头像渐变种子
  createdAt: number;
  ip?: string; // 仅用于审核，不返回前端
}

type PublicComment = Omit<StoredComment, "ip" | "email">;

const MAX_NAME = 30;
const MAX_BODY = 2000;
const MAX_ROLE = 20;
const RATE_LIMIT_PER_MIN = 5;

// 简单关键词黑名单（可扩展）
const BLOCKED_KEYWORDS = ["viagra", "casino", "免费色情", "代开发票"];

function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(data: unknown, headers: HeadersInit, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function text(body: string, headers: HeadersInit, status = 200): Response {
  return new Response(body, { status, headers: { ...headers, "Content-Type": "text/plain" } });
}

function pickOrigin(req: Request, env: Env): string {
  const allowed = env.ALLOWED_ORIGIN;
  if (!allowed || allowed === "*") return "*";
  // 支持配置多个域名（逗号分隔）
  const list = allowed.split(",").map((s) => s.trim());
  const origin = req.headers.get("Origin") ?? "";
  return list.includes(origin) ? origin : list[0];
}

function publicForm(c: StoredComment): PublicComment {
  const { ip: _ip, email: _email, ...rest } = c;
  return rest;
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

async function handleGet(req: Request, env: Env, headers: HeadersInit): Promise<Response> {
  const url = new URL(req.url);
  const path = url.searchParams.get("path");
  if (!path) return text("missing path", headers, 400);

  const list = (await env.COMMENTS.get(`path:${path}`, { type: "json" })) as
    | StoredComment[]
    | null;
  const cleaned = (list ?? []).map(publicForm);
  return json(cleaned, headers);
}

async function handlePost(req: Request, env: Env, headers: HeadersInit): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return text("invalid json", headers, 400);
  }

  const path = String(body.path ?? "").trim();
  const name = String(body.name ?? "").trim();
  const text_ = String(body.body ?? "").trim();
  const role = body.role ? String(body.role).trim().slice(0, MAX_ROLE) : undefined;
  const email = body.email ? String(body.email).trim().slice(0, 100) : undefined;

  if (!path || !name || !text_) return text("missing fields", headers, 400);
  if (name.length > MAX_NAME) return text("name too long", headers, 400);
  if (text_.length > MAX_BODY) return text("body too long", headers, 400);

  // 黑名单
  const lower = (text_ + name).toLowerCase();
  if (BLOCKED_KEYWORDS.some((k) => lower.includes(k))) {
    return text("blocked", headers, 400);
  }

  // 限流：每 IP 每 60 秒最多 N 条
  const ip = req.headers.get("CF-Connecting-IP") ?? "unknown";
  const rateKey = `rate:${ip}`;
  const recent = parseInt((await env.COMMENTS.get(rateKey)) ?? "0");
  if (recent >= RATE_LIMIT_PER_MIN) return text("rate limited", headers, 429);
  await env.COMMENTS.put(rateKey, String(recent + 1), { expirationTtl: 60 });

  const id = crypto.randomUUID();
  const comment: StoredComment = {
    id,
    path,
    name,
    role,
    email,
    body: text_,
    seed: hashSeed(name + (email ?? "")),
    createdAt: Date.now(),
    ip,
  };

  const key = `path:${path}`;
  const existing = (await env.COMMENTS.get(key, { type: "json" })) as StoredComment[] | null;
  const next = [...(existing ?? []), comment];
  // 防止单页堆积过多（每页保留最近 200 条）
  const trimmed = next.slice(-200);
  await env.COMMENTS.put(key, JSON.stringify(trimmed));

  return json(publicForm(comment), headers, 201);
}

/* --------------------------- 数据源代理 --------------------------- */

interface ProxyTarget {
  host: string;
  /** 模拟真实的页面 Referer，让上游觉得请求是从其官网发出（绕反爬） */
  referer: string;
}

const PROXY_TARGETS: Record<string, ProxyTarget> = {
  em: {
    host: "https://push2.eastmoney.com",
    referer: "https://quote.eastmoney.com/center/boardlist.html",
  },
  "em-search": {
    host: "https://search-api-web.eastmoney.com",
    referer: "https://www.eastmoney.com/",
  },
  cg: {
    host: "https://api.coingecko.com",
    referer: "https://www.coingecko.com/",
  },
  er: {
    host: "https://open.er-api.com",
    referer: "https://www.exchangerate-api.com/",
  },
  rss: {
    host: "https://api.rss2json.com",
    referer: "https://rss2json.com/",
  },
  bnb: {
    host: "https://api.binance.com",
    referer: "https://www.binance.com/",
  },
};

/** 不同数据源的边缘缓存 TTL（秒）— 静态/慢变数据 TTL 更长 */
const CACHE_TTL: Record<string, number> = {
  em: 20,         // 行情指数：20 秒
  "em-search": 300, // 板块新闻：5 分钟
  cg: 30,         // 加密货币 (CG)：30 秒
  bnb: 20,        // 加密货币 (Binance)：20 秒
  er: 1800,       // 汇率：30 分钟
  rss: 300,       // RSS：5 分钟
};

async function handleProxy(
  req: Request,
  url: URL,
  corsBase: HeadersInit,
  ctx: ExecutionContext
): Promise<Response> {
  // /proxy/<service>/<...rest>
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return text("missing service", corsBase, 400);
  const service = segments[1];
  const target = PROXY_TARGETS[service];
  if (!target) return text("unknown service", corsBase, 404);

  const upstreamPath = segments.length > 2 ? "/" + segments.slice(2).join("/") : "/";
  const upstreamUrl = target.host + upstreamPath + url.search;
  const ttl = CACHE_TTL[service] ?? 15;

  // 用 upstream URL 作为缓存 key，多浏览器/多组件相同请求共用同一份
  const cacheKey = new Request(upstreamUrl, { method: "GET" });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) {
    // 命中边缘缓存，直接返回（加上 CORS 头）
    const headers = new Headers(cached.headers);
    Object.entries(corsBase).forEach(([k, v]) => headers.set(k, String(v)));
    headers.set("x-cache", "HIT");
    return new Response(cached.body, { status: cached.status, headers });
  }

  try {
    // 给东方财富的请求附加一个 fake 但格式合法的访客 cookie，
    // 模拟刚从 eastmoney.com 主站跳过来的浏览器访问，避开 IP 段 + 无 cookie 的 502 反爬
    const extraHeaders: Record<string, string> = {};
    if (service === "em" || service === "em-search") {
      extraHeaders["Cookie"] =
        "qgqp_b_id=ec6fa70a4c43e7a3ad06d8e2c0baf4ea; em_hq_fls=js; HAList=ty-1-000001-%u4E0A%u8BC1%u6307%u6570";
    }

    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        Referer: target.referer,
        Accept: "*/*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        ...extraHeaders,
      },
      redirect: "follow",
    });
    const body = await upstream.arrayBuffer();
    const contentType =
      upstream.headers.get("content-type") || "application/json; charset=utf-8";

    // 只缓存成功响应
    if (upstream.ok) {
      const toCache = new Response(body, {
        status: upstream.status,
        headers: {
          "content-type": contentType,
          "cache-control": `public, max-age=${ttl}`,
        },
      });
      ctx.waitUntil(cache.put(cacheKey, toCache));
    }

    return new Response(body, {
      status: upstream.status,
      headers: {
        ...corsBase,
        "content-type": contentType,
        "cache-control": `public, max-age=${ttl}`,
        "x-cache": "MISS",
      },
    });
  } catch (e) {
    return text(
      `proxy error: ${e instanceof Error ? e.message : String(e)}`,
      corsBase,
      502
    );
  }
}

/* --------------------------- EM 板块聚合 --------------------------- */
/**
 * 一次返回所有活跃 EM 板块（行业 + 概念），绕开被反爬的 clist/get：
 *   - 内置 BK 代码段（BK0420-0490 行业 + BK0500-1300 概念，约 870 个）
 *   - 分批走 ulist.np（每批 200，5 个 subrequest）
 *   - 上游响应里 f14 非空的就是真实存在的板块
 *   - Worker 端缓存 30 分钟，多浏览器/多组件共用
 */

interface RawBoard {
  f3?: number;
  f12?: string;
  f14?: string;
  f62?: number;
}

async function handleEmBoards(
  corsBase: HeadersInit,
  ctx: ExecutionContext
): Promise<Response> {
  const cacheKey = new Request("https://em-boards-aggregate.local/v1", {
    method: "GET",
  });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) {
    const headers = new Headers(cached.headers);
    Object.entries(corsBase).forEach(([k, v]) => headers.set(k, String(v)));
    headers.set("x-cache", "HIT");
    return new Response(cached.body, { status: cached.status, headers });
  }

  // 构造完整 BK 代码列表
  const codes: string[] = [];
  for (let i = 420; i <= 490; i++) {
    codes.push(`90.BK${String(i).padStart(4, "0")}`);
  }
  for (let i = 500; i <= 1300; i++) {
    codes.push(`90.BK${String(i).padStart(4, "0")}`);
  }

  // 分批批量拉
  const BATCH = 180;
  const all: RawBoard[] = [];
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    Referer: "https://quote.eastmoney.com/center/boardlist.html",
    Accept: "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    Cookie:
      "qgqp_b_id=ec6fa70a4c43e7a3ad06d8e2c0baf4ea; em_hq_fls=js",
  };

  const batches: string[][] = [];
  for (let i = 0; i < codes.length; i += BATCH) {
    batches.push(codes.slice(i, i + BATCH));
  }

  // 并行各批，提高首次填充速度
  const results = await Promise.all(
    batches.map(async (batch) => {
      const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${batch.join(",")}&fields=f3,f12,f14,f62`;
      try {
        const r = await fetch(url, { headers, redirect: "follow" });
        if (!r.ok) return [] as RawBoard[];
        const j = (await r.json()) as { data?: { diff?: unknown } };
        const diff = j?.data?.diff;
        if (Array.isArray(diff)) return diff as RawBoard[];
        if (diff && typeof diff === "object")
          return Object.values(diff as Record<string, RawBoard>);
        return [];
      } catch {
        return [];
      }
    })
  );
  for (const r of results) all.push(...r);

  // 过滤掉名字空的（无效 secid）
  const boards = all.filter((b) => b.f12 && b.f14);

  const body = JSON.stringify({
    status: "ok",
    fetchedAt: Date.now(),
    count: boards.length,
    boards,
  });
  const ttl = 1800; // 30 分钟
  const toCache = new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${ttl}`,
    },
  });
  ctx.waitUntil(cache.put(cacheKey, toCache));

  return new Response(body, {
    status: 200,
    headers: {
      ...corsBase,
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${ttl}`,
      "x-cache": "MISS",
    },
  });
}

/* --------------------------- RSS 解析代理 --------------------------- */

interface ParsedFeedItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  guid: string;
  thumbnail?: string;
  author?: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function tagText(block: string, tag: string): string {
  // 支持带命名空间的标签，例如 dc:date / media:thumbnail
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i");
  const m = re.exec(block);
  return m ? decodeEntities(m[1]).trim() : "";
}

function tagAttr(block: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']+)["'][^>]*/?>`, "i");
  const m = re.exec(block);
  return m ? decodeEntities(m[1]) : "";
}

function parseRssXml(xml: string): ParsedFeedItem[] {
  const items: ParsedFeedItem[] = [];
  // 兼容 RSS 2.0 <item> 和 Atom <entry>
  const blocks: string[] = [];
  for (const m of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    blocks.push(m[1]);
  }
  if (blocks.length === 0) {
    for (const m of xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)) {
      blocks.push(m[1]);
    }
  }
  for (const block of blocks) {
    const title = tagText(block, "title");
    let link = tagText(block, "link");
    if (!link) link = tagAttr(block, "link", "href"); // Atom
    const pubDate =
      tagText(block, "pubDate") ||
      tagText(block, "dc:date") ||
      tagText(block, "published") ||
      tagText(block, "updated");
    const description =
      tagText(block, "description") ||
      tagText(block, "summary") ||
      tagText(block, "content") ||
      tagText(block, "content:encoded");
    const guid = tagText(block, "guid") || link;
    const author =
      tagText(block, "author") ||
      tagText(block, "dc:creator") ||
      undefined;
    const thumbnail =
      tagAttr(block, "media:thumbnail", "url") ||
      tagAttr(block, "media:content", "url") ||
      tagAttr(block, "enclosure", "url") ||
      undefined;
    if (title || link) {
      items.push({ title, link, pubDate, description, guid, author, thumbnail });
    }
  }
  return items;
}

async function handleFeedProxy(
  url: URL,
  corsBase: HeadersInit,
  ctx: ExecutionContext
): Promise<Response> {
  const rssUrl = url.searchParams.get("rss_url");
  if (!rssUrl) return text("missing rss_url", corsBase, 400);
  let target: URL;
  try {
    target = new URL(rssUrl);
  } catch {
    return text("invalid rss_url", corsBase, 400);
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return text("forbidden protocol", corsBase, 400);
  }

  const cacheKey = new Request(`https://feed-cache.local/${encodeURIComponent(rssUrl)}`, { method: "GET" });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) {
    const headers = new Headers(cached.headers);
    Object.entries(corsBase).forEach(([k, v]) => headers.set(k, String(v)));
    headers.set("x-cache", "HIT");
    return new Response(cached.body, { status: cached.status, headers });
  }

  try {
    const upstream = await fetch(target.toString(), {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      redirect: "follow",
    });
    if (!upstream.ok) {
      return json(
        { status: "error", message: `upstream ${upstream.status}` },
        corsBase,
        upstream.status
      );
    }
    const xml = await upstream.text();
    const items = parseRssXml(xml).slice(0, 30);
    const body = JSON.stringify({ status: "ok", items });

    const cacheTtl = 300; // 5 分钟
    const toCache = new Response(body, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": `public, max-age=${cacheTtl}`,
      },
    });
    ctx.waitUntil(cache.put(cacheKey, toCache));

    return new Response(body, {
      status: 200,
      headers: {
        ...corsBase,
        "content-type": "application/json; charset=utf-8",
        "cache-control": `public, max-age=${cacheTtl}`,
        "x-cache": "MISS",
      },
    });
  } catch (e) {
    return json(
      { status: "error", message: e instanceof Error ? e.message : String(e) },
      corsBase,
      502
    );
  }
}

/* ----------------------------- /数据源代理 ----------------------------- */

async function handleDelete(req: Request, env: Env, headers: HeadersInit): Promise<Response> {
  if (!env.ADMIN_TOKEN) return text("admin token not configured", headers, 503);
  const provided = req.headers.get("X-Admin-Token") ?? "";
  if (provided !== env.ADMIN_TOKEN) return text("unauthorized", headers, 401);

  const url = new URL(req.url);
  const id = url.pathname.split("/").filter(Boolean).pop();
  const path = url.searchParams.get("path");
  if (!id || !path) return text("bad request", headers, 400);

  const key = `path:${path}`;
  const existing = (await env.COMMENTS.get(key, { type: "json" })) as StoredComment[] | null;
  const filtered = (existing ?? []).filter((c) => c.id !== id);
  await env.COMMENTS.put(key, JSON.stringify(filtered));
  return json({ ok: true, removed: (existing?.length ?? 0) - filtered.length }, headers);
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const headers = corsHeaders(pickOrigin(req, env));

    if (req.method === "OPTIONS") {
      return new Response(null, { headers, status: 204 });
    }

    if (url.pathname === "/health") {
      return json({ ok: true, time: Date.now() }, headers);
    }

    if (url.pathname === "/proxy/feed") {
      return handleFeedProxy(url, headers, ctx);
    }

    if (url.pathname === "/em/boards") {
      return handleEmBoards(headers, ctx);
    }

    if (url.pathname === "/admin/run-monitor") {
      return handleAdminRunMonitor(req, env, headers);
    }

    if (url.pathname === "/chat") {
      return handleChat(req, env, headers);
    }

    if (url.pathname === "/admin/chat-index") {
      return handleChatIndexUpsert(req, env, headers);
    }

    if (url.pathname === "/admin/chat-index/clear") {
      return handleChatIndexClear(req, env, headers);
    }

    if (url.pathname.startsWith("/proxy/")) {
      return handleProxy(req, url, headers, ctx);
    }

    if (url.pathname === "/comments") {
      if (req.method === "GET") return handleGet(req, env, headers);
      if (req.method === "POST") return handlePost(req, env, headers);
      return text("method not allowed", headers, 405);
    }

    if (url.pathname.startsWith("/comments/")) {
      if (req.method === "DELETE") return handleDelete(req, env, headers);
      return text("method not allowed", headers, 405);
    }

    return text("not found", headers, 404);
  },

  /**
   * Cron 触发器（在 wrangler.toml 配置 schedule）：每日跑 timeline 监控
   */
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runMonitor(env)
        .then((report) => {
          console.log("[monitor] done:", JSON.stringify(report, null, 2));
        })
        .catch((e) => {
          console.error("[monitor] failed:", e instanceof Error ? e.stack : e);
        })
    );
  },
} satisfies ExportedHandler<Env>;
