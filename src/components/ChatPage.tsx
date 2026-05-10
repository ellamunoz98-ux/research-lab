import { useEffect, useMemo, useRef, useState } from "react";

interface Source {
  n: number;
  slug: string;
  title: string;
  heading: string;
  anchor: string;
  score: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  pending?: boolean;
  errored?: boolean;
}

interface Props {
  apiUrl: string;
}

const SUGGESTED = [
  {
    title: "PCB 行业的核心增长引擎",
    sub: "AI 数据中心 / 汽车智驾 / 机器人 哪条最稳？",
    q: "PCB 行业未来 5 年的核心增长引擎是什么？",
  },
  {
    title: "SK 海力士 vs 三星 HBM",
    sub: "为什么 SK 海力士 2025 反超三星？",
    q: "SK 海力士在 HBM 上是怎么超过三星的？",
  },
  {
    title: "猪周期当前位置",
    sub: "猪粮比、能繁存栏、反转窗口",
    q: "目前猪周期处在历史什么位置？什么时候反转？",
  },
  {
    title: "AIDC 估值最被低估的标的",
    sub: "五维度评分 + 估值修复空间",
    q: "AIDC 被动元件里估值上行空间最大的几个标的是哪些？",
  },
  {
    title: "AMD vs Nvidia AI 算力",
    sub: "短中长期格局判断",
    q: "AMD 在 AI 算力上能追上 Nvidia 吗？",
  },
  {
    title: "CoWoS 封装瓶颈",
    sub: "产能、价值链、A 股受益标的",
    q: "CoWoS 现在的产能瓶颈在哪？A 股有哪些真受益的标的？",
  },
];

function urlForSource(s: Source): string {
  const path = `/reports/${s.slug}`;
  return s.anchor ? `${path}#${s.anchor}` : path;
}

export default function ChatPage({ apiUrl }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const url = useMemo(() => apiUrl.replace(/\/$/, ""), [apiUrl]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;

    setInput("");
    setBusy(true);

    const history = messages
      .filter((m) => !m.pending && !m.errored)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [
      ...prev,
      { role: "user", content: q },
      { role: "assistant", content: "", pending: true },
    ]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const resp = await fetch(`${url}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history }),
        signal: ctrl.signal,
      });

      if (!resp.ok || !resp.body) {
        const errText = await resp.text().catch(() => `HTTP ${resp.status}`);
        throw new Error(errText.slice(0, 200));
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let sep;
        while ((sep = buf.indexOf("\n\n")) !== -1) {
          const block = buf.slice(0, sep);
          buf = buf.slice(sep + 2);

          let event = "delta";
          let data = "";
          for (const line of block.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data = line.slice(5).trim();
          }

          if (event === "sources" && data) {
            try {
              const sources: Source[] = JSON.parse(data);
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === "assistant") {
                  next[next.length - 1] = { ...last, sources };
                }
                return next;
              });
            } catch {}
          } else if (event === "delta" && data) {
            try {
              const { text } = JSON.parse(data);
              if (text) {
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last && last.role === "assistant") {
                    next[next.length - 1] = {
                      ...last,
                      content: last.content + text,
                      pending: false,
                    };
                  }
                  return next;
                });
              }
            } catch {}
          }
        }
      }

      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant" && last.pending) {
          next[next.length - 1] = { ...last, pending: false };
        }
        return next;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") {
          next[next.length - 1] = {
            role: "assistant",
            content: `抱歉，出错了：${msg}`,
            errored: true,
          };
        }
        return next;
      });
    } finally {
      setBusy(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function reset() {
    if (busy) return;
    setMessages([]);
    inputRef.current?.focus();
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* 消息滚动区 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-10">
          {empty ? (
            <div className="space-y-10">
              <div className="text-center">
                <div className="text-xs text-cyan-accent tracking-[0.3em] font-mono mb-4">
                  AI · RESEARCH ASSISTANT
                </div>
                <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-3 text-text-primary">
                  问任何关于 <span className="gradient-text">Research.Lab</span>
                </h1>
                <p className="text-text-secondary">
                  我会去报告库里检索答案，并附上来源直链。基于 DeepSeek + Cloudflare Vectorize。
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {SUGGESTED.map((s) => (
                  <button
                    key={s.q}
                    onClick={() => send(s.q)}
                    className="group text-left rounded-xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-cyan-400/40 hover:bg-cyan-400/5"
                  >
                    <div className="text-sm font-medium text-text-primary group-hover:text-cyan-accent transition-colors">
                      {s.title}
                    </div>
                    <div className="text-xs text-text-secondary mt-1">{s.sub}</div>
                  </button>
                ))}
              </div>

              <div className="text-center text-xs text-text-secondary/60">
                覆盖：PCB / AIDC 被动元件 / 生猪周期 / 半导体产业链 — 共 112 个语义片段
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={
                      m.role === "user"
                        ? "max-w-[80%] rounded-2xl rounded-br-sm bg-cyan-500/90 px-4 py-3 text-white"
                        : "max-w-[90%] space-y-3 rounded-2xl rounded-bl-sm bg-white/5 border border-white/10 px-5 py-4 text-text-primary"
                    }
                  >
                    {m.pending && !m.content ? (
                      <div className="flex items-center gap-1.5 py-1">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
                        <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400 [animation-delay:120ms]" />
                        <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400 [animation-delay:240ms]" />
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap leading-relaxed text-[15px]">
                        {m.content}
                      </div>
                    )}
                    {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/5">
                        {m.sources.map((s) => (
                          <a
                            key={s.n}
                            href={urlForSource(s)}
                            target="_blank"
                            rel="noopener"
                            className="inline-flex items-center gap-1.5 rounded-md border border-cyan-400/30 bg-cyan-400/5 px-2 py-1 text-xs text-cyan-300 transition hover:border-cyan-400/60 hover:bg-cyan-400/10"
                            title={`${s.title}${s.heading ? " · " + s.heading : ""}`}
                          >
                            <span className="font-medium">[{s.n}]</span>
                            <span className="max-w-[280px] truncate">
                              {s.heading || s.title}
                            </span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 输入区固定底部 */}
      <div className="border-t border-white/10 bg-bg-base/80 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder={
                empty ? "问点关于报告库的事…（Shift+Enter 换行）" : "继续追问…"
              }
              disabled={busy}
              className="flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[15px] text-white placeholder-zinc-500 outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 disabled:opacity-50"
              style={{ maxHeight: "200px", minHeight: "48px" }}
            />
            {busy ? (
              <button
                onClick={stop}
                className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 hover:bg-rose-500/20"
              >
                停止
              </button>
            ) : (
              <button
                onClick={() => send(input)}
                disabled={!input.trim()}
                className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                发送
              </button>
            )}
            {messages.length > 0 && !busy && (
              <button
                onClick={reset}
                className="rounded-xl border border-white/10 px-3 py-3 text-sm text-text-secondary hover:border-white/20 hover:text-text-primary"
                title="清空对话"
              >
                清空
              </button>
            )}
          </div>
          <p className="mt-2 text-[11px] text-text-secondary/60 text-center">
            答案基于报告库 RAG 检索 + DeepSeek 生成；可能存在偏差，仅供研究参考。
          </p>
        </div>
      </div>
    </div>
  );
}
