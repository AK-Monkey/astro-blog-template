// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import pagefind from 'astro-pagefind';

// https://astro.build/config
export default defineConfig({
  site: 'https://example.com',
  integrations: [sitemap(), pagefind()],
  markdown: {
    // 亮/暗双主题：defaultColor: false 时只输出 --shiki-light / --shiki-dark 变量，
    // 由 global.css 根据 data-theme 与系统设置选择。
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    },
  },
});
