# 个人网站（Astro 7）

个人网站模板。静态输出，Astro 7.3.x，npm，纯 CSS（无 Tailwind）。默认语言中文，不带 URL 前缀；英文将来放 `/en/`（尚未实现）。

## 常用命令

```bash
npm install
npm run dev        # http://localhost:4321，开发模式会显示 draft 文章（含 _sample）
npm run build      # 输出到 dist/
npm run preview    # 预览构建结果（不含 draft）
```

`main` 即生产环境：推送到 `main`（包括 /admin 后台保存）会自动上线。没有明确要求时不要推送 `main`、不要改 `.vercel/`。部署与后台登录配置见 [docs/DEPLOY.md](docs/DEPLOY.md)。

## 目录结构

```
astro.config.mjs            site、sitemap、Shiki 双主题
src/site.config.ts          代码级设置（siteUrl、显示设置开关与默认值），并合并 src/data/site.json
src/data/site.json          可在后台编辑：网站名、简介、内容栏目名称（postsLabel，界面上不要写死“文章”）、导航、社交链接、首页区块
src/content.config.ts       posts 集合 schema（与导入程序的契约）
src/content/posts/<slug>/   每篇文章一个文件夹：index.md + images/
src/data/videos.json        视频列表（后台可编辑；videos.ts 做类型包装，空数组则整块不显示）
src/lib/posts.ts            getPosts()（过滤 draft、倒序）、阅读时间、描述等
src/layouts/BaseLayout.astro  <head>（SEO、首屏设置脚本）、导航、页脚、字体
src/components/             Nav / Footer / Logo / Socials / DisplaySettings 等
src/scripts/display.ts      显示设置交互（面板、主题循环、localStorage）
src/styles/global.css       全部样式（颜色 token、暗色、正文、fs-grid、callout、面板）
src/pages/                  index、posts/、posts/[slug]/、posts/[slug].md.ts、
                            rss.xml.ts、llms.txt.ts、videos/projects/about/links/404
public/                     favicon.svg、robots.txt、admin/（Sveltia 后台）、uploads/（后台上传）
scripts/import-feishu.mjs   飞书导入
docs/DEPLOY.md              部署与后台登录配置
```

## 内容集合 `posts`

路径：`src/content/posts/<slug>/index.md`，文件夹名即 URL slug（`/posts/<slug>/`）。图片放同目录 `images/`，正文用相对路径 `![alt](./images/xxx.png)` 引用，Astro 会自动优化。以 `_` 开头的文件夹照常加载（`_sample` 是自测文章）。

frontmatter（zod，见 `src/content.config.ts`）：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `title` | string | 必填 |
| `date` | date | 必填，`YYYY-MM-DD` |
| `updated` | date | 可选 |
| `description` | string | 可选；缺省时取正文开头纯文本 |
| `tags` | string[] | 默认 `[]`；列表页只显示第一个 |
| `lang` | `'zh'` \| `'en'` | 默认 `zh` |
| `draft` | boolean | 默认 `false`；生产构建不输出，dev 可见 |
| `source` | `{ type: 'feishu', url, docToken, importedAt }` | 可选，导入程序写入 |

正文标题从 `##` 开始（`#` 由页面标题占用）。目录由 `render()` 返回的 headings（depth 2–3）生成，少于 2 个则不显示。宽屏（≥1180px）显示为正文左侧的吸附式侧栏（`.toc-side`，可收起，状态存 localStorage `site-toc`，当前章节高亮，脚本 `src/scripts/toc.ts`）；窄屏显示为正文上方的折叠目录，读过它之后右下角出现目录按钮（`.toc-fab`），点开是底部弹出面板（`.toc-sheet`），同样高亮当前章节。

### fs-grid（飞书分栏）

导入程序输出 HTML 与 Markdown 交错的结构，**空行必不可少**，否则里面的 Markdown 不会被解析（图片也就不会被优化）：

```html
<div class="fs-grid">
<div class="fs-col" style="--fs-ratio: 0.51">

![alt](./images/a.png)

</div>
<div class="fs-col" style="--fs-ratio: 0.49">

![alt](./images/b.png)

</div>
</div>
```

桌面端按 `--fs-ratio` 横向并排（间距 12px），宽度 < 640px 纵向堆叠。样式在 `global.css` 的 `.fs-grid` / `.fs-col`。已验证（Astro 7 + Sätteri）：输出 HTML 结构正确，栏内图片走 `/_astro/*.webp` 优化。

### callout（飞书高亮块）

同样的空行交错写法：

```html
<aside class="callout" data-kind="info">

**提示**　正文，支持 Markdown。

</aside>
```

`data-kind` 支持 `info`（默认）、`tip`/`success`、`warning`、`danger`/`error`。

### 图片

`alt` 可能很长（一两百字描述），只作为替代文本，不显示为图注。样式：`max-width: 100%`、圆角、细边框、居中。

## 派生端点

- `/posts/<slug>.md`：原始 Markdown（含 frontmatter），`text/markdown; charset=utf-8`。读取源文件，并把 `./images/x.png` 改写成绝对 URL，指向 Vite 输出到 `/_astro/` 的**原图**（`import.meta.glob` 取得，构建后形如 `https://example.com/_astro/x.<hash>.png`；不是优化后的 webp）。dev 下用当前 origin。
- `/rss.xml`：全文。用 Container API 渲染 `render()` 的 `Content`（得到图片已优化的 HTML），再把站内绝对路径补全为完整 URL，并经 sanitize-html 清理。
- `/llms.txt`：站点简介 + 每篇文章标题、描述、`.md` 链接。
- `/sitemap-index.xml`：`@astrojs/sitemap`（仅构建/预览产出，dev 下没有）。

## 显示设置

`src/site.config.ts` 的 `displaySettings: true` 控制导航栏齿轮按钮 + 弹出面板（布局 A/B/C、字体、主题、标志），设置存 localStorage（键 `site-display`），`BaseLayout` 的 `<head>` 内联脚本在首屏绘制前写入 `<html data-*>`。布局 A 没有导航，页脚有“显示设置”入口。设为 `false` 时不渲染按钮与面板，使用 `displayDefaults`（导航栏主题循环按钮仍可用，仅持久化主题）。

## 注意

- Astro 7 默认用 Sätteri 处理 Markdown（不是 remark/rehype）；需要 remark/rehype 插件时要换 `unified()` 处理器。
- `z` 从 `astro/zod` 导入；`render` 从 `astro:content` 导入。
- 字体自托管（`@fontsource*`），不要引入 Google Fonts。

## 飞书导入

纯规则转换，不依赖 AI。读取依赖本机 `lark-cli` 的登录态（`lark-cli auth status` 检查；默认 `--as user`）。

```bash
npm run import:feishu -- "<飞书 docx 链接>" --slug my-post --tags "标签1,标签2"
npm run import:feishu -- "<同一链接>"            # 再次导入 = 更新原文章
npm run import:feishu -- "<链接>" --dry-run      # 只打印结果，不写文件
```

- 输出：`src/content/posts/<slug>/index.md` + `images/<飞书图片 token>.<ext>`。
- 幂等：按 frontmatter 里的 `source.docToken` 找到已导入的文章并覆盖；保留原有 slug、date、tags、description；删除文档里已不存在的图片。从飞书导入的文章只在飞书里改，网站侧手改会在下次导入时被覆盖。
- 更新日期：重新导入时正文有变化，自动写入 `updated: 今天`（本机时区）；正文没变则沿用原值。
- 元数据：标题取飞书文档标题；日期优先级 `--date` > 已有值 > 文首“时间戳 2026.10.01”引用块（导入后从正文移除）> 今天；description 默认取开头段落。
- 数据源是 `lark-cli docs +fetch` 的 XML（比 Markdown 导出更完整，含分栏和图片 token）。映射：h1→`##`（标题整体降一级）、引用块内连续段落→硬换行、分栏→`fs-grid`、高亮块→`aside.callout`、表格→GFM 表格（合并单元格会展开并告警）、行首 `1.`/`#`/`-` 等会被转义、`**` 在中文标点边界无法闭合时改用 `<strong>`、裸链接写成 `<url>`。
- 间距遵循飞书：作者在飞书里插入的空段落输出为 `<div class="fs-gap"></div>`（一行高的空白，首尾的会去掉）；`source.type: feishu` 的文章块间距收紧为 8px（样式见 `.prose[data-source="feishu"]`）。`.md` 端点会去掉这些占位。
- 有序列表编号：带 `seq` 的项从该数字重新开始；自动编号的项接着同一容器里上一个有序列表续号（中间隔着段落也续），遇到标题重置为 1（经验规则）。lark-cli 的 `seq-marker` 不考虑续号，不使用。
- 遇到未识别的飞书块会输出 `⚠` 告警并保留文字，不会静默丢弃。


## 站内搜索

- Pagefind（`astro-pagefind` 集成），`npm run build` 后自动生成 `dist/pagefind/` 索引；只收录带 `data-pagefind-body` 的内容（目前是文章正文），目录用 `data-pagefind-ignore` 排除，标题来自 `data-pagefind-meta="title"`。
- UI 是自写的对话框：`src/components/SearchButton.astro`、`SearchDialog.astro`、`src/scripts/search.ts`。入口：导航栏放大镜、布局 A 的页脚“搜索”、⌘K / Ctrl+K、`/`。
- 开发模式读取的是上一次构建的索引；新增文章后要在本地搜到，需先 `npm run build`。

## 管理后台（Sveltia CMS）

- 入口 `/admin`（`public/admin/index.html` + `config.yml`）。可编辑：`src/data/site.json`（网站名、简介、导航、社交链接、首页区块顺序/显隐）、`src/data/videos.json`、`src/content/posts/`。保存即向 GitHub 提交 commit，Vercel 自动重建。
- `backend.branch` 是 `main`：后台保存会直接触发生产部署。
- GitHub 登录：Cloudflare Worker `sveltia-cms-auth`（`config.yml` 的 `backend.base_url`），变量 `GITHUB_CLIENT_ID`、`ALLOWED_DOMAINS` 为明文，`GITHUB_CLIENT_SECRET` 为加密 secret（不入库）。新增可访问域名时要同步更新 `ALLOWED_DOMAINS`。OAuth App 回调地址为 `https://sveltia-cms-auth.<子域>.workers.dev/callback`，配置步骤见 docs/DEPLOY.md。
