import { timelineItems } from "../lib/timelineData";
import type { APIRoute } from "astro";

/**
 * 静态 JSON 端点：Cloudflare Worker 每日 cron 从这里拉数据
 * 命中此端点：https://shaun-research.pages.dev/timeline.json
 */
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ items: timelineItems, generatedAt: Date.now() }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
