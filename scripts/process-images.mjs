#!/usr/bin/env node
import sharp from 'sharp';
import { readdir, mkdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename, extname, resolve } from 'node:path';
import { homedir } from 'node:os';

const SOURCE_ROOT = join(homedir(), 'Downloads', '栖影堂');
const PROJECT_ROOT = resolve(import.meta.dirname, '..');
const OUT_ROOT = join(PROJECT_ROOT, 'assets', 'images');
const DATA_ROOT = join(PROJECT_ROOT, 'assets', 'data');

const CATEGORY_MAP = [
  { dir: '1.首页',     out: 'home',     label: '封面' },
  { dir: '2.人像写真', out: 'portrait', label: '人像写真' },
  { dir: '3.活动摄影', out: 'event',    label: '活动摄影' },
  { dir: '4.婚礼摄影', out: 'wedding',  label: '婚礼摄影' },
];

const WEDDING_SUBCATEGORY = {
  // 4.婚礼摄影/婚礼摄影.md 的 领证跟拍 小节含 26 张（8 哈希 + 7 时间戳 + 11 image*.png）：下方 Set 枚举哈希与 image* 词干，2026-05-31 前缀规则覆盖时间戳。
};
const LICENCE_FILES = new Set([
  '0da947d78e46dd64c8babfbc58185984','311b53ebbeffb424c159c22fcf3a72ea',
  '2520622fa352b2aec215a76bb0794a64','52e2115542ce62b38adbc6f81972ceff',
  '17393944f15a83412f26c4a714b96fb4','16a5754871217186d25c1eaffaf8df72',
  '36c965cb001cecccae21be4dc2537acd','b6d121b4a69f3a71ef6561e2cfedf78b',
  // image*.png 属 领证跟拍；image-1/-5/-11 属 婚礼跟拍，故意排除
  'image','image-2','image-3','image-4','image-6','image-7',
  'image-8','image-9','image-10','image-12','image-13',
]);
// 时间戳前缀 "2026-05-31" 也归入领证
function weddingCategory(stem) {
  if (LICENCE_FILES.has(stem)) return '领证';
  if (stem.startsWith('2026-05-31')) return '领证';
  return '婚礼';
}

const PORTRAIT_STYLES = ['清新日系','情绪写真','韩系风','港风','夜景写真'];
const EVENT_TYPES = ['企业活动','年会','发布会','路演','展会'];
function portraitCategory(idx, total) { return PORTRAIT_STYLES[idx % PORTRAIT_STYLES.length]; }
function eventCategory(idx, total) { return EVENT_TYPES[idx % EVENT_TYPES.length]; }

function safeStem(name) {
  return basename(name, extname(name))
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'img';
}

export async function processOne(srcPath, outDir, category, stem, altText) {
  await mkdir(outDir, { recursive: true });
  const img = sharp(srcPath).rotate(); // rotate() honors EXIF orientation, then strips metadata by default
  const meta = await img.metadata();
  const longest = Math.max(meta.width || 0, meta.height || 0);

  const baseWebp = join(outDir, `${stem}.webp`);
  const thumbWebp = join(outDir, `${stem}-thumb.webp`);
  const fallbackJpg = join(outDir, `${stem}.jpg`);
  const big2x = join(outDir, `${stem}@2x.webp`);

  const mainBuf = await img.clone().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(baseWebp);
  await img.clone().resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true }).webp({ quality: 75 }).toFile(thumbWebp);
  await img.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toFile(fallbackJpg);

  let has2x = false;
  if (longest >= 2800) {
    await img.clone().resize({ width: 2800, height: 2800, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(big2x);
    has2x = true;
  }

  return {
    id: stem,
    src: `assets/images/${category}/${stem}.webp`,
    srcset: [
      `assets/images/${category}/${stem}-thumb.webp 800w`,
      `assets/images/${category}/${stem}.webp 2000w`,
      ...(has2x ? [`assets/images/${category}/${stem}@2x.webp 2800w`] : []),
    ].join(', '),
    fallback: `assets/images/${category}/${stem}.jpg`,
    thumb: `assets/images/${category}/${stem}-thumb.webp`,
    width: mainBuf.width,
    height: mainBuf.height,
    alt: altText,
  };
}

export function buildGalleryJson(items) { return { items }; }

async function listImages(dir) {
  if (!existsSync(dir)) return [];
  const all = await readdir(dir);
  return all.filter(f => /\.(jpe?g|png|webp)$/i.test(f)).sort();
}

async function main() {
  await mkdir(DATA_ROOT, { recursive: true });
  const summary = {};
  for (const cat of CATEGORY_MAP) {
    const srcDir = join(SOURCE_ROOT, cat.dir, '图片和附件');
    const outDir = join(OUT_ROOT, cat.out);
    const files = await listImages(srcDir);
    const items = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const stem = safeStem(f);
      let alt = `${cat.label} 作品 ${i + 1}`;
      let categoryField;
      if (cat.out === 'portrait') categoryField = portraitCategory(i, files.length);
      else if (cat.out === 'event') categoryField = eventCategory(i, files.length);
      else if (cat.out === 'wedding') categoryField = weddingCategory(stem);
      const item = await processOne(join(srcDir, f), outDir, cat.out, stem, alt);
      if (categoryField) item.category = categoryField;
      items.push(item);
      process.stdout.write(`\r[${cat.out}] ${i + 1}/${files.length}`);
    }
    process.stdout.write('\n');
    if (cat.out !== 'home') {
      await writeFile(join(DATA_ROOT, `${cat.out}.json`), JSON.stringify(buildGalleryJson(items), null, 2), 'utf8');
    }
    summary[cat.out] = items.length;
  }
  console.log('Done:', summary);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  main().catch(e => { console.error(e); process.exit(1); });
}
