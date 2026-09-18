#!/usr/bin/env node
import { readFile, writeFile, readdir, mkdir, copyFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { watch } from 'chokidar';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = resolve(join(__filename, '..'), '..');
const DIST = join(PROJECT_ROOT, 'dist');

export function compileString(src, partials) {
  // 1) extract @vars (first occurrence)
  let vars = {};
  src = src.replace(/<!--\s*@vars\s+(\{[\s\S]*?\})\s*-->/, (_, json) => {
    try { vars = JSON.parse(json); } catch (e) { console.warn('[build] bad @vars JSON:', e.message); }
    return '';
  });
  // 2) resolve @include (recursive, depth-limited)
  const resolveIncludes = (text, depth = 0) => {
    if (depth > 5) throw new Error('@include depth > 5');
    return text.replace(/<!--\s*@include\s+([\w./-]+)\s*-->/g, (_, p) => {
      const body = partials[p];
      if (body == null) throw new Error(`partial not found: ${p}`);
      return resolveIncludes(body, depth + 1);
    });
  };
  src = resolveIncludes(src);
  // 3) substitute {{var}}
  src = src.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return src;
}

async function loadPartials() {
  const dir = join(PROJECT_ROOT, 'partials');
  const out = {};
  if (!existsSync(dir)) return out;
  const walk = async (d, prefix = '') => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      const abs = join(d, e.name);
      if (e.isDirectory()) await walk(abs, rel);
      else if (e.name.endsWith('.html')) out[`partials/${rel}`] = await readFile(abs, 'utf8');
    }
  };
  await walk(dir);
  return out;
}

export async function copyStatic() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  // copy assets/ wholesale
  const assetsSrc = join(PROJECT_ROOT, 'assets');
  if (existsSync(assetsSrc)) await copyDir(assetsSrc, join(DIST, 'assets'));
  // copy _headers / _redirects / robots.txt / sitemap.xml if present (page .html files compiled by compileAll)
  for (const f of ['_headers', '_redirects', 'robots.txt', 'sitemap.xml']) {
    const p = join(PROJECT_ROOT, f);
    if (existsSync(p)) await copyFile(p, join(DIST, f));
  }
}

async function copyDir(src, dst) {
  await mkdir(dst, { recursive: true });
  for (const e of await readdir(src, { withFileTypes: true })) {
    const s = join(src, e.name), d = join(dst, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else await copyFile(s, d);
  }
}

async function compileAll() {
  const partials = await loadPartials();
  const pages = (await readdir(PROJECT_ROOT)).filter(f => f.endsWith('.html'));
  for (const p of pages) {
    const src = await readFile(join(PROJECT_ROOT, p), 'utf8');
    const out = compileString(src, partials);
    await writeFile(join(DIST, p), out, 'utf8');
  }
}

async function main() {
  const isWatch = process.argv.includes('--watch');
  await copyStatic();
  await compileAll();
  console.log(`[build] dist/ ready (${(await readdir(DIST)).length} top-level entries)`);
  if (isWatch) {
    watch([join(PROJECT_ROOT, '*.html'), join(PROJECT_ROOT, 'partials/**/*.html'), join(PROJECT_ROOT, 'assets/**/*')], { ignoreInitial: true })
      .on('all', async (ev, p) => { console.log(`[watch] ${ev} ${relative(PROJECT_ROOT, p)}`); await copyStatic(); await compileAll(); });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  main().catch(e => { console.error(e); process.exit(1); });
}
