import { json, error, validId, rowToStory } from '../_lib.js';

const MAX_SLOTS = 20;

// GET /api/home —— 首页精选：按 homepage.story_ids 顺序返回已发布故事摘要
export async function onRequestGet(context) {
  const { env } = context;
  const row = await env.DB.prepare('SELECT story_ids FROM homepage WHERE id = 1').first();
  let ids = [];
  try { ids = JSON.parse(row?.story_ids || '[]'); } catch { ids = []; }
  ids = ids.filter(id => validId(String(id))).slice(0, MAX_SLOTS);
  if (!ids.length) return json({ stories: [] }, 200, { 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' });

  const placeholders = ids.map(() => '?').join(',');
  const { results } = await env.DB
    .prepare(`SELECT * FROM stories WHERE is_published = 1 AND id IN (${placeholders})`)
    .bind(...ids).all();

  const byId = Object.fromEntries(results.map(r => [r.id, r]));
  const stories = ids.map(id => byId[id]).filter(Boolean).map(r => rowToStory(env, r));
  return json({ stories }, 200, { 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' });
}

// PUT /api/home —— 保存首页精选（数组顺序即展示顺序），鉴权
export async function onRequestPut(context) {
  const { request, env } = context;
  let b;
  try { b = await request.json(); } catch { return error('请求格式错误'); }
  if (!Array.isArray(b.story_ids)) return error('story_ids 必须是数组');
  if (b.story_ids.length > MAX_SLOTS) return error(`首页最多 ${MAX_SLOTS} 个精选`);

  const ids = b.story_ids.map(String);
  if (ids.some(id => !validId(id))) return error('含非法 id');
  if (new Set(ids).size !== ids.length) return error('story_ids 不可重复');

  // 仅接受已发布故事
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    const { results } = await env.DB
      .prepare(`SELECT id FROM stories WHERE is_published = 1 AND id IN (${placeholders})`).bind(...ids).all();
    const ok = new Set(results.map(r => r.id));
    const missing = ids.filter(id => !ok.has(id));
    if (missing.length) return error(`以下故事未发布或不存在: ${missing.join(', ')}`, 422);
  }

  await env.DB.prepare(`UPDATE homepage SET story_ids = ?, updated_at = datetime('now') WHERE id = 1`)
    .bind(JSON.stringify(ids)).run();
  return json({ ok: true, story_ids: ids });
}
