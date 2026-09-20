import { json, error, CATEGORIES, validId, readNum, rowToStory, verifySessionToken, parseCookies, SESSION_COOKIE } from '../../_lib.js';

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

async function authed(context) {
  const token = parseCookies(context.request)[SESSION_COOKIE];
  return verifySessionToken(token, context.env.SESSION_SECRET);
}

async function findRow(env, ref) {
  if (validId(ref)) return env.DB.prepare('SELECT * FROM stories WHERE id = ?').bind(ref).first();
  if (SLUG_RE.test(ref)) return env.DB.prepare('SELECT * FROM stories WHERE slug = ?').bind(ref).first();
  return null;
}

// GET /api/stories/{id|slug} —— 公开仅返回已发布；草稿仅登录可见
export async function onRequestGet(context) {
  const { env, params } = context;
  const row = await findRow(env, params.id);
  if (!row) return error('未找到', 404);
  if (!row.is_published && !(await authed(context))) return error('未找到', 404);
  return json(rowToStory(env, row));
}

export async function onRequestPut(context) {
  const { request, env, params } = context;
  const row = await findRow(env, params.id);
  if (!row) return error('未找到', 404);

  let b;
  try { b = await request.json(); } catch { return error('请求格式错误'); }

  const pick = (key, cur) => (key in b ? b[key] : cur);
  const str = v => (v == null ? null : String(v));
  const title = typeof b.title === 'string' && b.title.trim() ? b.title.trim() : row.title;
  const slug = 'slug' in b ? String(b.slug || '').toLowerCase() : row.slug;
  if (!SLUG_RE.test(slug)) return error('slug 非法');
  const catPick = pick('category', row.category);
  const category = CATEGORIES.includes(catPick) ? catPick : row.category;
  const cover_key = b.cover_uploaded ? `stories/${row.id}/cover.webp` : row.cover_key;

  try {
    await env.DB.prepare(
      `UPDATE stories SET slug=?, title=?, subtitle=?, category=?, cover_key=?, description=?, content=?, location=?, shoot_date=?, sort_order=?, is_published=?, updated_at=datetime('now')
       WHERE id=?`
    ).bind(
      slug, title,
      str(pick('subtitle', row.subtitle)),
      category,
      cover_key,
      str(pick('description', row.description)),
      str(pick('content', row.content)),
      str(pick('location', row.location)),
      str(pick('shoot_date', row.shoot_date)),
      Math.trunc(readNum(pick('sort_order', row.sort_order), row.sort_order)),
      pick('is_published', !!row.is_published) ? 1 : 0,
      row.id
    ).run();
  } catch (e) {
    if (/UNIQUE/i.test(String(e?.message))) return error('slug 已存在', 409);
    throw e;
  }

  const updated = await env.DB.prepare('SELECT * FROM stories WHERE id = ?').bind(row.id).first();
  return json(rowToStory(env, updated));
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const row = await findRow(env, params.id);
  if (!row) return error('未找到', 404);
  await env.DB.prepare('DELETE FROM stories WHERE id = ?').bind(row.id).run();
  if (row.cover_key) { try { await env.MEDIA.delete(row.cover_key); } catch (e) { console.error('cover delete', e); } }
  return json({ ok: true });
}
