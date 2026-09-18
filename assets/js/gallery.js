import { initFilter } from './filter.js';
import { bindGallery } from './lightbox.js';
import { initReveal } from './reveal.js';

export async function mountGallery({ mountEl, filterEl, dataUrl, emptyText = '暂无作品' }) {
  const res = await fetch(dataUrl);
  if (!res.ok) throw new Error(`failed to load ${dataUrl}: ${res.status}`);
  const { items } = await res.json();

  function render(list) {
    mountEl.innerHTML = '';
    if (!list.length) {
      const p = document.createElement('p');
      p.className = 'gallery-empty';
      p.textContent = emptyText;
      mountEl.append(p);
      return;
    }
    const grid = document.createElement('div');
    grid.className = 'gallery-grid';
    list.forEach((it, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gallery-item';
      btn.dataset.lightboxIndex = String(i);
      btn.setAttribute('aria-label', `\u67E5\u770B\u5927\u56FE\uFF1A${it.alt}`);
      btn.innerHTML = `<img src="${it.thumb}" srcset="${it.srcset}" sizes="(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 25vw" alt="${it.alt}" loading="lazy" decoding="async" width="${it.width}" height="${it.height}">`;
      grid.append(btn);
    });
    mountEl.append(grid);
    bindGallery(grid, list);
    initReveal(grid);
  }

  initFilter({ container: filterEl, items, render, paramKey: 'style' });
}
