// /api/home 的「精选作品」半边：只存元数据、顺序即数组下标、草稿不许漏到前台。
// 这里用正则匹配 SQL 而不是引真库，图的是能断言「先整体清空、再按新顺序写回」这个事务形状——
// 少了清空那一步，被移出的照片会永远留在首页上。
import { describe, it, expect } from 'vitest';
import { onRequestGet, onRequestPut } from '../functions/api/home.js';

const ID = i => `photo${'0'.repeat(Math.max(0, 6 - String(i).length))}${i}`;   // validId 要求 6~64 位

function makeDb(photos, storyIds = '[]') {
  const state = { photos: photos.map(p => ({ ...p })), homepage: { id: 1, story_ids: storyIds } };
  const q = sql => ({
    bind(...vals) { this.vals = vals; return this; },
    async all() { return { results: exec(this) }; },
    async first() { const r = exec(this); return r[0] ?? null; },
    async run() { exec(this); return { success: true }; },
    _sql: sql,
  });
  function exec(self) {
    const s = self._sql.replace(/\s+/g, ' ').trim();
    const vals = self.vals || [];
    if (/^SELECT story_ids FROM homepage/.test(s)) return [state.homepage];
    if (/^SELECT \* FROM photos WHERE homepage_order IS NOT NULL AND is_published = 1/.test(s)) {
      const limit = vals[0] ?? 14;
      return state.photos.filter(p => p.homepage_order != null && p.is_published === 1)
        .sort((a, b) => a.homepage_order - b.homepage_order).slice(0, limit);
    }
    if (/^SELECT id FROM photos WHERE is_published = 1 AND id IN/.test(s)) {
      return state.photos.filter(p => p.is_published === 1 && vals.includes(p.id)).map(p => ({ id: p.id }));
    }
    if (/^UPDATE photos SET homepage_order = NULL/.test(s)) {
      state.photos.forEach(p => { p.homepage_order = null; });
      return [];
    }
    const one = /^UPDATE photos SET homepage_order = \?.*WHERE id = \?$/.exec(s);
    if (one) {
      const [order, id] = vals;
      const row = state.photos.find(p => p.id === id);
      if (row) row.homepage_order = order;
      return [];
    }
    if (/^UPDATE homepage SET story_ids/.test(s)) { state.homepage.story_ids = vals[0]; return []; }
    throw new Error(`未覆盖的 SQL：${s}`);
  }
  return { db: { prepare: q, async batch(stmts) { for (const st of stmts) await st.run(); } }, state };
}

const photo = (i, extra = {}) => ({
  id: ID(i), title: `作品${i}`, description: null, category: 'wedding', subcategory: null,
  source: 'site', story_id: null, image_key: `assets/images/w${i}.webp`, thumbnail_key: `assets/images/w${i}-thumb.webp`,
  width: 2000, height: 1333, alt_text: `alt${i}`, sort_order: i, is_published: 1, homepage_order: null,
  ...extra,
});

function ctx(method, body, photos, storyIds) {
  const { db, state } = makeDb(photos, storyIds);
  return {
    state,
    context: {
      env: { DB: db },
      request: { method, url: `https://x/api/home`, json: async () => body },
    },
  };
}

describe('GET /api/home', () => {
  it('没有精选时返回两个空数组而不是缺字段', async () => {
    const c = ctx('GET', null, [photo(1)]);
    const data = await (await onRequestGet(c.context)).json();
    expect(data).toEqual({ stories: [], photos: [] });
  });

  it('按 homepage_order 升序返回，URL 由 key 派生', async () => {
    const c = ctx('GET', null, [photo(1, { homepage_order: 1 }), photo(2, { homepage_order: 0 })]);
    const data = await (await onRequestGet(c.context)).json();
    expect(data.photos.map(p => p.id)).toEqual([ID(2), ID(1)]);
    expect(data.photos[0].image).toBe('/assets/images/w2.webp');
    expect(data.photos[0].thumbnail).toBe('/assets/images/w2-thumb.webp');
    expect(data.photos[0].homepage_order).toBe(0);
  });

  it('勾了首页但被隐藏（草稿）的作品不会漏到前台', async () => {
    const c = ctx('GET', null, [photo(1, { homepage_order: 0, is_published: 0 }), photo(2, { homepage_order: 1 })]);
    const data = await (await onRequestGet(c.context)).json();
    expect(data.photos.map(p => p.id)).toEqual([ID(2)]);
  });
});

describe('PUT /api/home', () => {
  it('写入顺序 = 数组下标，且先整体清空再写回', async () => {
    const c = ctx('PUT', { photo_ids: [ID(3), ID(1)] }, [photo(1, { homepage_order: 0 }), photo(2, { homepage_order: 1 }), photo(3)]);
    const res = await onRequestPut(c.context);
    expect(res.status).toBe(200);
    // photo2 原本在首页、这次没被选中 → 必须被清成 NULL，否则它会永远挂在首页上
    expect(c.state.photos.find(p => p.id === ID(2)).homepage_order).toBe(null);
    expect(c.state.photos.find(p => p.id === ID(3)).homepage_order).toBe(0);
    expect(c.state.photos.find(p => p.id === ID(1)).homepage_order).toBe(1);
  });

  it('传 photo_ids 不动 story_ids，传 story_ids 不动 photo_ids', async () => {
    const c = ctx('PUT', { photo_ids: [] }, [photo(1, { homepage_order: 0 })], '["aaaaaaaaaa"]');
    await onRequestPut(c.context);
    expect(c.state.homepage.story_ids).toBe('["aaaaaaaaaa"]');
    expect(c.state.photos[0].homepage_order).toBe(null);
  });

  it('超过 14 张直接拒绝，且不落库', async () => {
    const many = Array.from({ length: 15 }, (_, i) => photo(i + 1));
    const c = ctx('PUT', { photo_ids: many.map(p => p.id) }, [photo(1, { homepage_order: 0 }), ...many.slice(1)]);
    const res = await onRequestPut(c.context);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('14');
    expect(c.state.photos.filter(p => p.homepage_order != null)).toHaveLength(1);
  });

  it('草稿 / 不存在的 id 拒绝，并点名是哪几个', async () => {
    const c = ctx('PUT', { photo_ids: [ID(1), ID(2)] }, [photo(1), photo(2, { is_published: 0 })]);
    const res = await onRequestPut(c.context);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toContain(ID(2));
    expect(c.state.photos[0].homepage_order).toBe(null);
  });

  it('重复 id 拒绝', async () => {
    const c = ctx('PUT', { photo_ids: [ID(1), ID(1)] }, [photo(1)]);
    expect((await onRequestPut(c.context)).status).toBe(400);
  });

  it('两个字段都不给时拒绝，避免误清空首页', async () => {
    const c = ctx('PUT', {}, [photo(1, { homepage_order: 0 })]);
    expect((await onRequestPut(c.context)).status).toBe(400);
    expect(c.state.photos[0].homepage_order).toBe(0);
  });

  it('清空首页是合法操作（photo_ids: []）', async () => {
    const c = ctx('PUT', { photo_ids: [] }, [photo(1, { homepage_order: 0 })]);
    expect((await onRequestPut(c.context)).status).toBe(200);
    expect(c.state.photos[0].homepage_order).toBe(null);
  });
});
