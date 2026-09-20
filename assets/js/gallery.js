import { initFilter } from './filter.js';
import { bindGallery } from './lightbox.js';
import { initReveal } from './reveal.js';

// 画廊数据加载：优先后台 API（/api/gallery/{cat}，唯一来源），
// 若接口不可用 / 返回非 2xx / items 为空（如线上 D1 尚未迁移）→ 回落历史静态 JSON。
export async function fetchGallery({ apiUrl, dataUrl }) {
  if (apiUrl) {
    try {
      const res = await fetch(apiUrl, { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items) && data.items.length) return data.items;
      }
    } catch (_) { /* 网络或解析失败，走回落 */ }
  }
  const res = await fetch(dataUrl);
  if (!res.ok) throw new Error(`failed to load ${dataUrl}: ${res.status}`);
  const { items } = await res.json();
  return items;
}

export async function mountGallery({ mountEl, filterEl, apiUrl, dataUrl, emptyText = '暂无作品' }) {
  const items = await fetchGallery({ apiUrl, dataUrl });

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
