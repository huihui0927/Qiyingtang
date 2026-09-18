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
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(r.value),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));
      if (data.ok === false) throw new Error(data.error || '提交失败');
      form.reset();
      setStatus('success', '已收到您的预约，我们会在 1 个工作日内联系您。');
    } catch (err) {
      setStatus('error', `提交失败：${err.message}。请稍后重试，或直接致电 152 1047 5723。`);
    } finally {
      submit.disabled = false;
    }
  });
}
