// R2 本地代理（仅当未配 R2_PUBLIC_BASE 时用于本地预览；线上图片走 R2 公开域名绕过 Worker）。
// catch-all：/api/media/photos/{id}/image.webp → params.key = ['photos','{id}','image.webp']
import { error } from '../../_lib.js';

const KEY_RE = /^(photos|stories)\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/;

export async function onRequestGet(context) {
  const { env, params } = context;
  const key = Array.isArray(params.key) ? params.key.join('/') : String(params.key || '');
  if (!KEY_RE.test(key)) return error('invalid key', 400);

  const obj = await env.MEDIA.get(key);
  if (!obj) return error('not found', 404);

  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType || 'image/webp',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
