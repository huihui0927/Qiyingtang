// 首页两处 CMS 区块：「精选作品」图片墙 + 「客片故事」，都接 /api/home。
// 接口不可用 / 未配置时保留 index.html 里的静态兜底，绝不白屏。
import { bindGallery } from './lightbox.js';

const PAGE = { portrait: 'portrait.html', wedding: 'wedding.html', event: 'event.html' };

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// —— 精选作品：等高图片墙 ——
// 每行张数跟视口走；末行不满时把各行拉匀（宁可每行 4/3/3，也不要 4/4/2 那种半行空白）。
export function perRowFor(viewportWidth) {
  if (viewportWidth < 640) return 2;
  if (viewportWidth < 900) return 3;
  return 4;
}
export function bentoRows(n, perRow) {
  if (n <= 0 || perRow <= 0) return [];
  const rows = Math.ceil(n / perRow);
  const base = Math.floor(n / rows);
  const extra = n % rows;
  return Array.from({ length: rows }, (_, i) => base + (i < extra ? 1 : 0));
}

let bentoItems = [];
let bentoPerRow = 0;

function bentoCell(item, i) {
  const label = esc(item.alt || item.title || '作品');
  return `<button class="bento-cell${i === 0 ? ' bento-lead' : ''}" type="button" data-lightbox-index="${i}" aria-label="查看作品：${label}">
    <img src="${esc(item.thumb)}" data-full="${esc(item.src)}" alt="${label}" width="${Number(item.width) || 1280}" height="${Number(item.height) || 854}" loading="${i < 4 ? 'eager' : 'lazy'}" decoding="async">
    <span class="bento-cap">${esc(item.title)}</span>
  </button>`;
}

function drawBento(box) {
  const perRow = perRowFor(innerWidth);
  if (!bentoItems.length) return;
  bentoPerRow = perRow;
  let i = 0;
  box.className = 'bento bento--rows';
  box.innerHTML = bentoRows(bentoItems.length, perRow)
    .map(count => `<div class="bento-row">${bentoItems.slice(i, i + count).map(it => bentoCell(it, i++)).join('')}</div>`)
    .join('');
  bindGallery(box, bentoItems);
}

// 静态兜底：直接读 index.html 里写死的那几格，避免同一批图在 HTML 和 JS 里各存一份。
function collectStatic(box) {
  return [...box.querySelectorAll('.bento-cell')].map(btn => {
    const img = btn.querySelector('img');
    if (!img) return null;
    return {
      src: img.getAttribute('data-full') || img.getAttribute('src'), thumb: img.getAttribute('src'),
      alt: img.getAttribute('alt') || '', title: (btn.querySelector('.bento-cap')?.textContent || img.getAttribute('alt') || '').trim(),
      width: Number(img.getAttribute('width')) || 0, height: Number(img.getAttribute('height')) || 0,
    };
  }).filter(Boolean);
}

function setBento(photos) {
  const box = document.getElementById('bento');
  if (!box) return;
  bentoItems = photos.length ? photos : collectStatic(box);
  drawBento(box);
}

addEventListener('resize', () => {
  const box = document.getElementById('bento');
  if (box && perRowFor(innerWidth) !== bentoPerRow) drawBento(box);
});

// —— 客片故事：三列卡片 ——
function storyCard(s, i) {
  const issue = s.shoot_date ? esc(s.shoot_date) : String(i + 1).padStart(2, '0');
  const meta = [s.subtitle, s.location].filter(Boolean).map(esc).join(' · ');
  const title = String(s.title || '').trim();
  // 后台的「简介」经常和标题填成同一句话，重复一遍只会让卡片显得没内容
  const lede = s.description && String(s.description).trim() !== title
    ? `<p class="lede">${esc(s.description)}</p>` : '';
  const media = s.cover
    ? `<div class="story-card-media"><img src="${esc(s.cover)}" alt="${esc(s.title)}" loading="lazy"></div>` : '';
  return `<article class="story-card">
    ${media}
    <div class="story-card-body">
      <span class="issue" lang="en">${issue}</span>
      <h3 lang="zh-CN">${esc(s.title)}</h3>
      ${meta ? `<p class="meta">${meta}</p>` : ''}
      ${lede}
      <a class="view-story" href="${PAGE[s.category] || 'index.html'}"><span lang="en">View Story</span> →</a>
    </div>
  </article>`;
}

export async function initHomeCMS() {
  const box = document.getElementById('bento');
  const storiesBox = document.getElementById('client-stories');
  if (box) setBento([]);                       // 先按后台数据之外的静态 3 张把版式立起来
  let data;
  try {
    const res = await fetch('/api/home', { credentials: 'same-origin' });
    if (!res.ok) return;                       // 后台不可用 → 保留静态兜底
    data = await res.json();
  } catch { return; }

  const photos = Array.isArray(data && data.photos) ? data.photos : [];
  if (photos.length) {
    setBento(photos.map(p => ({
      src: p.image, thumb: p.thumbnail || p.image, alt: p.alt_text || p.title,
      title: p.title || p.alt_text || '', width: p.width, height: p.height,
    })));
  }

  const stories = Array.isArray(data && data.stories) ? data.stories : [];
  if (storiesBox && stories.length) storiesBox.innerHTML = stories.map(storyCard).join('');
}
