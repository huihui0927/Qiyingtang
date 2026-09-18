#!/usr/bin/env node
// Prerequisites: Python 3.10+ with fonttools and brotli installed
// Install with: pip install fonttools brotli
import { readFile, writeFile, mkdir, stat, copyFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import https from 'node:https';

const PROJECT_ROOT = resolve(import.meta.dirname, '..');
const FONT_DIR = join(PROJECT_ROOT, 'assets', 'fonts');
const CACHE_DIR = join(tmpdir(), 'qiyangtang-font-cache');
const CHARSET_TXT = join(PROJECT_ROOT, 'scripts', 'charset.txt');

const RELEASE_TAG = 'v1.522';
const GITHUB_API_ASSETS = {
  'LXGWWenKai-Regular.ttf': 375817996,
  'LXGWWenKai-Medium.ttf': 375818013,
};
const FONTS = [
  {
    name: 'LXGWWenKai-Regular',
    url: `https://github.com/lxgw/LxgwWenKai/releases/download/${RELEASE_TAG}/LXGWWenKai-Regular.ttf`,
    outFile: 'lxgw-wenkai-regular-subset.woff2',
    weight: 400,
  },
  {
    name: 'LXGWWenKai-Medium',
    url: `https://github.com/lxgw/LxgwWenKai/releases/download/${RELEASE_TAG}/LXGWWenKai-Medium.ttf`,
    outFile: 'lxgw-wenkai-medium-subset.woff2',
    weight: 500,
  },
];

const MODE = process.argv.includes('--mode=cn-font-split') ? 'cn-font-split' : 'pyftsubset';

const PYTHON_PATHS = [
  join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe'),
  join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe'),
  join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python310', 'python.exe'),
  'python3',
  'python',
];

function findPython() {
  for (const p of PYTHON_PATHS) {
    try {
      const r = spawnSync(p, ['--version'], { stdio: 'pipe' });
      if (r.status === 0) return p;
    } catch {}
  }
  return null;
}

function findPyftsubset(python) {
  const test = spawnSync('pyftsubset', ['--help'], { stdio: 'ignore' });
  if (test.status === 0) return 'pyftsubset';

  if (python) {
    const scriptDir = join(python, '..');
    const pyftsubsetExe = join(scriptDir, 'Scripts', 'pyftsubset.exe');
    if (existsSync(pyftsubsetExe)) return pyftsubsetExe;
    const pyftsubsetPy = join(scriptDir, 'Scripts', 'pyftsubset');
    if (existsSync(pyftsubsetPy)) return pyftsubsetPy;
  }
  return null;
}

function httpGet(url, opts = {}, timeout = 30000) {
  return new Promise((res, rej) => {
    const req = https.get(url, { ...opts, timeout }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        r.resume();
        return res({ redirect: r.headers.location });
      }
      res({ response: r });
    });
    req.on('error', rej);
    req.on('timeout', () => { req.destroy(); rej(new Error(`timeout: ${url}`)); });
  });
}

function readResponse(r) {
  return new Promise((res, rej) => {
    const chunks = [];
    r.on('data', c => chunks.push(c));
    r.on('end', () => res(Buffer.concat(chunks)));
    r.on('error', rej);
  });
}

async function downloadViaApi(filename, dest) {
  const assetId = GITHUB_API_ASSETS[filename];
  if (!assetId) return false;
  const apiUrl = `https://api.github.com/repos/lxgw/LxgwWenKai/releases/assets/${assetId}`;
  console.log(`[font] trying GitHub API for ${filename}...`);
  const r1 = await httpGet(apiUrl, { headers: { 'Accept': 'application/octet-stream', 'User-Agent': 'node' } });
  if (!r1.redirect) return false;
  const r2 = await httpGet(r1.redirect, {}, 120000);
  if (!r2.response || r2.response.statusCode !== 200) return false;
  const buf = await readResponse(r2.response);
  await writeFile(dest, buf);
  return true;
}

async function download(url, dest) {
  await mkdir(join(dest, '..'), { recursive: true });
  if (existsSync(dest)) {
    const s = await stat(dest);
    if (s.size > 1_000_000) return;
  }
  const filename = dest.split(/[/\\]/).pop();
  console.log(`[font] downloading ${filename}...`);
  try {
    await new Promise((res, rej) => {
      const follow = (u) => https.get(u, { timeout: 30000 }, r => {
        if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return follow(r.headers.location);
        if (r.statusCode !== 200) return rej(new Error(`HTTP ${r.statusCode} for ${u}`));
        const chunks = [];
        r.on('data', c => chunks.push(c));
        r.on('end', async () => { await writeFile(dest, Buffer.concat(chunks)); res(); });
      }).on('error', rej);
      follow(url);
    });
  } catch (e) {
    console.warn(`[font] direct download failed: ${e.message}`);
    const ok = await downloadViaApi(filename, dest);
    if (!ok) throw new Error(`failed to download ${filename} via all methods`);
  }
}

function buildCharSet(rawCharset) {
  const chars = new Set();

  for (const ch of rawCharset) {
    chars.add(ch);
  }

  for (let i = 0x0020; i <= 0x007E; i++) chars.add(String.fromCodePoint(i));
  for (let i = 0x2000; i <= 0x206F; i++) chars.add(String.fromCodePoint(i));
  for (let i = 0x3000; i <= 0x303F; i++) chars.add(String.fromCodePoint(i));
  for (let i = 0xFF00; i <= 0xFFEF; i++) chars.add(String.fromCodePoint(i));

  return chars;
}

async function tryPyftsubset(pyftsubsetCmd, ttfPath, outPath, charsetPath) {
  const args = [
    ttfPath,
    `--text-file=${charsetPath}`,
    `--output-file=${outPath}`,
    '--flavor=woff2',
    '--layout-features=*',
    '--no-hinting',
    '--desubroutinize',
  ];
  const r = spawnSync(pyftsubsetCmd, args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('pyftsubset failed');
}

async function tryCnFontSplit(ttfPath, outPath, chars) {
  const { fontSplit } = await import('cn-font-split');

  const codePoints = [];
  for (const ch of chars) {
    codePoints.push(ch.codePointAt(0));
  }
  codePoints.sort((a, b) => a - b);

  const ranges = [];
  let start = codePoints[0];
  let end = codePoints[0];
  for (let i = 1; i < codePoints.length; i++) {
    if (codePoints[i] === end + 1) {
      end = codePoints[i];
    } else {
      ranges.push(start === end ? start : [start, end]);
      start = codePoints[i];
      end = codePoints[i];
    }
  }
  ranges.push(start === end ? start : [start, end]);

  const tempOut = join(tmpdir(), 'cn-font-split-temp');
  await mkdir(tempOut, { recursive: true });

  await fontSplit({
    FontPath: ttfPath,
    destFold: tempOut,
    chunkSize: 2 * 1024 * 1024,
    subsets: [ranges],
    css: { fontFamily: 'LXGW WenKai', fontDisplay: 'swap' },
    testHTML: false,
    reporter: false,
    targetType: 'woff2',
  });

  const { readdir } = await import('node:fs/promises');
  const files = await readdir(tempOut);
  const woff2File = files.find(f => f.endsWith('.woff2'));
  if (!woff2File) throw new Error('cn-font-split did not produce a woff2 file');

  await copyFile(join(tempOut, woff2File), outPath);
  await rm(tempOut, { recursive: true, force: true });
}

async function subsetFont(font, chars, pyftsubsetCmd) {
  const ttfPath = join(CACHE_DIR, `${font.name}.ttf`);
  const outPath = join(FONT_DIR, font.outFile);

  await download(font.url, ttfPath);

  if (MODE === 'pyftsubset') {
    const tempCharset = join(CACHE_DIR, `charset-${font.name}.txt`);
    await writeFile(tempCharset, Array.from(chars).join(''), 'utf8');
    await tryPyftsubset(pyftsubsetCmd, ttfPath, outPath, tempCharset);
  } else {
    await tryCnFontSplit(ttfPath, outPath, chars);
  }

  const s = await stat(outPath);
  console.log(`[font] wrote ${font.outFile} (${(s.size / 1024).toFixed(1)} KB, weight ${font.weight})`);
  if (s.size > 350 * 1024) {
    console.warn(`[font] WARNING: ${font.outFile} > 350 KB, consider trimming charset.txt`);
  }
  return s.size;
}

async function main() {
  await mkdir(FONT_DIR, { recursive: true });
  await mkdir(CACHE_DIR, { recursive: true });

  const rawCharset = await readFile(CHARSET_TXT, 'utf8');
  const lines = rawCharset.split('\n').filter(l => !l.startsWith('#'));
  const cleanCharset = lines.join('');
  const chars = buildCharSet(cleanCharset);

  console.log(`[font] charset size: ${chars.size} characters`);
  console.log(`[font] mode: ${MODE}`);

  let pyftsubsetCmd = null;
  if (MODE === 'pyftsubset') {
    const python = findPython();
    pyftsubsetCmd = findPyftsubset(python);
    if (!pyftsubsetCmd) {
      console.error('pyftsubset not found. Install with: pip install fonttools brotli');
      process.exit(1);
    }
    console.log(`[font] using pyftsubset at: ${pyftsubsetCmd}`);
  }

  for (const font of FONTS) {
    await subsetFont(font, chars, pyftsubsetCmd);
  }

  console.log('[font] done.');
}

main().catch(e => { console.error(e); process.exit(1); });
