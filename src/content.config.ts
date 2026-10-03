import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * posts：src/content/posts/<slug>/index.md
 * 每篇一个文件夹，图片放同目录 images/，正文用相对路径 ![alt](./images/x.png) 引用。
 * 这是与导入程序的契约，修改前请同步 AGENTS.md。
 */
const posts = defineCollection({
  loader: glob({
    pattern: '*/index.md',
    base: './src/content/posts',
    // 条目 id = 文件夹名 = URL slug
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).default([]),
    lang: z.enum(['zh', 'en']).default('zh'),
    draft: z.boolean().default(false),
    source: z
      .object({
        type: z.literal('feishu'),
        url: z.string(),
        docToken: z.string(),
        importedAt: z.string(),
      })
      .optional(),
  }),
});

export const collections = { posts };
