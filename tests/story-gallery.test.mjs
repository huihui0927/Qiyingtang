/** @vitest-environment jsdom */
// 首页「客片故事」扇形画廊。守住三件肉眼看不见、出事却很难查的事：
// 1) 监听绝不能挂到 window/document 上——那样页面别处一滚，画廊就自己转起来（React Bits 原组件的毛病）；
// 2) 竖向滚轮必须留给页面，画廊只吃横向意图；
// 3) 后台换掉整批卡之后，画廊要重新摆位，而不是继续拿着旧卡片。
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// jsdom 环境里 import.meta.url 不是 file: 协议，只能按项目根目录读。
const read = p => readFileSync(resolve(process.cwd(), p), 'utf8');
const homeJs = read('assets/js/home.js');
const homeCss = read('assets/css/home.css');
const indexHtml = read('index.html');

const card = (i, href = 'wedding.html') => `<a class="story-card" href="${href}">
  <div class="story-card-media"><img src="c${i}.webp" alt="客片 ${i}"></div>
  <div class="story-card-body"><span class="issue">2025.0${i}</span><h3>故事 ${i}</h3>
  <p class="lede">简介 ${i}</p><span class="view-story">View Story</span></div>
</a>`;

const galleryHtml = (n) => `<div class="bento" id="bento"></div>
<div class="story-gallery"><div class="story-viewport"><div class="story-cards" id="client-stories">
${Array.from({ length: n }, (_, i) => card(i + 1)).join('')}
</div></div><p class="story-hint">拖动翻看</p></div>`;

function stubHome(stories = []) {
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ photos: [], stories }) });
}

describe('画廊的事件边界', () => {
  it('绝不在 window / document 上挂滚轮、鼠标、触摸、指针监听', () => {
    expect(homeJs).not.toMatch(
      /(window|document|globalThis)\s*\.\s*addEventListener\(\s*['"`](wheel|mousewheel|touchstart|touchmove|touchend|mousedown|mousemove|mouseup|pointerdown|pointermove|pointerup)/,
    );
  });

  it('拖拽与滚轮只听自己那块视口', () => {
    for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel']) {
      expect(homeJs, `视口上少了 ${ev}`).toContain(`viewport.addEventListener('${ev}'`);
    }
  });

  // 一按下就接管指针，浏览器会把随后的 click 一并改派到视口上（真浏览器里抓到 target 是
  // .story-viewport）：中间那张跳不动，两侧那张也收不到「转到中间」的指令。
  it('接管指针要等到真的拖起来，点击才不会被改派', () => {
    const down = homeJs.slice(homeJs.indexOf('function onPointerDown'), homeJs.indexOf('function onPointerMove'));
    expect(down).not.toMatch(/setPointerCapture/);
    const move = homeJs.slice(homeJs.indexOf('function onPointerMove'), homeJs.indexOf('function onPointerUp'));
    expect(move).toMatch(/if \(dragMoved > DRAG_SLOP[^\n]*setPointerCapture/);
  });

  // 卡里有图、卡本体又是链接：不挡掉原生拖拽，浏览器一抬手就 dragstart + pointercancel，
  // pointermove 只到一次，画廊根本转不动。
  it('挡掉浏览器原生拖拽，拖动翻卡才有连续的 pointermove', () => {
    expect(homeJs).toMatch(/viewport\.addEventListener\('dragstart', e => e\.preventDefault\(\)\)/);
  });

  it('竖向滚轮直接 return，不拦截页面滚动', () => {
    const fn = homeJs.slice(homeJs.indexOf('function onWheel'), homeJs.indexOf('function onKeyDown'));
    expect(fn).toMatch(/if \(!horizontal\) return;[\s\S]*?e\.preventDefault\(\)/);
  });
});

describe('画廊的样式契约', () => {
  it('接管前是一条能横滑的轨道，接管后才改成绝对定位', () => {
    expect(homeCss).toMatch(/\.story-cards \{[^}]*overflow-x: auto/);
    expect(homeCss).toMatch(/\[data-gallery="on"\] \.story-card \{[^}]*position: absolute/);
  });

  // JS 写 data-gallery="loop"、CSS 只认 [data-gallery="on"]：整排卡会安静地躺回静态轨道，
  // 弧线参数照样算却一帧都看不见。
  it('JS 写下的接管值和 CSS 认的选择器是同一个值', () => {
    const fromCss = new Set([...homeCss.matchAll(/\[data-gallery="([^"]+)"\]/g)].map(m => m[1]));
    const fromJs = homeJs.match(/setAttribute\('data-gallery', '([^']+)'\)/);
    expect(fromJs).not.toBeNull();
    expect([...fromCss]).toEqual([fromJs[1]]);
  });
  it('index.html 里的静态兜底已经带上画廊外壳', () => {
    expect(indexHtml).toMatch(/<div class="story-gallery"[\s\S]*?<div class="story-viewport"[\s\S]*?<div class="story-cards" id="client-stories"/);
  });

  // 方向键监听挂在画廊根节点上；没有 tabindex 的 div 拿不到焦点，键盘用户就永远转不动它。
  it('画廊根节点可聚焦，方向键才有人接', () => {
    expect(indexHtml).toMatch(/<div class="story-gallery"[^>]*tabindex="0"/);
  });
});

describe('画廊接管', () => {
  beforeEach(() => { stubHome(); });

  it('卡片就位：正好一张正对中间，其余按弧线让开', async () => {
    document.body.innerHTML = galleryHtml(4);
    const { initHomeCMS } = await import('../assets/js/home.js');
    await initHomeCMS();

    const root = document.querySelector('.story-gallery');
    const cards = [...root.querySelectorAll('.story-card')];
    expect(root.hasAttribute('data-gallery')).toBe(true);
    expect(cards.filter(c => c.classList.contains('is-active'))).toHaveLength(1);
    expect(cards[0].classList.contains('is-active'), '第一张应当正对中间').toBe(true);
    expect(cards.slice(1).some(c => c.style.visibility === 'hidden'), '窗外的卡片要藏起来').toBe(true);
  });

  it('只剩一张卡时不接管，保持静态轨道', async () => {
    document.body.innerHTML = galleryHtml(1);
    const { initHomeCMS } = await import('../assets/js/home.js');
    await initHomeCMS();
    expect(document.querySelector('.story-gallery').hasAttribute('data-gallery')).toBe(false);
  });

  it('后台换成 6 条后重新摆位，不拿旧卡片凑数', async () => {
    document.body.innerHTML = galleryHtml(3);
    const { initHomeCMS } = await import('../assets/js/home.js');
    stubHome(Array.from({ length: 6 }, (_, i) => ({
      id: `s${i}`, title: `故事 ${i}`, cover: `https://cdn.example/stories/s${i}/cover.webp`,
      category: 'wedding', description: '简介', shoot_date: `2025.0${i + 1}`,
    })));
    await initHomeCMS();

    const cards = [...document.querySelectorAll('#client-stories .story-card')];
    expect(cards).toHaveLength(6);
    expect(cards.filter(c => c.classList.contains('is-active'))).toHaveLength(1);
    expect(cards[0].querySelector('img').getAttribute('src')).toContain('cover.webp');
  });

  it('点两侧的卡是把它转到中间，不跳转', async () => {
    document.body.innerHTML = galleryHtml(4);
    const { initHomeCMS } = await import('../assets/js/home.js');
    await initHomeCMS();

    const cards = [...document.querySelectorAll('#client-stories .story-card')];
    const side = cards.find(c => !c.classList.contains('is-active'));
    const active = cards.find(c => c.classList.contains('is-active'));
    // 点图片区：整张卡就是 <a>，落点归谁处理取决于点的是不是中间那张
    expect(side.querySelector('.story-card-media').dispatchEvent(
      new window.MouseEvent('click', { bubbles: true, cancelable: true }),
    ), '侧卡点击应当被拦下来用于聚焦').toBe(false);
    expect(active.querySelector('.story-card-media').dispatchEvent(
      new window.MouseEvent('click', { bubbles: true, cancelable: true }),
    ), '中间那张不该被拦，照常跳转').toBe(true);
  });

  // 曾经用 .view-story::after 铺一层透明热区冒充整卡可点；文字区一成为定位祖先，
  // 那层热区就缩回标题以下，图片点下去没反应。现在卡片本体就是链接。
  it('整张卡本体就是链接，不靠透明热区', () => {
    expect(homeCss).not.toMatch(/\.view-story::after/);
    expect(indexHtml).toMatch(/<a class="story-card" href="wedding\.html">[\s\S]*?<\/a>\s*<a class="story-card"/);
    expect(homeJs).toMatch(/<a class="story-card" href="\$\{href\}">/);
  });
});
