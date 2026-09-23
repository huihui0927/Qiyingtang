/** @vitest-environment jsdom */
// 首页两处 CMS 区块：「精选作品」图片墙 + 「客片故事」卡片，都走 initHomeCMS。
// 关注点是「8~14 张不许出现半行空白」和「后台挂了首页照样有图有故事」，这两件事一旦回归没人会肉眼发现。
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { perRowFor, bentoRows } from '../assets/js/home.js';

const STATIC_HTML = `<div class="bento" id="bento">
  <button class="bento-cell bento-lg" type="button"><img src="w-thumb.webp" data-full="w.webp" alt="婚礼纪实" width="1920" height="1280"><span class="bento-cap"><span class="cap-year">2026</span> 婚礼全天纪实</span></button>
  <button class="bento-cell bento-sm" type="button"><img src="p-thumb.webp" data-full="p.webp" alt="人像写真" width="1280" height="1920"><span class="bento-cap">人像写真</span></button>
  <button class="bento-cell bento-sm" type="button"><img src="e-thumb.webp" data-full="e.webp" alt="活动纪实" width="2000" height="1334"><span class="bento-cap">品牌活动</span></button>
</div><div class="story-cards" id="client-stories">${['w', 'p', 'e'].map(k => `<a class="story-card" href="${k}.html"><div class="story-card-media"><img src="${k}-thumb.webp" alt="${k}"></div><div class="story-card-body"><span class="issue">2025.01</span><h3>静态兜底</h3><span class="view-story">View Story</span></div></a>`).join('')}</div>`;

function apiResponse(data) {
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => data });
}

function cmsPhoto(i) {
  return {
    id: `p${i}`, title: `作品 ${i}`, alt_text: `alt ${i}`,
    image: `https://cdn.example/photos/p${i}/image.webp`,
    thumbnail: `https://cdn.example/photos/p${i}/thumbnail.webp`,
    width: 2000, height: 1333,
  };
}

describe('bento 行分配', () => {
  it('视口宽度决定每行张数', () => {
    expect(perRowFor(390)).toBe(2);
    expect(perRowFor(768)).toBe(3);
    expect(perRowFor(1024)).toBe(4);
    expect(perRowFor(1440)).toBe(4);
  });

  it.each([2, 3, 4])('%i 列时，1~20 张都刚好铺满且末行不缺角', perRow => {
    for (let n = 1; n <= 20; n++) {
      const rows = bentoRows(n, perRow);
      expect(rows.reduce((a, b) => a + b, 0), `${n} 张分成 ${rows} 数量对不上`).toBe(n);
      expect(rows.length, `${n} 张的行数`).toBe(Math.ceil(n / perRow));
      expect(Math.max(...rows), `${n} 张不该有超过 ${perRow} 列的行`).toBeLessThanOrEqual(perRow);
      // 拉匀：任意两行相差 ≤1，末行才不会孤零零只剩一张
      expect(Math.max(...rows) - Math.min(...rows), `${n} 张的行分布不均：${rows}`).toBeLessThanOrEqual(1);
    }
  });

  it('8~14 张（用户要求的区间）在桌面 4 列下逐条对得上', () => {
    expect(bentoRows(8, 4)).toEqual([4, 4]);
    expect(bentoRows(9, 4)).toEqual([3, 3, 3]);
    expect(bentoRows(10, 4)).toEqual([4, 3, 3]);
    expect(bentoRows(11, 4)).toEqual([4, 4, 3]);
    expect(bentoRows(12, 4)).toEqual([4, 4, 4]);
    expect(bentoRows(13, 4)).toEqual([4, 3, 3, 3]);
    expect(bentoRows(14, 4)).toEqual([4, 4, 3, 3]);
  });

  it('0 张不渲染任何行', () => {
    expect(bentoRows(0, 4)).toEqual([]);
  });
});

describe('bento 渲染', () => {
  beforeEach(() => {
    document.body.innerHTML = STATIC_HTML;
  });

  it('/api/home 返回 10 张时按行铺开，序号连续，缩略图与大图分开', async () => {
    const { initHomeCMS } = await import('../assets/js/home.js');
    apiResponse({ stories: [], photos: Array.from({ length: 10 }, (_, i) => cmsPhoto(i)) });
    await initHomeCMS();

    const box = document.getElementById('bento');
    const cells = [...box.querySelectorAll('.bento-cell')];
    expect(box.classList.contains('bento--rows')).toBe(true);
    expect(cells).toHaveLength(10);
    expect([...box.querySelectorAll('.bento-row')].map(r => r.children.length)).toEqual([4, 3, 3]);
    expect(cells.map(c => Number(c.dataset.lightboxIndex))).toEqual([...Array(10).keys()]);
    expect(cells[0].querySelector('img').getAttribute('src')).toContain('thumbnail.webp');
    expect(cells[0].querySelector('img').getAttribute('data-full')).toContain('image.webp');
  });

  it('接口挂了保留 index.html 里写死的 3 张，并同样排成图片墙', async () => {
    const { initHomeCMS } = await import('../assets/js/home.js');
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: 500 });
    await initHomeCMS();

    const cells = [...document.querySelectorAll('#bento .bento-cell')];
    expect(cells).toHaveLength(3);
    expect(cells[0].querySelector('img').getAttribute('src')).toBe('w-thumb.webp');
    expect(cells[0].querySelector('img').getAttribute('data-full')).toBe('w.webp');
  });

  it('后台一张都没选时不会把首页画成空的', async () => {
    const { initHomeCMS } = await import('../assets/js/home.js');
    apiResponse({ stories: [], photos: [] });
    await initHomeCMS();
    expect(document.querySelectorAll('#bento .bento-cell')).toHaveLength(3);
  });

  it('标题里的尖括号被转义，不会撕开 DOM', async () => {
    const { initHomeCMS } = await import('../assets/js/home.js');
    apiResponse({ stories: [], photos: [{ ...cmsPhoto(1), title: '<img src=x onerror=alert(1)>' }] });
    await initHomeCMS();
    expect(document.querySelector('#bento .bento-cap').textContent).toBe('<img src=x onerror=alert(1)>');
    expect(document.querySelectorAll('#bento .bento-cap img')).toHaveLength(0);
  });
});

const cmsStory = (i, extra = {}) => ({
  id: `s${i}`, slug: `s${i}`, title: `故事 ${i}`, subtitle: '全天纪实', location: '北京',
  cover: `https://cdn.example/stories/s${i}/cover.webp`, category: 'wedding',
  description: '一句话简介', shoot_date: `2025.0${i}`, is_published: true, ...extra,
});

describe('客片故事卡', () => {
  beforeEach(() => {
    document.body.innerHTML = STATIC_HTML;
  });

  it('后台返回几条就渲染几张卡，链接按分类落到对应画廊页', async () => {
    const { initHomeCMS } = await import('../assets/js/home.js');
    apiResponse({ photos: [], stories: [
      cmsStory(1), cmsStory(2, { category: 'portrait' }), cmsStory(3, { category: 'event' }),
    ] });
    await initHomeCMS();

    const cards = [...document.querySelectorAll('#client-stories .story-card')];
    expect(cards).toHaveLength(3);
    expect(cards.map(c => c.getAttribute('href'))).toEqual(['wedding.html', 'portrait.html', 'event.html']);
    expect(cards[0].querySelector('.issue').textContent).toBe('2025.01');
    expect(cards[0].querySelector('.meta').textContent).toBe('全天纪实 · 北京');
    expect(cards[0].querySelector('img').getAttribute('src')).toContain('cover.webp');
  });

  it('简介和标题填成同一句话时不再重复渲染 lede', async () => {
    const { initHomeCMS } = await import('../assets/js/home.js');
    apiResponse({ photos: [], stories: [cmsStory(1, { title: '张先生 × 李小姐', description: '张先生 × 李小姐' })] });
    await initHomeCMS();
    const card = document.querySelector('#client-stories .story-card');
    expect(card.querySelector('.lede')).toBeNull();
    expect(card.querySelector('h3').textContent).toBe('张先生 × 李小姐');
  });

  it('简介空着或撞标题时退到正文第一句，三张卡不会缺一行', async () => {
    const { initHomeCMS } = await import('../assets/js/home.js');
    apiResponse({ photos: [], stories: [
      cmsStory(1, { title: '张先生 × 李小姐', description: '张先生 × 李小姐', content: '一场满载鲜花的开篇。\n红瓣落下的瞬间。\n第三段。' }),
      cmsStory(2, { description: '', content: '两行正文。\n第二行。' }),
    ] });
    await initHomeCMS();
    const ledes = [...document.querySelectorAll('#client-stories .lede')].map(p => p.textContent);
    expect(ledes).toEqual(['一场满载鲜花的开篇。', '两行正文。']);
  });

  it('正文过长时截到 48 字加省略号，不会把一张卡撑高一屏', async () => {
    const { initHomeCMS } = await import('../assets/js/home.js');
    apiResponse({ photos: [], stories: [cmsStory(1, { description: '', content: '影'.repeat(80) })] });
    await initHomeCMS();
    const lede = document.querySelector('#client-stories .lede').textContent;
    expect(lede.length).toBe(49);
    expect(lede.endsWith('…')).toBe(true);
  });

  it('接口挂了保留 index.html 里写死的 3 张静态卡', async () => {
    const { initHomeCMS } = await import('../assets/js/home.js');
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));
    await initHomeCMS();
    expect(document.querySelectorAll('#client-stories .story-card')).toHaveLength(3);
  });
});
