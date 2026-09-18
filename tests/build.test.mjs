import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileString, copyStatic } from '../scripts/build.mjs';

describe('build.compileString', () => {
  it('replaces @include with partial contents', () => {
    const partials = { 'partials/head.html': '<head>{{title}}</head>' };
    const out = compileString('<!-- @vars {"title":"首页"} --><!-- @include partials/head.html -->', partials);
    expect(out).toBe('<head>首页</head>');
  });
  it('substitutes {{var}} globally after @vars', () => {
    const out = compileString('<!-- @vars {"a":"X","b":"Y"} -->{{a}}-{{b}}-{{a}}', {});
    expect(out).toBe('X-Y-X');
  });
  it('leaves unmatched placeholders intact', () => {
    const out = compileString('<!-- @vars {"a":"X"} -->{{a}} {{zz}}', {});
    expect(out).toBe('X {{zz}}');
  });
  it('removes @vars / @include comment markers in output', () => {
    const out = compileString('<!-- @vars {} -->hello', {});
    expect(out).toBe('hello');
  });
});
