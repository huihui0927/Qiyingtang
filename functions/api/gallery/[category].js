import { json, error, CATEGORIES, mediaUrl, readNum } from '../../_lib.js';

const MAX_ITEMS = 500;

// GET /api/gallery/{category}?limit=500&offset=0 —— 前台作品流（已发布）
// 默认值必须等于上限：三张画廊页都不带 limit，默认小了会静默少图。
export async function onRequestGet(context) {
  const { env, params, request } = context;
  const category = params.category;
  if (!CATEGORIES.includes(category)) return error('未知分类', 404);

  const url = new URL(request.url);
  const limit = Math.min(Math.max(readNum(url.searchParams.get('limit'), MAX_ITEMS), 1), MAX_ITEMS);
  const offset = Math.max(readNum(url.searchParams.get('offset'), 0), 0);

  const { results } = await env.DB
    .prepare(
      `SELECT id, image_key, thumbnail_key, updated_at, width, height, alt_text, title, category, subcategory, source, sort_order
       FROM photos
       WHERE is_published = 1 AND category = ?
       ORDER BY sort_order ASC, id ASC
       LIMIT ? OFFSET ?`
    )
    .bind(category, limit, offset)
    .all();

  const items = results.map(r => {
    const source = r.source || 'r2';
    const src = mediaUrl(env, r.image_key, r.updated_at, source);
    const thumb = mediaUrl(env, r.thumbnail_key, r.updated_at, source);
    const sub = r.subcategory || '';
    return {
      id: r.id,
      src,
      thumb,
      srcset: `${thumb} 600w, ${src} 2000w`,
      width: r.width,
      height: r.height,
      alt: r.alt_text || r.title,
      // 前端 filter.js / wedding.html 用 category 做页内分组，语义等同旧 JSON 的子标签
      category: sub,
      subcategory: sub,
      page: r.category,
      source,
    };
  });

  return json({ items }, 200, { 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' });
}
