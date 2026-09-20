import { json, error, CATEGORIES, validId, readNum, rowToPhoto } from '../../_lib.js';

// GET /api/photos —— 后台列表（含草稿），按 sort_order
export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const limit = Math.min(Math.max(readNum(url.searchParams.get('limit'), 200), 1), 500);
  const offset = Math.max(readNum(url.searchParams.get('offset'), 0), 0);

  const hasCat = category && CATEGORIES.includes(category);
  const where = hasCat ? 'WHERE category = ?' : '';
  const { results } = await env.DB
    .prepare(`SELECT * FROM photos ${where} ORDER BY sort_order ASC, created_at DESC LIMIT ? OFFSET ?`)
    .bind(...(hasCat ? [category] : []), limit, offset)
    .all();
  const meta = await env.DB.prepare(`SELECT COUNT(*) AS total FROM photos ${where}`)
    .bind(...(hasCat ? [category] : [])).first();

  return json({ items: results.map(r => rowToPhoto(env, r)), total: meta.total });
}

// POST /api/photos —— 新建（图片须先经 /api/upload 写入 R2）
export async function onRequestPost(context) {
  const { request, env } = context;
  let b;
  try { b = await request.json(); } catch { return error('请求格式错误'); }

  const id = String(b.id || '');
  if (!validId(id)) return error('非法 id');
  if (!CATEGORIES.includes(b.category)) return error('分类非法');
  if (typeof b.title !== 'string' || !b.title.trim()) return error('标题必填');
  const width = Math.trunc(readNum(b.width, 0));
  const height = Math.trunc(readNum(b.height, 0));
  if (width <= 0 || height <= 0) return error('尺寸非法');

  const max = readNum(env.MAX_PHOTOS, 1000);
  const meta = await env.DB.prepare('SELECT COUNT(*) AS total FROM photos').first();
  if (meta.total >= max) return error(`已达作品上限 ${max}，请先清理`, 409);

  const imageKey = `photos/${id}/image.webp`;
  const thumbKey = `photos/${id}/thumbnail.webp`;
  if (!(await env.MEDIA.head(imageKey)) || !(await env.MEDIA.head(thumbKey)))
    return error('图片尚未上传成功', 422);

  const storyId = b.story_id && validId(String(b.story_id)) ? String(b.story_id) : null;
  const str = v => (typeof v === 'string' ? v : null);

  await env.DB.prepare(
    `INSERT INTO photos (id, title, description, category, subcategory, story_id, image_key, thumbnail_key, width, height, alt_text, sort_order, is_published, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'r2')`
  ).bind(
    id, b.title.trim(), str(b.description), b.category, str(b.subcategory), storyId, imageKey, thumbKey,
    width, height, str(b.alt_text), Math.trunc(readNum(b.sort_order, 0)), b.is_published ? 1 : 0
  ).run();

  const row = await env.DB.prepare('SELECT * FROM photos WHERE id = ?').bind(id).first();
  return json(rowToPhoto(env, row), 201);
}
