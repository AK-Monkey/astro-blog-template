// 站内搜索：Pagefind JS API + 自定义对话框。
// 打开方式：导航栏放大镜、页脚“搜索”、⌘K / Ctrl+K、在非输入状态下按 /。

type PagefindResult = { url: string; excerpt: string; meta: { title?: string } };
type Pagefind = {
  options: (o: Record<string, unknown>) => Promise<void>;
  debouncedSearch: (q: string, o?: object, ms?: number) => Promise<{ results: { data: () => Promise<PagefindResult> }[] } | null>;
};

const dialog = document.getElementById('site-search') as HTMLDialogElement | null;
const input = dialog?.querySelector<HTMLInputElement>('input[name="q"]');
const list = dialog?.querySelector<HTMLOListElement>('.search-results');
const status = dialog?.querySelector<HTMLElement>('.search-status');

let pagefind: Promise<Pagefind | null> | null = null;
let active = -1;

function loadPagefind() {
  pagefind ??= (async () => {
    try {
      const url = '/pagefind/pagefind.js';
      const pf = (await import(/* @vite-ignore */ url)) as Pagefind;
      await pf.options({ excerptLength: 28 });
      return pf;
    } catch {
      return null;
    }
  })();
  return pagefind;
}

function open() {
  if (!dialog || dialog.open) return;
  dialog.showModal();
  input?.select();
  loadPagefind();
}

function setActive(i: number) {
  const items = list ? [...list.querySelectorAll<HTMLAnchorElement>('a')] : [];
  if (!items.length) return;
  active = (i + items.length) % items.length;
  items.forEach((a, k) => a.setAttribute('aria-selected', String(k === active)));
  items[active].scrollIntoView({ block: 'nearest' });
}

async function run(q: string) {
  if (!list || !status) return;
  const query = q.trim();
  if (!query) {
    list.innerHTML = '';
    status.textContent = '';
    return;
  }
  const pf = await loadPagefind();
  if (!pf) {
    status.textContent = '搜索索引还没有生成（需要先运行一次 npm run build）。';
    return;
  }
  const search = await pf.debouncedSearch(query, {}, 150);
  if (!search) return; // 被更新的输入取代
  const data = await Promise.all(search.results.slice(0, 8).map((r) => r.data()));
  if (input && input.value.trim() !== query) return;
  status.textContent = data.length ? `找到 ${search.results.length} 条结果` : '没有找到相关内容';
  list.innerHTML = '';
  for (const r of data) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = r.url;
    const title = document.createElement('span');
    title.className = 'search-title';
    title.textContent = r.meta.title || r.url;
    const excerpt = document.createElement('span');
    excerpt.className = 'search-excerpt';
    excerpt.innerHTML = r.excerpt; // Pagefind 生成的摘要，只含 <mark>
    a.append(title, excerpt);
    li.append(a);
    list.append(li);
  }
  active = -1;
}

if (dialog && input) {
  input.addEventListener('input', () => run(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter') {
      const target = list?.querySelectorAll<HTMLAnchorElement>('a')[Math.max(active, 0)];
      if (target) { e.preventDefault(); location.href = target.href; }
    }
  });
  // 点击遮罩处关闭
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  document.addEventListener('click', (e) => {
    if ((e.target as Element).closest('[data-search-open]')) { e.preventDefault(); open(); }
  });
  document.addEventListener('keydown', (e) => {
    const typing = (e.target as HTMLElement).closest('input, textarea, [contenteditable="true"]');
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
      e.preventDefault();
      open();
    }
  });
}
