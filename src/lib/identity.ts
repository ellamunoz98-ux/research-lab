/**
 * 身份系统：存在 localStorage 里，纯前端，没有后端鉴权。
 * 用于评论预填、欢迎语、个性化展示。
 */

export type IdentityRole = "学生" | "研究员" | "投资者" | "从业者" | "路过";

export interface Identity {
  name: string;
  role?: IdentityRole;
  email?: string;
  bio?: string;
  /** 头像渐变种子（基于名字哈希），用于一致颜色生成 */
  seed: number;
  createdAt: number;
}

const KEY = "researchLab:identity";

// 简单的字符串 hash → 整数 seed
function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const GRADIENTS: [string, string][] = [
  ["#22d3ee", "#a78bfa"], // cyan → purple
  ["#34d399", "#22d3ee"], // emerald → cyan
  ["#a78bfa", "#fb7185"], // purple → rose
  ["#fb7185", "#f59e0b"], // rose → amber
  ["#3b82f6", "#a78bfa"], // blue → purple
  ["#22d3ee", "#34d399"], // cyan → emerald
  ["#f59e0b", "#fb7185"], // amber → rose
  ["#34d399", "#3b82f6"], // emerald → blue
];

export function gradientFor(seed: number): [string, string] {
  return GRADIENTS[seed % GRADIENTS.length];
}

export function loadIdentity(): Identity | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.name) return null;
    return parsed as Identity;
  } catch {
    return null;
  }
}

export function saveIdentity(input: Omit<Identity, "seed" | "createdAt"> & Partial<Pick<Identity, "seed" | "createdAt">>) {
  if (typeof localStorage === "undefined") return null;
  const identity: Identity = {
    name: input.name.trim(),
    role: input.role,
    email: input.email?.trim() || undefined,
    bio: input.bio?.trim() || undefined,
    seed: input.seed ?? hashSeed(input.name + (input.email ?? "")),
    createdAt: input.createdAt ?? Date.now(),
  };
  localStorage.setItem(KEY, JSON.stringify(identity));
  // 广播给同页面其他组件
  window.dispatchEvent(new CustomEvent("identity:updated", { detail: identity }));
  return identity;
}

export function clearIdentity() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("identity:updated", { detail: null }));
}

export function initialFor(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  // 中文取第一个字，英文取第一个字母大写
  const ch = trimmed[0];
  return /[a-zA-Z]/.test(ch) ? ch.toUpperCase() : ch;
}
