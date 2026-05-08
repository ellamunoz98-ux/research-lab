# 行业热力图配图目录

本目录存放每个子板块的"杂志封面"配图。

## 命名规则

每张图按 `{slug}.jpg` 命名，slug 在 `src/lib/industries.ts` 的 `BOARD_SLUG` 常量里查（如 `humanoid.jpg`、`cpo.jpg`）。

## 推荐规格

- **格式**：JPG（也支持 PNG/WebP，但 JPG 体积小且兼容好）
- **比例**：3:2 横向（如 1500×1000、900×600）
- **大小**：单图 ≤ 200 KB（页面加载会更快）
- **风格统一**：全部按同一组 prompt 后缀生成，确保画风一致

## 工作流

1. 用即梦 / 文心一格 / Midjourney 生成图
2. 重命名为对应 slug
3. 放进本目录
4. `git add public/industries/*.jpg && git commit && git push`
5. Netlify 重新部署后页面自动显示

未提供图的板块会自动 fallback 到 emoji 水印，不会报错。
