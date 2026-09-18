const PHONE_RE = /^1[3-9]\d{9}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TYPES = new Set(['portrait','wedding','event','other']);

export function validateName(s) {
  const v = (s || '').trim();
  if (!v) return '请填写姓名（必填）';
  if (v.length > 30) return '姓名过长（最多 30 字）';
  return null;
}
export function validatePhone(s) {
  const v = (s || '').replace(/[\s-]/g, '');
  if (!v) return '请填写手机号（必填）';
  if (!PHONE_RE.test(v)) return '请输入有效的中国大陆手机号';
  return null;
}
export function validateDate(s, today = new Date()) {
  const v = (s || '').trim();
  if (!v) return '请选择拍摄日期（必填）';
  if (!DATE_RE.test(v)) return '日期格式应为 YYYY-MM-DD';
  const d = new Date(v + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return '日期格式应为 YYYY-MM-DD';
  const t = new Date(today); t.setUTCHours(0,0,0,0);
  const max = new Date(t); max.setUTCDate(max.getUTCDate() + 365);
  if (d < t) return '日期已过去，请重新选择';
  if (d > max) return '日期不能超过一年以内';
  return null;
}
export function validateType(s) {
  if (!TYPES.has(s)) return '请选择拍摄类型';
  return null;
}
export function validateMessage(s) {
  const v = s || '';
  if (v.length > 500) return '留言过长（最多 500 字）';
  return null;
}
export function validateHoneypot(s) {
  return (s && s.length > 0) ? 'spam' : null;
}
export function validateForm(p, today = new Date()) {
  const errors = {};
  const checks = [
    ['name', validateName(p.name)],
    ['phone', validatePhone(p.phone)],
    ['date', validateDate(p.date, today)],
    ['type', validateType(p.type)],
    ['message', validateMessage(p.message)],
    ['website', validateHoneypot(p.website)],
  ];
  for (const [k, e] of checks) if (e) errors[k] = e;
  return Object.keys(errors).length
    ? { ok: false, errors }
    : { ok: true, value: { name: p.name.trim(), phone: p.phone.replace(/[\s-]/g,''), date: p.date, type: p.type, message: (p.message||'').trim() } };
}
