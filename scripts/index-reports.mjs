#!/usr/bin/env node
/**
 * Research.Lab 报告库 → Vectorize 索引脚本
 *
 * 工作流：
 *   1. 扫 src/content/reports/*.mdx
 *   2. 解析 frontmatter，跳过 draft
 *   3. 去掉 import 行 + JSX 组件，保留 Markdown 文本
 *   4. 按 H2/H3 切块（每块 200-1200 字，超长按段落切）
 *   5. 分批 POST 到 Worker 的 /admin/chat-index 端点
 *      （Worker 用 bge-m3 嵌入 + 写入 Vectorize）
 *
 * 用法：
 *   WORKER_URL=https://research-lab-comments.<xxx>.workers.dev \
 *   ADMIN_TOKEN=<your-token> \
 *   node scripts/index-reports.mjs
 *
 *   可选 --dry 只切块不上传，用于看分块结果
 *   可选 --slug=<name> 只索引某一份报告
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORTS_DIR = path.join(ROOT, "src", "content", "reports");

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const SLUG_FILTER = (args.find((a) => a.startsWith("--slug=")) ?? "").slice(7);

const WORKER_URL = process.env.WORKER_URL;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

if (!DRY && (!WORKER_URL || !ADMIN_TOKEN)) {
  console.error("❌ 请设置环境变量 WORKER_URL 和 ADMIN_TOKEN（或加 --dry 仅本地切块）");
  process.exit(1);
}

const MAX_CHUNK = 1200;
const MIN_CHUNK = 120;
const BATCH_SIZE = 20;

/* ----------------------- frontmatter 解析 ----------------------- */

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return { meta: {}, body: raw };
  const yaml = m[1];
  const meta = {};
  for (const line of yaml.split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue; // YAML 注释行
    const km = line.match(/^([a-zA-Z]+):\s*(.+)$/);
    if (!km) continue;
    let val = km[2];
    if (val.startsWith('"')) {
      const end = val.indexOf('"', 1);
      val = end > 0 ? val.slice(1, end) : val.slice(1);
    } else if (val.startsWith("'")) {
      const end = val.indexOf("'", 1);
      val = end > 0 ? val.slice(1, end) : val.slice(1);
    } else {
      // 去行内 # 注释
      val = val.replace(/\s+#.*$/, "").trim();
    }
    meta[km[1]] = val;
  }
  return { meta, body: raw.slice(m[0].length) };
}

/* ----------------------- 清理 MDX → Markdown ----------------------- */

function cleanMdx(body) {
  let s = body;
  // 去 import 行
  s = s.replace(/^\s*import\s+.+?from\s+["'][^"']+["'];?\s*$/gm, "");
  // 去 JSX 自闭合（含跨行属性）  <Tag ... /> 或 <Tag>...</Tag>
  s = s.replace(/<([A-Z][A-Za-z0-9]*)\b[^>]*?\/>/gs, "");
  s = s.replace(/<([A-Z][A-Za-z0-9]*)\b[^>]*>[\s\S]*?<\/\1>/g, (m, _t) => {
    // 把 Callout/StatCard 里的纯文本提出来（去 props，留正文）
    const inner = m
      .replace(/<[A-Z][A-Za-z0-9]*\b[^>]*>/g, "")
      .replace(/<\/[A-Z][A-Za-z0-9]*>/g, "")
      .trim();
    return inner.length > 30 ? `\n${inner}\n` : "";
  });
  // 去 HTML div 块
  s = s.replace(/<div\b[^>]*>[\s\S]*?<\/div>/g, "");
  // 去 MDX 注释 {/* ... */}
  s = s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  // 解码 &lt; &gt;
  s = s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  // 多余空行收敛
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

/* ----------------------- 锚点（仿 github-slugger） ----------------------- */

function slugify(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[、，。！？：；""''（）()\[\]【】《》「」.,!?:;'"`/\\#*~$%^&]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ----------------------- 切块 ----------------------- */

function splitLong(text) {
  if (text.length <= MAX_CHUNK) return [text];
  const paras = text.split(/\n\n+/);
  const chunks = [];
  let buf = "";
  for (const p of paras) {
    const next = buf ? buf + "\n\n" + p : p;
    if (next.length > MAX_CHUNK && buf.length >= MIN_CHUNK) {
      chunks.push(buf);
      buf = p;
    } else if (next.length > MAX_CHUNK) {
      // 单段就超长 → 按句号粗切
      const sentences = p.split(/(?<=[。！？!?])/);
      for (const s of sentences) {
        if ((buf + s).length > MAX_CHUNK && buf.length >= MIN_CHUNK) {
          chunks.push(buf);
          buf = s;
        } else {
          buf = buf + s;
        }
      }
    } else {
      buf = next;
    }
  }
  if (buf.trim()) chunks.push(buf);
  return chunks;
}

function chunkBody(body, slug, title) {
  const chunks = [];
  let idx = 0;

  // 按 H2 切
  const h2Parts = body.split(/^## +(.+)$/m);
  // h2Parts: [前言, h2_title_1, h2_body_1, h2_title_2, h2_body_2, ...]

  const pushChunk = (heading, anchor, text) => {
    const pieces = splitLong(text);
    for (const piece of pieces) {
      if (piece.trim().length < MIN_CHUNK) continue;
      chunks.push({
        id: `${slug}__${idx}`,
        slug,
        title,
        heading,
        anchor,
        text: piece.trim(),
      });
      idx++;
    }
  };

  // 前言
  const preamble = (h2Parts[0] ?? "").trim();
  if (preamble.length >= MIN_CHUNK) {
    pushChunk("（导语）", "", preamble);
  }

  for (let i = 1; i < h2Parts.length; i += 2) {
    const h2Title = h2Parts[i].trim();
    const h2Body = (h2Parts[i + 1] ?? "").trim();
    const h2Anchor = slugify(h2Title);

    // 在 H2 内继续按 H3 切
    const h3Parts = h2Body.split(/^### +(.+)$/m);
    const h2Lead = (h3Parts[0] ?? "").trim();
    if (h2Lead.length >= MIN_CHUNK) {
      pushChunk(h2Title, h2Anchor, h2Lead);
    }

    for (let j = 1; j < h3Parts.length; j += 2) {
      const h3Title = h3Parts[j].trim();
      const h3Body = (h3Parts[j + 1] ?? "").trim();
      if (!h3Body) continue;
      const heading = `${h2Title} · ${h3Title}`;
      // 锚点优先用 H3，没有就用 H2
      const anchor = slugify(h3Title) || h2Anchor;
      pushChunk(heading, anchor, h3Body);
    }
  }

  return chunks;
}

/* ----------------------- 主流程 ----------------------- */

const allFiles = (await fs.readdir(REPORTS_DIR)).filter(
  (f) => f.endsWith(".mdx") && !f.startsWith("_")
);

const targetFiles = SLUG_FILTER
  ? allFiles.filter((f) => f.replace(/\.mdx$/, "") === SLUG_FILTER)
  : allFiles;

if (targetFiles.length === 0) {
  console.error(`❌ 没找到匹配的报告文件${SLUG_FILTER ? `（slug=${SLUG_FILTER}）` : ""}`);
  process.exit(1);
}

console.log(`📚 扫到 ${targetFiles.length} 份报告`);

const allChunks = [];
const skipped = [];
for (const file of targetFiles) {
  const slug = file.replace(/\.mdx$/, "");
  const raw = await fs.readFile(path.join(REPORTS_DIR, file), "utf8");
  const { meta, body } = parseFrontmatter(raw);

  if (meta.draft === "true" || meta.draft === true) {
    skipped.push(`${slug}（draft）`);
    continue;
  }
  // PDF 模式（pdfFile）的报告正文一般很短，但仍然索引前言部分
  const cleaned = cleanMdx(body);
  const chunks = chunkBody(cleaned, slug, meta.title || slug);
  console.log(`  · ${slug}：${chunks.length} 块`);
  allChunks.push(...chunks);
}

if (skipped.length) console.log(`⏭  跳过：${skipped.join("、")}`);
console.log(`\n✂  共切出 ${allChunks.length} 块（平均 ${Math.round(allChunks.reduce((s, c) => s + c.text.length, 0) / Math.max(allChunks.length, 1))} 字/块）\n`);

if (DRY) {
  console.log("--- DRY 模式：仅展示前 3 块预览 ---");
  for (const c of allChunks.slice(0, 3)) {
    console.log(`\n[${c.id}] ${c.heading}`);
    console.log(c.text.slice(0, 200) + "...");
  }
  process.exit(0);
}

console.log(`📤 上传到 ${WORKER_URL}/admin/chat-index ...`);
let ok = 0;
const totalBatches = Math.ceil(allChunks.length / BATCH_SIZE);
for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
  const batch = allChunks.slice(i, i + BATCH_SIZE);
  const resp = await fetch(`${WORKER_URL}/admin/chat-index`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Token": ADMIN_TOKEN,
    },
    body: JSON.stringify({ chunks: batch }),
  });
  if (!resp.ok) {
    console.error(
      `❌ 批次 ${i / BATCH_SIZE + 1}/${totalBatches} 失败：${resp.status} ${await resp.text()}`
    );
    process.exit(1);
  }
  ok += batch.length;
  console.log(`  · 批次 ${i / BATCH_SIZE + 1}/${totalBatches} OK（累计 ${ok}/${allChunks.length}）`);
}

console.log(`\n✅ 完成，已索引 ${ok} 块。`);
