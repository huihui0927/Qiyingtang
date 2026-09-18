#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = resolve(join(__filename, '..'), '..');
const DIST = join(PROJECT_ROOT, 'dist');

const children = [];

function forwardSignals() {
  const cleanup = () => {
    for (const child of children) {
      if (!child.killed) child.kill();
    }
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

function waitForDist() {
  return new Promise((resolve) => {
    // If dist already exists, resolve quickly
    if (existsSync(DIST)) {
      // Give it a small delay to allow the first build to write files
      setTimeout(resolve, 500);
      return;
    }
    const interval = setInterval(() => {
      if (existsSync(DIST)) {
        clearInterval(interval);
        setTimeout(resolve, 500);
      }
    }, 200);
  });
}

async function main() {
  forwardSignals();

  // 1. Start the build in watch mode
  const build = spawn('node', ['scripts/build.mjs', '--watch'], {
    cwd: PROJECT_ROOT,
    stdio: ['inherit', 'pipe', 'inherit'],
    shell: false,
  });
  children.push(build);

  build.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
  });

  // 2. Wait for first build to complete (dist/ exists), then start serve
  await waitForDist();

  const serve = spawn('npx', ['--yes', 'serve', 'dist', '-l', '5173'], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    shell: true,
  });
  children.push(serve);

  // If build exits unexpectedly, also kill serve
  build.on('exit', (code) => {
    if (!serve.killed) serve.kill();
    process.exit(code ?? 1);
  });

  serve.on('exit', (code) => {
    if (!build.killed) build.kill();
    process.exit(code ?? 1);
  });
}

main().catch(e => { console.error(e); process.exit(1); });
