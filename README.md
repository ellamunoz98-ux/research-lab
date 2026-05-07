# Research.Lab

个人行业研究 / 股票深度调研 / 全球金融实时行情展示站点。暗色科技感主题，交互式 3D 地球，中文优化，支持评论 + 身份系统。

## 站点结构

| 路径 | 内容 |
|---|---|
| `/` | 首页 · Hero + 实时浮卡 + 3D 地球 + 最新报告 |
| `/markets` | 全球行情 · 3D 地球 + 16 对汇率 + 8 大央行政策利率 |
| `/reports` | 研究报告（MDX 互动 + PDF 原版双模式） |
| `/news` | 资讯快线 · 5 类财经新闻 5 分钟自动刷新 |
| `/about` | 关于 Shaun 与本站理念 |

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Astro 5 + MDX |
| 样式 | Tailwind CSS 4（暗色科技感） |
| 图表 | ECharts（报告页） |
| 3D | Three.js + react-globe.gl（首页地球） |
| 动画 | GSAP + ScrollTrigger |
| 实时数据 | 东方财富 / CoinGecko / ExchangeRate-API / rss2json |
| 身份系统 | localStorage（无后端） |
| 评论 | Waline（可选部署） |
| 部署 | Cloudflare Pages / Vercel |

## 实时数据源（全部免费、CORS 开放）

| 用途 | 接口 | 频率 |
|---|---|---|
| A 股 / 港股 / 美股 / 欧股指数 | 东方财富 push2 | 30 秒 |
| 加密货币 | CoinGecko | 30 秒 |
| 主要货币对 | ExchangeRate-API | 30 分钟 |
| 国际财经新闻 | rss2json + Investing/CoinDesk RSS | 5 分钟 |
| 央行政策利率 | 静态数据（每月手动更新一次） | — |

## 本地启动

```bash
# 安装依赖（首次）
npm install

# 启动开发服务器
npm run dev          # → http://localhost:4321

# 生产构建
npm run build
npm run preview      # 本地预览生产版本
```

需要 **Node 22+** 与 **npm 11+**。

## 两种发布模式

写新报告前先选模式：

| 模式 | 适用 | 工作量 | 体验 |
|---|---|---|---|
| **⚡ 互动 MDX** | 镇站精品报告 | 高（要重写、配图表） | 交互图表、暗色科技感、SEO 友好 |
| **📄 原版 PDF** | 已有 Word 直接发 | 低（导 PDF 拖文件） | 100% Word 保真，0 编辑 |

两种模式可以**并存**——镇站之作走 MDX，平时随手写的走 PDF。报告卡上会自动显示对应徽章。

---

## PDF 原版模式（最简单，3 步）

### Step 1：Word 导出 PDF

在 Word 里：**文件 → 另存为 → 选择 PDF**。

### Step 2：把 PDF 拖到 `public/pdfs/`

文件名建议英文短横线（如 `baijiu-2026.pdf`），中文名也行但部署后 URL 难看。

### Step 3：在 `src/content/reports/` 新建一个 .mdx

复制 `_template-pdf.mdx`，重命名（如 `baijiu-2026.mdx`），改这几行：

```yaml
---
title: "白酒深度调研"
summary: "..."
industry: "食品饮料"
publishDate: 2026-05-07
pdfFile: "baijiu-2026.pdf"   # ← 关键：你刚拖进去的 PDF 文件名
pdfPages: 25                  # 可选
---
```

保存。浏览器自动刷新，PDF 报告上线，访客可在线翻页、下载、全屏阅读。

> 正文部分（frontmatter 之后）可写可不写——写了会显示在 PDF 上方作为前言/写作背景。

---

## 互动 MDX 模式（精品 showcase）

每篇报告就是一个 MDX 文件。三步：

### Step 1：在 `src/content/reports/` 新建文件

文件名（无空格、英文）就是 URL 路径：
```
src/content/reports/baijiu-deep-dive.mdx → /reports/baijiu-deep-dive
```

### Step 2：填 frontmatter

```yaml
---
title: "白酒行业深度：高端酒还能涨价吗"
subtitle: "基于茅台批价、库存、消费场景的三维拆解"
summary: "本文通过 2018 年以来茅台批价与一批二批库存的领先滞后关系..."
industry: "食品饮料"
tags: ["白酒", "茅台", "高端消费"]
rating: "增持"               # 可选：买入/增持/中性/减持/卖出
target: "目标价 1900 元"
publishDate: 2026-04-22
accent: "rose"                # 主色调：cyan/purple/emerald/rose/blue
featured: true
readingTime: "10 分钟"
---
```

### Step 3：在正文中插入交互组件

```mdx
import LineChart from "../../components/charts/LineChart.tsx";
import Callout from "../../components/Callout.astro";
import StatCard from "../../components/StatCard.astro";

## 一、行情回顾

<Callout type="success" title="核心结论">
当前飞天茅台批价 2,650 元，距离 2021 年高点回落 30%，已包含较多悲观预期。
</Callout>

<LineChart
  client:only="react"
  title="飞天茅台批价走势"
  source="酒商调研周报"
  yUnit="元/瓶"
  area
  xData={["2022-01", "2022-07", "2023-01", "2023-07", "2024-01"]}
  series={[
    { name: "整箱批价", data: [3200, 3050, 2980, 2750, 2650] },
    { name: "散瓶批价", data: [2850, 2750, 2700, 2480, 2380] },
  ]}
/>
```

> **重要**：所有图表组件**必须**带 `client:only="react"`，因为 ECharts 依赖浏览器 DOM。

## 内置可用组件

放在 MDX 中即可使用：

| 组件 | 用途 |
|---|---|
| `<LineChart>` | 折线图（趋势、对比） |
| `<BarChart>` | 柱状图（支持堆叠、横向） |
| `<PieChart>` | 饼图/环形图（占比） |
| `<CandlestickChart>` | K 线图（行情） |
| `<ExcelViewer>` | 直接渲染 .xlsx 文件（多 sheet/搜索/排序/下载） |
| `<StatCard>` | KPI 数据卡 |
| `<Callout>` | 高亮框（info/warning/success/danger/insight） |

每个组件的 props 看 `src/components/` 下的源码即可，TypeScript 有完整类型提示。

### Excel 内嵌用法

把 .xlsx 文件拖进 `public/excel/`，在 MDX 中：

```mdx
import ExcelViewer from "../../components/ExcelViewer.tsx";

<ExcelViewer
  client:only="react"
  file="财务数据.xlsx"
  title="2024 合并财报"
  source="公司年报"
  height={500}
/>
```

读者可以：切换 sheet、搜索关键字、按列排序、一键下载原文件。仅支持 .xlsx；如果是老的 .xls，先在 Excel 里"另存为"成 .xlsx。

## 评论系统配置（Waline）

评论需要服务端，部署一次即可所有报告共用：

1. **Fork** [Waline](https://github.com/walinejs/waline)
2. **一键部署到 Vercel**（推荐），数据库可选 LeanCloud / Supabase（免费额度足够个人使用）
3. 拿到部署 URL（如 `https://your-waline.vercel.app`）
4. 在网站根目录创建 `.env`：
   ```
   PUBLIC_WALINE_SERVER_URL=https://your-waline.vercel.app
   ```
5. `npm run dev` 重启即可

详细教程：https://waline.js.org/guide/get-started.html

## 部署

### Cloudflare Pages（推荐，国内访问快，免费）

1. 把项目推到 GitHub
2. Cloudflare Pages → 连接仓库
3. 构建命令：`npm run build`，输出目录：`dist`
4. 环境变量：`PUBLIC_WALINE_SERVER_URL`（如已配置评论）

### Vercel

```bash
npm i -g vercel && vercel
```

按提示走完即可，自动检测 Astro。

## 把 Word/Excel 转成报告（手动流程）

1. **Word → Markdown 骨架**：用 [Pandoc](https://pandoc.org)
   ```bash
   pandoc 报告.docx -t gfm -o draft.md
   ```
   把 `draft.md` 内容复制到新建的 `.mdx` 中作为初稿，加上 frontmatter。

2. **Excel → 图表数据**：复制需要画图的列，丢到 [csvjson.com/csv2json](https://csvjson.com/csv2json) 转 JSON 数组，再粘进 `<LineChart>` 的 `xData` / `series.data`。

3. **静态截图换交互图**：把 Word 中的静态图表用对应组件重画，体验立刻拉开档次。

## 主题改色

所有颜色在 `src/styles/global.css` 的 `@theme` 块里，改一处全站生效：

```css
@theme {
  --color-cyan-accent: #22d3ee;     /* 主强调色 */
  --color-purple-accent: #a78bfa;
  --color-bg-base: #060912;          /* 整体背景 */
  /* ... */
}
```

## 目录结构

```
src/
├── content/
│   └── reports/              ← 你的报告 MDX 写在这里
├── components/
│   ├── charts/               ← ECharts 封装
│   ├── Callout.astro
│   ├── StatCard.astro
│   ├── Hero.astro
│   ├── ReportCard.astro
│   ├── TableOfContents.astro
│   └── Comments.tsx          ← Waline
├── layouts/
│   ├── BaseLayout.astro      ← 全局壳
│   └── ReportLayout.astro    ← 报告页壳（含 TOC + 评论）
├── pages/
│   ├── index.astro           ← 首页
│   ├── about.astro
│   └── reports/
│       ├── index.astro       ← 报告列表
│       └── [...slug].astro   ← 报告详情
├── styles/
│   └── global.css            ← Tailwind 4 主题
└── content.config.ts         ← 报告 frontmatter 校验
```

## 可继续扩展

- **全站搜索**：Pagefind（构建时索引，零运维）
- **RSS 订阅**：`@astrojs/rss`
- **图片放大**：medium-zoom
- **按标签聚合页**：自动按 `tags` 生成路由
- **打印样式**：优化 PDF 导出
- **暗 / 亮主题切换**：当前是纯暗色

需要哪个开口，对应改 1—2 个文件即可。
