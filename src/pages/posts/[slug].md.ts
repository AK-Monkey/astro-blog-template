import type { APIRoute, GetStaticPaths } from 'astro';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getPosts } from '../../lib/posts';

/**
 * /posts/<slug>.md —— 返回文章原始 Markdown（含 frontmatter）。
 *
 * 正文里的相对图片路径（./images/x.png）在纯文本里会失效，
 * 这里改写成构建后可访问的绝对 URL：
 * 用 import.meta.glob 导入 images/ 下的原图，Vite 会把它们按内容哈希输出到 /_astro/ 下，
 * 拿到的 src 就是原图的最终地址（不是 webp 优化版本，但稳定且无需额外复制）。
 */
const images = import.meta.glob<{ src: string }>(
  '/src/content/posts/*/images/*.{png,jpg,jpeg,gif,webp,avif,svg}',
  { eager: true, import: 'default' },
);

export const getStaticPaths = (async () => {
  const posts = await getPosts();
  return posts.map((post) => ({ params: { slug: post.id }, props: { filePath: post.filePath } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params, props, site, url }) => {
  const slug = params.slug as string;
  const filePath = props.filePath as string | undefined;
  if (!filePath) return new Response('Not found', { status: 404 });

  const raw = await readFile(path.resolve(process.cwd(), filePath), 'utf8');
  // 生产环境用站点域名；开发环境用当前访问的 origin，方便本地查看
  const origin = import.meta.env.DEV ? url.origin : (site ?? url).origin;

  const body = raw.replace(
    /(\]\(\s*<?|\bsrc=["']|\bhref=["'])(?:\.\/)?(images\/[^\s)"'>]+)/g,
    (match, prefix: string, rel: string) => {
      let name = rel;
      try {
        name = decodeURI(rel);
      } catch {
        // 保持原样
      }
      const asset = images[`/src/content/posts/${slug}/${name}`];
      return asset ? `${prefix}${new URL(asset.src, origin).href}` : match;
    },
  );

  // 飞书空段落占位只服务于网页排版，纯文本版去掉，避免干扰阅读
  const text = body.replace(/\n*<div class="fs-gap"><\/div>\n*/g, '\n\n');

  return new Response(text, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
