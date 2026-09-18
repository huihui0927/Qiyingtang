#!/usr/bin/env node
// 字魂龙吟手书 子集化脚本（已获得商用授权）
// 用法:
//   node scripts/subset-zihun.mjs ["<TTF 路径>"]
// 默认 TTF 路径为下载目录中的原始文件；子集字符集为 BRUSH_TEXT
// （书法字体仅用于 hero 标题 / 品牌故事引言 / 结尾标题，按需裁剪）。
// 若首页新增书法文字，请同步补充 BRUSH_TEXT。
// 依赖: Python 3.10+ 且已 pip install fonttools brotli
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const PROJECT_ROOT = resolve(import.meta.dirname, '..');
const OUT = join(PROJECT_ROOT, 'assets', 'fonts', 'zihun-longyin-shushu-subset.woff2');
const DEFAULT_TTF = 'C:/Users/ThinkPad/Downloads/Compressed/字魂龙吟手书(商用需授权)/字魂龙吟手书(商用需授权).ttf';

const BRUSH_TEXT = '栖一方光影留半盏流年如果你正在寻找欢迎告诉我们你的故事摄影不是记录而是与时间交换记忆婚礼人像写真活动纪实品牌影像——、。·';

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

const charset = BRUSH_TEXT;
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
console.log('[font] wrote zihun-longyin-shushu-subset.woff2');
