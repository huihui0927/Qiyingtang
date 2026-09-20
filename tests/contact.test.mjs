import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestPost, buildFeishuPost, signFeishu } from '../functions/api/contact.js';

function makeReq({ body, headers = {}, method = 'POST', url = 'https://x/api/contact' } = {}) {
  return {
    method, url,
    headers: new Headers({ origin: 'https://x', 'content-type': 'application/json', ...headers }),
    json: async () => body,
    text: async () => JSON.stringify(body ?? {}),
  };
}
const ENV = { FEISHU_WEBHOOK_URL: 'https://open.feishu.cn/open-apis/bot/v2/hook/test' };

function futureDate(daysAhead = 30) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

describe('buildFeishuPost', () => {
  it('builds rich-text post with all fields', () => {
    const p = buildFeishuPost({ name:'张三', phone:'15210475723', date:'2026-10-01', type:'portrait', message:'你好' }, '1.2.3.4');
    expect(p.msg_type).toBe('post');
    const content = JSON.parse(p.content);
    expect(content.post.zh_cn.title).toContain('张三');
    const text = JSON.stringify(content);
    expect(text).toContain('15210475723');
    expect(text).toContain('2026-10-01');
    expect(text).toContain('人像写真');
    expect(text).toContain('你好');
    expect(text).toContain('1.2.3.4');
  });
  it('maps type enum to Chinese', () => {
    for (const [t, cn] of [['portrait','人像写真'],['wedding','婚礼摄影'],['event','活动摄影'],['other','其他']]) {
      const p = buildFeishuPost({ name:'a', phone:'15210475723', date:'2026-10-01', type:t, message:'' }, 'unknown');
      expect(JSON.parse(p.content).post.zh_cn.content.flat().some(x => x.text?.includes(cn))).toBe(true);
    }
  });
  it('includes IP line', () => {
    const p = buildFeishuPost({ name:'a', phone:'15210475723', date:'2026-10-01', type:'portrait', message:'' }, '10.0.0.1');
    const text = JSON.stringify(p);
    expect(text).toContain('10.0.0.1');
  });
});

describe('signFeishu', () => {
  it('produces deterministic base64 hmac', async () => {
    const s1 = await signFeishu(1700000000, 'secret');
    const s2 = await signFeishu(1700000000, 'secret');
    expect(s1).toBe(s2);
    expect(typeof s1).toBe('string');
  });
});

describe('POST /api/contact', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('rejects cross-origin', async () => {
    const req = makeReq({ body: { name:'a', phone:'15210475723', date: futureDate(30), type:'portrait', message:'' }, headers: { origin: 'https://evil.com' } });
    const res = await onRequestPost({ request: req, env: ENV });
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.ok).toBe(false);
  });

  it('silently accepts honeypot (returns 200 but does not forward)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 0 }), { status: 200 }));
    const req = makeReq({ body: { name:'a', phone:'15210475723', date: futureDate(30), type:'portrait', message:'', website:'bot' } });
    const res = await onRequestPost({ request: req, env: ENV });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects invalid payload with field errors', async () => {
    const req = makeReq({ body: { name:'', phone:'bad', date:'2020-01-01', type:'x', message:'' } });
    const res = await onRequestPost({ request: req, env: ENV });
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.errors).toBeDefined();
    expect(Object.keys(j.errors).sort()).toEqual(['date','name','phone','type']);
  });

  it('forwards to feishu and returns ok', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 0, msg: 'success' }), { status: 200 }));
    const req = makeReq({ body: { name:'张三', phone:'15210475723', date: futureDate(30), type:'portrait', message:'hi' } });
    const res = await onRequestPost({ request: req, env: ENV });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledWith(ENV.FEISHU_WEBHOOK_URL, expect.objectContaining({ method: 'POST' }));
  });

  it('returns 502 when feishu replies non-zero after retry', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 19001, msg: 'sign error' }), { status: 200 }));
    const req = makeReq({ body: { name:'张三', phone:'15210475723', date: futureDate(30), type:'portrait', message:'' } });
    const res = await onRequestPost({ request: req, env: ENV });
    expect(res.status).toBe(502);
  });

  it('retries once on feishu failure then succeeds', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 19001, msg: 'temp error' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0 }), { status: 200 }));
    const req = makeReq({ body: { name:'张三', phone:'15210475723', date: futureDate(30), type:'portrait', message:'' } });
    const res = await onRequestPost({ request: req, env: ENV });
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('signs when FEISHU_WEBHOOK_SECRET present', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 0 }), { status: 200 }));
    const req = makeReq({ body: { name:'张三', phone:'15210475723', date: futureDate(30), type:'portrait', message:'' } });
    const res = await onRequestPost({ request: req, env: { ...ENV, FEISHU_WEBHOOK_SECRET: 's3cr3t' } });
    expect(res.status).toBe(200);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.timestamp).toBeDefined();
    expect(body.sign).toBeDefined();
  });

  it('reads CF-Connecting-IP and passes to buildFeishuPost', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 0 }), { status: 200 }));
    const req = makeReq({ body: { name:'张三', phone:'15210475723', date: futureDate(30), type:'portrait', message:'' }, headers: { 'cf-connecting-ip': '203.0.113.42' } });
    const res = await onRequestPost({ request: req, env: ENV });
    expect(res.status).toBe(200);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const content = JSON.parse(body.content);
    const text = JSON.stringify(content);
    expect(text).toContain('203.0.113.42');
  });

  it('accepts name up to 30 chars', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 0 }), { status: 200 }));
    const req = makeReq({ body: { name:'a'.repeat(30), phone:'15210475723', date: futureDate(30), type:'portrait', message:'' } });
    const res = await onRequestPost({ request: req, env: ENV });
    expect(res.status).toBe(200);
  });

  it('rejects name over 30 chars', async () => {
    const req = makeReq({ body: { name:'a'.repeat(31), phone:'15210475723', date: futureDate(30), type:'portrait', message:'' } });
    const res = await onRequestPost({ request: req, env: ENV });
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.errors.name).toBeDefined();
  });

  it('rejects date > +365d', async () => {
    const farFuture = new Date(); farFuture.setDate(farFuture.getDate() + 400);
    const req = makeReq({ body: { name:'张三', phone:'15210475723', date: farFuture.toISOString().slice(0,10), type:'portrait', message:'' } });
    const res = await onRequestPost({ request: req, env: ENV });
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.errors.date).toBeDefined();
  });
});

describe('Pages Functions routing contract', () => {
  it('exports onRequestPost / onRequestGet (method-based routing names)', async () => {
    const mod = await import('../functions/api/contact.js');
    expect(typeof mod.onRequestPost).toBe('function');
    expect(typeof mod.onRequestGet).toBe('function');
  });

  it('handler takes a single context object { request, env }', async () => {
    const mod = await import('../functions/api/contact.js');
    const req = makeReq({ body: { name:'a', phone:'15210475723', date: futureDate(30), type:'portrait', message:'' }, headers: { origin: 'https://evil.com' } });
    const res = await mod.onRequestPost({ request: req, env: ENV });
    expect(res.status).toBe(400);
  });
});
