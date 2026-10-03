# 部署与后台登录

## 整体架构

```
写作                    存储                     构建与托管               访问
──────────────────────────────────────────────────────────────────────────────
飞书文档 ──导入脚本──┐
                     ├──> GitHub 仓库 ──push main──> Vercel ──> 你的域名
/admin 后台 ─commit──┘   (Markdown + JSON + 图片)   (Astro 静态构建 + Pagefind 索引)
     │
     └─ GitHub 登录 ──> Cloudflare Worker sveltia-cms-auth ──> GitHub OAuth App
```

- 网站是纯静态的，所有内容都是仓库里的文件。
- `main` 分支就是生产环境：任何推送到 `main` 的提交（包括后台保存）都会自动上线。其他分支推送后 Vercel 会生成预览地址。

## 1. 部署到 Vercel

1. 把仓库推到你的 GitHub。
2. 在 Vercel 导入该仓库。框架由根目录 `vercel.json`（`"framework": "astro"`）决定，构建命令 `npm run build`，输出目录 `dist`。
3. 在 Vercel 绑定域名，并同步修改 `astro.config.mjs` 的 `site`、`src/site.config.ts` 的 `siteUrl`、`public/robots.txt`。
4. （可选）在 Vercel 项目里打开 Web Analytics；不需要的话删掉 `BaseLayout.astro` 里的 `<Analytics />` 和 `@vercel/analytics` 依赖。

## 2. 后台登录（Sveltia CMS + Cloudflare Worker）

登录流程：后台页面 → Worker `/auth` → GitHub 授权页 → Worker `/callback` 用 Client Secret 换取令牌 → 令牌返回给后台页面。Worker 只把令牌交给 `ALLOWED_DOMAINS` 里的域名。

1. 部署 Worker：克隆 https://github.com/sveltia/sveltia-cms-auth ，按其 README 部署到 Cloudflare Workers，得到地址 `https://sveltia-cms-auth.<你的子域>.workers.dev`。
2. 创建 GitHub OAuth App（GitHub → Settings → Developer settings → OAuth Apps），回调地址填 `https://sveltia-cms-auth.<你的子域>.workers.dev/callback`。
3. 配置 Worker 变量：

   | 变量 | 类型 | 值 |
   | --- | --- | --- |
   | `GITHUB_CLIENT_ID` | 明文 | OAuth App 的 Client ID |
   | `ALLOWED_DOMAINS` | 明文 | 你的域名，逗号分隔，如 `example.com, www.example.com` |
   | `GITHUB_CLIENT_SECRET` | 加密 secret | `npx wrangler secret put GITHUB_CLIENT_SECRET --name sveltia-cms-auth` |

4. 修改 `public/admin/config.yml`：`backend.repo` 改为 `你的用户名/仓库名`，`backend.base_url` 改为 Worker 地址。
5. 打开 `https://你的域名/admin`，点 “Sign In with GitHub”。

备用：Worker 不可用时，在后台登录页点 “Sign In with Token”，用对仓库有 Contents 读写权限的 GitHub 个人访问令牌登录。

密钥类信息（Client Secret、各类令牌）不要提交进仓库。

## 3. 飞书导入（可选）

依赖本机 [`lark-cli`](https://www.npmjs.com/package/@larksuite/cli) 的登录态（`lark-cli auth status` 检查，过期运行 `lark-cli auth login`）。

```bash
npm run import:feishu -- "<飞书文档链接>" --slug my-post --tags "标签1,标签2"
npm run import:feishu -- "<同一链接>"            # 再次导入 = 更新原文章
npm run import:feishu -- "<链接>" --dry-run      # 只打印结果，不写文件
```

不用飞书的话，可以删掉 `scripts/import-feishu.mjs` 和 `package.json` 里的 `import:feishu`。

## 4. 部署与回滚

- 上线：推送到 `main`。先预览：推到其他分支，看完预览地址再合并。
- 回滚：Vercel → Deployments → 选上一个正常部署 → Instant Rollback；或 `git revert <提交>` 后推送。

## 5. 维护

| 事项 | 做法 |
| --- | --- |
| 依赖升级 | `npm outdated` 后升级 astro、@astrojs/*、astro-pagefind、pagefind；`npm run build` 通过后先推预览分支验证。不要运行 `npm audit fix --force`，它可能把 astro 降级 |
| Sveltia CMS 版本 | `public/admin/index.html` 固定了版本号，升级时修改并在预览站验证能登录和保存 |

## 6. 故障排查

| 现象 | 可能原因 | 处理 |
| --- | --- | --- |
| 后台点 “Sign In with GitHub” 没反应或报错 | 当前域名不在 `ALLOWED_DOMAINS`；Secret 失效；Worker 停用 | 检查第 2 节的配置；可先用 Token 登录应急 |
| 后台保存成功但网站没变化 | Vercel 构建失败 | 看最新部署的构建日志，常见原因是 frontmatter 不符合 schema |
| 本地搜索搜不到新文章 | 开发模式用的是上次构建的索引 | 运行 `npm run build` |
| 构建报 Markdown 相关错误 | Astro 7 默认用 Sätteri 处理 Markdown，不支持 remark/rehype 插件 | 见 AGENTS.md 的“注意”一节 |

## 关键决定与原因

| 决定 | 原因 |
| --- | --- |
| Astro 静态站，不用 WordPress | 不需要运维服务器和数据库；外观完全可控；内容是 Markdown，方便迁移，也方便 agent 读取 |
| 飞书导入读取 `lark-cli` 的 XML 结构，不用 Markdown 导出 | Markdown 导出会丢掉分栏里的图片，也拿不到图片 token |
| 导入不依赖 AI | 结果可预期、可重复 |
| 后台用 Sveltia CMS + Cloudflare Worker 登录 | 不需要服务器，后台就在自己的域名下；登录服务免费，并且限制了可用域名 |
| 字体自托管 | 国内访问 Google Fonts 不稳定 |
