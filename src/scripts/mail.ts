// 点击后才显示邮箱：解码 data-mail，填进弹窗或就地替换。编码方式见 src/lib/mail.ts。

const decode = (encoded: string) => {
  const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  return [...new TextDecoder().decode(bytes)].reverse().join('');
};

function fill(scope: ParentNode, addr: string) {
  scope.querySelectorAll<HTMLElement>('[data-mail-addr]').forEach((el) => (el.textContent = addr));
  scope.querySelectorAll<HTMLAnchorElement>('[data-mail-send]').forEach((a) => (a.href = `mailto:${addr}`));
}

document.addEventListener('click', async (e) => {
  const target = e.target as Element;

  const copy = target.closest<HTMLButtonElement>('[data-mail-copy]');
  if (copy) {
    const addr = copy.closest('[popover], .mail-reveal')?.querySelector('[data-mail-addr]')?.textContent ?? '';
    try {
      await navigator.clipboard.writeText(addr);
      copy.textContent = '已复制';
    } catch {
      copy.textContent = '复制失败，请手动选择';
    }
    setTimeout(() => (copy.textContent = '复制'), 1600);
    return;
  }

  const trigger = target.closest<HTMLElement>('[data-mail]');
  if (!trigger) return;
  const addr = decode(trigger.dataset.mail ?? '');
  const popoverId = trigger.getAttribute('popovertarget');
  if (popoverId) {
    // 弹窗由浏览器原生 popover 打开，这里只负责填内容
    const pop = document.getElementById(popoverId);
    if (pop) fill(pop, addr);
    return;
  }
  // 就地显示（链接页）
  const wrap = trigger.closest('.mail-reveal');
  if (wrap) {
    fill(wrap, addr);
    wrap.classList.add('revealed');
  }
});
