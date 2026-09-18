let items = [];
let index = 0;
let root = null;
let trigger = null;
let touchStartX = 0;

function ensureDom() {
  if (root) return root;
  root = document.createElement('div');
  root.className = 'lightbox';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', '作品预览');
  root.hidden = true;
  root.innerHTML = `
    <div class="lightbox-backdrop" data-close></div>
    <figure class="lightbox-figure">
      <img class="lightbox-img" alt="">
      <figcaption class="lightbox-caption"></figcaption>
    </figure>
    <button class="lightbox-btn lightbox-prev" aria-label="上一张">‹</button>
    <button class="lightbox-btn lightbox-next" aria-label="下一张">›</button>
    <button class="lightbox-btn lightbox-close" aria-label="关闭" data-close>×</button>
    <div class="lightbox-counter" aria-live="polite"></div>
  `;
  document.body.append(root);
  root.querySelector('.lightbox-prev').addEventListener('click', prev);
  root.querySelector('.lightbox-next').addEventListener('click', next);
  root.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
  root.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  root.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) >= 40) (dx < 0 ? next : prev)();
  }, { passive: true });
  document.addEventListener('keydown', onKey);
  return root;
}

function onKey(e) {
  if (!root || root.hidden) return;
  if (e.key === 'Escape') { e.preventDefault(); close(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
  else if (e.key === 'Tab') { trapFocus(e); }
}

function trapFocus(e) {
  const f = root.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])');
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function render() {
  const it = items[index];
  const img = root.querySelector('.lightbox-img');
  img.src = it.src;
  img.srcset = it.srcset || '';
  img.alt = it.alt || '';
  img.width = it.width; img.height = it.height;
  root.querySelector('.lightbox-caption').textContent = it.alt || '';
  root.querySelector('.lightbox-counter').textContent = `${index + 1} / ${items.length}`;
}

export function openLightbox(list, i = 0, triggerEl = null) {
  items = list; index = i; trigger = triggerEl || document.activeElement;
  ensureDom();
  root.hidden = false;
  document.body.style.overflow = 'hidden';
  render();
  root.querySelector('.lightbox-close').focus();
}
export function closeLightbox() {
  if (!root) return;
  root.hidden = true;
  document.body.style.overflow = '';
  if (trigger && typeof trigger.focus === 'function') trigger.focus();
}
export function nextLightbox() { index = (index + 1) % items.length; render(); }
export function prevLightbox() { index = (index - 1 + items.length) % items.length; render(); }
export function getLightboxState() { return { open: !!root && !root.hidden, index, count: items.length }; }

// auto-bind: any element with data-lightbox-index inside container
export function bindGallery(container, list) {
  container.querySelectorAll('[data-lightbox-index]').forEach(el => {
    el.addEventListener('click', () => openLightbox(list, Number(el.dataset.lightboxIndex), el));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(list, Number(el.dataset.lightboxIndex), el); } });
  });
}

const next = nextLightbox, prev = prevLightbox, close = closeLightbox;
