// 共用工具：session 签发/校验、响应封装、限流、校验。
// 设计：无状态 HMAC 签名的 HttpOnly cookie，不依赖 KV/D1，符合免费优先。

const encoder = new TextEncoder();
export const SESSION_COOKIE = 'qyt_admin';
export const SESSION_TTL = 7 * 24 * 3600; // 秒：7 天

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export function error(message, status = 400) {
  return json({ error: message }, status);
}

function toHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSign(payload, secret) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
}

// 定长比较，避免通过长度/时序泄露
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(secret) {
  const exp = Date.now() + SESSION_TTL * 1000;
  const sig = await hmacSign(String(exp), secret);
  return `${exp}.${sig}`;
}

export async function verifySessionToken(token, secret) {
  if (!token || !secret) return false;
  const i = token.lastIndexOf('.');
  if (i < 0) return false;
  const exp = token.slice(0, i);
  const sig = token.slice(i + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmacSign(exp, secret));
}

export function sessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL}`;
}

export function clearedCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function parseCookies(request) {
  const header = request.headers.get('cookie') || '';
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

// —— 简单内存限流（每 isolate 生效，尽力而为；避免引入付费 Rate Limiting）——
const attempts = new Map(); // ip -> { count, lockedUntil }
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

export function isLocked(ip) {
  const rec = attempts.get(ip);
  if (!rec) return false;
  if (rec.lockedUntil && rec.lockedUntil > Date.now()) return true;
  if (rec.lockedUntil) attempts.delete(ip);
  return false;
}

export function recordFailure(ip) {
  const rec = attempts.get(ip) || { count: 0, lockedUntil: 0 };
  rec.count += 1;
  if (rec.count >= MAX_FAILS) rec.lockedUntil = Date.now() + LOCK_MS;
  attempts.set(ip, rec);
}

export function clearFailures(ip) {
  attempts.delete(ip);
}

// —— 校验辅助 ——
export const ID_RE = /^[a-zA-Z0-9_-]{6,64}$/;
export const CATEGORIES = ['portrait', 'wedding', 'event'];

export function validId(id) {
  return typeof id === 'string' && ID_RE.test(id);
}

export function readNum(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// 把图片 key 拼成浏览器可访问的 URL。
// source='site'：历史静态图，key 本身就是站内路径（assets/images/...），原样返回，不经 R2/代理。
// source='r2'（默认）：未配置 R2_PUBLIC_BASE 时回退到本站 Function 代理 /api/media/{key}（本地开发）；
// 线上应配 R2 公开域名让图片绕过 Worker（免费额度 §33）。
export function publicUrl(env, key, source = 'r2') {
  if (!key) return null;
  if (source === 'site') return `/${String(key).replace(/^\/+/, '')}`;
  const base = env.R2_PUBLIC_BASE;
  if (base) return `${base.replace(/\/$/, '')}/${key}`;
  return `/api/media/${key}`;
}

// DB 行 → 对外 photo 对象（URL 由 key 派生）
export function rowToPhoto(env, r) {
  if (!r) return null;
  const source = r.source || 'r2';
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    subcategory: r.subcategory ?? null,
    source,
    story_id: r.story_id,
    image: publicUrl(env, r.image_key, source),
    thumbnail: publicUrl(env, r.thumbnail_key, source),
    width: r.width,
    height: r.height,
    alt_text: r.alt_text,
    sort_order: r.sort_order,
    is_published: !!r.is_published,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// DB 行 → 对外 story 对象
export function rowToStory(env, r) {
  if (!r) return null;
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle,
    cover: r.cover_key ? publicUrl(env, r.cover_key) : null,
    category: r.category,
    description: r.description,
    content: r.content,
    location: r.location,
    shoot_date: r.shoot_date,
    sort_order: r.sort_order,
    is_published: !!r.is_published,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}
