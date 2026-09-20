import { json, error, createSessionToken, sessionCookie, isLocked, recordFailure, clearFailures } from '../../_lib.js';

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (isLocked(ip)) return error('尝试次数过多，请稍后再试', 429);

  let body;
  try { body = await request.json(); } catch { return error('请求格式错误'); }
  const password = typeof body.password === 'string' ? body.password : '';

  if (!env.ADMIN_PASSWORD || !safeEqual(password, env.ADMIN_PASSWORD)) {
    recordFailure(ip);
    return error('密码错误', 401);
  }

  clearFailures(ip);
  const token = await createSessionToken(env.SESSION_SECRET);
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(token) });
}
