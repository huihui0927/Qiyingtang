#!/usr/bin/env node
// 字魂龙吟手书 子集化脚本（已获得商用授权）
// 用法:
//   node scripts/subset-zihun.mjs ["<TTF 路径>"]
// 默认 TTF 路径为下载目录中的原始文件；子集字符集取自 scripts/brush-text.txt。
// brush-text.txt 是艺术字文案的唯一事实源：新增/改动任何 --font-brush 文字都要同步到这里，
// 否则该字不在子集内，浏览器会静默回退到楷体，造成艺术字之间风格不一致。
// npm test（tests/brush-charset.test.mjs）会拦住这种漂移。
// 脚本还会把 fonts.css 里的 ?v= 改成新文件的哈希：Pages 用 max-age=31536000, immutable 发字体，
// URL 不变的话老访客会一直用旧子集，新加的艺术字就静默掉回楷体。
// 依赖: Python 3.10+ 且已 pip install fonttools brotli
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const PROJECT_ROOT = resolve(import.meta.dirname, '..');
const OUT = join(PROJECT_ROOT, 'assets', 'fonts', 'zihun-longyin-shushu-subset.woff2');
const FONTS_CSS = join(PROJECT_ROOT, 'assets', 'css', 'fonts.css');
const BRUSH_TEXT_FILE = join(import.meta.dirname, 'brush-text.txt');
const DEFAULT_TTF = 'C:/Users/ThinkPad/Downloads/Compressed/字魂龙吟手书(商用需授权)/字魂龙吟手书(商用需授权).ttf';

const PYTHON_CANDIDATES = [
  join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe'),
  join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe'),
  'python3', 'python',
];

function findPython() {
  for (const p of PYTHON_CANDIDATES) {
    const r = spawnSync(p, ['--version'], { stdio: 'pipe' });
    if (r.status === 0) return p;
  }
  return null;
}

const ttf = process.argv[2] || DEFAULT_TTF;
const python = findPython();
if (!python) { console.error('未找到 Python，请安装 Python 3.10+ 并执行: pip install fonttools brotli'); process.exit(1); }

const charset = [...new Set((await readFile(BRUSH_TEXT_FILE, 'utf8')).replace(/\s+/g, ''))].join('');
const tmpTxt = join(PROJECT_ROOT, 'scripts', '.charset-zihun.tmp.txt');
await writeFile(tmpTxt, charset, 'utf8');
console.log(`[font] ${charset.length} 个字形 ← scripts/brush-text.txt`);

const r = spawnSync(python, ['-m', 'fontTools.subset', ttf,
  `--text-file=${tmpTxt}`,
  `--output-file=${OUT}`,
  '--flavor=woff2',
  '--layout-features=*',
  '--no-hinting',
  '--desubroutinize',
], { stdio: 'inherit' });

await unlink(tmpTxt);
if (r.status !== 0) { console.error('子集化失败'); process.exit(r.status ?? 1); }

const version = createHash('sha256').update(await readFile(OUT)).digest('hex').slice(0, 8);
const css = await readFile(FONTS_CSS, 'utf8');
const stamped = css.replace(
  /zihun-longyin-shushu-subset\.woff2(\?v=[0-9a-f]+)?/g,
  `zihun-longyin-shushu-subset.woff2?v=${version}`,
);
if (!stamped.includes(`zihun-longyin-shushu-subset.woff2?v=${version}`)) {
  console.error('[font] fonts.css 里找不到 zihun 的 @font-face src，无法改写版本号');
  process.exit(1);
}
if (stamped !== css) await writeFile(FONTS_CSS, stamped, 'utf8');
console.log(`[font] wrote zihun-longyin-shushu-subset.woff2 + fonts.css → ?v=${version}`);

