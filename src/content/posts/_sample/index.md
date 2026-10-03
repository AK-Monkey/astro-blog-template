---
title: 示例文章：排版自测
date: 2026-10-01
updated: 2026-10-02
description: 用于自测排版与导入契约的示例文章，draft 为 true，仅开发模式可见。
tags:
  - 示例
  - 排版
lang: zh
draft: true
---

这是一段引言，用来检查正文字体在中英混排（比如 Astro、Vercel、2026 年）时的效果。This paragraph mixes English words to check how Latin and CJK glyphs sit together on the same line. 这里有 **粗体文字**、`行内代码`，以及一个[普通链接](https://astro.build)。

## 二级标题：段落与引用

第二段正文。正文行高 1.8，段与段之间留出固定间距，方便长时间阅读。中文标点“引号”、《书名号》和（括号）也一并检查。

> 最好的写作工具，是你已经打开着的那个。

### 三级标题：列表

无序列表：

- 高亮块 → 提示框
- 画板 → 导出成图片
- 公式 → KaTeX 渲染

有序列表：

1. 在飞书里写作
2. 粘贴链接，触发导入
3. 等待一两分钟，文章出现在网站上

## 表格

| 飞书元素 | 网站呈现 | 备注 |
| --- | --- | --- |
| 高亮块 | callout 提示框 | 使用 `aside.callout` |
| 分栏 | fs-grid 并排布局 | 窄屏纵向堆叠 |
| 画板 | 图片 | 导出为 PNG，放在 images 目录下，文件名带有较长的描述，用来检查表格横向滚动是否只发生在容器内 |

## 代码

```bash
npm run dev
# 导入后的文章位于 src/content/posts/<slug>/index.md
echo "hello world"
```

## 分栏与图片

下面是一个两栏的 fs-grid，图片 alt 很长，但不应显示为图注：

<div class="fs-grid">
<div class="fs-col" style="--fs-ratio: 0.51">

![这是一张橙色渐变的测试图片。为了模拟导入程序生成的长描述，这里的 alt 文本被刻意写得很长：画面从左上角的深橙色逐渐过渡到右下角的浅杏色，没有任何文字或图形元素，仅用于验证分栏布局、图片优化以及 alt 文本不会被当作图注显示。](./images/a.png)

</div>
<div class="fs-col" style="--fs-ratio: 0.49">

![一张蓝色渐变的测试图片，与左侧橙色图片并排显示。](./images/b.png)

</div>
</div>

单独一张图片：

![橙色渐变测试图片](./images/a.png)

## 提示框

<aside class="callout" data-kind="info">

**提示**　这是飞书“高亮块”在网站上的样子，支持 Markdown，比如 `行内代码` 和[链接](https://astro.build)。

</aside>

<aside class="callout" data-kind="warning">

**注意**　这是 warning 类型的提示框。

</aside>

以上内容仅用于排版自测。
