// 显示设置交互：主题循环、弹出面板、localStorage 持久化。
// 首屏绘制前的 data-* 设置由 BaseLayout 里的内联脚本完成，这里只处理交互。

const root = document.documentElement;
const KEYS = ['layout', 'font', 'theme', 'logo'] as const;
type Key = (typeof KEYS)[number];

const ALLOWED: Record<Key, string[]> = {
  layout: ['a', 'b', 'c'],
  font: ['serif', 'sans', 'mix'],
  theme: ['auto', 'light', 'dark'],
  logo: ['on', 'off'],
};
const THEME_LABEL: Record<string, string> = { auto: '跟随系统', light: '亮', dark: '暗' };

const storageKey = root.dataset.storageKey || 'site-display';
const settingsEnabled = root.dataset.displaySettings === 'true';

const state = {} as Record<Key, string>;
KEYS.forEach((k) => {
  state[k] = root.dataset[k] ?? ALLOWED[k][0];
});

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // 隐私模式等情况下忽略
  }
}

function apply() {
  KEYS.forEach((k) => {
    root.dataset[k] = state[k];
  });
  document.querySelectorAll<HTMLElement>('[data-set]').forEach((b) => {
    b.setAttribute('aria-pressed', String(state[b.dataset.set as Key] === b.dataset.val));
  });
  const label = `切换主题（当前：${THEME_LABEL[state.theme]}）`;
  document.querySelectorAll<HTMLElement>('[data-cycle-theme]').forEach((b) => {
    b.title = label;
    b.setAttribute('aria-label', label);
  });
}

function set(key: Key, val: string) {
  if (!ALLOWED[key]?.includes(val)) return;
  state[key] = val;
  apply();
  save();
  if (panel && !panel.hidden) place();
}

// ---------- 弹出面板 ----------
const panel = document.getElementById('display-settings') as HTMLElement | null;
let anchor: HTMLElement | null = null;

function place() {
  if (!panel || !anchor) return;
  let rect = anchor.getBoundingClientRect();
  if (rect.width === 0) {
    // 切换布局后，原触发按钮可能被隐藏（导航 <-> 页脚），改用当前可见的那个
    const visible = Array.from(document.querySelectorAll<HTMLElement>('[data-settings-toggle]')).find(
      (b) => b.getBoundingClientRect().width > 0,
    );
    if (!visible) {
      closePanel();
      return;
    }
    anchor = visible;
    setExpanded(true);
    rect = visible.getBoundingClientRect();
  }
  const sx = window.scrollX;
  const sy = window.scrollY;
  const gap = 8;
  const margin = 16;
  const w = panel.offsetWidth;
  const h = panel.offsetHeight;
  let left = rect.right + sx - w;
  left = Math.max(sx + margin, Math.min(left, sx + document.documentElement.clientWidth - w - margin));
  let top = rect.bottom + sy + gap;
  // 下方放不下（例如页脚里的按钮）就放到上方
  if (rect.bottom + gap + h > window.innerHeight && rect.top - gap - h > 0) {
    top = rect.top + sy - gap - h;
  }
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

function setExpanded(open: boolean) {
  document.querySelectorAll<HTMLElement>('[data-settings-toggle]').forEach((b) => {
    b.setAttribute('aria-expanded', String(open && b === anchor));
  });
}

function openPanel(from: HTMLElement) {
  if (!panel) return;
  anchor = from;
  panel.hidden = false;
  setExpanded(true);
  place();
}

function closePanel(restoreFocus = false) {
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  setExpanded(false);
  if (restoreFocus && anchor) anchor.focus();
}

document.addEventListener('click', (e) => {
  const target = e.target as Element | null;
  if (!target) return;

  const setBtn = target.closest<HTMLElement>('[data-set]');
  if (setBtn) {
    set(setBtn.dataset.set as Key, setBtn.dataset.val || '');
    return;
  }

  if (target.closest('[data-cycle-theme]')) {
    const order = ALLOWED.theme;
    set('theme', order[(order.indexOf(state.theme) + 1) % order.length]);
    return;
  }

  if (!settingsEnabled || !panel) return;

  const toggle = target.closest<HTMLElement>('[data-settings-toggle]');
  if (toggle) {
    if (!panel.hidden && anchor === toggle) closePanel();
    else openPanel(toggle);
    return;
  }
  if (target.closest('[data-settings-close]')) {
    closePanel(true);
    return;
  }
  if (!panel.hidden && !panel.contains(target)) closePanel();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePanel(true);
});
window.addEventListener('resize', () => {
  if (panel && !panel.hidden) place();
});

apply();
