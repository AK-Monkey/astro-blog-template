import { getCollection, type CollectionEntry } from 'astro:content';
import { siteConfig } from '../site.config';

export type Post = CollectionEntry<'posts'>;

/** 开发模式显示 draft，生产构建不显示。按日期倒序。 */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export const postPath = (id: string) => `/posts/${id}/`;
export const postMdPath = (id: string) => `/posts/${id}.md`;

export const absoluteUrl = (path: string, site?: URL | string) => new URL(path, site ?? siteConfig.siteUrl).href;

/** YYYY-MM-DD（frontmatter 日期按 UTC 解析，所以也按 UTC 输出） */
export const formatDate = (d: Date) => d.toISOString().slice(0, 10);

/** 去掉代码块、图片、HTML 标签和 Markdown 标记，得到近似纯文本。 */
export function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_`~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 预计阅读分钟数：中文 ~400 字/分钟，英文 ~220 词/分钟，至少 1。 */
export function readingMinutes(markdown: string): number {
  const text = plainText(markdown);
  const cjk = (text.match(/[㐀-鿿豈-﫿]/g) ?? []).length;
  const words = (text.replace(/[㐀-鿿豈-﫿]/g, ' ').match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) ?? []).length;
  return Math.max(1, Math.round(cjk / 400 + words / 220));
}

/** 描述：优先用 frontmatter，其次取正文开头的纯文本。 */
export function postDescription(post: Post, max = 110): string {
  if (post.data.description) return post.data.description;
  const text = plainText(post.body ?? '');
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}
