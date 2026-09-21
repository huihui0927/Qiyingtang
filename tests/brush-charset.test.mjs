// 艺术字防漂移测试。
// 背景：--font-brush 的回退链第二位是 LXGW WenKai，所以字体子集里缺某个字时浏览器不报错，
// 直接用楷体画出来——首页 hero 和页脚标语曾经是同一句话两种字，就是这个静默降级。
// 本测试把「base.css 的艺术字清单」和「scripts/brush-text.txt（子集来源）」钉在一起校验。
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');
const CSS_FILES = join(ROOT, 'assets', 'css');

async function readBrushBlock() {
  const css = await readFile(join(CSS_FILES, 'base.css'), 'utf8');
  const m = css.match(/([^{}]+)\{[^{}]*font-family:\s*var\(--font-brush\)[^{}]*\}/);
  if (!m) throw new Error('base.css 里找不到艺术字统一声明块（font-family: var(--font-brush)）');
  return m[1].replace(/\/\*[\s\S]*?\*\//g, '').split(',').map(s => s.trim()).filter(Boolean);
}

async function siteHtml() {
  const rootHtml = (await readdir(ROOT)).filter(n => n.endsWith('.html')).map(n => join(ROOT, n));
  const partialDir = join(ROOT, 'partials');
  const partials = (await readdir(partialDir)).filter(n => n.endsWith('.html')).map(n => join(partialDir, n));
  const files = [...rootHtml, ...partials];
  return (await Promise.all(files.map(f => readFile(f, 'utf8')))).join('\n');
}

function classPositions(html, cls) {
  const out = [];
  const re = /class="([^"]*)"/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1].split(/\s+/).includes(cls)) out.push(m.index);
  }
  return out;
}

// 取带该 class 的元素内部文字（假定目标元素自身不再嵌套同名标签）
function innerTextByClass(html, cls) {
  const texts = [];
  for (const pos of classPositions(html, cls)) {
    const lt = html.lastIndexOf('<', pos);
    const tag = /^<([a-z0-9]+)/i.exec(html.slice(lt))?.[1];
    if (!tag) continue;
    const gt = html.indexOf('>', pos);
    const close = html.indexOf(`</${tag}>`, gt);
    if (gt < 0 || close < 0) continue;
    texts.push(html.slice(gt + 1, close));
  }
  return texts;
}

// 祖先 class 命中后，向后找第一个 <tag>…</tag>
function tagAfterAncestor(html, ancestorCls, tag) {
  const texts = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  for (const pos of classPositions(html, ancestorCls)) {
    const m = re.exec(html.slice(pos));
    if (m) texts.push(m[1]);
  }
  return texts;
}

function toText(fragment) {
  return fragment
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z]+;/gi, '')
    .replace(/\s+/g, '');
}

// 需要子集覆盖的字符：所有非 ASCII 字符（ASCII 走拉丁回退，不占中文字子集）
function glyphChars(text) {
  return [...text].filter(c => c.codePointAt(0) > 0x7f);
}

describe('艺术字（字魂龙吟手书）', () => {
  it('base.css 艺术字清单能解析出选择器', async () => {
    const sels = await readBrushBlock();
    expect(sels.length).toBeGreaterThan(5);
  });

  it('每个艺术字选择器都在 HTML 里命中了元素，且用字全部在子集清单内', async () => {
    const [sels, html, phraseFile] = await Promise.all([
      readBrushBlock(),
      siteHtml(),
      readFile(join(ROOT, 'scripts', 'brush-text.txt'), 'utf8'),
    ]);
    const subset = new Set(phraseFile.replace(/\s+/g, ''));

    for (const sel of sels) {
      const parts = sel.split(/\s+/);
      const last = parts[parts.length - 1];
      let texts;
      if (last.startsWith('.')) {
        texts = innerTextByClass(html, last.slice(1));
      } else {
        const ancestor = parts[parts.length - 2]?.replace(/^\./, '');
        expect(ancestor, `选择器 ${sel} 缺少祖先 class`).toBeTruthy();
        texts = tagAfterAncestor(html, ancestor, last);
      }
      expect(texts.length, `艺术字选择器 ${sel} 在 HTML 里没找到任何元素`).toBeGreaterThan(0);

      const missing = [...new Set(texts.flatMap(t => glyphChars(toText(t))))].filter(c => !subset.has(c));
      expect(missing, `${sel} 的文字「${missing.join('')}」不在 scripts/brush-text.txt 里，会静默降级成楷体`).toEqual([]);
    }
  });
});
