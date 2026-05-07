import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const reports = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/reports" }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    summary: z.string(),
    industry: z.string(),
    tags: z.array(z.string()).default([]),
    // 投资评级（可选）
    rating: z.enum(["买入", "增持", "中性", "减持", "卖出"]).optional(),
    target: z.string().optional(),
    publishDate: z.coerce.date(),
    updateDate: z.coerce.date().optional(),
    cover: z.string().optional(),
    accent: z.enum(["cyan", "purple", "emerald", "rose", "blue"]).default("cyan"),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    readingTime: z.string().optional(),
    /**
     * PDF 模式：文件名（相对于 public/pdfs/）
     * 设置后，本篇报告将以 PDF 查看器形式展示，MDX 正文会渲染在 PDF 上方作为前言（可空）
     */
    pdfFile: z.string().optional(),
    pdfPages: z.number().optional(), // 可选：手动标注总页数，仅展示用
  }),
});

export const collections = { reports };
