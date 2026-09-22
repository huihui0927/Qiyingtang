// /api/gallery/{cat} 的分页取值。前台三张画廊页都不带 limit，所以「默认值」就是它们能看到的条数——
// 默认值一旦低于某个分类的实际条数，页面会静默少图（婚礼 69 条只出 60 张），故此处锁死默认=上限。
import { describe, it, expect } from 'vitest';
import { onRequestGet } from '../functions/api/gallery/[category].js';

const MAX_ITEMS = 500;

function rows(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `photo${String(i).padStart(8, '0')}`, image_key: `assets/images/wedding/${i}.webp`,
    thumbnail_key: `assets/images/wedding/${i}-thumb.webp`, width: 2000, height: 1333,
    alt_text: null, title: `作品${i}`, category: 'wedding', subcategory: null, source: 'site', sort_order: i,
  }));
}

async function count(total, query = '') {
  let bound = null;
  const env = { DB: { prepare: () => ({ bind(...vals) { bound = vals; return this; }, async all() { return { results: rows(total).slice(0, bound[1]) }; } }) } };
  const res = await onRequestGet({ env, params: { category: 'wedding' }, request: { url: `https://x/api/gallery/wedding${query}` } });
  const { items } = await res.json();
  return items.length;
}

describe('/api/gallery/{category} limit', () => {
  it('不带 limit 时返回整个分类，默认值等于上限', async () => {
    expect(await count(69)).toBe(69);
    expect(await count(MAX_ITEMS)).toBe(MAX_ITEMS);
  });

  it('显式 limit 生效，且被夹在 1..上限之间', async () => {
    expect(await count(69, '?limit=10')).toBe(10);
    expect(await count(69, '?limit=0')).toBe(1);
    expect(await count(9999, '?limit=99999')).toBe(MAX_ITEMS);
  });

  it('非法 limit 回落到默认值而不是 1', async () => {
    expect(await count(69, '?limit=abc')).toBe(69);
  });

  it('未知分类 404', async () => {
    const res = await onRequestGet({ env: { DB: { prepare: () => ({ bind() { return this; }, async all() { return { results: [] }; } }) } }, params: { category: 'nope' }, request: { url: 'https://x/api/gallery/nope' } });
    expect(res.status).toBe(404);
  });
});
