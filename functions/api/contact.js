// Cloudflare Pages Function — Workers runtime
// Secret: FEISHU_WEBHOOK_URL (required), FEISHU_WEBHOOK_SECRET (optional)

const PHONE_RE = /^1[3-9]\d{9}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TYPES = { portrait:'人像写真', wedding:'婚礼摄影', event:'活动摄影', other:'其他' };
const MAX_MESSAGE = 500;
const MAX_NAME = 30;

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function validate(p) {
  const errors = {};
  const name = (p.name || '').trim();
  if (!name) errors.name = '必填'; else if (name.length > MAX_NAME) errors.name = '过长';
  const phone = (p.phone || '').replace(/[\s-]/g, '');
  if (!PHONE_RE.test(phone)) errors.phone = '无效手机号';
  const date = (p.date || '').trim();
  if (!DATE_RE.test(date)) errors.date = '格式错误';
  else {
    const d = new Date(date + 'T00:00:00Z');
    const t = new Date(); t.setUTCHours(0,0,0,0);
    const MAX_DATE_DAYS = 365;
    const max = new Date(t); max.setUTCDate(max.getUTCDate() + MAX_DATE_DAYS);
    if (d < t) errors.date = '过去';
    else if (d > max) errors.date = '超过一年';
  }
  if (!(p.type in TYPES)) errors.type = '无效类型';
  if ((p.message || '').length > MAX_MESSAGE) errors.message = '过长';
  return { ok: Object.keys(errors).length === 0, errors, value: { name, phone, date, type: p.type, message: (p.message || '').trim() } };
}

export function buildFeishuPost(v, ip) {
  const typeCn = TYPES[v.type] || v.type;
  const lines = [
    [{ tag: 'text', text: `姓名：${v.name}` }],
    [{ tag: 'text', text: `手机：${v.phone}` }],
    [{ tag: 'text', text: `期望日期：${v.date}` }],
    [{ tag: 'text', text: `拍摄类型：${typeCn}` }],
  ];
  if (v.message) lines.push([{ tag: 'text', text: `备注：${v.message}` }]);
  lines.push([{ tag: 'text', text: `提交时间：${new Date().toISOString()}` }]);
  lines.push([{ tag: 'text', text: `IP：${ip || 'unknown'}` }]);
  return {
    msg_type: 'post',
    content: JSON.stringify({
      post: { zh_cn: { title: `📷 新预约 · ${v.name} · ${typeCn}`, content: lines } },
    }),
  };
}

export async function signFeishu(timestamp, secret) {
  const stringToSign = `${timestamp}\n${secret}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(stringToSign),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new Uint8Array(0));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function sameOrigin(req) {
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const url = new URL(req.url);
  if (origin) { try { return new URL(origin).host === url.host; } catch { return false; } }
  if (referer) { try { return new URL(referer).host === url.host; } catch { return false; } }
  return true;
}

export async function onRequestPost(context) {
  const req = context.request;
  try {
    if (!sameOrigin(req)) return json(400, { ok: false, error: 'origin' });
    const env = context.env || {};
    if (!env.FEISHU_WEBHOOK_URL) return json(500, { ok: false, error: 'misconfigured' });

    let body;
    try { body = await req.json(); } catch { return json(400, { ok: false, error: 'bad-json' }); }

    // Honeypot: silent 200, don't forward
    if (body.website) return json(200, { ok: true });

    const r = validate(body || {});
    if (!r.ok) return json(400, { ok: false, error: 'invalid', errors: r.errors });

    const ip = req.headers.get('cf-connecting-ip') || 'unknown';
    const payload = buildFeishuPost(r.value, ip);
    if (env.FEISHU_WEBHOOK_SECRET) {
      const timestamp = Math.floor(Date.now() / 1000);
      payload.timestamp = String(timestamp);
      payload.sign = await signFeishu(timestamp, env.FEISHU_WEBHOOK_SECRET);
    }

    // Forward to Feishu with 1 retry
    let lastError;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const upstream = await fetch(env.FEISHU_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const text = await upstream.text();
        let data; try { data = JSON.parse(text); } catch { data = { code: -1, msg: text }; }
        if (upstream.ok && data.code === 0) {
          return json(200, { ok: true });
        }
        lastError = { status: upstream.status, code: data.code, msg: data.msg };
        console.error(`Feishu webhook attempt ${attempt + 1} failed:`, lastError);
      } catch (e) {
        lastError = { error: String(e?.message || e) };
        console.error(`Feishu webhook attempt ${attempt + 1} network error:`, lastError);
      }
    }
    return json(502, { ok: false, error: 'upstream', detail: lastError });
  } catch (e) {
    return json(500, { ok: false, error: 'internal', detail: String(e?.message || e) });
  }
}

export async function onRequestGet() {
  return json(405, { ok: false, error: 'method-not-allowed' });
}
