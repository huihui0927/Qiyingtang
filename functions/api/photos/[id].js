import { json, error, CATEGORIES, validId, readNum, rowToPhoto } from '../../_lib.js';

// /api/photos/{id} —— 读取 / 编辑元数据 / 删除
// 注：不在此改图片像素。换图 = 上传新 id + 删旧，保证 R2 key 与缓存 URL 不可变。

export async function onRequestGet(context) {
  const { env, params } = context;
  if (!validId(params.id)) return error('非法 id');
  const row = await env.DB.prepare('SELECT * FROM photos WHERE id = ?').bind(params.id).first();
  if (!row) return error('未找到', 404);
  return json(rowToPhoto(env, row));
}

export async function onRequestPut(context) {
  const { request, env, params } = context;
  if (!validId(params.id)) return error('非法 id');
  const row = await env.DB.prepare('SELECT * FROM photos WHERE id = ?').bind(params.id).first();
  if (!row) return error('未找到', 404);

  let b;
  try { b = await request.json(); } catch { return error('请求格式错误'); }

  const title = typeof b.title === 'string' && b.title.trim() ? b.title.trim() : row.title;
  const category = CATEGORIES.includes(b.category) ? b.category : row.category;
  const subcategory = 'subcategory' in b ? (b.subcategory == null || b.subcategory === '' ? null : String(b.subcategory)) : row.subcategory;
  const description = 'description' in b ? (b.description == null ? null : String(b.description)) : row.description;
  const alt_text = 'alt_text' in b ? (b.alt_text == null ? null : String(b.alt_text)) : row.alt_text;
  const story_id = 'story_id' in b
    ? (b.story_id && validId(String(b.story_id)) ? String(b.story_id) : null)
    : row.story_id;
  const sort_order = 'sort_order' in b ? Math.trunc(readNum(b.sort_order, row.sort_order)) : row.sort_order;
  const is_published = 'is_published' in b ? (b.is_published ? 1 : 0) : row.is_published;

  await env.DB.prepare(
    `UPDATE photos SET title=?, category=?, subcategory=?, description=?, alt_text=?, story_id=?, sort_order=?, is_published=?, updated_at=datetime('now')
     WHERE id=?`
  ).bind(title, category, subcategory, description, alt_text, story_id, sort_order, is_published, params.id).run();

  const updated = await env.DB.prepare('SELECT * FROM photos WHERE id = ?').bind(params.id).first();
  return json(rowToPhoto(env, updated));
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  if (!validId(params.id)) return error('非法 id');
  const row = await env.DB.prepare('SELECT image_key, thumbnail_key, source FROM photos WHERE id = ?').bind(params.id).first();
  if (!row) return error('未找到', 404);

  await env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(params.id).run();
  // source='site' 的历史图不在 R2（仍是 Pages 静态文件），只删元数据行，不动 R2。
  // source='r2'：清 R2 回收存储；删对象失败不阻断（DB 已删），仅记录。
  if ((row.source || 'r2') === 'r2') {
    try {
      await env.MEDIA.delete([row.image_key, row.thumbnail_key]);
    } catch (e) {
      console.error('R2 delete failed', params.id, e?.message || e);
    }
  }
  return json({ ok: true });
}
