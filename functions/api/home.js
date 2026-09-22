import { json, error, validId, rowToPhoto, rowToStory } from '../_lib.js';

const MAX_STORY_SLOTS = 20;
const MAX_PHOTO_SLOTS = 14;
const CACHE = { 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' };

// GET /api/home —— 首页两处精选：
//   stories 按 homepage.story_ids 顺序，photos 按 photos.homepage_order 顺序（NULL 不上首页）。
// 两者都只返回已发布项，草稿即使被勾了首页也不会漏到前台。
export async function onRequestGet(context) {
  const { env } = context;
  const [row, photoRows] = await Promise.all([
    env.DB.prepare('SELECT story_ids FROM homepage WHERE id = 1').first(),
    env.DB.prepare(
      'SELECT * FROM photos WHERE homepage_order IS NOT NULL AND is_published = 1 ORDER BY homepage_order ASC LIMIT ?'
    ).bind(MAX_PHOTO_SLOTS).all(),
  ]);

  let ids = [];
  try { ids = JSON.parse(row?.story_ids || '[]'); } catch { ids = []; }
  ids = ids.filter(id => validId(String(id))).slice(0, MAX_STORY_SLOTS);

  let stories = [];
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    const { results } = await env.DB
      .prepare(`SELECT * FROM stories WHERE is_published = 1 AND id IN (${placeholders})`)
      .bind(...ids).all();
    const byId = Object.fromEntries(results.map(r => [r.id, r]));
    stories = ids.map(id => byId[id]).filter(Boolean).map(r => rowToStory(env, r));
  }

  return json({ stories, photos: photoRows.results.map(r => rowToPhoto(env, r)) }, 200, CACHE);
}

// PUT /api/home —— 保存首页精选（数组顺序即展示顺序），鉴权。
// story_ids / photo_ids 各自可选，只写传进来的那半边，另一半边不动。
export async function onRequestPut(context) {
  const { request, env } = context;
  let b;
  try { b = await request.json(); } catch { return error('请求格式错误'); }
  if (!('story_ids' in b) && !('photo_ids' in b)) return error('story_ids 或 photo_ids 至少给一个');

  const stmts = [];
  const out = {};

  if ('story_ids' in b) {
    if (!Array.isArray(b.story_ids)) return error('story_ids 必须是数组');
    if (b.story_ids.length > MAX_STORY_SLOTS) return error(`首页最多 ${MAX_STORY_SLOTS} 个精选`);
    const ids = b.story_ids.map(String);
    if (ids.some(id => !validId(id))) return error('含非法 id');
    if (new Set(ids).size !== ids.length) return error('story_ids 不可重复');
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      const { results } = await env.DB
        .prepare(`SELECT id FROM stories WHERE is_published = 1 AND id IN (${placeholders})`).bind(...ids).all();
      const ok = new Set(results.map(r => r.id));
      const missing = ids.filter(id => !ok.has(id));
      if (missing.length) return error(`以下故事未发布或不存在: ${missing.join(', ')}`, 422);
    }
    stmts.push(env.DB.prepare(`UPDATE homepage SET story_ids = ?, updated_at = datetime('now') WHERE id = 1`)
      .bind(JSON.stringify(ids)));
    out.story_ids = ids;
  }

  if ('photo_ids' in b) {
    if (!Array.isArray(b.photo_ids)) return error('photo_ids 必须是数组');
    if (b.photo_ids.length > MAX_PHOTO_SLOTS) return error(`首页精选作品最多 ${MAX_PHOTO_SLOTS} 张`);
    const ids = b.photo_ids.map(String);
    if (ids.some(id => !validId(id))) return error('含非法 id');
    if (new Set(ids).size !== ids.length) return error('photo_ids 不可重复');
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      const { results } = await env.DB
        .prepare(`SELECT id FROM photos WHERE is_published = 1 AND id IN (${placeholders})`).bind(...ids).all();
      const ok = new Set(results.map(r => r.id));
      const missing = ids.filter(id => !ok.has(id));
      if (missing.length) return error(`以下作品未发布或不存在: ${missing.join(', ')}`, 422);
    }
    // 先整体清空再按新顺序写回：batch 是一个事务，中途失败不会留下半份选择。
    stmts.push(env.DB.prepare('UPDATE photos SET homepage_order = NULL WHERE homepage_order IS NOT NULL'));
    ids.forEach((id, i) => {
      stmts.push(env.DB.prepare(`UPDATE photos SET homepage_order = ?, updated_at = datetime('now') WHERE id = ?`).bind(i, id));
    });
    out.photo_ids = ids;
  }

  await env.DB.batch(stmts);
  return json({ ok: true, ...out });
}
