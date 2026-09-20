// 迁移历史静态画廊图到 D1：把 assets/data/{portrait,wedding,event}.json 里每张图写成
// 一条 photos 行（source='site'，图片仍是 Pages 静态路径，不搬进 R2）。
// 之后 /api/gallery/{cat} 成为唯一来源；后台可编辑/隐藏/删除旧图。
//
// 幂等：id = 'lg-' + sha256(item.src).slice(0,20)（与内容无关、可重复），用 INSERT OR IGNORE，
// 重跑不会覆盖后台已做的改动（隐藏/改名/删除标记不会被复活内容覆盖，只补空缺）。
//
// 生成文件：repo 根目录 legacy.sql（已 gitignore）。执行：
//   npm run db:legacy:local     本地 D1
//   npm run db:legacy:remote    线上 D1
// 需先跑过 schema.sql（含 subcategory / source 列）。

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['portrait', 'wedding', 'event'];
const OUT = path.join(root, 'legacy.sql');

const q = v => {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
};

// 站内相对路径，去掉可能的前导斜杠；publicUrl(source='site') 会补回 '/'。
const relPath = p => String(p || '').replace(/^\/+/, '');

const rows = [];
for (const cat of FILES) {
  const file = path.join(root, 'assets', 'data', `${cat}.json`);
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    console.warn(`跳过 ${cat}.json：${e.message}`);
    continue;
  }
  const items = Array.isArray(data.items) ? data.items : [];
  items.forEach((it, i) => {
    const width = Math.trunc(Number(it.width));
    const height = Math.trunc(Number(it.height));
    const src = relPath(it.src);
    const thumb = relPath(it.thumb || it.src);
    if (!src || !thumb) { console.warn(`  跳过 ${cat} #${i}：缺 src/thumb`); return; }
    if (!(width > 0) || !(height > 0)) { console.warn(`  跳过 ${cat} #${i}：尺寸非法`); return; }
    const id = 'lg-' + createHash('sha256').update(src).digest('hex').slice(0, 20);
    rows.push({
      id,
      title: it.alt || `${cat} 作品 ${i + 1}`,
      description: null,
      category: cat,
      subcategory: it.category || null,   // 旧 JSON 的 category 实为页内子标签（领证/婚礼/风格名）
      source: 'site',
      story_id: null,
      image_key: src,
      thumbnail_key: thumb,
      width,
      height,
      alt_text: it.alt || null,
      sort_order: i,
      is_published: 1,
    });
  });
  console.log(`${cat}: ${items.length} 项`);
}

const cols = 'id, title, description, category, subcategory, source, story_id, image_key, thumbnail_key, width, height, alt_text, sort_order, is_published';
const stmts = rows.map(r => {
  const vals = [r.id, r.title, r.description, r.category, r.subcategory, r.source, r.story_id,
    r.image_key, r.thumbnail_key, r.width, r.height, r.alt_text, r.sort_order, r.is_published];
  const literal = vals.map((v, idx) =>
    (typeof v === 'number') ? String(v) : q(v)
  );
  return `INSERT OR IGNORE INTO photos (${cols}) VALUES (${literal.join(', ')});`;
});

const header =
  `-- 由 scripts/migrate-legacy.mjs 生成，请勿手改。幂等：仅补空缺，不覆盖后台改动。\n` +
  `-- 执行前请先应用 schema.sql（含 subcategory / source 列）。\n` +
  `-- 共 ${rows.length} 条历史照片（source='site'）。\n\n`;

writeFileSync(OUT, header + stmts.join('\n') + '\n', 'utf8');
console.log(`\n写入 ${path.relative(root, OUT)}：${rows.length} 条 INSERT`);
