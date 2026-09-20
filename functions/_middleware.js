// Pages Functions 全局中间件：只保护 /api/ 下的写操作与非公开读。
// 静态资源与既有 /api/contact 直接放行。
import { verifySessionToken, parseCookies, SESSION_COOKIE, error } from './_lib.js';

// 公开路由：前台只读 + 登录。其余 /api/* 需鉴权。
const PUBLIC_GET = [/^\/api\/gallery(\/|$)/, /^\/api\/stories(\/|$)/, /^\/api\/home$/, /^\/api\/media\//];
const PUBLIC_POST = [/^\/api\/auth\/login$/];

export async function onRequest(context) {
  const { request, next, env } = context;
  const path = new URL(request.url).pathname;

  if (!path.startsWith('/api/')) return next();
  if (path.startsWith('/api/contact')) return next();

  const method = request.method;
  let isPublic = false;
  if (method === 'GET') isPublic = PUBLIC_GET.some(re => re.test(path));
  else if (method === 'POST') isPublic = PUBLIC_POST.some(re => re.test(path));

  if (isPublic) return next();

  const token = parseCookies(request)[SESSION_COOKIE];
  const ok = await verifySessionToken(token, env.SESSION_SECRET);
  if (!ok) return error('未授权，请先登录', 401);
  return next();
}
