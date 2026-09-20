import { json, clearedCookie } from '../../_lib.js';

export function onRequestPost() {
  return json({ ok: true }, 200, { 'set-cookie': clearedCookie() });
}
