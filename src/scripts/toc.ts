// 文章目录交互：
// - 宽屏侧栏：展开/收起（记住状态）
// - 窄屏：右下角按钮打开底部目录面板
// - 两处共用：当前章节高亮
// 布局与过渡动画在 global.css 的“侧边目录”“窄屏目录”两节。

const root = document.documentElement;
const KEY = 'site-toc';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// ---------- 宽屏侧栏：展开/收起 ----------
const side = document.querySelector<HTMLElement>('.toc-side');
const sidePanel = side?.querySelector<HTMLElement>('.toc-side-panel');
if (side && sidePanel) {
  const toggle = side.querySelector<HTMLButtonElement>('[data-toc-toggle]')!;
  const sync = () => {
    const collapsed = root.dataset.toc === 'collapsed';
    const label = collapsed ? '展开目录' : '收起目录';
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.title = label;
    toggle.setAttribute('aria-label', label);
    sidePanel.inert = collapsed;
  };
  sync();
  toggle.addEventListener('click', () => {
    const collapsed = root.dataset.toc !== 'collapsed';
    if (collapsed) root.dataset.toc = 'collapsed';
    else delete root.dataset.toc;
    try {
      localStorage.setItem(KEY, collapsed ? 'collapsed' : 'open');
    } catch {}
    sync();
  });
  // 首屏按保存的状态直接呈现，之后的切换才有过渡动画
  requestAnimationFrame(() => requestAnimationFrame(() => (root.dataset.tocReady = '')));
}

// ---------- 窄屏：目录按钮 + 底部面板 ----------
const sheet = document.getElementById('toc-sheet');
const fab = document.querySelector<HTMLButtonElement>('[data-toc-sheet-open]');
const sheetList = sheet?.querySelector<HTMLElement>('.toc-sheet-list');

const isSheetOpen = () => 'tocSheet' in root.dataset;

function openSheet() {
  if (!sheet || !fab || isSheetOpen()) return;
  root.dataset.tocSheet = '';
  fab.setAttribute('aria-expanded', 'true');
  sheet.inert = false;
  // 打开时让当前章节出现在面板可视区
  const active = sheetList?.querySelector<HTMLElement>('a.is-active');
  if (sheetList && active) sheetList.scrollTop = active.offsetTop - sheetList.clientHeight / 3;
  sheet.querySelector<HTMLElement>('.toc-sheet-close')?.focus({ preventScroll: true });
}

function closeSheet(restoreFocus = true) {
  if (!sheet || !fab || !isSheetOpen()) return;
  delete root.dataset.tocSheet;
  fab.setAttribute('aria-expanded', 'false');
  sheet.inert = true;
  if (restoreFocus) fab.focus({ preventScroll: true });
}

if (sheet && fab) {
  sheet.inert = true;
  fab.addEventListener('click', openSheet);
  sheet.addEventListener('click', (e) => {
    const target = e.target as Element;
    if (target.closest('[data-toc-sheet-close]')) {
      closeSheet();
      return;
    }
    const link = target.closest<HTMLAnchorElement>('a[href^="#"]');
    if (!link) return;
    // 先收起面板，再滚动到目标，避免面板遮挡或滚动被打断
    e.preventDefault();
    closeSheet(false);
    const id = decodeURIComponent(link.hash.slice(1));
    const dest = document.getElementById(id);
    requestAnimationFrame(() => {
      dest?.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', link.hash);
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isSheetOpen()) closeSheet();
  });

  // 读过正文上方的目录后，才显示右下角按钮
  const inlineToc = document.querySelector<HTMLElement>('.post-layout > .toc');
  if (inlineToc && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      const passed = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      if (passed) root.dataset.tocFab = '';
      else delete root.dataset.tocFab;
    }).observe(inlineToc);
  } else {
    root.dataset.tocFab = '';
  }
}

// ---------- 当前章节高亮（侧栏与底部面板共用） ----------
const allLinks = [...document.querySelectorAll<HTMLAnchorElement>('.toc-links a[data-toc-link]')];
const ids = [...new Set(allLinks.map((a) => a.dataset.tocLink!))];
const heads = ids.map((id) => document.getElementById(id)).filter((h): h is HTMLElement => h !== null);
let currentId: string | undefined;
let ticking = false;

function update() {
  ticking = false;
  const line = Math.min(140, window.innerHeight * 0.25);
  let idx = -1;
  for (let i = 0; i < heads.length; i++) {
    if (heads[i].getBoundingClientRect().top - line <= 0) idx = i;
    else break;
  }
  // 滚到底部时高亮最后一节（最后几节可能太短，标题到不了阅读线）
  if (heads.length && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) idx = heads.length - 1;
  const nextId = idx >= 0 ? heads[idx].id : undefined;
  if (nextId === currentId) return;
  currentId = nextId;
  for (const a of allLinks) {
    const on = a.dataset.tocLink === currentId;
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'location');
    else a.removeAttribute('aria-current');
  }
  // 侧栏很长时，让高亮项保持在可视区（只滚动侧栏；用瞬时滚动，避免打断页面的平滑滚动）
  const active = sidePanel?.querySelector<HTMLElement>('a.is-active');
  if (sidePanel && active && sidePanel.offsetParent) {
    const top = active.offsetTop - sidePanel.offsetTop;
    if (top < sidePanel.scrollTop + 24 || top > sidePanel.scrollTop + sidePanel.clientHeight - 48) {
      sidePanel.scrollTop = top - sidePanel.clientHeight / 3;
    }
  }
}

if (heads.length) {
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
}
