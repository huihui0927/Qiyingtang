import { json } from '../_lib.js';

// GET /api/stats —— 后台概览：数量与软上限，用于用量监控（鉴权）
export async function onRequestGet(context) {
  const { env } = context;
  const [photos, published, drafts, stories, featured] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) c FROM photos').first(),
    env.DB.prepare('SELECT COUNT(*) c FROM photos WHERE is_published = 1').first(),
    env.DB.prepare('SELECT COUNT(*) c FROM photos WHERE is_published = 0').first(),
    env.DB.prepare('SELECT COUNT(*) c FROM stories').first(),
    env.DB.prepare('SELECT story_ids FROM homepage WHERE id = 1').first(),
  ]);
  let homeCount = 0;
  try { homeCount = JSON.parse(featured?.story_ids || '[]').length; } catch {}
  return json({
    photos: photos.c, published: published.c, drafts: drafts.c,
    stories: stories.c, homepage: homeCount,
    max_photos: Number(env.MAX_PHOTOS || 1000),
  });
}
