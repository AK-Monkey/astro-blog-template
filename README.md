# Astro 个人网站模板

一个纯静态的中文个人网站框架：Markdown 写作、可视化后台、站内搜索、RSS / llms.txt，推送即部署。没有服务器，也没有数据库，所有内容都是仓库里的文件。

## 技术栈

| 环节 | 方案 |
| --- | --- |
| 框架 | [Astro 7](https://astro.build)（静态输出），TypeScript，纯 CSS（无 Tailwind） |
| 内容 | Content Collections（`src/content/posts/<slug>/index.md`，zod schema），图片随文章存放并由 Astro 自动优化 |
| 代码高亮 | Shiki 亮/暗双主题 |
| 字体 | `@fontsource` 自托管（Inter / Source Serif 4 / Noto Serif SC），不依赖 Google Fonts |
| 搜索 | [Pagefind](https://pagefind.app)（`astro-pagefind`），自写搜索对话框，⌘K / `/` 唤起 |
| 订阅与机器可读 | 全文 RSS（`/rss.xml`）、`/llms.txt`、每篇文章的原始 Markdown（`/posts/<slug>.md`）、sitemap |
| 后台 | [Sveltia CMS](https://github.com/sveltia/sveltia-cms)（`/admin`），保存即向 GitHub 提交 |
| 后台登录 | Cloudflare Worker 上的 [sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth) + GitHub OAuth App |
| 托管 | Vercel（推送 `main` 自动构建），Vercel Web Analytics（无 Cookie） |
| 写作来源（可选） | 飞书云文档导入脚本（`scripts/import-feishu.mjs`，依赖本机 `lark-cli`，纯规则转换） |

## 功能

- 三种布局（无导航居中 / 顶部导航左对齐 / 顶部导航居中）、三种字体组合、亮/暗/跟随系统主题，访客可在“显示设置”面板切换并记住选择。
- 文章目录：宽屏为可收起的侧栏，窄屏为折叠目录 + 底部弹出面板，均高亮当前章节。
- 首页区块（简介 / 文章 / 视频）的顺序、显隐、条数可在后台调整；内容栏目名称（默认“手记”）可配置。
- 社交链接支持二维码弹窗（如公众号）；邮箱地址不以明文写进 HTML，点击后才显示。
- 飞书分栏（`fs-grid`）、高亮块（`callout`）等富排版在 Markdown 中可用。

## 快速开始

```bash
npm install
npm run dev      # http://localhost:4321，开发模式显示草稿（含 _sample 示例文章）
npm run build    # 构建到 dist/，同时生成搜索索引
npm run preview  # 预览构建结果
```

## 改成你自己的站点

1. `astro.config.mjs` 的 `site`、`src/site.config.ts` 的 `siteUrl`（及回退值 `example.com`）、`public/robots.txt` 的 Sitemap：换成你的域名。
2. `src/data/site.json`：网站名、简介、作者、导航、社交链接、首页区块（之后也可以在后台改）。
3. `public/favicon.svg`、`src/components/Logo.astro`：换成你的标志。
4. `public/admin/config.yml`：`backend.repo` 改为你的仓库，`backend.base_url` 改为你的登录 Worker 地址（见 [docs/DEPLOY.md](docs/DEPLOY.md)）。
5. 写文章：`src/content/posts/<slug>/index.md`，frontmatter 见 [AGENTS.md](AGENTS.md)。`_sample` 是排版自测用的草稿，生产构建不会输出。

代码约定（内容 schema、富排版写法、导入映射规则、派生端点实现）见 [AGENTS.md](AGENTS.md)，部署与后台登录见 [docs/DEPLOY.md](docs/DEPLOY.md)。
