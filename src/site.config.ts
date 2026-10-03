import site from './data/site.json';

/**
 * 站点配置：集中管理名称、导航、社交链接与显示设置默认值。
 */

export type Layout = 'a' | 'b' | 'c';
export type FontMode = 'serif' | 'sans' | 'mix';
export type ThemeMode = 'auto' | 'light' | 'dark';
export type LogoMode = 'on' | 'off';

export interface DisplayDefaults {
  /** a：无导航、居中；b：顶部导航、左对齐；c：顶部导航、居中 */
  layout: Layout;
  /** serif：全衬线；sans：全无衬线；mix：衬线标题 + 无衬线正文 */
  font: FontMode;
  /** auto：跟随系统 */
  theme: ThemeMode;
  logo: LogoMode;
}

export type SocialIcon = 'rss' | 'github' | 'x' | 'telegram' | 'wechat' | 'bilibili' | 'mail';

export interface SocialLink {
  label: string;
  icon: SocialIcon;
  /** 为空或为 '#' 且没有二维码时，该条目不显示 */
  href?: string;
  /** 二维码图片（如微信公众号）：有值时图标点击弹出二维码 */
  qrcode?: string;
  /** 二维码下方的说明文字 */
  note?: string;
}

/** 首页区块：顺序即显示顺序，enabled 为 false 时隐藏 */
export interface HomeSection {
  type: 'intro' | 'posts' | 'videos';
  title?: string;
  enabled: boolean;
  limit?: number;
}

/**
 * 可在 /admin 后台编辑的内容（名称、简介、导航、社交链接、首页区块）在 src/data/site.json；
 * 这里只放和代码相关的设置，并把两者合并成 siteConfig。
 */
const raw = site as Partial<{
  name: string;
  tagline: string;
  description: string;
  author: string;
  postsLabel: string;
  intro: string;
  about: string;
  nav: { label: string; href: string }[];
  socials: SocialLink[];
  home: HomeSection[];
}>;
const text = (v?: string) => (v ?? '').trim();
const name = text(raw.name);
const tagline = text(raw.tagline);

/**
 * 后台里这些字段都可以留空：页面上为空就不显示；
 * <title>、RSS、结构化数据等必须有值的地方用 title / description / author 的回退值。
 */
export const siteConfig = {
  name,
  tagline,
  /** 一定有值的站点标题：网站名为空时用域名 */
  title: name || 'example.com',
  description: text(raw.description) || tagline || name || 'example.com',
  author: text(raw.author) || name || 'example.com',
  /** 内容栏目名称（导航、列表页、“全部…”链接、搜索框等处统一使用） */
  postsLabel: text(raw.postsLabel) || '手记',
  intro: text(raw.intro),
  about: text(raw.about),
  nav: raw.nav ?? [],
  socials: raw.socials ?? [],
  home: raw.home ?? [],
  siteUrl: 'https://example.com',

  /**
   * 是否启用“显示设置”（导航栏齿轮按钮 + 弹出面板 + localStorage 持久化）。
   * 关闭后不渲染按钮，布局/字体/标志固定使用 displayDefaults。
   * 导航栏里的主题循环按钮不受影响。
   */
  displaySettings: true,

  displayDefaults: {
    layout: 'c',
    font: 'mix',
    theme: 'auto',
    logo: 'on',
  } satisfies DisplayDefaults,

  /** localStorage 键名 */
  storageKey: 'site-display',
};

export type SiteConfig = typeof siteConfig;
