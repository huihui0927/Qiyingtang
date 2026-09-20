import { json } from '../../_lib.js';

// 受 _middleware 保护：能进来即已鉴权。供后台探测登录态。
export function onRequestGet() {
  return json({ ok: true });
}
