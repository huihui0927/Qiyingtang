import { json, error, validId, readNum } from '../../_lib.js';

// POST /api/upload —— multipart。方案 A：字节经 Function 中转写 R2（前端已压成 WebP）。
//   kind=photo : 字段 id, image(WebP), thumbnail(WebP) → photos/{id}/image.webp + thumbnail.webp
//   kind=cover : 字段 id, image(WebP)                   → stories/{id}/cover.webp
// 仅收 WebP，校验魔数 + 大小 + 合法 id（防路径穿越）。
const isWebp = buf => {
  const b = new Uint8Array(buf);
  const c = i => String.fromCharCode(b[i]);
  return b.length === 12 && c(0) === 'R' && c(1) === 'I' && c(2) === 'F' && c(3) === 'F'
    && c(8) === 'W' && c(9) === 'E' && c(10) === 'B' && c(11) === 'P';
};
async function checkFile(label, f, maxBytes) {
  if (!(f instanceof File)) return `${label} 缺失`;
  if (f.type && f.type !== 'image/webp') return `${label} 必须是 WebP`;
  if (f.size === 0 || f.size > maxBytes) return `${label} 大小非法（≤${maxBytes} 字节）`;
  if (!isWebp(await f.slice(0, 12).arrayBuffer())) return `${label} 非 WebP 内容`;
  return null;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let form;
  try { form = await request.formData(); } catch { return error('需要 multipart/form-data'); }

  const kind = String(form.get('kind') || 'photo');
  const id = String(form.get('id') || '');
  if (!validId(id)) return error('非法 id');

  const maxBytes = readNum(env.MAX_UPLOAD_BYTES, 20 * 1024 * 1024);
  const meta = { httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' } };

  const image = form.get('image');
  const err1 = await checkFile('image', image, maxBytes);
  if (err1) return error(err1);

  if (kind === 'cover') {
    const key = `stories/${id}/cover.webp`;
    await env.MEDIA.put(key, image.stream(), meta);
    return json({ ok: true, key });
  }

  const thumb = form.get('thumbnail');
  const err2 = await checkFile('thumbnail', thumb, maxBytes);
  if (err2) return error(err2);

  const imageKey = `photos/${id}/image.webp`;
  const thumbKey = `photos/${id}/thumbnail.webp`;
  await env.MEDIA.put(imageKey, image.stream(), meta);
  await env.MEDIA.put(thumbKey, thumb.stream(), meta);
  return json({ ok: true, imageKey, thumbKey });
}
