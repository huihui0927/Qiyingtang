import { json, error, validId } from '../../_lib.js';

// POST /api/photos/reorder —— body: { ids: ["id1","id2",...] }，按数组下标写 sort_order
// 批量更新，走事务减少写入次数。仅更新存在的 id。
export async function onRequestPost(context) {
  const { request, env } = context;
  let b;
  try { b = await request.json(); } catch { return error('请求格式错误'); }
  if (!Array.isArray(b.ids) || b.ids.length === 0) return error('ids 必须是非空数组');
  if (b.ids.length > 500) return error('一次排序过多');

  const stmts = [];
  b.ids.forEach((id, i) => {
    if (!validId(String(id))) return;
    stmts.push(env.DB.prepare('UPDATE photos SET sort_order = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(i, String(id)));
  });
  if (!stmts.length) return error('无有效 id');

  await env.DB.batch(stmts);
  return json({ ok: true, updated: stmts.length });
}
