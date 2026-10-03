// 邮箱不以明文出现在 HTML 里：构建时把地址反转后 base64 编码，访客点击后由 src/scripts/mail.ts 解码显示。
// 只能挡住按正则抓取明文邮箱的简单爬虫，挡不住会执行 JS 的爬虫。

export const isMail = (href = '') => href.startsWith('mailto:');

export const encodeMail = (href: string) =>
  Buffer.from([...href.replace(/^mailto:/, '')].reverse().join(''), 'utf8').toString('base64');
