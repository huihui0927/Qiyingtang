/** @vitest-environment jsdom */
// 预约表单的失败路径。守住一件事：服务端把原因写在响应体里（misconfigured / upstream /
// origin / invalid / internal），前端必须把它翻成人话并保留原始码 ——
// 以前非 2xx 一律只报「HTTP 500」，用户截图过来也无法判断是密钥没生效还是飞书不通。
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initBooking } from '../assets/js/booking.js';

const read = p => readFileSync(resolve(process.cwd(), p), 'utf8');

const FORM = `<form id="booking-form">
  <input name="name"><p data-error-for="name" hidden></p>
  <input name="phone"><p data-error-for="phone" hidden></p>
  <input name="date" type="date"><p data-error-for="date" hidden></p>
  <select name="type"><option value=""></option><option value="wedding"></option></select>
  <p data-error-for="type" hidden></p>
  <textarea name="message"></textarea><p data-error-for="message" hidden></p>
  <input name="website"><p data-error-for="website" hidden></p>
  <p data-status hidden role="status"></p>
  <button type="submit">提交预约</button>
</form>`;

// 服务端只接受今天到一年内的日期，测试不能写死。
const soon = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 10);
  return d.toISOString().slice(0, 10);
};

const res = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

let form, status, submit;

beforeEach(() => {
  document.body.innerHTML = FORM;
  form = document.getElementById('booking-form');
  status = form.querySelector('[data-status]');
  submit = form.querySelector('button[type="submit"]');
  initBooking(form);
  form.elements.name.value = '测试';
  form.elements.phone.value = '15210475723';
  form.elements.date.value = soon();
  form.elements.type.value = 'wedding';
});

afterEach(() => { vi.restoreAllMocks(); });

// submit 处理器里有两个 await（fetch、res.json），一次宏任务不够。
const flush = async () => { for (let i = 0; i < 4; i++) await new Promise(r => setTimeout(r, 0)); };

async function submitWith(response) {
  global.fetch = vi.fn(async () => response);
  form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  await flush();
  return status.textContent;
}

describe('失败时把服务端错误码透出到状态栏', () => {
  it('misconfigured（密钥没生效）说清楚是通知渠道没配置，而不是干巴巴一个 500', async () => {
    const text = await submitWith(res(500, { ok: false, error: 'misconfigured' }));
    expect(text).toContain('服务端通知渠道未配置');
    expect(text).toContain('misconfigured');
    expect(text).not.toContain('HTTP 500');
    expect(text).toContain('152 1047 5723');
  });

  it('upstream（飞书不通，服务端返回 502）单独一句话', async () => {
    const text = await submitWith(res(502, { ok: false, error: 'upstream', detail: { code: 19001 } }));
    expect(text).toContain('通知渠道暂时不可达');
    expect(text).toContain('upstream');
  });

  it('origin / internal 各有对应文案', async () => {
    expect(await submitWith(res(400, { ok: false, error: 'origin' }))).toContain('请从本站页面重新提交');
    expect(await submitWith(res(500, { ok: false, error: 'internal' }))).toContain('服务端处理异常');
  });

  it('没见过的错误码回落到 HTTP 状态，但绝不把状态码以外的信息吞掉', async () => {
    const text = await submitWith(res(500, { ok: false, error: 'brand-new-code' }));
    expect(text).toContain('提交失败');
    expect(text).toContain('brand-new-code');
  });

  it('响应体不是 JSON 时退回裸 HTTP 状态码，不炸', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => { throw new Error('not json'); } }));
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await flush();
    expect(status.textContent).toContain('HTTP 500');
  });

  it('200 但 ok:false 也算失败（不能被状态码骗过去）', async () => {
    const text = await submitWith(res(200, { ok: false, error: 'internal' }));
    expect(text).toContain('服务端处理异常');
    expect(status.dataset.kind).toBe('error');
  });

  it('invalid 时把服务端的字段错误标到对应输入框上', async () => {
    const text = await submitWith(res(400, { ok: false, error: 'invalid', errors: { phone: '无效手机号' } }));
    expect(text).toBe('请检查表单中标红的字段。');
    expect(form.elements.phone.getAttribute('aria-invalid')).toBe('true');
    const slot = form.querySelector('[data-error-for="phone"]');
    expect(slot.hidden).toBe(false);
    expect(slot.textContent).toBe('无效手机号');
  });

  it('网络层直接失败时说明是网络不通，并留下电话', async () => {
    global.fetch = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await flush();
    expect(status.textContent).toContain('网络不通');
    expect(status.textContent).toContain('152 1047 5723');
    expect(submit.disabled).toBe(false);
  });

  it('失败后提交按钮恢复可用，用户才能重试', async () => {
    await submitWith(res(500, { ok: false, error: 'misconfigured' }));
    expect(submit.disabled).toBe(false);
  });
});

describe('成功路径没有被改坏', () => {
  it('成功时清空表单并给出成功文案', async () => {
    const text = await submitWith(res(200, { ok: true }));
    expect(text).toContain('已收到您的预约');
    expect(status.dataset.kind).toBe('success');
    expect(form.elements.name.value).toBe('');
    expect(submit.disabled).toBe(false);
  });

  it('前端校验不通过时根本不发请求', async () => {
    global.fetch = vi.fn(async () => res(200, { ok: true }));
    form.elements.phone.value = '123';
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await flush();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(status.textContent).toBe('请检查表单中标红的字段。');
  });
});

describe('版本戳与回归锁', () => {
  it('booking.html 引用的 booking.js 带 ?v= 且已随本次改动升到 3', () => {
    const html = read('booking.html');
    const m = html.match(/assets\/js\/booking\.js\?v=(\d+)/);
    expect(m, 'booking.html 里的 booking.js 引用丢了 ?v= 版本戳').not.toBeNull();
    expect(Number(m[1])).toBeGreaterThanOrEqual(3);
  });

  it('绝不退回「非 2xx 就丢掉响应体」的老写法', () => {
    const js = read('assets/js/booking.js');
    expect(js).not.toMatch(/if \(!res\.ok\) throw new Error\(/);
    expect(js).toMatch(/await res\.json\(\)\.catch\(\(\) => \(\{\}\)\)/);
  });
});
