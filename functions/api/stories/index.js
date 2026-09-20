import { json, error, CATEGORIES, validId, readNum, rowToStory, verifySessionToken, parseCookies, SESSION_COOKIE } from '../../_lib.js';

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

async function authed(context) {
  const token = parseCookies(context.request)[SESSION_COOKIE];
  return verifySessionToken(token, context.env.SESSION_SECRET);
}

// GET /api/stories?category=&limit=&offset= —— 公开只含已发布；登录后台可见草稿
export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const limit = Math.min(Math.max(readNum(url.searchParams.get('limit'), 50), 1), 200);
  const offset = Math.max(readNum(url.searchParams.get('offset'), 0), 0);
  const isAdmin = await authed(context);

  const conds = []; const binds = [];
  if (!isAdmin) conds.push('is_published = 1');
  if (category && CATEGORIES.includes(category)) { conds.push('category = ?'); binds.push(category); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const { results } = await env.DB
    .prepare(`SELECT * FROM stories ${where} ORDER BY sort_order ASC, created_at DESC LIMIT ? OFFSET ?`)
    .bind(...binds, limit, offset)
    .all();

  const cc = isAdmin ? 'no-store' : 'public, s-maxage=60, stale-while-revalidate=300';
  return json({ items: results.map(r => rowToStory(env, r)) }, 200, { 'cache-control': cc });
}

// POST /api/stories —— 新建（鉴权由 _middleware 保证）
export async function onRequestPost(context) {
  const { request, env } = context;
  let b;
  try { b = await request.json(); } catch { return error('请求格式错误'); }

  const id = String(b.id || '');
  if (!validId(id)) return error('非法 id');
  if (typeof b.title !== 'string' || !b.title.trim()) return error('标题必填');
  if (!CATEGORIES.includes(b.category)) return error('分类非法');
  const slug = String(b.slug || '').toLowerCase();
  if (!SLUG_RE.test(slug)) return error('slug 需为小写字母/数字/连字符');

  const str = v => (v == null ? null : String(v));
  const coverKey = b.cover_uploaded ? `stories/${id}/cover.webp` : null;
  try {
    await env.DB.prepare(
      `INSERT INTO stories (id, slug, title, subtitle, category, cover_key, description, content, location, shoot_date, sort_order, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, slug, b.title.trim(), str(b.subtitle), b.category, coverKey, str(b.description), str(b.content),
      str(b.location), str(b.shoot_date), Math.trunc(readNum(b.sort_order, 0)), b.is_published ? 1 : 0
    ).run();
  } catch (e) {
    if (/UNIQUE/i.test(String(e?.message))) return error('slug 已存在', 409);
    throw e;
  }

  const row = await env.DB.prepare('SELECT * FROM stories WHERE id = ?').bind(id).first();
  return json(rowToStory(env, row), 201);
}
