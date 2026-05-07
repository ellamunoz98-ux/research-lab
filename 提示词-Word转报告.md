# 把 Word + Excel 转成 MDX 报告：万能提示词

> **如果你只想原样发布 Word 报告**（不要交互图表，100% 还原 Word 排版）→ 不用这份提示词，看下面 ⬇️

## 🚀 不想转 MDX？用 PDF 原版模式

最快三步：

1. **Word 里另存为 PDF**
2. **PDF 拖到 `public/pdfs/` 文件夹**
3. **复制 `_template-pdf.mdx`，改 frontmatter 的标题、行业、`pdfFile` 文件名，删掉 `draft: true`，保存**

完。浏览器自动刷新，访客就能在线翻页、缩放、下载你的 PDF。

PDF 模式适合：批量发布存量 Word；不想花精力重写为交互版；要求 100% 还原原稿。

---

## 📊 想要交互图表（MDX 模式）？继续往下看

把下面的提示词整段复制，发给任何 AI（Claude / ChatGPT / 豆包 / Kimi / 通义千问 …），跟着把你的素材贴进去，AI 就会吐回一份可以直接放进 `src/content/reports/` 的 MDX 文件。

---

## 使用步骤

1. **复制下方"提示词正文"全部内容到 AI 对话框**
2. **替换三个占位区**：
   - `<<<报告基本信息>>>` → 标题、行业、评级等
   - `<<<Word 正文>>>` → 把 Word 文档复制粘贴进去（包括所有文字、表头、数据描述）
   - `<<<Excel 数据>>>` → 把 Excel 表格选中，Ctrl+C 直接粘贴（带 Tab 分隔即可），或者贴 CSV
3. **回车，AI 输出 MDX 全文**
4. **复制 AI 输出 → 在 `src/content/reports/` 下新建 `xxx.mdx` → 粘贴 → 保存**
5. dev server 会自动热更新，浏览器立刻能看到

---

## 提示词正文（复制以下整段）

```
你是一名给"暗色科技感"研究网站准备 MDX 内容的助手。我会给你一份股票/行业研究的 Word 正文与 Excel 数据，请你把它们转换为可直接放入 Astro 内容目录的 MDX 文件。请严格遵守下列规则：

# 一、输出格式
1. 输出且仅输出一份合法的 MDX 文件文本，不加任何前后说明。
2. 文件以 YAML frontmatter 开头，字段如下：
   ---
   title: "..."
   subtitle: "..."
   summary: "...（2-4 句话）"
   industry: "..."
   tags: ["...", "...", "..."]
   rating: "买入" | "增持" | "中性" | "减持" | "卖出"  # 不确定就省略
   target: "..."  # 可选
   publishDate: YYYY-MM-DD
   accent: "cyan" | "purple" | "emerald" | "rose" | "blue"
   featured: true | false
   readingTime: "X 分钟"
   ---
3. frontmatter 之后必须紧接着这行 import 块（一字不差）：
   import LineChart from "../../components/charts/LineChart.tsx";
   import BarChart from "../../components/charts/BarChart.tsx";
   import PieChart from "../../components/charts/PieChart.tsx";
   import CandlestickChart from "../../components/charts/CandlestickChart.tsx";
   import Callout from "../../components/Callout.astro";
   import StatCard from "../../components/StatCard.astro";
   import ExcelViewer from "../../components/ExcelViewer.tsx";
4. 然后是正文。

# 二、可用组件与用法
所有图表必须带 client:only="react"，否则会报错。

A. 折线图（趋势）
<LineChart
  client:only="react"
  title="..."
  subtitle="..."  # 可选
  source="..."    # 可选
  yUnit="..."
  xData={["...", "..."]}
  series={[
    { name: "系列A", data: [1, 2, 3] },
    { name: "系列B", data: [4, 5, 6] },
  ]}
  area  # 可选，开启面积渐变
/>

B. 柱状图
<BarChart
  client:only="react"
  title="..."
  yUnit="..."
  xData={["...", "..."]}
  series={[{ name: "...", data: [1, 2] }]}
  stacked  # 可选，堆叠
  horizontal  # 可选，横向
/>

C. 饼图/环形
<PieChart
  client:only="react"
  title="..."
  donut  # 可选
  centerLabel="..."  # donut 模式下中心文字
  data={[{ name: "...", value: 35 }]}
/>

D. K 线
<CandlestickChart
  client:only="react"
  title="..."
  data={[["YYYY-MM-DD", 开, 收, 低, 高]]}
/>

E. KPI 卡片墙（横排）
<div class="not-prose grid grid-cols-2 md:grid-cols-4 gap-3 my-8">
  <StatCard label="..." value="..." unit="..." delta="+5.2% YoY" trend="up" accent="cyan" />
  ...（最多 4 个）
</div>

F. 高亮提示框
<Callout type="success" title="...">  内容  </Callout>
type 可选：info / warning / success / danger / insight

G. Excel 表格内嵌（用户已把 .xlsx 文件放在 public/excel/ 下）
<ExcelViewer
  client:only="react"
  file="财务数据.xlsx"     // 必填，文件名
  title="..."              // 可选
  source="..."             // 可选
  height={500}             // 可选，默认 480
  sheet="Sheet2"           // 可选，默认第一张
/>
仅当用户在素材里明确说"这份 Excel 应该原样展示给读者"时才用 ExcelViewer；如果用户只是给 Excel 数据用来画图，请提取数据写进 LineChart/BarChart 等组件，不要用 ExcelViewer。

# 三、内容组织建议
1. 报告开头先放一个 type="success" 的 Callout 总结核心结论，再放一组 4 个 StatCard 摆关键指标。
2. 章节用 `## 一、xxx`、`## 二、xxx` 这样的二级标题，子节用 `###`。会自动生成右侧目录。
3. 把 Word 中**所有**静态图表（截图、配图）替换为对应的交互组件，从 Excel 数据中提取出 xData 和 series.data。
4. 表格用标准 Markdown 表格语法。
5. 中间穿插不同 type 的 Callout（warning 风险、insight 独到观点、danger 关键警告）让阅读节奏起伏。
6. 报告末尾必有一个 type="warning" 或正文章节"风险提示"，列举 3-5 条不确定性。
7. 数字保留合适小数位；同比/环比用 +X.X% 格式；金额带千分位。
8. 引用块（>）用于强调单句金句。

# 四、accent 颜色推荐
- 食品饮料/消费 → rose
- 科技/半导体/AI → cyan
- 新能源/电动车 → emerald
- 金融/地产 → blue
- 医药/创新药 → purple
- 农林牧渔/周期 → emerald
- 不确定就用 cyan

# 五、要避免的错误
1. 千万不要忘记在每个图表上加 client:only="react"。
2. 不要 import 不存在的组件。
3. 不要在 frontmatter 中用单引号包裹中文，全部用双引号。
4. data 里只能放数字，不要写 "12亿" 这种字符串，单位放 yUnit 或 unit。
5. **正文中所有数学不等号必须转义**：`<` 写成 `&lt;`，`>` 写成 `&gt;`。例如 "营收<5%" 必须写成 "营收&lt;5%"，"毛利率>40%" 必须写成 "毛利率&gt;40%"。否则 MDX 会把它当 JSX 标签报错。Markdown 引用块开头的 `> ` 不受影响（那是合法的）。
6. publishDate 必须是裸日期格式 `2026-05-07`，不要加引号、不要写 `2026/5/7` 或 `2026.5.7`。
7. tags 必须是数组：`["A", "B"]`，不要写成 `"A, B"`。

# 六、我的素材

【报告基本信息】
<<<报告基本信息>>>
（包括：标题、副标题、行业、想要的评级、目标价、标签、想用什么主色调）

【Word 正文】
<<<Word 正文>>>

【Excel 数据】
<<<Excel 数据>>>
（每张表说明：这是什么数据、用来画哪种图、x 轴是什么、要画几个系列）

请直接输出完整的 MDX 文件内容。
```

---

## 实战流程举例

假设你今天写一份白酒报告：

1. 在 Word 里把分析写完，Excel 里整理好茅台批价、库存、净利数据
2. 打开 Claude/ChatGPT，粘贴上面整段提示词
3. 在 `<<<报告基本信息>>>` 处填：
   ```
   标题：白酒行业深度：高端价格带是否还能涨
   行业：食品饮料
   评级：增持
   目标价：板块超配
   标签：白酒、茅台、五粮液、高端消费
   主色调：rose
   ```
4. 把 Word 全选复制到 `<<<Word 正文>>>` 处
5. 把 Excel 选中复制到 `<<<Excel 数据>>>` 处
6. 回车，等 AI 出货
7. AI 给你的 MDX 复制到 `src/content/reports/baijiu-2026.mdx` 保存
8. `npm run dev` 已经在跑的话，浏览器自动刷新，立刻能看

## 不依赖 AI 的纯手工方式

1. 复制 [`src/content/reports/_template.mdx`](src/content/reports/_template.mdx)（这就是模板，里面每个组件都有示例）
2. 重命名成你的英文 slug
3. 改 frontmatter，删 `draft: true`
4. 把模板里的占位文字换成你的内容
5. Excel 数据 → 复制需要画图的列 → 在 [csvjson.com/csv2json](https://csvjson.com/csv2json) 转成 JS 数组 → 粘到 `xData` 和 `series.data`
6. 保存，浏览器立刻显示

## 什么情况建议来找我

- 想加新的图表类型（雷达图 / 桑基图 / 地图等）
- 想加新功能（标签聚合页、搜索、暗亮主题切换…）
- 视觉风格想大改（换字体、换配色体系）
- AI 给你的 MDX 跑不起来，调试不出来
- 报告排版想做特殊布局（分屏对比、滚动叙事）

正常加报告 → 完全不用找我，自助即可。
