#!/usr/bin/env node
// 字魂龙吟手书 子集化脚本（已获得商用授权）
// 用法:
//   node scripts/subset-zihun.mjs ["<TTF 路径>"]
// 默认 TTF 路径为下载目录中的原始文件；子集字符集取 scripts/charset.txt。
// 依赖: Python 3.10+ 且已 pip install fonttools brotli
import { readFile, writeFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const PROJECT_ROOT = resolve(import.meta.dirname, '..');
const CHARSET_TXT = join(PROJECT_ROOT, 'scripts', 'charset.txt');
const OUT = join(PROJECT_ROOT, 'assets', 'fonts', 'zihun-longyin-shushu-subset.woff2');
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

const raw = await readFile(CHARSET_TXT, 'utf8');
const charset = raw.split('\n').filter(l => !l.startsWith('#')).join('');
const tmpTxt = join(PROJECT_ROOT, 'scripts', '.charset-zihun.tmp.txt');
await writeFile(tmpTxt, charset, 'utf8');

const r = spawnSync(python, ['-m', 'fontTools.subset', ttf,
  `--text-file=${tmpTxt}`,
  `--output-file=${OUT}`,
  '--flavor=woff2',
  '--layout-features=*',
  '--no-hinting',
  '--desubroutinize',
], { stdio: 'inherit' });

if (r.status !== 0) { console.error('子集化失败'); process.exit(r.status ?? 1); }
const s = await stat(OUT);
console.log(`[font] wrote zihun-longyin-shushu-subset.woff2 (${(s.size / 1024).toFixed(1)} KB)`);
