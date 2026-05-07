import { useEffect, useMemo, useState } from "react";
import { gradientFor, initialFor, type Identity } from "../lib/identity";

interface PublicComment {
  id: string;
  path: string;
  name: string;
  role?: string;
  body: string;
  seed: number;
  createdAt: number;
}

interface Props {
  /** Worker API base URL，如 https://research-lab-comments.xxx.workers.dev */
  apiUrl: string;
  /** 评论页路径标识 */
  path: string;
  /** 当前用户身份（来自 localStorage） */
  identity: Identity | null;
  /** 没身份时的引导回调 */
  onRequestIdentity?: () => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} 天前`;
  return new Date(ts).toLocaleDateString("zh-CN");
}

export default function WorkerComments({ apiUrl, path, identity, onRequestIdentity }: Props) {
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const url = apiUrl.replace(/\/$/, "");

  async function load() {
    try {
      const res = await fetch(`${url}/comments?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as PublicComment[];
      setComments(data.sort((a, b) => b.createdAt - a.createdAt));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl, path]);

  async function submit() {
    if (!identity) {
      onRequestIdentity?.();
      return;
    }
    if (!body.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${url}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path,
          name: identity.name,
          role: identity.role,
          email: identity.email,
          body: body.trim(),
        }),
      });
      if (res.status === 429) throw new Error("发评论太频繁，稍后再试");
      if (res.status === 400) {
        const t = await res.text();
        throw new Error(`输入有误：${t}`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const newComment = (await res.json()) as PublicComment;
      setComments((prev) => [newComment, ...prev]);
      setBody("");
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 发表区 */}
      <div className="glass p-4">
        {identity ? (
          <CommentForm
            identity={identity}
            body={body}
            setBody={setBody}
            submitting={submitting}
            error={submitError}
            onSubmit={submit}
          />
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-text-secondary mb-3">
              发表评论前，请先设置一个身份（昵称即可）
            </p>
            <button
              onClick={onRequestIdentity}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-accent to-purple-accent text-bg-base font-semibold text-sm hover:shadow-[0_0_24px_-4px_rgba(34,211,238,0.6)] transition-all"
            >
              设置我的身份
            </button>
          </div>
        )}
      </div>

      {/* 列表 */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-sm font-semibold text-text-primary">
            {loading && comments.length === 0
              ? "正在加载评论..."
              : `共 ${comments.length} 条评论`}
          </h3>
          <button
            onClick={load}
            className="text-xs text-text-muted hover:text-cyan-accent transition-colors flex items-center gap-1"
            title="刷新"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新
          </button>
        </div>

        {error && comments.length === 0 ? (
          <div className="glass p-6 text-center">
            <div className="text-rose-accent text-sm mb-1">⚠ 加载失败</div>
            <div className="text-xs text-text-muted">{error}</div>
            <button onClick={load} className="mt-3 text-xs text-cyan-accent hover:underline">
              重试
            </button>
          </div>
        ) : comments.length === 0 && !loading ? (
          <div className="glass p-8 text-center">
            <div className="text-3xl mb-2 opacity-50">💭</div>
            <div className="text-sm text-text-secondary">暂无评论 · 来当第一个吧</div>
          </div>
        ) : (
          <div className="space-y-2">
            {comments.map((c) => (
              <CommentItem key={c.id} comment={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CommentForm({
  identity,
  body,
  setBody,
  submitting,
  error,
  onSubmit,
}: {
  identity: Identity;
  body: string;
  setBody: (v: string) => void;
  submitting: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  const [g1, g2] = gradientFor(identity.seed);
  const remaining = 2000 - body.length;
  return (
    <div>
      <div className="flex items-start gap-3">
        <span
          className="w-9 h-9 rounded-full flex items-center justify-center text-bg-base font-mono text-sm font-bold shrink-0"
          style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}
        >
          {initialFor(identity.name)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 text-xs">
            <span className="text-text-primary font-semibold">{identity.name}</span>
            {identity.role && (
              <span className="text-cyan-accent text-[10px] px-1.5 py-0.5 rounded border border-cyan-accent/30 bg-cyan-accent/5">
                {identity.role}
              </span>
            )}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="说点什么..."
            rows={3}
            maxLength={2000}
            className="w-full px-3 py-2 rounded-md bg-bg-card border border-border-default focus:border-cyan-accent outline-none text-text-primary text-sm placeholder:text-text-muted transition-colors resize-y"
          />
          <div className="flex items-center justify-between mt-2">
            <span
              className={`text-[10px] font-mono ${
                remaining < 50 ? "text-rose-accent" : "text-text-muted"
              }`}
            >
              {remaining} 字
            </span>
            <button
              onClick={onSubmit}
              disabled={submitting || !body.trim()}
              className="px-4 py-1.5 rounded-md bg-gradient-to-r from-cyan-accent to-purple-accent text-bg-base font-semibold text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_16px_-4px_rgba(34,211,238,0.6)] transition-all"
            >
              {submitting ? "发布中..." : "发布"}
            </button>
          </div>
          {error && (
            <div className="mt-2 text-xs text-rose-accent bg-rose-accent/5 border border-rose-accent/20 rounded px-2 py-1.5">
              ⚠ {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CommentItem({ comment }: { comment: PublicComment }) {
  const [g1, g2] = gradientFor(comment.seed);
  return (
    <div className="glass p-4 flex items-start gap-3">
      <span
        className="w-9 h-9 rounded-full flex items-center justify-center text-bg-base font-mono text-sm font-bold shrink-0"
        style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}
      >
        {initialFor(comment.name)}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-text-primary text-sm font-semibold">{comment.name}</span>
          {comment.role && (
            <span className="text-cyan-accent text-[10px] px-1.5 py-0.5 rounded border border-cyan-accent/30 bg-cyan-accent/5">
              {comment.role}
            </span>
          )}
          <span className="text-[10px] text-text-muted font-mono ml-auto">
            {timeAgo(comment.createdAt)}
          </span>
        </div>
        <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap break-words">
          {comment.body}
        </p>
      </div>
    </div>
  );
}
