import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { render } from 'astro:content';
import sanitizeHtml from 'sanitize-html';
import { siteConfig } from '../site.config';
import { getPosts, postDescription, postPath } from '../lib/posts';

export async function GET(context: APIContext) {
  const site = context.site ?? new URL(siteConfig.siteUrl);
  const posts = await getPosts();
  // 官方示例用 markdown-it 重新解析 post.body，但那样相对图片路径和 HTML 块不会被处理；
  // 这里用 Container API 渲染 render() 得到的 Content，拿到的是 Astro 实际输出的 HTML（图片已优化）。
  const container = await AstroContainer.create();

  const items = await Promise.all(
    posts.map(async (post) => {
      const { Content } = await render(post);
      const html = await container.renderToString(Content);
      // 站内绝对路径（/_astro/...、/posts/...）补全成完整 URL
      const absolute = html.replace(/\b(src|href)="\/(?!\/)/g, `$1="${site.origin}/`);
      return {
        title: post.data.title,
        pubDate: post.data.date,
        description: postDescription(post),
        link: postPath(post.id),
        categories: post.data.tags,
        content: sanitizeHtml(absolute, {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'aside', 'figure', 'figcaption']),
          allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            img: ['src', 'alt', 'width', 'height'],
          },
        }),
      };
    }),
  );

  return rss({
    title: siteConfig.title,
    description: siteConfig.description,
    site,
    items,
    customData: '<language>zh-cn</language>',
  });
}
