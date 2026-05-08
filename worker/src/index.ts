/**
 * Research.Lab 评论系统后端 + 数据源代理
 * 基于 Cloudflare Workers + KV 存储
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
 * 防滥用：
 *   - 每 IP 每分钟最多 5 条评论
 *   - 名字 ≤ 30 字，正文 ≤ 2000 字
 *   - 简单关键词黑名单（可扩展）
 */

interface Env {
  /** KV Namespace 绑定，存储评论 */
  COMMENTS: KVNamespace;
  /** 管理员 token，用于删除评论 */
  ADMIN_TOKEN?: string;
  /** 允许的来源（部署后填你的网站域名，如 https://research-lab.pages.dev） */
  ALLOWED_ORIGIN?: string;
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

const PROXY_TARGETS: Record<string, string> = {
  em: "https://push2.eastmoney.com",
  "em-search": "https://search-api-web.eastmoney.com",
  cg: "https://api.coingecko.com",
  er: "https://open.er-api.com",
  rss: "https://api.rss2json.com",
};

async function handleProxy(
  req: Request,
  url: URL,
  corsBase: HeadersInit
): Promise<Response> {
  // /proxy/<service>/<...rest>
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return text("missing service", corsBase, 400);
  const service = segments[1];
  const target = PROXY_TARGETS[service];
  if (!target) return text("unknown service", corsBase, 404);

  const upstreamPath = segments.length > 2 ? "/" + segments.slice(2).join("/") : "/";
  const upstreamUrl = target + upstreamPath + url.search;
  const targetOrigin = new URL(target).origin;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        // 提供合理的 UA / Referer，避免被反爬关连接
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        Referer: targetOrigin + "/",
        Accept: "*/*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      cf: { cacheTtl: 15, cacheEverything: true } as RequestInitCfProperties,
    });
    const body = await upstream.arrayBuffer();
    const contentType =
      upstream.headers.get("content-type") || "application/json; charset=utf-8";
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...corsBase,
        "content-type": contentType,
        "cache-control": "public, max-age=15",
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
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const headers = corsHeaders(pickOrigin(req, env));

    if (req.method === "OPTIONS") {
      return new Response(null, { headers, status: 204 });
    }

    if (url.pathname === "/health") {
      return json({ ok: true, time: Date.now() }, headers);
    }

    if (url.pathname.startsWith("/proxy/")) {
      return handleProxy(req, url, headers);
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
} satisfies ExportedHandler<Env>;
