import type { APIContext } from 'astro';
import { siteConfig } from '../site.config';
import { absoluteUrl, getPosts, postDescription, postMdPath } from '../lib/posts';

export async function GET(context: APIContext) {
  const site = context.site ?? siteConfig.siteUrl;
  const posts = await getPosts();

  const lines = [
    `# ${siteConfig.title}`,
    '',
    `> ${siteConfig.description}`,
    '',
    ...(siteConfig.tagline ? [siteConfig.tagline, ''] : []),
    `## ${siteConfig.postsLabel}`,
    '',
    ...(posts.length > 0
      ? posts.map((p) => {
          const desc = postDescription(p, 80).replace(/\s+/g, ' ');
          return `- [${p.data.title}](${absoluteUrl(postMdPath(p.id), site)})${desc ? `: ${desc}` : ''}`;
        })
      : ['（暂无）']),
    '',
    '## 其他',
    '',
    `- [RSS](${absoluteUrl('/rss.xml', site)}): 全文订阅`,
    `- [站点地图](${absoluteUrl('/sitemap-index.xml', site)})`,
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
