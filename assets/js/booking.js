import { validateForm } from './validate.js';

export function initBooking(form, { endpoint = '/api/contact' } = {}) {
  const status = form.querySelector('[data-status]');
  const submit = form.querySelector('button[type="submit"]');

  function setError(field, msg) {
    const input = form.elements[field];
    const slot = form.querySelector(`[data-error-for="${field}"]`);
    if (msg) {
      input?.setAttribute('aria-invalid', 'true');
      if (slot) { slot.textContent = msg; slot.hidden = false; }
    } else {
      input?.removeAttribute('aria-invalid');
      if (slot) { slot.textContent = ''; slot.hidden = true; }
    }
  }
  function clearErrors() { for (const f of ['name','phone','date','type','message','website']) setError(f, null); }
  function setStatus(kind, text) {
    status.dataset.kind = kind;
    status.textContent = text;
    status.hidden = false;
  }

  // 服务端把失败原因写在响应体里（misconfigured / upstream / origin / invalid / internal）。
  // 以前非 2xx 一律只报「HTTP 500」，把原因整个丢掉了 —— 这个表单故障因此始终无法定位。
  const FALLBACK = '，请稍后重试，或直接致电 152 1047 5723。';
  const FAIL_TEXT = {
    misconfigured: '服务端通知渠道未配置',
    upstream: '通知渠道暂时不可达',
    origin: '请从本站页面重新提交',
    internal: '服务端处理异常',
    'bad-json': '提交内容格式有误',
  };
  function failMessage(res, data) {
    const code = data && data.error;
    if (code === 'invalid' && data.errors) {
      for (const [k, v] of Object.entries(data.errors)) setError(k, v);
      return '请检查表单中标红的字段。';
    }
    // 括号里保留原始错误码：报障时一句话就能定位，不用再猜是哪种故障。
    const label = FAIL_TEXT[code] || '提交失败';
    return `${label}（${code || 'HTTP ' + res.status}）${FALLBACK}`;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    const r = validateForm(payload);
    if (!r.ok) {
      for (const [k, v] of Object.entries(r.errors)) setError(k, v);
      setStatus('error', '请检查表单中标红的字段。');
      const firstBad = form.querySelector('[aria-invalid="true"]');
      firstBad?.focus();
      return;
    }
    submit.disabled = true;
    setStatus('pending', '提交中…');
    let res;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(r.value),
      });
    } catch {
      setStatus('error', `网络不通，提交失败（network）${FALLBACK}`);
      submit.disabled = false;
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) setStatus('error', failMessage(res, data));
    else {
      form.reset();
      setStatus('success', '已收到您的预约，我们会在 1 个工作日内联系您。');
    }
    submit.disabled = false;
  });
}
