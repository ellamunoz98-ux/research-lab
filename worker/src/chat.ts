/**
 * Research.Lab AI 助手后端
 *
 * /chat                    POST { question, history? }  → SSE 流式回答（含来源 chip）
 * /admin/chat-index        POST { chunks: [...] }       → 嵌入并写入 Vectorize（仅站长）
 * /admin/chat-index/clear  POST { ids: [...] }          → 按 ID 删除向量（仅站长）
 *
 * 检索：bge-m3（Workers AI，多语言、中文友好、免费）→ 1024 维
 * 生成：DeepSeek API（OpenAI 兼容，stream=true）
 */

interface ChatEnv {
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  DEEPSEEK_API_KEY?: string;
  ADMIN_TOKEN?: string;
}

interface ChunkInput {
  id: string;
  slug: string;
  title: string;
  heading: string;
  anchor: string;
  text: string;
}

const SYSTEM_PROMPT = `你是 Research.Lab 的研究助手。基于检索到的报告片段回答用户问题。

规则：
1. 只用提供的「报告片段」作为依据，不要凭空发挥。如果片段里没有答案，明确说「报告库里暂时没找到」，不要编造。
2. 回答时在每个引用句末用 [来源 N] 标注（N 是片段编号 1-6，可多个）。
3. 中文回答，简洁直接，能一段说完就不分段。
4. 如果用户问的是与投资研究无关的话题（闲聊、写代码等），礼貌回复你只回答 Research.Lab 报告库相关问题。
`;

const MAX_QUESTION_LEN = 500;
const TOP_K = 6;

function jsonResp(data: unknown, headers: HeadersInit, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function textResp(body: string, headers: HeadersInit, status = 200): Response {
  return new Response(body, { status, headers: { ...headers, "Content-Type": "text/plain" } });
}

async function embed(env: ChatEnv, texts: string[]): Promise<number[][]> {
  const out = (await env.AI.run("@cf/baai/bge-m3" as any, { text: texts })) as unknown as {
    data: number[][];
  };
  return out.data;
}

/* ============================ /chat ============================ */

export async function handleChat(
  req: Request,
  env: ChatEnv,
  baseHeaders: HeadersInit
): Promise<Response> {
  if (req.method !== "POST") return textResp("method not allowed", baseHeaders, 405);
  if (!env.DEEPSEEK_API_KEY) return textResp("chat not configured", baseHeaders, 503);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return textResp("invalid json", baseHeaders, 400);
  }

  const question = String(body.question ?? "").trim();
  if (!question) return textResp("missing question", baseHeaders, 400);
  if (question.length > MAX_QUESTION_LEN) return textResp("question too long", baseHeaders, 400);

  const history = Array.isArray(body.history)
    ? body.history
        .filter(
          (m: any) =>
            m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant")
        )
        .slice(-4)
    : [];

  // 1. 嵌入问题
  let queryVec: number[];
  try {
    const vecs = await embed(env, [question]);
    queryVec = vecs[0];
  } catch (e) {
    return jsonResp(
      { error: "embed failed", detail: e instanceof Error ? e.message : String(e) },
      baseHeaders,
      502
    );
  }

  // 2. 检索 Vectorize
  let matches: VectorizeMatch[] = [];
  try {
    const result = await env.VECTORIZE.query(queryVec, { topK: TOP_K, returnMetadata: "all" });
    matches = result.matches ?? [];
  } catch (e) {
    return jsonResp(
      { error: "vectorize failed", detail: e instanceof Error ? e.message : String(e) },
      baseHeaders,
      502
    );
  }

  const sources = matches.map((m, i) => {
    const md = (m.metadata ?? {}) as Record<string, string>;
    return {
      n: i + 1,
      slug: md.slug ?? "",
      title: md.title ?? "",
      heading: md.heading ?? "",
      anchor: md.anchor ?? "",
      text: md.text ?? "",
      score: m.score,
    };
  });

  if (sources.length === 0) {
    // 报告库里没匹配 → 直接告知，不调 LLM 省钱
    const stream = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        controller.enqueue(enc.encode(`event: sources\ndata: []\n\n`));
        controller.enqueue(
          enc.encode(
            `event: delta\ndata: ${JSON.stringify({
              text: "报告库里暂时没找到相关内容。可以试试换一种问法，或者具体提到某个行业/公司名。",
            })}\n\n`
          )
        );
        controller.enqueue(enc.encode(`event: done\ndata: [DONE]\n\n`));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { ...baseHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  // 3. 组装 prompt
  const contextBlock = sources
    .map(
      (s) =>
        `[来源 ${s.n}] 出自《${s.title}》${s.heading ? "·" + s.heading : ""}\n${s.text}`
    )
    .join("\n\n---\n\n");

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    {
      role: "user",
      content: `以下是从 Research.Lab 报告库检索到的相关片段：\n\n${contextBlock}\n\n---\n\n用户问题：${question}`,
    },
  ];

  // 4. 调 DeepSeek（流式）
  const dsResp = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      stream: true,
      temperature: 0.3,
      max_tokens: 1500,
    }),
  });

  if (!dsResp.ok || !dsResp.body) {
    const errBody = await dsResp.text().catch(() => "");
    return jsonResp(
      { error: "deepseek failed", status: dsResp.status, detail: errBody.slice(0, 300) },
      baseHeaders,
      502
    );
  }

  // 5. SSE 转发：用 ReadableStream + start 模式（CF Workers 推荐写法，
  //    避免 TransformStream + 后台 IIFE 在某些情况下死锁）
  const sourceMeta = sources.map((s) => ({
    n: s.n,
    slug: s.slug,
    title: s.title,
    heading: s.heading,
    anchor: s.anchor,
    score: s.score,
  }));

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();

      // 先发 sources 事件
      controller.enqueue(
        enc.encode(`event: sources\ndata: ${JSON.stringify(sourceMeta)}\n\n`)
      );

      const reader = dsResp.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const raw of lines) {
            const line = raw.trim();
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data) continue;
            if (data === "[DONE]") {
              controller.enqueue(enc.encode(`event: done\ndata: [DONE]\n\n`));
              continue;
            }
            try {
              const j = JSON.parse(data);
              const delta = j.choices?.[0]?.delta?.content;
              if (delta) {
                controller.enqueue(
                  enc.encode(
                    `event: delta\ndata: ${JSON.stringify({ text: delta })}\n\n`
                  )
                );
              }
            } catch {
              // 忽略解析失败的中间帧
            }
          }
        }
      } catch (e) {
        controller.enqueue(
          enc.encode(
            `event: error\ndata: ${JSON.stringify({
              message: e instanceof Error ? e.message : String(e),
            })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...baseHeaders,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}

/* ===================== /admin/chat-index ===================== */

function checkAdmin(req: Request, env: ChatEnv): boolean {
  if (!env.ADMIN_TOKEN) return false;
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? req.headers.get("X-Admin-Token") ?? "";
  return token === env.ADMIN_TOKEN;
}

export async function handleChatIndexUpsert(
  req: Request,
  env: ChatEnv,
  baseHeaders: HeadersInit
): Promise<Response> {
  if (req.method !== "POST") return textResp("method not allowed", baseHeaders, 405);
  if (!checkAdmin(req, env)) return textResp("unauthorized", baseHeaders, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return textResp("invalid json", baseHeaders, 400);
  }

  const chunks = body.chunks as ChunkInput[];
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return textResp("chunks array required", baseHeaders, 400);
  }
  if (chunks.length > 50) return textResp("max 50 chunks per request", baseHeaders, 400);

  for (const c of chunks) {
    if (!c.id || !c.text) return textResp("chunk needs id and text", baseHeaders, 400);
  }

  const texts = chunks.map((c) => c.text);
  const vectors = await embed(env, texts);

  const records = chunks.map((c, i) => ({
    id: c.id,
    values: vectors[i],
    metadata: {
      slug: c.slug,
      title: c.title,
      heading: c.heading,
      anchor: c.anchor,
      text: c.text.slice(0, 4000),
    },
  }));

  await env.VECTORIZE.upsert(records as any);
  return jsonResp({ ok: true, upserted: records.length }, baseHeaders);
}

export async function handleChatIndexClear(
  req: Request,
  env: ChatEnv,
  baseHeaders: HeadersInit
): Promise<Response> {
  if (req.method !== "POST") return textResp("method not allowed", baseHeaders, 405);
  if (!checkAdmin(req, env)) return textResp("unauthorized", baseHeaders, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return textResp("invalid json", baseHeaders, 400);
  }

  const ids = body.ids as string[];
  if (!Array.isArray(ids) || ids.length === 0) return textResp("ids required", baseHeaders, 400);
  if (ids.length > 1000) return textResp("max 1000 ids per request", baseHeaders, 400);

  await env.VECTORIZE.deleteByIds(ids);
  return jsonResp({ ok: true, deleted: ids.length }, baseHeaders);
}
