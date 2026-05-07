import { useEffect, useRef, useState } from "react";
import Giscus from "@giscus/react";
import { init } from "@waline/client";
import "@waline/client/waline.css";
import {
  loadIdentity,
  gradientFor,
  initialFor,
  type Identity,
} from "../lib/identity";
import WorkerComments from "./WorkerComments";

interface Props {
  /** 评论页路径标识，默认使用当前 path */
  path?: string;
  /** 自建 Worker API（最高优先级） */
  apiUrl?: string;
  /** Waline 服务端地址 */
  serverURL?: string;
  /** Giscus 配置 */
  giscus?: {
    repo: `${string}/${string}`;
    repoId: string;
    category: string;
    categoryId: string;
  };
}

export default function Comments({ path, apiUrl, serverURL, giscus }: Props) {
  const [identity, setIdentity] = useState<Identity | null>(null);

  useEffect(() => {
    setIdentity(loadIdentity());
    const handler = (e: Event) =>
      setIdentity((e as CustomEvent).detail ?? null);
    window.addEventListener("identity:updated", handler);
    return () => window.removeEventListener("identity:updated", handler);
  }, []);

  const requestIdentity = () => {
    // 触发 IdentityWidget 打开编辑模态：发个全局事件让它响应
    window.dispatchEvent(new CustomEvent("identity:open-editor"));
  };

  // 优先级：Worker > Giscus > Waline > Placeholder
  if (apiUrl) {
    return (
      <div className="glass my-8 p-2 md:p-4">
        <IdentityBar identity={identity} system="worker" />
        <div className="px-2 md:px-3 py-2">
          <WorkerComments
            apiUrl={apiUrl}
            path={path ?? (typeof location !== "undefined" ? location.pathname : "/")}
            identity={identity}
            onRequestIdentity={requestIdentity}
          />
        </div>
      </div>
    );
  }

  const useGiscus = !!(
    giscus?.repo &&
    giscus.repoId &&
    giscus.category &&
    giscus.categoryId
  );
  if (useGiscus) {
    return (
      <div className="glass my-8 p-2 md:p-4">
        <IdentityBar identity={identity} system="giscus" />
        <div className="px-2 md:px-3 py-2">
          <Giscus
            id="comments"
            repo={giscus!.repo}
            repoId={giscus!.repoId}
            category={giscus!.category}
            categoryId={giscus!.categoryId}
            mapping="pathname"
            term={path ?? undefined}
            strict="0"
            reactionsEnabled="1"
            emitMetadata="0"
            inputPosition="top"
            theme="dark_dimmed"
            lang="zh-CN"
            loading="lazy"
          />
        </div>
      </div>
    );
  }

  if (serverURL)
    return <WalineComments path={path} serverURL={serverURL} identity={identity} />;

  return <CommentsPlaceholder identity={identity} />;
}

function IdentityBar({
  identity,
  system,
}: {
  identity: Identity | null;
  system: "giscus" | "waline" | "worker";
}) {
  if (!identity) {
    return (
      <div className="px-3 py-2 mb-1 text-xs text-text-muted border-b border-border-subtle">
        💡 设置右上角身份信息后，留言会显示你的名字和身份
      </div>
    );
  }
  const [g1, g2] = gradientFor(identity.seed);
  const systemHint = {
    giscus: " · 留言需用 GitHub 账号登录（保护数据真实性）",
    waline: "",
    worker: " · 留言会即时显示给所有访客",
  }[system];
  return (
    <div className="px-3 py-2 mb-1 flex items-center gap-2 text-xs text-text-secondary border-b border-border-subtle">
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center text-bg-base font-mono text-[10px] font-bold shrink-0"
        style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}
      >
        {initialFor(identity.name)}
      </span>
      <span>
        欢迎，<span className="text-cyan-accent font-semibold">{identity.name}</span>
        {identity.role && <span className="text-text-muted"> · {identity.role}</span>}
        <span className="text-text-muted">{systemHint}</span>
      </span>
    </div>
  );
}

function WalineComments({
  path,
  serverURL,
  identity,
}: {
  path?: string;
  serverURL: string;
  identity: Identity | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    if (identity) {
      try {
        localStorage.setItem(
          "WALINE_USER_META",
          JSON.stringify({
            nick: identity.name,
            mail: identity.email ?? "",
            link: "",
          })
        );
      } catch {
        /* ignore */
      }
    }
    const inst = init({
      el: ref.current,
      serverURL,
      path: path ?? location.pathname,
      lang: "zh-CN",
      dark: "html",
      reaction: true,
      pageview: true,
      search: false,
      emoji: ["https://unpkg.com/@waline/emojis@1.2.0/weibo"],
      requiredMeta: ["nick"],
      wordLimit: [0, 800],
    });
    return () => inst?.destroy();
  }, [path, serverURL, identity]);

  return (
    <div className="glass my-8 p-2 md:p-4">
      <IdentityBar identity={identity} system="waline" />
      <div ref={ref} />
    </div>
  );
}

function CommentsPlaceholder({ identity }: { identity: Identity | null }) {
  return (
    <div className="glass my-8 p-8">
      <div className="text-center mb-6">
        <div className="text-3xl mb-2">💬</div>
        <div className="text-text-primary font-semibold text-lg">评论系统待配置</div>
        {identity && (
          <p className="text-xs text-text-muted mt-2">
            已识别身份：
            <span className="text-cyan-accent font-semibold mx-1">{identity.name}</span>
            {identity.role && <span>· {identity.role}</span>}
          </p>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-3 max-w-3xl mx-auto">
        <div className="rounded-lg border border-cyan-accent/30 bg-cyan-accent/5 p-4">
          <div className="text-cyan-accent font-semibold text-sm mb-2 flex items-center gap-1.5">
            <span>⭐</span> 自建 Worker
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            Cloudflare Workers + KV，免费匿名评论。私有仓库适用。
          </p>
          <div className="mt-2 text-[10px] text-text-muted">10 分钟设置 · 见 worker/README.md</div>
        </div>
        <div className="rounded-lg border border-border-default p-4">
          <div className="text-text-primary font-semibold text-sm mb-2 flex items-center gap-1.5">
            <span>🐙</span> Giscus
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            基于 GitHub Discussions，需公开仓库 + GitHub 账号。
          </p>
          <div className="mt-2 text-[10px] text-text-muted">5 分钟设置</div>
        </div>
        <div className="rounded-lg border border-border-default p-4">
          <div className="text-text-primary font-semibold text-sm mb-2 flex items-center gap-1.5">
            <span>🔧</span> Waline
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            Vercel + LeanCloud 部署，支持完全匿名留言。
          </p>
          <div className="mt-2 text-[10px] text-text-muted">15 分钟设置</div>
        </div>
      </div>
    </div>
  );
}
