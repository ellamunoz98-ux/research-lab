import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  loadIdentity,
  saveIdentity,
  clearIdentity,
  gradientFor,
  initialFor,
  type Identity,
  type IdentityRole,
} from "../lib/identity";

const ROLES: IdentityRole[] = ["学生", "研究员", "投资者", "从业者", "路过"];

export default function IdentityWidget() {
  const [mounted, setMounted] = useState(false);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [open, setOpen] = useState(false); // 编辑模态
  const [showOnboarding, setShowOnboarding] = useState(false);

  // 表单 state
  const [name, setName] = useState("");
  const [role, setRole] = useState<IdentityRole | "">("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    setMounted(true);
    const existing = loadIdentity();
    setIdentity(existing);
    if (!existing) {
      // 首次访问，等 0.8 秒再弹（避开 hero 入场动画）
      const t = setTimeout(() => setShowOnboarding(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  // 监听其他组件触发的 identity 更新
  useEffect(() => {
    const handler = (e: Event) => {
      setIdentity((e as CustomEvent).detail ?? null);
    };
    window.addEventListener("identity:updated", handler);
    return () => window.removeEventListener("identity:updated", handler);
  }, []);

  // 监听其他组件触发的"打开编辑器"事件（如评论区的"设置身份"按钮）
  useEffect(() => {
    const handler = () => startEdit();
    window.addEventListener("identity:open-editor", handler);
    return () => window.removeEventListener("identity:open-editor", handler);
    // startEdit 引用 identity，但为简单起见每次响应都重新读取 identity 是 OK 的
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);

  if (!mounted) return null;

  const startEdit = () => {
    if (identity) {
      setName(identity.name);
      setRole(identity.role ?? "");
      setEmail(identity.email ?? "");
      setBio(identity.bio ?? "");
    } else {
      setName("");
      setRole("");
      setEmail("");
      setBio("");
    }
    setOpen(true);
    setShowOnboarding(false);
  };

  const submit = () => {
    if (!name.trim()) return;
    const saved = saveIdentity({
      name: name.trim(),
      role: role || undefined,
      email: email.trim() || undefined,
      bio: bio.trim() || undefined,
    });
    setIdentity(saved);
    setOpen(false);
    setShowOnboarding(false);
  };

  const handleClear = () => {
    if (!confirm("确定要清空当前身份吗？以后可以再设置。")) return;
    clearIdentity();
    setIdentity(null);
    setOpen(false);
  };

  const [g1, g2] = identity ? gradientFor(identity.seed) : ["#22d3ee", "#a78bfa"];

  return (
    <>
      {/* 头部小徽章 */}
      <button
        onClick={startEdit}
        className="group flex items-center gap-2 px-2.5 py-1.5 rounded-full border border-border-default hover:border-cyan-accent transition-all bg-bg-card/40"
        title={identity ? `${identity.name}${identity.role ? ` · ${identity.role}` : ""}` : "设置身份"}
      >
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-bg-base font-mono text-xs font-bold shrink-0"
          style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}
        >
          {identity ? initialFor(identity.name) : "?"}
        </span>
        <span className="text-xs text-text-secondary group-hover:text-cyan-accent max-w-[120px] truncate">
          {identity ? identity.name : "设置身份"}
        </span>
      </button>

      {/* 首次访问引导 + 编辑模态：用 Portal 渲染到 document.body，
          避免被 header 的 backdrop-blur 创建的 containing block 影响 */}
      {showOnboarding && !identity &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center px-4 backdrop-blur-md bg-bg-base/60 animate-[fadeIn_0.3s_ease-out]"
            onClick={() => setShowOnboarding(false)}
          >
            <div
              className="glass max-w-md w-full p-8 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-cyan-accent text-xs tracking-[0.3em] font-mono mb-3">WELCOME</div>
              <h2 className="text-2xl font-bold text-text-primary mb-3 leading-tight">
                欢迎来到 <span className="gradient-text">Research.Lab</span>
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed mb-6">
                先告诉我你是谁吧——这样在评论时就能用你的身份留言。
                <br />
                <span className="text-text-muted text-xs">所有信息只存在你的浏览器本地，不会上传服务器。</span>
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={startEdit}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-accent to-purple-accent text-bg-base font-semibold text-sm hover:shadow-[0_0_24px_-4px_rgba(34,211,238,0.6)] transition-all"
                >
                  好，我来填
                </button>
                <button
                  type="button"
                  onClick={() => setShowOnboarding(false)}
                  className="px-4 py-2.5 rounded-lg border border-border-default text-text-secondary hover:border-cyan-accent hover:text-cyan-accent text-sm transition-all"
                >
                  先逛逛
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 编辑模态（同样 portal 到 body） */}
      {open && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4 backdrop-blur-md bg-bg-base/70 animate-[fadeIn_0.2s_ease-out]"
          onClick={() => setOpen(false)}
        >
          <div
            className="glass max-w-md w-full p-7 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full hover:bg-bg-card/60 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
              aria-label="关闭"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-5">
              <span
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-bg-base font-mono text-lg font-bold shrink-0"
                style={{
                  background: name ? `linear-gradient(135deg, ${g1}, ${g2})` : `linear-gradient(135deg, #475569, #334155)`,
                }}
              >
                {name ? initialFor(name) : "?"}
              </span>
              <div>
                <div className="text-text-primary font-semibold">{identity ? "编辑身份" : "设置你的身份"}</div>
                <div className="text-xs text-text-muted">仅保存在你浏览器本地</div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-text-secondary mb-1.5 font-mono">名字 / 昵称<span className="text-rose-accent ml-1">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="如：Shaun"
                  maxLength={20}
                  autoFocus
                  className="w-full px-3 py-2 rounded-md bg-bg-card border border-border-default focus:border-cyan-accent outline-none text-text-primary text-sm placeholder:text-text-muted transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1.5 font-mono">身份</label>
                <div className="flex flex-wrap gap-1.5">
                  {ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(role === r ? "" : r)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                        role === r
                          ? "border-cyan-accent bg-cyan-accent/10 text-cyan-accent"
                          : "border-border-default text-text-secondary hover:border-cyan-accent/50"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1.5 font-mono">邮箱（可选，用于评论通知）</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-3 py-2 rounded-md bg-bg-card border border-border-default focus:border-cyan-accent outline-none text-text-primary text-sm placeholder:text-text-muted transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1.5 font-mono">一句话简介（可选）</label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="如：清华经管学生 / 量化研究爱好者"
                  maxLength={60}
                  className="w-full px-3 py-2 rounded-md bg-bg-card border border-border-default focus:border-cyan-accent outline-none text-text-primary text-sm placeholder:text-text-muted transition-colors"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={submit}
                disabled={!name.trim()}
                className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-accent to-purple-accent text-bg-base font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_24px_-4px_rgba(34,211,238,0.6)] transition-all"
              >
                {identity ? "保存修改" : "完成"}
              </button>
              {identity && (
                <button
                  onClick={handleClear}
                  className="px-3 py-2.5 rounded-lg border border-rose-accent/30 text-rose-accent hover:bg-rose-accent/10 text-xs transition-all"
                >
                  清空
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}
