# Research.Lab 评论后端 · 部署指南

基于 Cloudflare Workers + KV 的零运维评论系统。**完全免费**（CF 免费版每天 10 万次请求 + 1 GB 存储，远超个人站点需求）。

## 一次性部署（10–15 分钟）

### Step 1：注册 Cloudflare 账号

访问 https://dash.cloudflare.com/sign-up，邮箱注册，免费。

### Step 2：本地装好 wrangler CLI

在 **worker 目录**（不是网站根目录）打开终端：

```bash
cd worker
npm install
```

第一次会装上 `wrangler`（Cloudflare 的命令行工具）。

### Step 3：登录 wrangler

```bash
npx wrangler login
```

会弹出浏览器让你授权，点同意。

### Step 4：创建 KV 命名空间

```bash
npx wrangler kv:namespace create COMMENTS
```

输出会包含一行类似：

```
[[kv_namespaces]]
binding = "COMMENTS"
id = "abc123def456......"
```

把 `id` 后面那串复制下来。

### Step 5：填入 wrangler.toml

打开 `worker/wrangler.toml`，把这行：

```toml
id = "REPLACE_WITH_KV_NAMESPACE_ID"
```

替换成你刚拿到的 id。

### Step 6：设置管理员密码（仅你一人知道）

```bash
npx wrangler secret put ADMIN_TOKEN
```

提示输入时打一段强密码（自己记住，用来删除恶意评论），回车。

### Step 7：部署

```bash
npx wrangler deploy
```

成功后会输出：

```
Published research-lab-comments
  https://research-lab-comments.<你的子域名>.workers.dev
```

复制这个 URL，等会儿要填到网站的 `.env` 里。

### Step 8：测试

```bash
curl https://research-lab-comments.<你的子域名>.workers.dev/health
```

应该返回 `{"ok":true,"time":...}`。如果返回了，恭喜你后端跑起来了。

### Step 9：把 URL 配置到主网站

在网站根目录（不是 worker 目录）的 `.env` 文件里加一行：

```
PUBLIC_COMMENTS_API=https://research-lab-comments.<你的子域名>.workers.dev
```

重启 dev server 或重新部署 Pages。

### Step 10（强烈建议）：限制 CORS 来源

部署完 Pages 拿到网站域名后（如 `research-lab.pages.dev`），回到 wrangler.toml：

```toml
[vars]
ALLOWED_ORIGIN = "https://research-lab.pages.dev,http://localhost:4321"
```

再 `npx wrangler deploy` 一次。

这样只有你的域名可以调用评论接口，别人没法滥用。

## 删除评论

如果有恶意/垃圾评论，用管理员命令：

```bash
curl -X DELETE \
  "https://research-lab-comments.<你的子域名>.workers.dev/comments/<评论 id>?path=/reports/aidc" \
  -H "X-Admin-Token: 你设置的密码"
```

评论 id 在网页上 inspect element 能看到，或调 GET 接口看 JSON。

## 修改 / 升级

改完代码后再跑一次 `npx wrangler deploy`。Worker 部署是热更新，访客不会感知。

## 常见问题

- **本地测试：** `npx wrangler dev` 启动本地 Worker（端口 8787），可以先在 dev server 里指 `PUBLIC_COMMENTS_API=http://localhost:8787` 联调。
- **配额：** 免费版每天 10 万请求、KV 每天 1000 次写。一个个人站点用 10 年都用不完。
- **要更长留存：** KV 默认永久存储，不会过期。除非你主动删，否则一直在。
