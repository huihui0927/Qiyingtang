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

// —— 客片故事：卡片模板 ——
// 后台的「简介」经常空着、或者跟标题填成同一句话；缺这一行的卡在画廊里会明显缺一块。
// 所以退而取正文的第一句（正文最长到两句），保证每张都有简介。
function pickLede(s) {
  const title = String(s.title || '').trim();
  const desc = String(s.description || '').trim();
  if (desc && desc !== title) return desc;
  const body = String(s.content || '').trim();
  if (!body) return '';
  const first = body.split('\n')[0].split(/(?<=[。！？])/).slice(0, 2).join('').trim();
  return first.length > 48 ? first.slice(0, 48) + '…' : first;
}

function storyCard(s, i) {
  const issue = s.shoot_date ? esc(s.shoot_date) : String(i + 1).padStart(2, '0');
  const meta = [s.subtitle, s.location].filter(Boolean).map(esc).join(' · ');
  const lede = pickLede(s);
  const media = s.cover
    ? `<div class="story-card-media"><img src="${esc(s.cover)}" alt="${esc(s.title)}" loading="lazy"></div>` : '';
  const href = PAGE[s.category] || 'index.html';
  // 整张卡就是一个链接：以前用 a::after 铺一层透明热区，但文字区一旦成为定位祖先，
  // 那层热区就只盖住标题以下，图片点不动。少一层 hack 少一类回归。
  return `<a class="story-card" href="${href}">
    ${media}
    <div class="story-card-body">
      <span class="issue" lang="en">${issue}</span>
      <h3 lang="zh-CN">${esc(s.title)}</h3>
      ${meta ? `<p class="meta">${meta}</p>` : ''}
      ${lede ? `<p class="lede">${esc(lede)}</p>` : ''}
      <span class="view-story"><span lang="en">View Story</span> →</span>
    </div>
  </a>`;
}

// —— 客片故事：扇形画廊 ——
// 弧线做法：每档水平位移 step，倾斜 tilt×档数，下沉 sink×档数²（浅弧的二次近似，
// 和 React Bits 那版 CircularGallery 用圆方程算出来的观感一致，但不需要 WebGL）。
// 所有监听都挂在画廊自己身上——页面别处滚动、别处按下拖动，都不会带动它。
const GALLERY_EASE = 0.14;
// 手指点一下也会漂七八像素：这个阈值卡太紧，拇指的点击会被全判成拖动（既不转卡也不跳转）。
const DRAG_SLOP = 10;

function num(v, fallback) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function createStoryGallery(root) {
  const viewport = root.querySelector('.story-viewport');
  const rail = root.querySelector('.story-cards');
  if (!viewport || !rail) return null;

  let cards = [];
  let step = 1, tilt = 0, sink = 0;
  let half = 1, wrap = false;
  let pos = 0, target = 0, raf = 0;
  let dragging = false, dragMoved = 0, dragStartX = 0, dragStartPos = 0, clickHold = 0;
  let captureId = 0;
  let wheelTimer = 0;

  const reduceMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  function measure() {
    const railW = viewport.clientWidth || 1;
    const cardW = cards[0].offsetWidth || 240;
    const css = getComputedStyle(root);
    const gap = num(css.getPropertyValue('--card-gap'), 0);
    tilt = num(css.getPropertyValue('--tilt'), 0);
    sink = num(css.getPropertyValue('--sink'), 0);
    step = cardW + gap || 1;
    // 还能露出一点边的最远档数；条数比这个窗口多出一整圈才能无缝循环，否则到头就停
    const visible = Math.ceil((railW / 2 + cardW / 2) / step);
    half = visible;
    wrap = cards.length > visible * 2 + 1;
  }

  // 把 i 相对中心位置的档距折到 [-n/2, n/2)，让两端相接看起来无限
  function fold(d) {
    const n = cards.length;
    return wrap ? ((d % n) + n * 1.5) % n - n / 2 : d;
  }

  function paint() {
    cards.forEach((card, i) => {
      const d = fold(i - pos);
      const ad = Math.abs(d);
      card.style.setProperty('--x', `${(d * step).toFixed(2)}px`);
      card.style.setProperty('--y', `${(sink * d * d).toFixed(2)}px`);
      card.style.setProperty('--rot', `${(tilt * d).toFixed(2)}deg`);
      card.style.setProperty('--s', (1 - 0.06 * Math.min(ad, 3)).toFixed(3));
      card.style.setProperty('--z', String(50 - Math.round(ad * 10)));
      card.style.visibility = ad > half + 0.5 ? 'hidden' : '';
      card.classList.toggle('is-active', ad < 0.5);
    });
  }

  function seek(v) {
    target = wrap ? v : Math.max(0, Math.min(cards.length - 1, v));
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function snap() { seek(Math.round(target)); }

  function tick() {
    raf = 0;
    const ease = reduceMotion() || dragging ? 1 : GALLERY_EASE;
    pos += (target - pos) * ease;
    if (Math.abs(target - pos) < 0.002) pos = target;
    paint();
    if (pos !== target) raf = requestAnimationFrame(tick);
  }

  function centerOf(card) {
    return pos + fold(cards.indexOf(card) - pos);
  }

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true; dragMoved = 0; captureId = 0;
    dragStartX = e.clientX; dragStartPos = target;
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - dragStartX;
    dragMoved = Math.max(dragMoved, Math.abs(dx));
    // 指针一按下就接管会连 click 一起改派到视口上，卡片这个 <a> 就永远点不动了。
    // 只有真的拖起来（手指会跑出视口）才需要接管——这时点击本来也要作废。
    if (dragMoved > DRAG_SLOP && !captureId) { captureId = e.pointerId; viewport.setPointerCapture(captureId); }
    seek(dragStartPos - dx / step);
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    if (dragMoved > DRAG_SLOP) clickHold = performance.now() + 400;   // 拖完这一下不算点击
    else snap();
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function onClick(e) {
    const card = e.target.closest('.story-card');
    if (!card) return;
    if (performance.now() < clickHold || dragging) { e.preventDefault(); return; }
    if (card.classList.contains('is-active')) return;         // 正中间那张照常跳转
    e.preventDefault();
    seek(centerOf(card));
  }

  function onWheel(e) {
    // 只有横向意图才归画廊：竖向滚轮照常滚页面，否则访客会被卡在首页这一栏里。
    const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY) || (e.shiftKey && e.deltaY);
    if (!horizontal) return;
    e.preventDefault();
    seek(target + (e.deltaX || e.deltaY) * 0.006);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(snap, 160);
  }

  function onKeyDown(e) {
    const k = e.key;
    if (k === 'ArrowRight') { e.preventDefault(); seek(Math.round(target) + 1); }
    else if (k === 'ArrowLeft') { e.preventDefault(); seek(Math.round(target) - 1); }
    else if (k === 'Home') { e.preventDefault(); seek(wrap ? Math.round(target / cards.length) * cards.length : 0); }
    else if (k === 'End') { e.preventDefault(); seek(wrap ? Math.round(target / cards.length) * cards.length + cards.length - 1 : cards.length - 1); }
  }

  // Tab 到两侧卡的链接时把它转到中间，键盘用户不用自己数档
  function onFocusIn(e) {
    const card = e.target.closest('.story-card');
    if (card && !card.classList.contains('is-active')) seek(centerOf(card));
  }

  // 重新收集卡片并按当前宽度摆一次。后台数据换掉整批卡之后也要走这里。
  function refresh() {
    cards = [...rail.querySelectorAll('.story-card')];
    if (cards.length < 2) {
      cancelAnimationFrame(raf); raf = 0;
      root.removeAttribute('data-gallery');          // 单张不用摆，退回静态轨道
      return;
    }
    // 先接管，measure 才能量到绝对定位后的轨道；同一帧内摆好位置，不会闪。
    root.setAttribute('data-gallery', 'on');
    cancelAnimationFrame(raf); raf = 0;
    measure();
    pos = target = wrap ? 0 : Math.round((cards.length - 1) / 2);
    paint();
    snap();
  }

  viewport.addEventListener('pointerdown', onPointerDown);
  viewport.addEventListener('pointermove', onPointerMove);
  viewport.addEventListener('pointerup', onPointerUp);
  viewport.addEventListener('pointercancel', onPointerUp);
  // 卡里有图、卡本身又是链接：浏览器一抬手就发起原生拖拽，pointer 流当场断掉，拖动翻卡变成没反应。
  viewport.addEventListener('dragstart', e => e.preventDefault());
  viewport.addEventListener('wheel', onWheel, { passive: false });
  rail.addEventListener('click', onClick);
  rail.addEventListener('focusin', onFocusIn);
  root.addEventListener('keydown', onKeyDown);

  let resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (cards.length > 1) { measure(); paint(); } }, 150);
  });

  refresh();
  return refresh;
}

let refreshStories = null;
let storiesMountedOn = null;

// 只给当前这一个画廊根节点挂一次监听；换 DOM（测试里反复重置 body）时重新接管。
function mountStoriesGallery() {
  const root = document.querySelector('.story-gallery');
  if (!root || root === storiesMountedOn) return refreshStories;
  storiesMountedOn = root;
  refreshStories = createStoryGallery(root);
  return refreshStories;
}

export async function initHomeCMS() {
  const box = document.getElementById('bento');
  const storiesBox = document.getElementById('client-stories');
  if (box) setBento([]);                       // 先按后台数据之外的静态 3 张把版式立起来
  mountStoriesGallery();                       // 静态兜底那三张也照样能翻
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
  if (storiesBox && stories.length) {
    storiesBox.innerHTML = stories.map(storyCard).join('');
    if (refreshStories) refreshStories();
  }
}
