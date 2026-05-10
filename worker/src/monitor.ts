/**
 * 申请 Timeline 监控 + 多通道推送
 *
 * 每天 UTC 0:00（北京时间 8:00）由 cron 触发：
 *   1. 从站点 /timeline.json 拉取数据
 *   2. 算出未来 7 天会开放/截止的 phase
 *   3. 对每个 monitorUrl fetch + sha256 hash，与 KV 中上次比较，diff 出变化
 *   4. 打包消息，分别调用 Server 酱 / PushPlus / Resend 推送
 *
 * KV 复用 COMMENTS namespace，前缀 `monitor:`：
 *   - monitor:hash:<id>    上次抓到的 sha256
 *   - monitor:status:<id>  上次抓取状态（"ok" / "fail"）
 *   - monitor:lastrun      上次运行的 ISO 时间
 *
 * 也支持手动触发：
 *   GET /admin/run-monitor?token=<ADMIN_TOKEN>&dry=1
 *     dry=1 时只返回会推什么，不实际推送
 */

interface MonitorEnv {
  COMMENTS: KVNamespace;
  ADMIN_TOKEN?: string;
  /** 站点的 timeline.json URL，例：https://shaun-research.pages.dev/timeline.json */
  TIMELINE_JSON_URL?: string;
  /** Server 酱 SCKEY（https://sct.ftqq.com/） */
  SERVERCHAN_KEY?: string;
  /** PushPlus token（https://www.pushplus.plus/） */
  PUSHPLUS_TOKEN?: string;
  /** Resend API key（https://resend.com/） */
  RESEND_API_KEY?: string;
  /** Resend 发件人，例：alerts@yourdomain.com */
  RESEND_FROM?: string;
  /** Resend 收件人，例：you@example.com */
  RESEND_TO?: string;
}

interface TimelinePhase {
  phase: string;
  label: string;
  opens?: string;
  closes?: string;
  status: string;
  estimated?: boolean;
  notes?: string;
}

interface TimelineItem {
  id: string;
  type: string;
  category: string;
  name: string;
  shortName?: string;
  region: string;
  url: string;
  monitorUrl?: string;
  timeline: TimelinePhase[];
  notes?: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  master: "港大硕士",
  "ib-er": "外资投行 ER",
  "mutual-fund": "中资公募",
  "private-fund": "中资私募",
};

/* --------------------------- 工具 --------------------------- */

function daysFromNow(dateStr: string | undefined, today: Date): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  const t0 = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  return Math.round((d.getTime() - t0.getTime()) / 86_400_000);
}

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 抽取页面里"内容部分"的 hash —— 去掉 <script>/<style> 和大段空白，
 * 让无关动效/CSRF token 之类的变化不会触发误报
 */
function extractContent(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* --------------------------- 抓取 + diff --------------------------- */

interface FetchResult {
  id: string;
  url: string;
  ok: boolean;
  status: number;
  hash?: string;
  changed?: boolean;
  prevStatus?: string;
  errorMsg?: string;
}

async function fetchAndHash(item: TimelineItem, env: MonitorEnv): Promise<FetchResult> {
  const url = item.monitorUrl ?? item.url;
  const r: FetchResult = { id: item.id, url, ok: false, status: 0 };
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      // 个别页面响应慢，给 25s
      signal: AbortSignal.timeout(25_000),
    });
    r.status = resp.status;
    if (!resp.ok) {
      r.errorMsg = `HTTP ${resp.status}`;
      return r;
    }
    const html = await resp.text();
    const content = extractContent(html);
    if (content.length < 50) {
      r.errorMsg = "page too short, likely JS-rendered";
      return r;
    }
    const h = await sha256(content);
    r.hash = h;
    r.ok = true;
    const prevHash = await env.COMMENTS.get(`monitor:hash:${item.id}`);
    const prevStatus = await env.COMMENTS.get(`monitor:status:${item.id}`);
    r.prevStatus = prevStatus ?? "(首次)";
    if (prevHash && prevHash !== h) {
      r.changed = true;
    }
  } catch (e) {
    r.errorMsg = e instanceof Error ? e.message : String(e);
  }
  return r;
}

async function persistResult(item: TimelineItem, r: FetchResult, env: MonitorEnv) {
  if (r.ok && r.hash) {
    await env.COMMENTS.put(`monitor:hash:${item.id}`, r.hash);
    await env.COMMENTS.put(`monitor:status:${item.id}`, "ok");
  } else {
    await env.COMMENTS.put(`monitor:status:${item.id}`, `fail:${r.errorMsg ?? "?"}`);
  }
}

/* --------------------------- 消息构造 --------------------------- */

interface PhaseEvent {
  itemName: string;
  category: string;
  phaseLabel: string;
  kind: "opens" | "closes";
  date: string;
  daysAway: number;
  estimated: boolean;
  url: string;
}

interface ChangeEvent {
  itemName: string;
  category: string;
  url: string;
}

function findPhaseEvents(items: TimelineItem[], windowDays: number, today: Date): PhaseEvent[] {
  const out: PhaseEvent[] = [];
  for (const item of items) {
    for (const phase of item.timeline) {
      for (const kind of ["opens", "closes"] as const) {
        const dateStr = phase[kind];
        if (!dateStr) continue;
        const days = daysFromNow(dateStr, today);
        if (days === null) continue;
        if (days < 0 || days > windowDays) continue;
        out.push({
          itemName: item.shortName ?? item.name,
          category: item.category,
          phaseLabel: phase.label,
          kind,
          date: dateStr,
          daysAway: days,
          estimated: !!phase.estimated,
          url: item.url,
        });
      }
    }
  }
  return out.sort((a, b) => a.daysAway - b.daysAway);
}

interface BuiltMessage {
  title: string;
  markdown: string;
  html: string;
}

function buildMessage(
  phaseEvents: PhaseEvent[],
  changeEvents: ChangeEvent[],
  failures: { id: string; url: string; reason: string }[],
  today: Date
): BuiltMessage {
  const dateStr = today.toISOString().slice(0, 10);
  const totalAlerts = phaseEvents.length + changeEvents.length;
  const title =
    totalAlerts === 0
      ? `[Timeline] ${dateStr} 无更新`
      : `[Timeline] ${dateStr} ${phaseEvents.length} 个节点 + ${changeEvents.length} 个页面变更`;

  const md: string[] = [];
  md.push(`## ${dateStr} 申请 Timeline 日报`);
  md.push("");

  if (phaseEvents.length === 0 && changeEvents.length === 0) {
    md.push("> 今日无关键节点、无 URL 变化。");
  }

  if (phaseEvents.length > 0) {
    md.push("### 未来 7 天关键节点");
    md.push("");
    for (const ev of phaseEvents) {
      const tag = ev.kind === "opens" ? "🟢 开放" : "🟠 截止";
      const rel =
        ev.daysAway === 0 ? "**今天**" : ev.daysAway === 1 ? "**明天**" : `${ev.daysAway} 天后`;
      const est = ev.estimated ? " ⚠估算" : "";
      md.push(
        `- ${tag} · **${ev.itemName}** · ${ev.phaseLabel} · ${ev.date}（${rel}）${est}  \n  [→ 官网](${ev.url})`
      );
    }
    md.push("");
  }

  if (changeEvents.length > 0) {
    md.push("### 监控页面变更（人工去看是否有招聘动静）");
    md.push("");
    for (const ev of changeEvents) {
      md.push(
        `- 🔄 **${ev.itemName}**（${CATEGORY_LABEL[ev.category] ?? ev.category}）  \n  [→ ${ev.url}](${ev.url})`
      );
    }
    md.push("");
  }

  if (failures.length > 0) {
    md.push("### 抓取失败");
    md.push("");
    for (const f of failures) {
      md.push(`- ⚠ ${f.id}: ${f.reason}（${f.url}）`);
    }
  }

  // 简单 markdown → html，够邮件用
  const html = md
    .join("\n")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^> (.*)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^- (.*)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]+?<\/li>)/g, "<ul>$1</ul>")
    .replace(/<\/ul>\s*<ul>/g, "")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\n\n/g, "<br>")
    .replace(/  \n/g, "<br>");

  return { title, markdown: md.join("\n"), html };
}

/* --------------------------- 推送通道 --------------------------- */

interface PushResult {
  channel: string;
  ok: boolean;
  detail: string;
}

async function pushServerChan(
  env: MonitorEnv,
  msg: BuiltMessage
): Promise<PushResult | null> {
  if (!env.SERVERCHAN_KEY) return null;
  try {
    const url = `https://sctapi.ftqq.com/${env.SERVERCHAN_KEY}.send`;
    const body = new URLSearchParams({
      title: msg.title,
      desp: msg.markdown,
    });
    const r = await fetch(url, { method: "POST", body });
    const j = (await r.json().catch(() => ({}))) as { code?: number; message?: string };
    return {
      channel: "ServerChan",
      ok: r.ok && j.code === 0,
      detail: `HTTP ${r.status} · ${j.message ?? ""}`,
    };
  } catch (e) {
    return {
      channel: "ServerChan",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

async function pushPushPlus(
  env: MonitorEnv,
  msg: BuiltMessage
): Promise<PushResult | null> {
  if (!env.PUSHPLUS_TOKEN) return null;
  try {
    const r = await fetch("https://www.pushplus.plus/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: env.PUSHPLUS_TOKEN,
        title: msg.title,
        content: msg.markdown,
        template: "markdown",
      }),
    });
    const j = (await r.json().catch(() => ({}))) as { code?: number; msg?: string };
    return {
      channel: "PushPlus",
      ok: r.ok && j.code === 200,
      detail: `HTTP ${r.status} · ${j.msg ?? ""}`,
    };
  } catch (e) {
    return {
      channel: "PushPlus",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

async function pushResend(
  env: MonitorEnv,
  msg: BuiltMessage
): Promise<PushResult | null> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM || !env.RESEND_TO) return null;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: env.RESEND_FROM,
        to: env.RESEND_TO.split(",").map((s) => s.trim()),
        subject: msg.title,
        html: msg.html,
      }),
    });
    const j = (await r.json().catch(() => ({}))) as { id?: string; message?: string };
    return {
      channel: "Resend",
      ok: r.ok && !!j.id,
      detail: `HTTP ${r.status} · ${j.id ?? j.message ?? ""}`,
    };
  } catch (e) {
    return {
      channel: "Resend",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

/* --------------------------- 主流程 --------------------------- */

export interface RunReport {
  ranAt: string;
  itemCount: number;
  phaseEvents: PhaseEvent[];
  changes: ChangeEvent[];
  failures: { id: string; url: string; reason: string }[];
  push: PushResult[];
  dryRun: boolean;
}

export async function runMonitor(env: MonitorEnv, opts: { dryRun?: boolean } = {}): Promise<RunReport> {
  const today = new Date();
  const ranAt = today.toISOString();

  const timelineUrl =
    env.TIMELINE_JSON_URL ?? "https://shaun-research.pages.dev/timeline.json";
  const dataResp = await fetch(timelineUrl, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!dataResp.ok) {
    throw new Error(`failed to fetch timeline.json: HTTP ${dataResp.status}`);
  }
  const data = (await dataResp.json()) as { items: TimelineItem[] };
  const items = data.items ?? [];

  const phaseEvents = findPhaseEvents(items, 7, today);

  // 并行抓取（限并发，避免一次开 34 个连接）
  const concurrency = 6;
  const results: FetchResult[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      const item = items[i];
      if (!item.monitorUrl && !item.url) continue;
      const r = await fetchAndHash(item, env);
      results.push(r);
      // 不在 dryRun 时才回写 KV
      if (!opts.dryRun) await persistResult(item, r, env);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  const changes: ChangeEvent[] = [];
  const failures: { id: string; url: string; reason: string }[] = [];
  for (const r of results) {
    const item = items.find((it) => it.id === r.id);
    if (!item) continue;
    if (r.changed) {
      changes.push({ itemName: item.shortName ?? item.name, category: item.category, url: r.url });
    }
    if (!r.ok) {
      failures.push({ id: r.id, url: r.url, reason: r.errorMsg ?? "unknown" });
    }
  }

  const msg = buildMessage(phaseEvents, changes, failures, today);

  // 没有任何更新就不推（避免每天空消息打扰），但仍记录 lastrun
  const totalAlerts = phaseEvents.length + changes.length;
  const pushResults: PushResult[] = [];
  if (!opts.dryRun && totalAlerts > 0) {
    const promises = [
      pushServerChan(env, msg),
      pushPushPlus(env, msg),
      pushResend(env, msg),
    ];
    for (const p of await Promise.all(promises)) {
      if (p) pushResults.push(p);
    }
  }

  if (!opts.dryRun) {
    await env.COMMENTS.put("monitor:lastrun", ranAt);
  }

  return {
    ranAt,
    itemCount: items.length,
    phaseEvents,
    changes,
    failures,
    push: pushResults,
    dryRun: !!opts.dryRun,
  };
}

/* --------------------------- HTTP 入口（手动触发） --------------------------- */

export async function handleAdminRunMonitor(
  req: Request,
  env: MonitorEnv,
  corsHeaders: HeadersInit
): Promise<Response> {
  if (!env.ADMIN_TOKEN) {
    return new Response("admin token not configured", { status: 503, headers: corsHeaders });
  }
  const url = new URL(req.url);
  const tok = url.searchParams.get("token") ?? req.headers.get("X-Admin-Token") ?? "";
  if (tok !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401, headers: corsHeaders });
  }
  const dry = url.searchParams.get("dry") === "1";
  try {
    const report = await runMonitor(env, { dryRun: dry });
    return new Response(JSON.stringify(report, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }
}
