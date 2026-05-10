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
  /** Worker base URL，例如 https://research-lab-comments.xxx.workers.dev */
  apiUrl: string;
}

const SUGGESTED_QUESTIONS = [
  "PCB 行业的核心增长引擎是什么？",
  "为什么 SK 海力士能在 HBM 上反超三星？",
  "猪粮比目前在历史什么分位？",
  "AIDC 被动元件估值最被低估的标的有哪些？",
];

function urlForSource(s: Source): string {
  const path = `/reports/${s.slug}`;
  return s.anchor ? `${path}#${s.anchor}` : path;
}

export default function ChatWidget({ apiUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const url = useMemo(() => apiUrl.replace(/\/$/, ""), [apiUrl]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  // 用户按 ESC 收起
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

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
            } catch {
              // ignore
            }
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
            } catch {
              // ignore
            }
          } else if (event === "done") {
            // fall through, will end on next iter
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
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function reset() {
    if (busy) return;
    setMessages([]);
  }

  return (
    <>
      {/* 浮动按钮 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "关闭 AI 助手" : "打开 AI 助手"}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-cyan-500/90 px-4 py-3 text-sm font-medium text-white shadow-[0_8px_30px_rgb(34,211,238,0.35)] transition hover:bg-cyan-400 hover:shadow-[0_8px_30px_rgb(34,211,238,0.5)]"
      >
        <span className="text-lg leading-none">{open ? "×" : "✦"}</span>
        <span className="hidden sm:inline">{open ? "收起" : "问 AI"}</span>
      </button>

      {/* 面板 */}
      {open && (
        <div
          role="dialog"
          aria-label="Research.Lab AI 助手"
          className="fixed bottom-24 right-6 z-40 flex h-[min(640px,calc(100vh-7rem))] w-[min(420px,calc(100vw-3rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur-xl"
        >
          {/* 头部 */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-white">Research.Lab 研究助手</div>
              <div className="text-xs text-zinc-400">基于报告库 · 答案附来源</div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && !busy && (
                <button
                  onClick={reset}
                  className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-white/5 hover:text-white"
                >
                  清空
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded px-2 py-1 text-zinc-400 hover:bg-white/5 hover:text-white"
                aria-label="关闭"
              >
                ×
              </button>
            </div>
          </div>

          {/* 消息区 */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 text-sm">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-zinc-300">
                  问任何关于 Research.Lab 报告库的问题，我会去检索并附上来源。
                </p>
                <div className="space-y-1.5">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs text-zinc-300 transition hover:border-cyan-400/50 hover:bg-cyan-400/5 hover:text-white"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                  >
                    <div
                      className={
                        m.role === "user"
                          ? "max-w-[85%] rounded-2xl rounded-br-sm bg-cyan-500/90 px-3.5 py-2 text-white"
                          : "max-w-[90%] space-y-2 rounded-2xl rounded-bl-sm bg-white/5 px-3.5 py-2 text-zinc-100"
                      }
                    >
                      {m.pending && !m.content ? (
                        <div className="flex items-center gap-1 py-1">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400 [animation-delay:120ms]" />
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400 [animation-delay:240ms]" />
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                      )}
                      {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {m.sources.map((s) => (
                            <a
                              key={s.n}
                              href={urlForSource(s)}
                              target="_blank"
                              rel="noopener"
                              className="inline-flex items-center gap-1 rounded-md border border-cyan-400/30 bg-cyan-400/5 px-1.5 py-0.5 text-[10px] text-cyan-300 transition hover:border-cyan-400/60 hover:bg-cyan-400/10"
                              title={`${s.title}${s.heading ? " · " + s.heading : ""}`}
                            >
                              <span className="font-medium">[{s.n}]</span>
                              <span className="max-w-[160px] truncate">
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

          {/* 输入区 */}
          <div className="border-t border-white/10 px-3 py-3">
            <div className="flex items-end gap-2">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="问点关于报告库的事…（Shift+Enter 换行）"
                disabled={busy}
                className="flex-1 resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 disabled:opacity-50"
                style={{ maxHeight: "140px" }}
              />
              {busy ? (
                <button
                  onClick={stop}
                  className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 hover:bg-rose-500/20"
                >
                  停止
                </button>
              ) : (
                <button
                  onClick={() => send(input)}
                  disabled={!input.trim()}
                  className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-medium text-white transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  发送
                </button>
              )}
            </div>
            <p className="mt-2 text-[10px] text-zinc-500">
              答案基于报告库 RAG 检索 + DeepSeek 生成；可能存在偏差，仅供研究参考。
            </p>
          </div>
        </div>
      )}
    </>
  );
}
