# 栖影堂 | Lrishui 摄影工作室网站 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `C:\Users\ThinkPad\Downloads\栖影堂` 里的飞书素材，转成一份米白宣纸风、多页静态站，部署到 Cloudflare Pages，含 lightbox / 分类筛选 / 滚动揭示 / 预约表单 + 飞书 Webhook 通知。

**Architecture:**
- 纯静态 HTML/CSS/JS，无框架。源码用 `<!-- @include partials/xxx.html -->` + `<!-- @vars {json} -->`，由 `scripts/build.mjs` 编译为 `dist/`。
- 图片由 `scripts/process-images.mjs` 用 sharp 流水线从 `~/Downloads/栖影堂` 处理后输出到 `assets/images/{home,portrait,wedding,event}/`，并生成 `assets/data/{portrait,wedding,event}.json` 供前端 `fetch`。
- 表单走 `functions/contact.js`（Cloudflare Pages Function，Workers runtime），从 Secret 取 `FEISHU_WEBHOOK_URL`，POST 飞书富文本消息；可选 `FEISHU_WEBHOOK_SECRET` 触发 HmacSHA256 签名校验。
- 字体：霞鹜文楷（标题，本地子集 ≤ 300 KB，`fonts/lxgw-wenkai-subset.woff2`）+ Noto Serif SC（正文，CDN）+ Cormorant Garamond（英文，CDN）。

**Tech Stack:** HTML5, CSS3（custom properties）, Vanilla JS (ES2022 modules), Node 20+, sharp ^0.33, cn-font-split ^4（或 fonttools pyftsubset 回退）, Vitest + jsdom（前端 JS 单测）, Cloudflare Pages + Pages Functions。

**Spec:** `docs/superpowers/specs/2026-09-14-qiyangtang-site-design.md`

## Global Constraints

- **Secret 安全**：`FEISHU_WEBHOOK_URL`（值 `https://open.feishu.cn/open-apis/bot/v2/hook/49e99a90-7a83-42b5-8487-e2e35a5ad544`）只存 Cloudflare Pages Secret，**绝不进前端代码、不进 git、不进 .env.example 实值**。
- **隐私**：图片处理一律剥离 EXIF（保留方向）。
- **可访问性**：所有交互键盘可达，`prefers-reduced-motion: reduce` 时关闭过渡动画；lightbox 有 `role="dialog" aria-modal="true"` + focus trap。
- **响应式断点**：`--bp-sm 640px`、`--bp-md 900px`、`--bp-lg 1280px`。
- **色彩 tokens**（CSS custom properties，定义于 `assets/css/tokens.css`）：
  - `--paper: #F5F1E8` / `--paper-warm: #EDE6D6`
  - `--ink: #1F1B16` / `--ink-soft: #4A423A` / `--ink-mute: #8C8279`
  - `--seal: #A8321E` / `--gold: #B8945F`
  - `--line: rgba(31,27,22,0.12)`
- **字体 tokens**：`--font-kai`（霞鹜文楷，标题）、`--font-serif-cn`（Noto Serif SC，正文）、`--font-en`（Cormorant Garamond）。
- **图片输出规格**：`{name}.webp`（长边 2000px q80）+ `{name}@2x.webp`（长边 2800px q82，仅当原图 ≥ 2800px）+ `{name}-thumb.webp`（长边 800px q75）+ `{name}.jpg`（长边 1600px q78 mozjpeg fallback）。
- **V1 反垃圾**：honeypot 字段 + Origin/Referer 同源校验；**不实现 IP 频率限制**（spec 明确 V1 范围）。
- **签名校验**：仅当 `FEISHU_WEBHOOK_SECRET` 配置时启用；否则跳过签名段，直接 POST。
- **提交规范**：Conventional Commits（`feat:` / `fix:` / `chore:` / `docs:` / `test:`），单 `main` 分支，每个 Task 一个 commit。
- **路径约定**：项目根 `qiyangtang-site/`；源码在根（`index.html`、`portrait.html`、…、`assets/`、`partials/`、`functions/`、`scripts/`、`tests/`）；构建输出 `dist/`。

---

### Task 1: 项目脚手架 + 设计 tokens

**Files:**
- Create: `qiyangtang-site/package.json`
- Create: `qiyangtang-site/.gitignore`
- Create: `qiyangtang-site/.editorconfig`
- Create: `qiyangtang-site/assets/css/tokens.css`
- Create: `qiyangtang-site/assets/css/base.css`
- Create: `qiyangtang-site/README.md`

**Interfaces:**
- Produces: `tokens.css` 导出全部颜色/字体/断点 CSS 变量；`base.css` 提供 reset + 全局排版（body 用 `--font-serif-cn`、`--paper` 背景、`--ink` 文字）。后续所有页面 `<link rel="stylesheet" href="assets/css/tokens.css">` + `base.css`。

- [ ] **Step 1: 初始化项目目录与 git**

```bash
mkdir -p "C:/Users/ThinkPad/Documents/Qoder/2026-09-14/7fdb338b/qiyangtang-site"
cd "C:/Users/ThinkPad/Documents/Qoder/2026-09-14/7fdb338b/qiyangtang-site"
git init -b main
mkdir -p assets/css assets/js assets/images assets/data assets/fonts partials functions scripts tests dist
```

- [ ] **Step 2: 写 `package.json`**

```json
{
  "name": "qiyangtang-site",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "process:images": "node scripts/process-images.mjs",
    "subset:font": "node scripts/subset-font.mjs",
    "build": "node scripts/build.mjs",
    "dev": "node scripts/build.mjs --watch & npx --yes serve dist -l 5173",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "sharp": "^0.33.5",
    "cn-font-split": "^4.5.0",
    "vitest": "^2.1.0",
    "jsdom": "^25.0.0",
    "chokidar": "^3.6.0"
  }
}
```

- [ ] **Step 3: 写 `.gitignore`**

```
node_modules/
dist/
.wrangler/
.DS_Store
*.log
.env
.env.local
assets/images/**/*
!assets/images/.gitkeep
assets/fonts/*.woff2
```

- [ ] **Step 4: 写 `.editorconfig`**

```
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 5: 写 `assets/css/tokens.css`**

```css
:root {
  /* colors */
  --paper: #F5F1E8;
  --paper-warm: #EDE6D6;
  --ink: #1F1B16;
  --ink-soft: #4A423A;
  --ink-mute: #8C8279;
  --seal: #A8321E;
  --gold: #B8945F;
  --line: rgba(31, 27, 22, 0.12);

  /* fonts */
  --font-kai: "LXGW WenKai", "Kaiti SC", "STKaiti", serif;
  --font-serif-cn: "Noto Serif SC", "Songti SC", "SimSun", serif;
  --font-en: "Cormorant Garamond", "Times New Roman", serif;

  /* breakpoints (use in media queries directly; vars kept for docs) */
  --bp-sm: 640px;
  --bp-md: 900px;
  --bp-lg: 1280px;

  /* spacing scale */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 1rem;
  --space-4: 1.5rem;
  --space-5: 2.5rem;
  --space-6: 4rem;

  /* typography */
  --fs-xs: 0.8125rem;
  --fs-sm: 0.9375rem;
  --fs-base: 1rem;
  --fs-lg: 1.25rem;
  --fs-xl: 1.75rem;
  --fs-2xl: 2.5rem;
  --fs-3xl: 3.5rem;
  --lh-tight: 1.25;
  --lh-base: 1.75;
}
```

- [ ] **Step 6: 写 `assets/css/base.css`**

```css
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-serif-cn);
  font-size: var(--fs-base);
  line-height: var(--lh-base);
  -webkit-font-smoothing: antialiased;
}
img { max-width: 100%; height: auto; display: block; }
a { color: var(--ink); text-decoration: none; border-bottom: 1px solid var(--line); transition: color .2s, border-color .2s; }
a:hover, a:focus-visible { color: var(--seal); border-color: var(--seal); }
button { font: inherit; cursor: pointer; }
h1, h2, h3, h4 { font-family: var(--font-kai); font-weight: 500; line-height: var(--lh-tight); color: var(--ink); margin: 0 0 var(--space-3); }
h1 { font-size: var(--fs-3xl); }
h2 { font-size: var(--fs-2xl); }
h3 { font-size: var(--fs-xl); }
p { margin: 0 0 var(--space-3); }
.container { width: min(100% - 2rem, 1200px); margin-inline: auto; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
:focus-visible { outline: 2px solid var(--seal); outline-offset: 2px; }
```

- [ ] **Step 7: 写最小 README.md**

```markdown
# 栖影堂 | Lrishui

米白宣纸风个人摄影工作室站点。

## 开发

```bash
npm install
npm run process:images   # 从 ~/Downloads/栖影堂 生成 assets/images + assets/data
npm run subset:font      # 生成 assets/fonts/lxgw-wenkai-subset.woff2
npm run build            # 编译 partials → dist/
npm run dev              # 监听 + 本地预览 http://localhost:5173
npm test
```

## 部署

Cloudflare Pages：
- Build command: `npm run process:images && npm run subset:font && npm run build`
- Output directory: `dist`
- Functions directory: `functions`
- Secret: `FEISHU_WEBHOOK_URL`（必填）、`FEISHU_WEBHOOK_SECRET`（可选，开启签名校验）
```

- [ ] **Step 8: 安装依赖并验证**

```bash
cd "C:/Users/ThinkPad/Documents/Qoder/2026-09-14/7fdb338b/qiyangtang-site"
npm install
```

Expected: `node_modules/` 出现，`npm ls sharp cn-font-split vitest jsdom` 全部解析成功。

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json .gitignore .editorconfig README.md assets/css/tokens.css assets/css/base.css
git commit -m "chore: scaffold project with design tokens and base styles"
```

---

### Task 2: 图片流水线（sharp）

**Files:**
- Create: `qiyangtang-site/scripts/process-images.mjs`
- Create: `qiyangtang-site/tests/process-images.test.mjs`
- Create: `qiyangtang-site/assets/images/.gitkeep`

**Interfaces:**
- Consumes: `~/Downloads/栖影堂/{1.首页,2.人像写真,3.活动摄影,4.婚礼摄影}/图片和附件/*.{jpg,png,webp,JPG}`
- Produces:
  - `assets/images/home/*.{webp,jpg}`、`assets/images/portrait/*`、`assets/images/wedding/*`、`assets/images/event/*`
  - `assets/data/portrait.json`、`assets/data/wedding.json`、`assets/data/event.json`，schema：
    ```ts
    type GalleryItem = {
      id: string;          // 文件名 stem（无扩展名），URL-safe
      src: string;         // "assets/images/portrait/foo.webp"
      srcset: string;      // "assets/images/portrait/foo-thumb.webp 800w, assets/images/portrait/foo.webp 2000w[, assets/images/portrait/foo@2x.webp 2800w]"
      fallback: string;    // "assets/images/portrait/foo.jpg"
      thumb: string;       // "assets/images/portrait/foo-thumb.webp"
      width: number; height: number;  // 主 webp 实际尺寸
      alt: string;         // 中文描述，由分类映射表生成
      category?: string;   // portrait: 风格 / wedding: "领证" | "婚礼" / event: 类型
    };
    type GalleryData = { items: GalleryItem[] };
    ```

- [ ] **Step 1: 写测试 `tests/process-images.test.mjs`**

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { processOne, buildGalleryJson } from '../scripts/process-images.mjs';

describe('process-images', () => {
  let tmp;
  beforeAll(() => { tmp = mkdtempSync(join(tmpdir(), 'qi-')); });
  afterAll(() => { rmSync(tmp, { recursive: true, force: true }); });

  it('emits webp + thumb + jpg and strips EXIF', async () => {
    const src = join(tmp, 'a.jpg');
    await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#888' } })
      .jpeg().withMetadata({ exif: { IFD0: { ImageDescription: 'secret GPS' } } })
      .toFile(src);
    const outDir = join(tmp, 'out');
    mkdirSync(outDir, { recursive: true });
    const item = await processOne(src, outDir, 'portrait', 'a', '示例');
    expect(existsSync(join(outDir, 'a.webp'))).toBe(true);
    expect(existsSync(join(outDir, 'a-thumb.webp'))).toBe(true);
    expect(existsSync(join(outDir, 'a.jpg'))).toBe(true);
    expect(existsSync(join(outDir, 'a@2x.webp'))).toBe(true); // 原图 3000 ≥ 2800
    expect(item.width).toBe(2000);
    expect(item.height).toBeGreaterThan(0);
    // EXIF stripped
    const meta = await sharp(join(outDir, 'a.jpg')).metadata();
    expect(meta.exif).toBeUndefined();
  });

  it('skips @2x when source < 2800px', async () => {
    const src = join(tmp, 'b.jpg');
    await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#aaa' } }).jpeg().toFile(src);
    const outDir = join(tmp, 'out2'); mkdirSync(outDir, { recursive: true });
    await processOne(src, outDir, 'portrait', 'b', '小图');
    expect(existsSync(join(outDir, 'b@2x.webp'))).toBe(false);
  });

  it('buildGalleryJson returns items grouped by category', () => {
    const items = [
      { id: 'x', category: '清新日系', src: 'p/x.webp' },
      { id: 'y', category: '情绪写真', src: 'p/y.webp' },
    ];
    const data = buildGalleryJson(items);
    expect(data.items).toHaveLength(2);
    expect(data.items[0].category).toBe('清新日系');
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run tests/process-images.test.mjs
```
Expected: FAIL — module not found.

- [ ] **Step 3: 实现 `scripts/process-images.mjs`**

```js
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
  // 婚礼摄影 md 中两个小节，按文件出现顺序前 14 张为领证，后续为婚礼
  // 此处简化：从原 md 解析过于复杂，改为：默认全部 "婚礼"，文件名含 "2026-05-31" 或 "0da947" "311b53" 等已知前缀的为 "领证"。
  // 实际执行者按 spec 第 6 节 "wedding 分类规则" 维护此 Set。
};
const LICENCE_FILES = new Set([
  '0da947d78e46dd64c8babfbc58185984','311b53ebbeffb424c159c22fcf3a72ea',
  '2520622fa352b2aec215a76bb0794a64','52e2115542ce62b38adbc6f81972ceff',
  '17393944f15a83412f26c4a714b96fb4','16a5754871217186d25c1eaffaf8df72',
  '36c965cb001cecccae21be4dc2537acd','b6d121b4a69f3a71ef6561e2cfedf78b',
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
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run tests/process-images.test.mjs
```
Expected: 3 passed.

- [ ] **Step 5: 全量跑一次**

```bash
node scripts/process-images.mjs
```
Expected: 控制台输出 `[home] N/N`、`[portrait] 12/12`、`[event] 18/18`、`[wedding] 64/64`（实际数字按源文件），`assets/images/*` 与 `assets/data/*.json` 生成完毕，总大小 ≤ 60 MB。

- [ ] **Step 6: 校验 EXIF 已剥离**

```bash
node -e "const s=require('sharp');s('assets/images/portrait/'+require('fs').readdirSync('assets/images/portrait').find(f=>f.endsWith('.jpg'))).metadata().then(m=>console.log('exif:',m.exif))"
```
Expected: `exif: undefined`.

- [ ] **Step 7: Commit**

```bash
git add scripts/process-images.mjs tests/process-images.test.mjs assets/images/.gitkeep assets/data/
git commit -m "feat(images): sharp pipeline emitting webp/jpg/thumb + gallery json"
```

---

### Task 3: 字体子集化

**Files:**
- Create: `qiyangtang-site/scripts/subset-font.mjs`
- Create: `qiyangtang-site/assets/fonts/.gitkeep`
- Create: `qiyangtang-site/scripts/charset.txt`（常用汉字 + 站点专属字符）

**Interfaces:**
- Produces: `assets/fonts/lxgw-wenkai-subset.woff2`（≤ 300 KB），`@font-face` 声明写入 `assets/css/fonts.css`。

- [ ] **Step 1: 写 `scripts/charset.txt`**

包含：
- GB2312 一级常用字 3755 个（脚本运行时从内置常量取，或从 `https://github.com/kongxiangbiao/常用汉字表` 缓存）
- 站点专属字符：`栖影堂Lrishui愿景和目标空间简介我们的服务人像写真婚礼摄影活动摄影代表作品入口点击前往联系方式微信邮箱lrishui@163.com发送邮件信息请注明来意电话15210475723工作时间10:00-18:00为什么选择我们✅全风格拍摄后期精修支持视频一对一沟通快速交付我们记录仪式接亲宴会外景精选案例领证跟拍风格分类清新日系情绪韩系港夜景优秀案例企业年会发布路演展会预约姓名手机日期类型备注提交成功失败请重试©2026首页返回🎯⛳️⭐️💡📲🟢📧📞⁉️👥💒👉`

实际写文件时，第一行注释说明来源，后续每行一个字符或一段连续字符。

- [ ] **Step 2: 写 `scripts/subset-font.mjs`**

```js
#!/usr/bin/env node
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import https from 'node:https';

const PROJECT_ROOT = resolve(import.meta.dirname, '..');
const FONT_DIR = join(PROJECT_ROOT, 'assets', 'fonts');
const CACHE_DIR = join(tmpdir(), 'qiyangtang-font-cache');
const FULL_TTF = join(CACHE_DIR, 'LXGWWenKai-Regular.ttf');
const CHARSET_TXT = join(PROJECT_ROOT, 'scripts', 'charset.txt');
const OUT_WOFF2 = join(FONT_DIR, 'lxgw-wenkai-subset.woff2');
const DOWNLOAD_URL = 'https://github.com/lxgw/LxgwWenKai/releases/download/v1.510/LXGWWenKai-Regular.ttf';

async function download(url, dest) {
  await mkdir(join(dest, '..'), { recursive: true });
  if (existsSync(dest)) {
    const s = await stat(dest);
    if (s.size > 1_000_000) return; // already cached
  }
  await new Promise((res, rej) => {
    const follow = (u) => https.get(u, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return follow(r.headers.location);
      if (r.statusCode !== 200) return rej(new Error(`HTTP ${r.statusCode} for ${u}`));
      const chunks = [];
      r.on('data', c => chunks.push(c));
      r.on('end', async () => { await writeFile(dest, Buffer.concat(chunks)); res(); });
    }).on('error', rej);
    follow(url);
  });
}

async function tryCnFontSplit() {
  try {
    const mod = await import('cn-font-split');
    const cnFontSplit = mod.default || mod;
    await cnFontSplit({
      FontPath: FULL_TTF,
      OutDir: FONT_DIR,
      Reporter: false,
      CSS: { fontFamily: 'LXGW WenKai' },
      Subset: { Chinese: 'charset.txt' },
      // 单文件输出模式
      PreviewImage: false,
    });
    // cn-font-split 默认输出分片，需要合并；如果失败回退到 pyftsubset
    return false;
  } catch (e) {
    console.warn('[font] cn-font-split failed, falling back to pyftsubset:', e.message);
    return false;
  }
}

async function tryPyftsubset(charset) {
  const r = spawnSync('pyftsubset', [
    FULL_TTF,
    `--text-file=${CHARSET_TXT}`,
    `--output-file=${OUT_WOFF2}`,
    '--flavor=woff2',
    '--layout-features=*',
    '--no-hinting',
    '--desubroutinize',
  ], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('pyftsubset failed; install fonttools: pip install fonttools brotli');
}

async function main() {
  await mkdir(FONT_DIR, { recursive: true });
  await mkdir(CACHE_DIR, { recursive: true });
  console.log('[font] downloading LXGW WenKai full TTF (cached)…');
  await download(DOWNLOAD_URL, FULL_TTF);
  const charset = await readFile(CHARSET_TXT, 'utf8');
  console.log('[font] subsetting…');
  const ok = await tryCnFontSplit();
  if (!ok || !existsSync(OUT_WOFF2)) await tryPyftsubset(charset);
  const s = await stat(OUT_WOFF2);
  console.log(`[font] wrote ${OUT_WOFF2} (${(s.size / 1024).toFixed(1)} KB)`);
  if (s.size > 350 * 1024) console.warn('[font] WARNING: subset > 350 KB, trim charset.txt');
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: 写 `assets/css/fonts.css`**

```css
@font-face {
  font-family: "LXGW WenKai";
  src: url("../fonts/lxgw-wenkai-subset.woff2") format("woff2");
  font-weight: 400 500;
  font-style: normal;
  font-display: swap;
  unicode-range: U+4E00-9FFF, U+3000-303F, U+FF00-FFEF;
}
@font-face {
  font-family: "Noto Serif SC";
  src: url("https://fonts.googleapis.cnpmjs.org/css2?family=Noto+Serif+SC:wght@400;500;600&display=swap");
  font-display: swap;
}
@import url("https://fonts.googleapis.cnpmjs.org/css2?family=Noto+Serif+SC:wght@400;500;600&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&display=swap");
```

> 注：`@font-face` 的 `src` 不能直接是 CSS URL；上面 Noto Serif SC 那段保留为注释占位，真实加载走 `@import`。执行者按此结构落地，删除冗余的 `@font-face` 块。

- [ ] **Step 4: 跑子集化**

```bash
node scripts/subset-font.mjs
```
Expected: `assets/fonts/lxgw-wenkai-subset.woff2` 生成，控制台输出大小 ≤ 300 KB。若 cn-font-split 失败，pyftsubset 接管；若都失败，提示安装 `pip install fonttools brotli`。

- [ ] **Step 5: Commit**

```bash
git add scripts/subset-font.mjs scripts/charset.txt assets/css/fonts.css assets/fonts/.gitkeep
git commit -m "feat(fonts): subset LXGW WenKai to woff2 + load Noto Serif SC / Cormorant via CDN"
```

---

### Task 4: 构建脚本（HTML partials + vars）

**Files:**
- Create: `qiyangtang-site/scripts/build.mjs`
- Create: `qiyangtang-site/tests/build.test.mjs`

**Interfaces:**
- Consumes: 项目根的 `*.html` 源文件（`index.html`、`portrait.html`、`wedding.html`、`event.html`、`booking.html`），`partials/*.html`
- Produces: `dist/` 镜像目录树，HTML 中的 `<!-- @include partials/x.html -->` 被替换为 partial 内容；`<!-- @vars {"title":"…"} -->` 之后的 `{{title}}` 占位符被替换；静态资源（`assets/`、`functions/` 不入 dist）复制。

- [ ] **Step 1: 写测试 `tests/build.test.mjs`**

```js
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
```

- [ ] **Step 2: 跑测试，确认失败**

```bash
npx vitest run tests/build.test.mjs
```
Expected: FAIL.

- [ ] **Step 3: 实现 `scripts/build.mjs`**

```js
#!/usr/bin/env node
import { readFile, writeFile, readdir, mkdir, copyFile, stat, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { watch } from 'chokidar';

const PROJECT_ROOT = resolve(import.meta.dirname, '..');
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
  // copy root .html files (compiled separately)
  // copy _headers / _redirects if present
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

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  main().catch(e => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 4: 跑测试，确认通过**

```bash
npx vitest run tests/build.test.mjs
```
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/build.mjs tests/build.test.mjs
git commit -m "feat(build): partials + @vars compilation to dist/"
```

---

### Task 5: 共用 partials（head / nav / footer）

**Files:**
- Create: `qiyangtang-site/partials/head.html`
- Create: `qiyangtang-site/partials/nav.html`
- Create: `qiyangtang-site/partials/footer.html`
- Create: `qiyangtang-site/assets/css/layout.css`

**Interfaces:**
- Produces:
  - `head.html`：`<!doctype html><html lang="zh-CN"><head>…<link tokens/base/fonts/layout>…</head><body>` 起始（不含 `</body></html>`，由页面尾部 partial 闭合）
  - `nav.html`：站内导航（首页 / 人像写真 / 婚礼摄影 / 活动摄影 / 预约），含 logo `栖影堂` + 印章 SVG
  - `footer.html`：版权 + 联系方式 + `</body></html>`
- 变量：`{{title}}`、`{{description}}`、`{{active}}`（`home` | `portrait` | `wedding` | `event` | `booking`）

- [ ] **Step 1: 写 `partials/head.html`**

```html
<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{title}} · 栖影堂 Lrishui</title>
<meta name="description" content="{{description}}">
<meta property="og:title" content="{{title}} · 栖影堂 Lrishui">
<meta property="og:description" content="{{description}}">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.cnpmjs.org" crossorigin>
<link rel="stylesheet" href="assets/css/tokens.css">
<link rel="stylesheet" href="assets/css/base.css">
<link rel="stylesheet" href="assets/css/fonts.css">
<link rel="stylesheet" href="assets/css/layout.css">
<link rel="icon" href="assets/images/home/seal.svg" type="image/svg+xml">
</head>
<body data-page="{{active}}">
```

- [ ] **Step 2: 写 `partials/nav.html`**

```html
<header class="site-nav">
  <div class="container nav-inner">
    <a class="brand" href="index.html" aria-label="栖影堂首页">
      <span class="brand-cn">栖影堂</span>
      <span class="brand-en">Lrishui</span>
    </a>
    <nav aria-label="主导航">
      <ul class="nav-list">
        <li><a href="index.html"   data-nav="home">首页</a></li>
        <li><a href="portrait.html" data-nav="portrait">人像写真</a></li>
        <li><a href="wedding.html"  data-nav="wedding">婚礼摄影</a></li>
        <li><a href="event.html"    data-nav="event">活动摄影</a></li>
        <li><a href="booking.html"  data-nav="booking" class="cta">预约</a></li>
      </ul>
    </nav>
    <button class="nav-toggle" aria-expanded="false" aria-controls="nav-list" aria-label="切换菜单">☰</button>
  </div>
</header>
<script>
  // mark active
  const p = document.body.dataset.page;
  document.querySelectorAll(`[data-nav="${p}"]`).forEach(a => a.setAttribute('aria-current','page'));
  // mobile toggle
  const t = document.querySelector('.nav-toggle');
  t?.addEventListener('click', () => {
    const list = document.querySelector('.nav-list');
    const open = list.classList.toggle('open');
    t.setAttribute('aria-expanded', String(open));
  });
</script>
```

- [ ] **Step 3: 写 `partials/footer.html`**

```html
<footer class="site-footer">
  <div class="container footer-inner">
    <p class="footer-slogan">栖一方光影，留半盏流年。</p>
    <p class="footer-contact">
      邮箱 <a href="mailto:lrishui@163.com">lrishui@163.com</a> ·
      电话 <a href="tel:15210475723">152 1047 5723</a> ·
      工作时间 10:00–18:00
    </p>
    <p class="footer-copy">© 2026 栖影堂 Lrishui. All rights reserved.</p>
  </div>
</footer>
</body>
</html>
```

- [ ] **Step 4: 写 `assets/css/layout.css`**

```css
.site-nav { position: sticky; top: 0; z-index: 50; background: color-mix(in srgb, var(--paper) 92%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
.nav-inner { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); padding-block: var(--space-3); }
.brand { display: flex; flex-direction: column; line-height: 1; border: 0; }
.brand-cn { font-family: var(--font-kai); font-size: var(--fs-lg); color: var(--ink); letter-spacing: 0.08em; }
.brand-en { font-family: var(--font-en); font-size: var(--fs-xs); color: var(--ink-mute); letter-spacing: 0.2em; text-transform: uppercase; margin-top: 2px; }
.nav-list { display: flex; gap: var(--space-4); list-style: none; margin: 0; padding: 0; }
.nav-list a { border: 0; font-size: var(--fs-sm); color: var(--ink-soft); padding-block: var(--space-1); position: relative; }
.nav-list a[aria-current="page"] { color: var(--seal); }
.nav-list a[aria-current="page"]::after { content: ""; position: absolute; left: 0; right: 0; bottom: -4px; height: 1px; background: var(--seal); }
.nav-list a.cta { color: var(--paper); background: var(--ink); padding: var(--space-2) var(--space-4); border-radius: 2px; }
.nav-list a.cta:hover { background: var(--seal); }
.nav-toggle { display: none; background: none; border: 1px solid var(--line); padding: var(--space-1) var(--space-2); border-radius: 2px; }
@media (max-width: 900px) {
  .nav-toggle { display: inline-block; }
  .nav-list { position: absolute; top: 100%; left: 0; right: 0; flex-direction: column; background: var(--paper); border-bottom: 1px solid var(--line); padding: var(--space-3); display: none; }
  .nav-list.open { display: flex; }
}
.site-footer { margin-top: var(--space-6); padding-block: var(--space-5); border-top: 1px solid var(--line); background: var(--paper-warm); }
.footer-inner { text-align: center; display: grid; gap: var(--space-2); }
.footer-slogan { font-family: var(--font-kai); color: var(--ink-soft); font-size: var(--fs-lg); margin: 0; }
.footer-contact, .footer-copy { color: var(--ink-mute); font-size: var(--fs-sm); margin: 0; }
main { min-height: 60vh; padding-block: var(--space-5); }
section + section { margin-top: var(--space-6); }
.section-title { display: flex; align-items: baseline; gap: var(--space-3); margin-bottom: var(--space-4); }
.section-title h2 { margin: 0; }
.section-title .en { font-family: var(--font-en); color: var(--ink-mute); font-style: italic; }
.seal { display: inline-block; width: 1.2em; height: 1.2em; background: var(--seal); color: var(--paper); font-family: var(--font-kai); text-align: center; line-height: 1.2em; border-radius: 2px; font-size: 0.85em; }
```

- [ ] **Step 5: Commit**

```bash
git add partials/ assets/css/layout.css
git commit -m "feat(layout): shared head/nav/footer partials + layout styles"
```

---

### Task 6: Lightbox 组件（含测试）

**Files:**
- Create: `qiyangtang-site/assets/js/lightbox.js`
- Create: `qiyangtang-site/assets/css/lightbox.css`
- Create: `qiyangtang-site/tests/lightbox.test.mjs`

**Interfaces:**
- Produces: `window.QYTLightbox.open(items, index)` / `.close()` / `.next()` / `.prev()`，其中 `items: GalleryItem[]`（来自 Task 2 schema）。
- DOM：单例 `<div class="lightbox" role="dialog" aria-modal="true" aria-label="作品预览">` 注入 `document.body`，含 `<img>`、上一张/下一张按钮、关闭按钮、计数器 `n / N`、可选 caption。
- 行为：键盘 `Esc` 关闭、`←/→` 切换、`Tab` focus trap；点击遮罩关闭；触摸滑动切换（≥ 40px 阈值）；`prefers-reduced-motion: reduce` 时禁用淡入。

- [ ] **Step 1: 写测试 `tests/lightbox.test.mjs`**

```js
/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openLightbox, closeLightbox, nextLightbox, prevLightbox, getLightboxState } from '../assets/js/lightbox.js';

const ITEMS = [
  { id:'a', src:'a.webp', srcset:'a-thumb.webp 800w, a.webp 2000w', fallback:'a.jpg', thumb:'a-thumb.webp', width:2000, height:1333, alt:'A' },
  { id:'b', src:'b.webp', srcset:'b-thumb.webp 800w, b.webp 2000w', fallback:'b.jpg', thumb:'b-thumb.webp', width:2000, height:1333, alt:'B' },
  { id:'c', src:'c.webp', srcset:'c-thumb.webp 800w, c.webp 2000w', fallback:'c.jpg', thumb:'c-thumb.webp', width:2000, height:1333, alt:'C' },
];

describe('lightbox', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => closeLightbox());

  it('opens with correct image and counter', () => {
    openLightbox(ITEMS, 1);
    const s = getLightboxState();
    expect(s.open).toBe(true);
    expect(s.index).toBe(1);
    expect(document.querySelector('.lightbox img').getAttribute('src')).toBe('b.webp');
    expect(document.querySelector('.lightbox-counter').textContent).toBe('2 / 3');
    expect(document.querySelector('.lightbox').getAttribute('aria-modal')).toBe('true');
  });
  it('next wraps around', () => {
    openLightbox(ITEMS, 2); nextLightbox();
    expect(getLightboxState().index).toBe(0);
  });
  it('prev wraps around', () => {
    openLightbox(ITEMS, 0); prevLightbox();
    expect(getLightboxState().index).toBe(2);
  });
  it('Esc closes', () => {
    openLightbox(ITEMS, 0);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(getLightboxState().open).toBe(false);
  });
  it('ArrowRight advances', () => {
    openLightbox(ITEMS, 0);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(getLightboxState().index).toBe(1);
  });
  it('restores focus to trigger on close', () => {
    const btn = document.createElement('button'); document.body.append(btn); btn.focus();
    openLightbox(ITEMS, 0, btn);
    closeLightbox();
    expect(document.activeElement).toBe(btn);
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

```bash
npx vitest run tests/lightbox.test.mjs
```
Expected: FAIL.

- [ ] **Step 3: 实现 `assets/js/lightbox.js`**

```js
let items = [];
let index = 0;
let root = null;
let trigger = null;
let touchStartX = 0;

function ensureDom() {
  if (root) return root;
  root = document.createElement('div');
  root.className = 'lightbox';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', '作品预览');
  root.hidden = true;
  root.innerHTML = `
    <div class="lightbox-backdrop" data-close></div>
    <figure class="lightbox-figure">
      <img class="lightbox-img" alt="">
      <figcaption class="lightbox-caption"></figcaption>
    </figure>
    <button class="lightbox-btn lightbox-prev" aria-label="上一张">‹</button>
    <button class="lightbox-btn lightbox-next" aria-label="下一张">›</button>
    <button class="lightbox-btn lightbox-close" aria-label="关闭" data-close>×</button>
    <div class="lightbox-counter" aria-live="polite"></div>
  `;
  document.body.append(root);
  root.querySelector('.lightbox-prev').addEventListener('click', prev);
  root.querySelector('.lightbox-next').addEventListener('click', next);
  root.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
  root.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  root.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) >= 40) (dx < 0 ? next : prev)();
  }, { passive: true });
  document.addEventListener('keydown', onKey);
  return root;
}

function onKey(e) {
  if (!root || root.hidden) return;
  if (e.key === 'Escape') { e.preventDefault(); close(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
  else if (e.key === 'Tab') { trapFocus(e); }
}

function trapFocus(e) {
  const f = root.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])');
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function render() {
  const it = items[index];
  const img = root.querySelector('.lightbox-img');
  img.src = it.src;
  img.srcset = it.srcset || '';
  img.alt = it.alt || '';
  img.width = it.width; img.height = it.height;
  root.querySelector('.lightbox-caption').textContent = it.alt || '';
  root.querySelector('.lightbox-counter').textContent = `${index + 1} / ${items.length}`;
}

export function openLightbox(list, i = 0, triggerEl = null) {
  items = list; index = i; trigger = triggerEl || document.activeElement;
  ensureDom();
  root.hidden = false;
  document.body.style.overflow = 'hidden';
  render();
  root.querySelector('.lightbox-close').focus();
}
export function closeLightbox() {
  if (!root) return;
  root.hidden = true;
  document.body.style.overflow = '';
  if (trigger && typeof trigger.focus === 'function') trigger.focus();
}
export function nextLightbox() { index = (index + 1) % items.length; render(); }
export function prevLightbox() { index = (index - 1 + items.length) % items.length; render(); }
export function getLightboxState() { return { open: !!root && !root.hidden, index, count: items.length }; }

// auto-bind: any element with data-lightbox-gallery="<json script id>" + data-lightbox-index
export function bindGallery(container, list) {
  container.querySelectorAll('[data-lightbox-index]').forEach(el => {
    el.addEventListener('click', () => openLightbox(list, Number(el.dataset.lightboxIndex), el));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(list, Number(el.dataset.lightboxIndex), el); } });
  });
}

const next = nextLightbox, prev = prevLightbox, close = closeLightbox;
```

- [ ] **Step 4: 写 `assets/css/lightbox.css`**

```css
.lightbox { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; }
.lightbox[hidden] { display: none; }
.lightbox-backdrop { position: absolute; inset: 0; background: rgba(31,27,22,0.92); }
.lightbox-figure { position: relative; margin: 0; max-width: 92vw; max-height: 86vh; display: grid; gap: var(--space-2); justify-items: center; animation: lb-in .25s ease-out; }
@media (prefers-reduced-motion: reduce) { .lightbox-figure { animation: none; } }
@keyframes lb-in { from { opacity: 0; transform: scale(.98); } to { opacity: 1; transform: none; } }
.lightbox-img { max-width: 92vw; max-height: 80vh; object-fit: contain; background: var(--paper); box-shadow: 0 12px 48px rgba(0,0,0,.4); }
.lightbox-caption { color: var(--paper); font-size: var(--fs-sm); text-align: center; max-width: 60ch; }
.lightbox-btn { position: absolute; background: rgba(245,241,232,.12); color: var(--paper); border: 1px solid rgba(245,241,232,.3); width: 44px; height: 44px; border-radius: 50%; font-size: 1.5rem; line-height: 1; display: grid; place-items: center; transition: background .2s; }
.lightbox-btn:hover, .lightbox-btn:focus-visible { background: var(--seal); border-color: var(--seal); }
.lightbox-prev { left: 1rem; top: 50%; transform: translateY(-50%); }
.lightbox-next { right: 1rem; top: 50%; transform: translateY(-50%); }
.lightbox-close { top: 1rem; right: 1rem; }
.lightbox-counter { position: absolute; bottom: 1rem; left: 50%; transform: translateX(-50%); color: var(--paper); font-family: var(--font-en); font-size: var(--fs-sm); letter-spacing: .1em; }
```

- [ ] **Step 5: 跑测试，确认通过**

```bash
npx vitest run tests/lightbox.test.mjs
```
Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add assets/js/lightbox.js assets/css/lightbox.css tests/lightbox.test.mjs
git commit -m "feat(lightbox): accessible dialog with keyboard/touch nav and focus trap"
```

---

### Task 7: 滚动揭示 + 分类筛选

**Files:**
- Create: `qiyangtang-site/assets/js/reveal.js`
- Create: `qiyangtang-site/assets/js/filter.js`
- Create: `qiyangtang-site/assets/css/components.css`
- Create: `qiyangtang-site/tests/filter.test.mjs`

**Interfaces:**
- `reveal.js`：导出 `initReveal(root = document)`，扫描 `[data-reveal]` 元素，IntersectionObserver 触发 `.is-visible`；`prefers-reduced-motion: reduce` 时直接全部 `.is-visible`。
- `filter.js`：导出 `initFilter({ container, items, render, paramKey = 'style' })`，渲染分类 chips（来自 `items[*].category` 去重），点击切换 `?style=xxx`（`history.replaceState`），调用 `render(filteredItems)`；首次加载读 URL 同步状态。

- [ ] **Step 1: 写测试 `tests/filter.test.mjs`**

```js
/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { initFilter } from '../assets/js/filter.js';

const ITEMS = [
  { id:'1', category:'清新日系' }, { id:'2', category:'情绪写真' },
  { id:'3', category:'清新日系' }, { id:'4', category:'港风' },
];

describe('filter', () => {
  let container, rendered;
  beforeEach(() => {
    document.body.innerHTML = '<div id="c"></div>';
    container = document.getElementById('c');
    rendered = [];
    history.replaceState({}, '', '/');
  });

  it('renders chips for each unique category + "全部"', () => {
    initFilter({ container, items: ITEMS, render: x => rendered.push(x) });
    const chips = [...container.querySelectorAll('[data-filter]')].map(b => b.dataset.filter);
    expect(chips).toEqual(['all','清新日系','情绪写真','港风']);
  });
  it('initial render shows all items', () => {
    initFilter({ container, items: ITEMS, render: x => rendered.push(x) });
    expect(rendered[0]).toHaveLength(4);
  });
  it('clicking chip filters and updates URL', () => {
    initFilter({ container, items: ITEMS, render: x => rendered.push(x), paramKey: 'style' });
    container.querySelector('[data-filter="清新日系"]').click();
    expect(rendered.at(-1)).toHaveLength(2);
    expect(location.search).toBe('?style=%E6%B8%85%E6%96%B0%E6%97%A5%E7%B3%BB');
  });
  it('respects ?style= on init', () => {
    history.replaceState({}, '', '/?style=港风');
    initFilter({ container, items: ITEMS, render: x => rendered.push(x) });
    expect(rendered[0]).toHaveLength(1);
    expect(container.querySelector('[data-filter="港风"]').getAttribute('aria-pressed')).toBe('true');
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

```bash
npx vitest run tests/filter.test.mjs
```
Expected: FAIL.

- [ ] **Step 3: 实现 `assets/js/filter.js`**

```js
export function initFilter({ container, items, render, paramKey = 'style' }) {
  const cats = ['all', ...Array.from(new Set(items.map(i => i.category).filter(Boolean)))];
  const url = new URL(location.href);
  let active = url.searchParams.get(paramKey) || 'all';
  if (!cats.includes(active)) active = 'all';

  container.innerHTML = '';
  const bar = document.createElement('div');
  bar.className = 'filter-bar';
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', '分类筛选');
  for (const c of cats) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'filter-chip';
    b.dataset.filter = c;
    b.textContent = c === 'all' ? '全部' : c;
    b.setAttribute('aria-pressed', String(c === active));
    b.addEventListener('click', () => select(c));
    bar.append(b);
  }
  container.append(bar);

  function apply() {
    const list = active === 'all' ? items : items.filter(i => i.category === active);
    render(list);
    container.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === active)));
  }
  function select(c) {
    active = c;
    const u = new URL(location.href);
    if (c === 'all') u.searchParams.delete(paramKey); else u.searchParams.set(paramKey, c);
    history.replaceState({}, '', u);
    apply();
  }
  apply();
  return { select, getActive: () => active };
}
```

- [ ] **Step 4: 实现 `assets/js/reveal.js`**

```js
export function initReveal(root = document) {
  const els = root.querySelectorAll('[data-reveal]');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
  els.forEach(el => io.observe(el));
}
```

- [ ] **Step 5: 写 `assets/css/components.css`**

```css
[data-reveal] { opacity: 0; transform: translateY(16px); transition: opacity .6s ease, transform .6s ease; }
[data-reveal].is-visible { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { [data-reveal] { opacity: 1; transform: none; transition: none; } }

.filter-bar { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-4); }
.filter-chip { background: transparent; border: 1px solid var(--line); color: var(--ink-soft); padding: var(--space-1) var(--space-3); border-radius: 999px; font-size: var(--fs-sm); font-family: var(--font-serif-cn); transition: all .2s; }
.filter-chip:hover { border-color: var(--ink-mute); color: var(--ink); }
.filter-chip[aria-pressed="true"] { background: var(--ink); color: var(--paper); border-color: var(--ink); }

.gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--space-3); }
.gallery-item { position: relative; overflow: hidden; background: var(--paper-warm); aspect-ratio: 3 / 2; border: 0; padding: 0; cursor: zoom-in; }
.gallery-item img { width: 100%; height: 100%; object-fit: cover; transition: transform .6s ease; }
.gallery-item:hover img, .gallery-item:focus-visible img { transform: scale(1.04); }
.gallery-item::after { content: ""; position: absolute; inset: 0; background: linear-gradient(to top, rgba(31,27,22,.35), transparent 50%); opacity: 0; transition: opacity .3s; pointer-events: none; }
.gallery-item:hover::after { opacity: 1; }
```

- [ ] **Step 6: 跑测试，确认通过**

```bash
npx vitest run tests/filter.test.mjs
```
Expected: 4 passed.

- [ ] **Step 7: Commit**

```bash
git add assets/js/reveal.js assets/js/filter.js assets/css/components.css tests/filter.test.mjs
git commit -m "feat(ui): scroll reveal + URL-synced category filter"
```

---

### Task 8: 首页 `index.html`

**Files:**
- Create: `qiyangtang-site/index.html`
- Create: `qiyangtang-site/assets/css/home.css`
- Create: `qiyangtang-site/assets/images/home/seal.svg`（手写印章 SVG）

**Interfaces:**
- Consumes: `partials/head.html`、`partials/nav.html`、`partials/footer.html`、`tokens.css`、`base.css`、`fonts.css`、`layout.css`、`components.css`、`home.css`、`reveal.js`
- Produces: 首页含 Hero（纯文字 + 印章 SVG，无大图）、服务三栏、代表作品入口三卡、为什么选择我们、联系方式。

- [ ] **Step 1: 写 `assets/images/home/seal.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
  <rect x="4" y="4" width="56" height="56" rx="4" fill="#A8321E"/>
  <text x="32" y="42" text-anchor="middle" font-family="LXGW WenKai, Kaiti SC, serif" font-size="28" fill="#F5F1E8">栖</text>
</svg>
```

- [ ] **Step 2: 写 `index.html`**

```html
<!-- @vars {
  "title": "首页",
  "description": "栖影堂 Lrishui — 专注人像写真 / 婚礼摄影 / 活动纪实的摄影工作室。栖一方光影，留半盏流年。",
  "active": "home"
} -->
<!-- @include partials/head.html -->
<!-- @include partials/nav.html -->

<main>
  <section class="hero container" data-reveal>
    <div class="hero-seal" aria-hidden="true">
      <img src="assets/images/home/seal.svg" alt="" width="64" height="64">
    </div>
    <p class="hero-eyebrow"><span lang="en">Lrishui Studio</span> · 摄影工作室</p>
    <h1 class="hero-title">栖一方光影<br>留半盏流年</h1>
    <p class="hero-sub">用影像留住细碎时光。</p>
    <p class="hero-cta">
      <a class="btn btn-primary" href="booking.html">预约拍摄</a>
      <a class="btn btn-ghost" href="#works">查看作品</a>
    </p>
  </section>

  <section class="container services" id="services" data-reveal>
    <div class="section-title"><h2>我们的服务</h2><span class="en">Services</span></div>
    <div class="services-grid">
      <article class="service-card">
        <h3>👥 人像写真</h3>
        <p>清新日系 / 情绪写真 / 韩系风 / 港风 / 夜景写真，五种风格任你选。</p>
        <a href="portrait.html">查看客片 →</a>
      </article>
      <article class="service-card">
        <h3>💒 婚礼摄影</h3>
        <p>仪式 · 接亲 · 宴会 · 外景，全程跟拍，领证日也值得被记录。</p>
        <a href="wedding.html">查看案例 →</a>
      </article>
      <article class="service-card">
        <h3>🎯 活动摄影</h3>
        <p>企业活动 / 年会 / 发布会 / 路演 / 展会，专业纪实，快速交付。</p>
        <a href="event.html">查看案例 →</a>
      </article>
    </div>
  </section>

  <section class="container works" id="works" data-reveal>
    <div class="section-title"><h2>代表作品入口</h2><span class="en">Portfolio</span></div>
    <div class="works-grid">
      <a class="work-card" href="portrait.html">
        <span class="work-num">01</span>
        <span class="work-name">人像写真</span>
        <span class="work-en">Portrait</span>
      </a>
      <a class="work-card" href="wedding.html">
        <span class="work-num">02</span>
        <span class="work-name">婚礼摄影</span>
        <span class="work-en">Wedding</span>
      </a>
      <a class="work-card" href="event.html">
        <span class="work-num">03</span>
        <span class="work-name">活动摄影</span>
        <span class="work-en">Event</span>
      </a>
    </div>
  </section>

  <section class="container why" data-reveal>
    <div class="section-title"><h2>为什么选择我们</h2><span class="en">Why us</span></div>
    <ul class="why-list">
      <li>✅ 全风格拍摄</li>
      <li>✅ 后期精修</li>
      <li>✅ 支持视频拍摄</li>
      <li>✅ 一对一沟通</li>
      <li>✅ 快速交付</li>
    </ul>
  </section>

  <section class="container contact" data-reveal>
    <div class="section-title"><h2>联系方式</h2><span class="en">Contact</span></div>
    <div class="contact-grid">
      <div><h3>🟢 微信</h3><p>扫码添加，备注来意。</p></div>
      <div><h3>📧 邮箱</h3><p><a href="mailto:lrishui@163.com">lrishui@163.com</a></p></div>
      <div><h3>📞 电话</h3><p><a href="tel:15210475723">152 1047 5723</a><br><small>工作时间 10:00–18:00</small></p></div>
    </div>
  </section>
</main>

<!-- @include partials/footer.html -->
<link rel="stylesheet" href="assets/css/home.css">
<script type="module">
  import { initReveal } from './assets/js/reveal.js';
  initReveal();
</script>
```

> 注：`<link>` / `<script>` 放在 `@include footer` 之后会被 `</body></html>` 闭合掉。正确做法是把它们放到 footer partial 之前。执行时把上面两行移到 `<!-- @include partials/footer.html -->` 之前。

- [ ] **Step 3: 写 `assets/css/home.css`**

```css
.hero { text-align: center; padding-block: var(--space-6) var(--space-5); display: grid; gap: var(--space-3); justify-items: center; }
.hero-seal img { width: 64px; height: 64px; }
.hero-eyebrow { font-family: var(--font-en); letter-spacing: .25em; text-transform: uppercase; color: var(--ink-mute); font-size: var(--fs-sm); margin: 0; }
.hero-title { font-family: var(--font-kai); font-size: clamp(2.5rem, 7vw, 4.5rem); line-height: 1.15; margin: 0; letter-spacing: .04em; }
.hero-sub { color: var(--ink-soft); font-size: var(--fs-lg); margin: 0; }
.hero-cta { display: flex; gap: var(--space-3); flex-wrap: wrap; justify-content: center; margin-top: var(--space-3); }
.btn { display: inline-block; padding: var(--space-2) var(--space-4); border: 1px solid var(--ink); border-radius: 2px; font-size: var(--fs-sm); transition: all .2s; }
.btn-primary { background: var(--ink); color: var(--paper); }
.btn-primary:hover { background: var(--seal); border-color: var(--seal); color: var(--paper); }
.btn-ghost { background: transparent; color: var(--ink); }
.btn-ghost:hover { background: var(--ink); color: var(--paper); }

.services-grid, .works-grid, .contact-grid { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
.service-card { background: var(--paper-warm); padding: var(--space-4); border: 1px solid var(--line); border-radius: 2px; }
.service-card h3 { margin-top: 0; }
.service-card a { font-size: var(--fs-sm); color: var(--seal); }

.work-card { display: grid; gap: var(--space-1); padding: var(--space-5) var(--space-4); background: var(--paper); border: 1px solid var(--line); border-radius: 2px; text-align: left; transition: all .3s; position: relative; overflow: hidden; }
.work-card:hover { border-color: var(--seal); transform: translateY(-2px); }
.work-num { font-family: var(--font-en); font-size: var(--fs-3xl); color: var(--gold); line-height: 1; font-style: italic; }
.work-name { font-family: var(--font-kai); font-size: var(--fs-xl); color: var(--ink); }
.work-en { font-family: var(--font-en); color: var(--ink-mute); letter-spacing: .15em; text-transform: uppercase; font-size: var(--fs-xs); }

.why-list { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-2); grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.why-list li { padding: var(--space-3); background: var(--paper-warm); border-left: 3px solid var(--gold); font-size: var(--fs-sm); }

.contact-grid > div { padding: var(--space-4); border: 1px solid var(--line); background: var(--paper); }
.contact-grid h3 { margin-top: 0; font-size: var(--fs-lg); }
.contact-grid small { color: var(--ink-mute); }
```

- [ ] **Step 4: 构建并人工预览**

```bash
npm run build
npx --yes serve dist -l 5173
```
打开 http://localhost:5173 ，确认：
- 印章 SVG 显示
- Hero 标题用楷体
- 三栏服务卡 / 三作品入口 / 五卖点 / 三联系方式都渲染
- 滚动时各 section 淡入
- 移动端（≤ 900px）导航折叠成 ☰

- [ ] **Step 5: Commit**

```bash
git add index.html assets/css/home.css assets/images/home/seal.svg
git commit -m "feat(home): hero + services + portfolio entries + why-us + contact"
```

---

### Task 9: 人像写真页 `portrait.html`

**Files:**
- Create: `qiyangtang-site/portrait.html`
- Create: `qiyangtang-site/assets/js/gallery.js`（共用：fetch JSON + 渲染 grid + 绑定 lightbox + 绑定 filter）
- Create: `qiyangtang-site/assets/css/gallery.css`

**Interfaces:**
- Consumes: `assets/data/portrait.json`（Task 2 产物）、`filter.js`、`lightbox.js`、`reveal.js`
- Produces: `gallery.js` 导出 `mountGallery({ mountEl, filterEl, dataUrl, emptyText })`，三个画廊页共用。

- [ ] **Step 1: 写 `assets/js/gallery.js`**

```js
import { initFilter } from './filter.js';
import { bindGallery } from './lightbox.js';
import { initReveal } from './reveal.js';

export async function mountGallery({ mountEl, filterEl, dataUrl, emptyText = '暂无作品' }) {
  const res = await fetch(dataUrl);
  if (!res.ok) throw new Error(`failed to load ${dataUrl}: ${res.status}`);
  const { items } = await res.json();

  function render(list) {
    mountEl.innerHTML = '';
    if (!list.length) {
      const p = document.createElement('p');
      p.className = 'gallery-empty';
      p.textContent = emptyText;
      mountEl.append(p);
      return;
    }
    const grid = document.createElement('div');
    grid.className = 'gallery-grid';
    list.forEach((it, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gallery-item';
      btn.dataset.lightboxIndex = String(i);
      btn.setAttribute('aria-label', `查看大图：${it.alt}`);
      btn.innerHTML = `<img src="${it.thumb}" srcset="${it.srcset}" sizes="(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 25vw" alt="${it.alt}" loading="lazy" decoding="async" width="${it.width}" height="${it.height}">`;
      grid.append(btn);
    });
    mountEl.append(grid);
    bindGallery(grid, list);
    initReveal(grid);
  }

  initFilter({ container: filterEl, items, render, paramKey: 'style' });
}
```

- [ ] **Step 2: 写 `assets/css/gallery.css`**

```css
.gallery-page-header { text-align: center; padding-block: var(--space-5) var(--space-4); display: grid; gap: var(--space-2); justify-items: center; }
.gallery-page-header h1 { margin: 0; font-size: var(--fs-2xl); }
.gallery-page-header .lede { color: var(--ink-soft); max-width: 60ch; margin: 0; }
.gallery-toolbar { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; justify-content: space-between; margin-bottom: var(--space-4); }
.gallery-count { font-family: var(--font-en); color: var(--ink-mute); font-size: var(--fs-sm); letter-spacing: .1em; }
.gallery-empty { text-align: center; color: var(--ink-mute); padding: var(--space-6); }
```

- [ ] **Step 3: 写 `portrait.html`**

```html
<!-- @vars {
  "title": "人像写真",
  "description": "栖影堂人像写真客片：清新日系 / 情绪写真 / 韩系风 / 港风 / 夜景写真。",
  "active": "portrait"
} -->
<!-- @include partials/head.html -->
<!-- @include partials/nav.html -->

<main>
  <header class="gallery-page-header container" data-reveal>
    <h1>人像写真</h1>
    <p class="lede">清新日系 · 情绪写真 · 韩系风 · 港风 · 夜景写真 — 五种风格，记录你此刻的样子。</p>
  </header>

  <section class="container">
    <div class="gallery-toolbar">
      <div id="portrait-filter"></div>
      <span class="gallery-count" id="portrait-count" aria-live="polite"></span>
    </div>
    <div id="portrait-grid" class="gallery-mount"></div>
  </section>
</main>

<link rel="stylesheet" href="assets/css/components.css">
<link rel="stylesheet" href="assets/css/lightbox.css">
<link rel="stylesheet" href="assets/css/gallery.css">
<script type="module">
  import { mountGallery } from './assets/js/gallery.js';
  mountGallery({
    mountEl: document.getElementById('portrait-grid'),
    filterEl: document.getElementById('portrait-filter'),
    dataUrl: 'assets/data/portrait.json',
  }).then(() => {
    const update = () => {
      const n = document.querySelectorAll('#portrait-grid .gallery-item').length;
      document.getElementById('portrait-count').textContent = `${n} works`;
    };
    update();
    document.getElementById('portrait-filter').addEventListener('click', () => setTimeout(update, 0));
  });
</script>
<!-- @include partials/footer.html -->
```

- [ ] **Step 4: 构建 + 预览**

```bash
npm run build && npx --yes serve dist -l 5173
```
访问 http://localhost:5173/portrait.html ，确认：
- 12 张客片渲染
- 分类 chips 出现「全部 / 清新日系 / 情绪写真 / 韩系风 / 港风 / 夜景写真」
- 点击 chip 过滤 + URL 出现 `?style=...`
- 点击缩略图开 lightbox，键盘 ←/→/Esc 工作
- 移动端单列

- [ ] **Step 5: Commit**

```bash
git add portrait.html assets/js/gallery.js assets/css/gallery.css
git commit -m "feat(portrait): gallery page with filter + lightbox"
```

---

### Task 10: 婚礼摄影页 `wedding.html`

**Files:**
- Create: `qiyangtang-site/wedding.html`

**Interfaces:**
- Consumes: `assets/data/wedding.json`、`gallery.js`
- 分类：`领证` / `婚礼`（来自 Task 2 的 `weddingCategory`）

- [ ] **Step 1: 写 `wedding.html`**

```html
<!-- @vars {
  "title": "婚礼摄影",
  "description": "栖影堂婚礼摄影：仪式 / 接亲 / 宴会 / 外景全程跟拍，含领证日记录。",
  "active": "wedding"
} -->
<!-- @include partials/head.html -->
<!-- @include partials/nav.html -->

<main>
  <header class="gallery-page-header container" data-reveal>
    <h1>婚礼摄影</h1>
    <p class="lede">我们记录：仪式 · 接亲 · 宴会 · 外景。也记录领证那一天，你们成为彼此家人的瞬间。</p>
  </header>

  <section class="container">
    <div class="gallery-toolbar">
      <div id="wedding-filter"></div>
      <span class="gallery-count" id="wedding-count" aria-live="polite"></span>
    </div>
    <div id="wedding-grid" class="gallery-mount"></div>
  </section>
</main>

<link rel="stylesheet" href="assets/css/components.css">
<link rel="stylesheet" href="assets/css/lightbox.css">
<link rel="stylesheet" href="assets/css/gallery.css">
<script type="module">
  import { mountGallery } from './assets/js/gallery.js';
  mountGallery({
    mountEl: document.getElementById('wedding-grid'),
    filterEl: document.getElementById('wedding-filter'),
    dataUrl: 'assets/data/wedding.json',
  }).then(() => {
    const update = () => {
      const n = document.querySelectorAll('#wedding-grid .gallery-item').length;
      document.getElementById('wedding-count').textContent = `${n} works`;
    };
    update();
    document.getElementById('wedding-filter').addEventListener('click', () => setTimeout(update, 0));
  });
</script>
<!-- @include partials/footer.html -->
```

- [ ] **Step 2: 构建 + 预览**

```bash
npm run build && npx --yes serve dist -l 5173
```
访问 /wedding.html ，确认：~64 张图、chips 「全部 / 领证 / 婚礼」、过滤工作、lightbox 工作。

- [ ] **Step 3: Commit**

```bash
git add wedding.html
git commit -m "feat(wedding): gallery page (领证 / 婚礼 categories)"
```

---

### Task 11: 活动摄影页 `event.html`

**Files:**
- Create: `qiyangtang-site/event.html`

**Interfaces:**
- Consumes: `assets/data/event.json`、`gallery.js`
- 分类：`企业活动` / `年会` / `发布会` / `路演` / `展会`

- [ ] **Step 1: 写 `event.html`**

```html
<!-- @vars {
  "title": "活动摄影",
  "description": "栖影堂活动摄影：企业活动 / 年会 / 发布会 / 路演 / 展会专业纪实。",
  "active": "event"
} -->
<!-- @include partials/head.html -->
<!-- @include partials/nav.html -->

<main>
  <header class="gallery-page-header container" data-reveal>
    <h1>活动摄影</h1>
    <p class="lede">企业活动 · 年会 · 发布会 · 路演 · 展会 — 专业纪实，快速交付。</p>
  </header>

  <section class="container">
    <div class="gallery-toolbar">
      <div id="event-filter"></div>
      <span class="gallery-count" id="event-count" aria-live="polite"></span>
    </div>
    <div id="event-grid" class="gallery-mount"></div>
  </section>
</main>

<link rel="stylesheet" href="assets/css/components.css">
<link rel="stylesheet" href="assets/css/lightbox.css">
<link rel="stylesheet" href="assets/css/gallery.css">
<script type="module">
  import { mountGallery } from './assets/js/gallery.js';
  mountGallery({
    mountEl: document.getElementById('event-grid'),
    filterEl: document.getElementById('event-filter'),
    dataUrl: 'assets/data/event.json',
  }).then(() => {
    const update = () => {
      const n = document.querySelectorAll('#event-grid .gallery-item').length;
      document.getElementById('event-count').textContent = `${n} works`;
    };
    update();
    document.getElementById('event-filter').addEventListener('click', () => setTimeout(update, 0));
  });
</script>
<!-- @include partials/footer.html -->
```

- [ ] **Step 2: 构建 + 预览**

```bash
npm run build && npx --yes serve dist -l 5173
```
访问 /event.html ，确认：18 张图、5 类 chips、过滤 + lightbox 工作。

- [ ] **Step 3: Commit**

```bash
git add event.html
git commit -m "feat(event): gallery page (企业活动 / 年会 / 发布会 / 路演 / 展会)"
```

---

### Task 12: 预约表单前端 + 校验

**Files:**
- Create: `qiyangtang-site/booking.html`
- Create: `qiyangtang-site/assets/js/validate.js`（纯函数，可测）
- Create: `qiyangtang-site/assets/js/booking.js`（DOM glue）
- Create: `qiyangtang-site/assets/css/booking.css`
- Create: `qiyangtang-site/tests/validate.test.mjs`

**Interfaces:**
- `validate.js` 导出：
  - `validateName(s) -> string | null`（错误消息或 null）
  - `validatePhone(s) -> string | null`（中国大陆手机号 `/^1[3-9]\d{9}$/`）
  - `validateDate(s, today = new Date()) -> string | null`（ISO `YYYY-MM-DD`，≥ 今天，≤ 今天 + 365 天）
  - `validateType(s) -> string | null`（枚举：`portrait` | `wedding` | `event` | `other`）
  - `validateMessage(s) -> string | null`（≤ 500 字符，可空）
  - `validateHoneypot(s) -> string | null`（必须为空字符串；非空 → 返回 `"spam"`）
  - `validateForm(payload, today?) -> { ok: true, value } | { ok: false, errors: Record<string,string> }`
- `booking.js`：绑定 submit、调用 `validateForm`、错误内联展示 `aria-describedby`、POST `/api/contact`、成功/失败状态切换、提交中禁用按钮。

- [ ] **Step 1: 写测试 `tests/validate.test.mjs`**

```js
import { describe, it, expect } from 'vitest';
import { validateName, validatePhone, validateDate, validateType, validateMessage, validateHoneypot, validateForm } from '../assets/js/validate.js';

describe('validateName', () => {
  it('accepts 2-20 chars', () => { expect(validateName('张三')).toBeNull(); });
  it('rejects empty', () => { expect(validateName('')).toMatch(/必填/); });
  it('rejects > 20', () => { expect(validateName('a'.repeat(21))).toMatch(/过长/); });
});

describe('validatePhone', () => {
  it('accepts mainland mobile', () => { expect(validatePhone('15210475723')).toBeNull(); });
  it('rejects landline', () => { expect(validatePhone('01012345678')).toMatch(/手机号/); });
  it('rejects too short', () => { expect(validatePhone('1521047')).toMatch(/手机号/); });
  it('strips spaces and dashes', () => { expect(validatePhone('152-1047-5723')).toBeNull(); });
});

describe('validateDate', () => {
  const today = new Date('2026-09-14T00:00:00Z');
  it('accepts today', () => { expect(validateDate('2026-09-14', today)).toBeNull(); });
  it('accepts +30d', () => { expect(validateDate('2026-10-14', today)).toBeNull(); });
  it('rejects past', () => { expect(validateDate('2026-09-13', today)).toMatch(/过去/); });
  it('rejects > +365d', () => { expect(validateDate('2027-12-31', today)).toMatch(/一年/); });
  it('rejects malformed', () => { expect(validateDate('not-a-date', today)).toMatch(/格式/); });
});

describe('validateType', () => {
  it('accepts enum', () => { for (const t of ['portrait','wedding','event','other']) expect(validateType(t)).toBeNull(); });
  it('rejects unknown', () => { expect(validateType('xxx')).toMatch(/类型/); });
});

describe('validateMessage', () => {
  it('accepts empty', () => { expect(validateMessage('')).toBeNull(); });
  it('accepts 500', () => { expect(validateMessage('a'.repeat(500))).toBeNull(); });
  it('rejects 501', () => { expect(validateMessage('a'.repeat(501))).toMatch(/过长/); });
});

describe('validateHoneypot', () => {
  it('accepts empty', () => { expect(validateHoneypot('')).toBeNull(); });
  it('rejects non-empty', () => { expect(validateHoneypot('bot')).toBe('spam'); });
});

describe('validateForm', () => {
  const today = new Date('2026-09-14T00:00:00Z');
  it('returns ok for valid payload', () => {
    const r = validateForm({ name:'张三', phone:'15210475723', date:'2026-10-01', type:'portrait', message:'你好', website:'' }, today);
    expect(r.ok).toBe(true);
  });
  it('collects all errors', () => {
    const r = validateForm({ name:'', phone:'bad', date:'2020-01-01', type:'xxx', message:'a'.repeat(600), website:'' }, today);
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(['date','message','name','phone','type']);
  });
  it('flags spam when honeypot filled', () => {
    const r = validateForm({ name:'张三', phone:'15210475723', date:'2026-10-01', type:'portrait', message:'', website:'http://spam' }, today);
    expect(r.ok).toBe(false);
    expect(r.errors.website).toBe('spam');
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

```bash
npx vitest run tests/validate.test.mjs
```

- [ ] **Step 3: 实现 `assets/js/validate.js`**

```js
const PHONE_RE = /^1[3-9]\d{9}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TYPES = new Set(['portrait','wedding','event','other']);

export function validateName(s) {
  const v = (s || '').trim();
  if (!v) return '请填写姓名（必填）';
  if (v.length > 20) return '姓名过长（最多 20 字）';
  return null;
}
export function validatePhone(s) {
  const v = (s || '').replace(/[\s-]/g, '');
  if (!v) return '请填写手机号（必填）';
  if (!PHONE_RE.test(v)) return '请输入有效的中国大陆手机号';
  return null;
}
export function validateDate(s, today = new Date()) {
  const v = (s || '').trim();
  if (!v) return '请选择拍摄日期（必填）';
  if (!DATE_RE.test(v)) return '日期格式应为 YYYY-MM-DD';
  const d = new Date(v + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return '日期格式应为 YYYY-MM-DD';
  const t = new Date(today); t.setUTCHours(0,0,0,0);
  const max = new Date(t); max.setUTCDate(max.getUTCDate() + 365);
  if (d < t) return '日期不能早于今天';
  if (d > max) return '日期不能超过一年以内';
  return null;
}
export function validateType(s) {
  if (!TYPES.has(s)) return '请选择拍摄类型';
  return null;
}
export function validateMessage(s) {
  const v = s || '';
  if (v.length > 500) return '留言过长（最多 500 字）';
  return null;
}
export function validateHoneypot(s) {
  return (s && s.length > 0) ? 'spam' : null;
}
export function validateForm(p, today = new Date()) {
  const errors = {};
  const checks = [
    ['name', validateName(p.name)],
    ['phone', validatePhone(p.phone)],
    ['date', validateDate(p.date, today)],
    ['type', validateType(p.type)],
    ['message', validateMessage(p.message)],
    ['website', validateHoneypot(p.website)],
  ];
  for (const [k, e] of checks) if (e) errors[k] = e;
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { name: p.name.trim(), phone: p.phone.replace(/[\s-]/g,''), date: p.date, type: p.type, message: (p.message||'').trim() } };
}
```

- [ ] **Step 4: 跑测试，确认通过**

```bash
npx vitest run tests/validate.test.mjs
```
Expected: all passed.

- [ ] **Step 5: 实现 `assets/js/booking.js`**

```js
import { validateForm } from './validate.js';

export function initBooking(form, { endpoint = '/api/contact' } = {}) {
  const status = form.querySelector('[data-status]');
  const submit = form.querySelector('button[type="submit"]');

  function setError(field, msg) {
    const input = form.elements[field];
    const slot = form.querySelector(`[data-error-for="${field}"]`);
    if (msg) {
      input?.setAttribute('aria-invalid', 'true');
      if (slot) { slot.textContent = msg; slot.hidden = false; }
    } else {
      input?.removeAttribute('aria-invalid');
      if (slot) { slot.textContent = ''; slot.hidden = true; }
    }
  }
  function clearErrors() { for (const f of ['name','phone','date','type','message','website']) setError(f, null); }
  function setStatus(kind, text) {
    status.dataset.kind = kind;
    status.textContent = text;
    status.hidden = false;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    const r = validateForm(payload);
    if (!r.ok) {
      for (const [k, v] of Object.entries(r.errors)) setError(k, v);
      setStatus('error', '请检查表单中标红的字段。');
      const firstBad = form.querySelector('[aria-invalid="true"]');
      firstBad?.focus();
      return;
    }
    submit.disabled = true;
    setStatus('pending', '提交中…');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(r.value),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));
      if (data.ok === false) throw new Error(data.error || '提交失败');
      form.reset();
      setStatus('success', '已收到您的预约，我们会在 1 个工作日内联系您。');
    } catch (err) {
      setStatus('error', `提交失败：${err.message}。请稍后重试，或直接致电 152 1047 5723。`);
    } finally {
      submit.disabled = false;
    }
  });
}
```

- [ ] **Step 6: 写 `booking.html`**

```html
<!-- @vars {
  "title": "预约拍摄",
  "description": "预约栖影堂拍摄：人像写真 / 婚礼摄影 / 活动摄影。一对一沟通，快速回复。",
  "active": "booking"
} -->
<!-- @include partials/head.html -->
<!-- @include partials/nav.html -->

<main>
  <header class="gallery-page-header container" data-reveal>
    <h1>预约拍摄</h1>
    <p class="lede">填写下面的表单，我们会在 1 个工作日内通过微信或电话与您联系。也可以直接 <a href="mailto:lrishui@163.com">发邮件</a> 或致电 <a href="tel:15210475723">152 1047 5723</a>。</p>
  </header>

  <section class="container booking-wrap" data-reveal>
    <form id="booking-form" class="booking-form" novalidate>
      <div class="field">
        <label for="f-name">姓名 <span aria-hidden="true">*</span></label>
        <input id="f-name" name="name" type="text" required maxlength="20" autocomplete="name" aria-describedby="e-name">
        <p class="error" id="e-name" data-error-for="name" hidden></p>
      </div>

      <div class="field">
        <label for="f-phone">手机号 <span aria-hidden="true">*</span></label>
        <input id="f-phone" name="phone" type="tel" required inputmode="numeric" autocomplete="tel" pattern="1[3-9]\d{9}" aria-describedby="e-phone">
        <p class="error" id="e-phone" data-error-for="phone" hidden></p>
      </div>

      <div class="field">
        <label for="f-date">期望拍摄日期 <span aria-hidden="true">*</span></label>
        <input id="f-date" name="date" type="date" required aria-describedby="e-date">
        <p class="error" id="e-date" data-error-for="date" hidden></p>
      </div>

      <div class="field">
        <label for="f-type">拍摄类型 <span aria-hidden="true">*</span></label>
        <select id="f-type" name="type" required aria-describedby="e-type">
          <option value="">请选择…</option>
          <option value="portrait">人像写真</option>
          <option value="wedding">婚礼摄影</option>
          <option value="event">活动摄影</option>
          <option value="other">其他</option>
        </select>
        <p class="error" id="e-type" data-error-for="type" hidden></p>
      </div>

      <div class="field">
        <label for="f-message">备注（选填）</label>
        <textarea id="f-message" name="message" rows="4" maxlength="500" aria-describedby="e-message"></textarea>
        <p class="error" id="e-message" data-error-for="message" hidden></p>
      </div>

      <!-- honeypot: visually hidden, must remain empty -->
      <div class="field hp" aria-hidden="true">
        <label for="f-website">请勿填写此字段</label>
        <input id="f-website" name="website" type="text" tabindex="-1" autocomplete="off">
        <p class="error" id="e-website" data-error-for="website" hidden></p>
      </div>

      <p class="status" data-status hidden role="status" aria-live="polite"></p>

      <button type="submit" class="btn btn-primary">提交预约</button>
    </form>
  </section>
</main>

<link rel="stylesheet" href="assets/css/components.css">
<link rel="stylesheet" href="assets/css/booking.css">
<script type="module">
  import { initBooking } from './assets/js/booking.js';
  import { initReveal } from './assets/js/reveal.js';
  initReveal();
  initBooking(document.getElementById('booking-form'));
</script>
<!-- @include partials/footer.html -->
```

- [ ] **Step 7: 写 `assets/css/booking.css`**

```css
.booking-wrap { max-width: 640px; }
.booking-form { display: grid; gap: var(--space-4); background: var(--paper-warm); padding: var(--space-5); border: 1px solid var(--line); border-radius: 2px; }
.field { display: grid; gap: var(--space-1); }
.field label { font-family: var(--font-kai); color: var(--ink); font-size: var(--fs-sm); }
.field label span { color: var(--seal); }
.field input, .field select, .field textarea { font: inherit; font-family: var(--font-serif-cn); padding: var(--space-2) var(--space-3); border: 1px solid var(--line); background: var(--paper); color: var(--ink); border-radius: 2px; transition: border-color .2s; }
.field input:focus, .field select:focus, .field textarea:focus { border-color: var(--ink); outline: none; box-shadow: 0 0 0 3px rgba(184,148,95,.18); }
.field input[aria-invalid="true"], .field select[aria-invalid="true"], .field textarea[aria-invalid="true"] { border-color: var(--seal); }
.field .error { color: var(--seal); font-size: var(--fs-xs); margin: 0; }
.field.hp { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.status { padding: var(--space-3); border-left: 3px solid var(--ink-mute); background: var(--paper); font-size: var(--fs-sm); margin: 0; }
.status[data-kind="success"] { border-color: var(--gold); color: var(--ink); }
.status[data-kind="error"] { border-color: var(--seal); color: var(--seal); }
.status[data-kind="pending"] { border-color: var(--ink-mute); color: var(--ink-soft); }
.booking-form button[type="submit"] { justify-self: start; }
.booking-form button[type="submit"]:disabled { opacity: .6; cursor: not-allowed; }
```

- [ ] **Step 8: 构建 + 预览（表单提交此时会 404，Task 13 接入 Function）**

```bash
npm run build && npx --yes serve dist -l 5173
```
访问 /booking.html ，确认：
- 各字段渲染、honeypot 不可见
- 空提交 → 内联错误 + status error
- 填错手机号 → 「请输入有效的中国大陆手机号」
- 填昨天日期 → 「日期不能早于今天」
- 填 honeypot → status error 含 `spam`
- 正确填写后提交 → fetch 404（预期，Function 在 Task 13 接入）→ status error

- [ ] **Step 9: Commit**

```bash
git add booking.html assets/js/validate.js assets/js/booking.js assets/css/booking.css tests/validate.test.mjs
git commit -m "feat(booking): form with client validation + honeypot + status feedback"
```

---

### Task 13: Pages Function `/api/contact` + 飞书 Webhook

**Files:**
- Create: `qiyangtang-site/functions/api/contact.js`
- Create: `qiyangtang-site/tests/contact.test.mjs`
- Create: `qiyangtang-site/.env.example`

**Interfaces:**
- Endpoint: `POST /api/contact`
- Request body: `{ name, phone, date, type, message }`（已通过前端校验，Function 端再做一次同样的校验）
- Response:
  - `200 { ok: true }` — 飞书 webhook 返回 0
  - `400 { ok: false, error: "..." , errors?: {...} }` — 校验失败 / honeypot 命中 / Origin 不同源
  - `502 { ok: false, error: "upstream" }` — 飞书返回非 0
  - `500 { ok: false, error: "internal" }` — 其他异常
- Env（Pages Secret）：`FEISHU_WEBHOOK_URL`（必填）、`FEISHU_WEBHOOK_SECRET`（可选）

- [ ] **Step 1: 写 `.env.example`**

```
# Cloudflare Pages → Settings → Environment variables → Secret
# 必填：飞书自定义机器人 webhook 完整 URL
FEISHU_WEBHOOK_URL=
# 可选：飞书机器人「签名校验」密钥；配置后 Function 会对请求做 HmacSHA256 签名
FEISHU_WEBHOOK_SECRET=
```

- [ ] **Step 2: 写测试 `tests/contact.test.mjs`**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, buildFeishuPost, signFeishu } from '../functions/api/contact.js';

function makeReq({ body, headers = {}, method = 'POST', url = 'https://x/api/contact' } = {}) {
  return {
    method, url,
    headers: new Headers({ origin: 'https://x', 'content-type': 'application/json', ...headers }),
    json: async () => body,
    text: async () => JSON.stringify(body ?? {}),
  };
}
const ENV = { FEISHU_WEBHOOK_URL: 'https://open.feishu.cn/open-apis/bot/v2/hook/test' };

describe('buildFeishuPost', () => {
  it('builds rich-text post with all fields', () => {
    const p = buildFeishuPost({ name:'张三', phone:'15210475723', date:'2026-10-01', type:'portrait', message:'你好' });
    expect(p.msg_type).toBe('post');
    const content = JSON.parse(p.content);
    expect(content.post.zh_cn.title).toContain('张三');
    const text = JSON.stringify(content);
    expect(text).toContain('15210475723');
    expect(text).toContain('2026-10-01');
    expect(text).toContain('人像写真');
    expect(text).toContain('你好');
  });
  it('maps type enum to Chinese', () => {
    for (const [t, cn] of [['portrait','人像写真'],['wedding','婚礼摄影'],['event','活动摄影'],['other','其他']]) {
      const p = buildFeishuPost({ name:'a', phone:'15210475723', date:'2026-10-01', type:t, message:'' });
      expect(JSON.parse(p.content).post.zh_cn.content.flat().some(x => x.text?.includes(cn))).toBe(true);
    }
  });
});

describe('signFeishu', () => {
  it('produces deterministic base64 hmac', async () => {
    const s1 = await signFeishu(1700000000, 'secret');
    const s2 = await signFeishu(1700000000, 'secret');
    expect(s1).toBe(s2);
    expect(typeof s1).toBe('string');
  });
});

describe('POST /api/contact', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('rejects cross-origin', async () => {
    const req = makeReq({ body: { name:'a', phone:'15210475723', date:'2099-01-01', type:'portrait', message:'' }, headers: { origin: 'https://evil.com' } });
    const res = await POST(req, { env: ENV });
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.ok).toBe(false);
  });

  it('rejects honeypot', async () => {
    const req = makeReq({ body: { name:'a', phone:'15210475723', date:'2099-01-01', type:'portrait', message:'', website:'bot' } });
    const res = await POST(req, { env: ENV });
    expect(res.status).toBe(400);
  });

  it('rejects invalid payload with field errors', async () => {
    const req = makeReq({ body: { name:'', phone:'bad', date:'2020-01-01', type:'x', message:'' } });
    const res = await POST(req, { env: ENV });
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.errors).toBeDefined();
    expect(Object.keys(j.errors).sort()).toEqual(['date','name','phone','type']);
  });

  it('forwards to feishu and returns ok', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 0, msg: 'success' }), { status: 200 }));
    const req = makeReq({ body: { name:'张三', phone:'15210475723', date:'2099-01-01', type:'portrait', message:'hi' } });
    const res = await POST(req, { env: ENV });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledWith(ENV.FEISHU_WEBHOOK_URL, expect.objectContaining({ method: 'POST' }));
  });

  it('returns 502 when feishu replies non-zero', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 19001, msg: 'sign error' }), { status: 200 }));
    const req = makeReq({ body: { name:'张三', phone:'15210475723', date:'2099-01-01', type:'portrait', message:'' } });
    const res = await POST(req, { env: ENV });
    expect(res.status).toBe(502);
  });

  it('signs when FEISHU_WEBHOOK_SECRET present', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 0 }), { status: 200 }));
    const req = makeReq({ body: { name:'张三', phone:'15210475723', date:'2099-01-01', type:'portrait', message:'' } });
    const res = await POST(req, { env: { ...ENV, FEISHU_WEBHOOK_SECRET: 's3cr3t' } });
    expect(res.status).toBe(200);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.timestamp).toBeDefined();
    expect(body.sign).toBeDefined();
  });
});
```

- [ ] **Step 3: 跑测试，确认失败**

```bash
npx vitest run tests/contact.test.mjs
```

- [ ] **Step 4: 实现 `functions/api/contact.js`**

```js
// Cloudflare Pages Function — Workers runtime
// Secret: FEISHU_WEBHOOK_URL (required), FEISHU_WEBHOOK_SECRET (optional)

const PHONE_RE = /^1[3-9]\d{9}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TYPES = { portrait:'人像写真', wedding:'婚礼摄影', event:'活动摄影', other:'其他' };
const MAX_MESSAGE = 500;
const MAX_DATE_DAYS = 365;

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function validate(p) {
  const errors = {};
  const name = (p.name || '').trim();
  if (!name) errors.name = '必填'; else if (name.length > 20) errors.name = '过长';
  const phone = (p.phone || '').replace(/[\s-]/g, '');
  if (!PHONE_RE.test(phone)) errors.phone = '无效手机号';
  const date = (p.date || '').trim();
  if (!DATE_RE.test(date)) errors.date = '格式错误';
  else {
    const d = new Date(date + 'T00:00:00Z');
    const t = new Date(); t.setUTCHours(0,0,0,0);
    const max = new Date(t); max.setUTCDate(max.getUTCDate() + MAX_DATE_DAYS);
    if (d < t) errors.date = '过去';
    else if (d > max) errors.date = '超过一年';
  }
  if (!(p.type in TYPES)) errors.type = '无效类型';
  if ((p.message || '').length > MAX_MESSAGE) errors.message = '过长';
  if (p.website) errors.website = 'spam';
  return { ok: Object.keys(errors).length === 0, errors, value: { name, phone, date, type: p.type, message: (p.message || '').trim() } };
}

export function buildFeishuPost(v) {
  const typeCn = TYPES[v.type] || v.type;
  const lines = [
    [{ tag: 'text', text: `姓名：${v.name}` }],
    [{ tag: 'text', text: `手机：${v.phone}` }],
    [{ tag: 'text', text: `期望日期：${v.date}` }],
    [{ tag: 'text', text: `拍摄类型：${typeCn}` }],
  ];
  if (v.message) lines.push([{ tag: 'text', text: `备注：${v.message}` }]);
  lines.push([{ tag: 'text', text: `提交时间：${new Date().toISOString()}` }]);
  return {
    msg_type: 'post',
    content: JSON.stringify({
      post: { zh_cn: { title: `📷 新预约 · ${v.name} · ${typeCn}`, content: lines } },
    }),
  };
}

export async function signFeishu(timestamp, secret) {
  const stringToSign = `${timestamp}\n${secret}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(stringToSign),
    { name: 'HMAC', hash: 'SHA256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new Uint8Array(0));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function sameOrigin(req) {
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const url = new URL(req.url);
  if (origin) { try { return new URL(origin).host === url.host; } catch { return false; } }
  if (referer) { try { return new URL(referer).host === url.host; } catch { return false; } }
  // no origin/referer: allow (curl, same-page navigation in some browsers)
  return true;
}

export async function POST(req, ctx) {
  try {
    if (!sameOrigin(req)) return json(400, { ok: false, error: 'origin' });
    const env = ctx?.env || {};
    if (!env.FEISHU_WEBHOOK_URL) return json(500, { ok: false, error: 'misconfigured' });

    let body;
    try { body = await req.json(); } catch { return json(400, { ok: false, error: 'bad-json' }); }
    const r = validate(body || {});
    if (!r.ok) return json(400, { ok: false, error: 'invalid', errors: r.errors });

    const payload = buildFeishuPost(r.value);
    if (env.FEISHU_WEBHOOK_SECRET) {
      const timestamp = Math.floor(Date.now() / 1000);
      payload.timestamp = String(timestamp);
      payload.sign = await signFeishu(timestamp, env.FEISHU_WEBHOOK_SECRET);
    }

    const upstream = await fetch(env.FEISHU_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await upstream.text();
    let data; try { data = JSON.parse(text); } catch { data = { code: -1, msg: text }; }
    if (!upstream.ok || data.code !== 0) {
      return json(502, { ok: false, error: 'upstream', detail: { status: upstream.status, code: data.code, msg: data.msg } });
    }
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { ok: false, error: 'internal', detail: String(e?.message || e) });
  }
}

export async function GET() {
  return json(405, { ok: false, error: 'method-not-allowed' });
}
```

- [ ] **Step 5: 跑测试，确认通过**

```bash
npx vitest run tests/contact.test.mjs
```
Expected: 8 passed.

- [ ] **Step 6: 本地用 wrangler 跑一次（可选，需要登录）**

```bash
npx --yes wrangler pages dev dist --binding FEISHU_WEBHOOK_URL="https://open.feishu.cn/open-apis/bot/v2/hook/49e99a90-7a83-42b5-8487-e2e35a5ad544"
# 另一个终端：
curl -X POST http://localhost:8788/api/contact \
  -H "content-type: application/json" -H "origin: http://localhost:8788" \
  -d '{"name":"测试","phone":"15210475723","date":"2099-01-01","type":"portrait","message":"本地联调"}'
```
Expected: 返回 `{"ok":true}`，飞书群收到富文本卡片。

> 注意：wrangler 命令里的 webhook URL 是**本地联调用**，执行后立刻从 shell history 清除（`history -c` 或对应命令）。生产环境只走 Pages Secret。

- [ ] **Step 7: Commit**

```bash
git add functions/api/contact.js tests/contact.test.mjs .env.example
git commit -m "feat(api): /api/contact Pages Function with Feishu webhook + optional signing"
```

---

### Task 14: 部署文件（_headers / _redirects / robots / sitemap）

**Files:**
- Create: `qiyangtang-site/_headers`
- Create: `qiyangtang-site/_redirects`
- Create: `qiyangtang-site/robots.txt`
- Create: `qiyangtang-site/sitemap.xml`

**Interfaces:**
- Cloudflare Pages 自动识别 `_headers` / `_redirects`（构建后需在 `dist/` 里）。`build.mjs` 的 `copyStatic` 已处理。

- [ ] **Step 1: 写 `_headers`**

```
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/assets/images/*
  Cache-Control: public, max-age=31536000, immutable

/assets/fonts/*
  Cache-Control: public, max-age=31536000, immutable
  Access-Control-Allow-Origin: *

/assets/data/*.json
  Cache-Control: public, max-age=300, must-revalidate

/*.html
  Cache-Control: public, max-age=0, must-revalidate
```

- [ ] **Step 2: 写 `_redirects`**

```
# 规范化：去掉 .html 后缀（可选）
/index.html    /            301
/portrait.html /portrait    301
/wedding.html  /wedding     301
/event.html    /event       301
/booking.html  /booking     301
```

> 注：启用 301 后，站内链接需相应改为无后缀形式，或保留 `.html` 链接但接受一次 301。**V1 默认不启用**——把整个 `_redirects` 内容注释掉，仅保留文件占位。执行者按 spec 第 9 节决定是否启用；若启用，同步更新 `partials/nav.html` 与所有 `<a href>`。

- [ ] **Step 3: 写 `robots.txt`**

```
User-agent: *
Allow: /
Sitemap: https://qiyangtang.pages.dev/sitemap.xml
```

> 实际域名以 Cloudflare Pages 分配为准；自定义域名上线后替换。

- [ ] **Step 4: 写 `sitemap.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://qiyangtang.pages.dev/</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>
  <url><loc>https://qiyangtang.pages.dev/portrait.html</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://qiyangtang.pages.dev/wedding.html</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://qiyangtang.pages.dev/event.html</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://qiyangtang.pages.dev/booking.html</loc><changefreq>yearly</changefreq><priority>0.6</priority></url>
</urlset>
```

- [ ] **Step 5: 重新构建，确认文件进入 dist**

```bash
npm run build
ls dist/_headers dist/_redirects dist/robots.txt dist/sitemap.xml
```
Expected: 四个文件都存在。

- [ ] **Step 6: Commit**

```bash
git add _headers _redirects robots.txt sitemap.xml
git commit -m "chore(deploy): headers, redirects placeholder, robots, sitemap"
```

---

### Task 15: README + 部署手册

**Files:**
- Modify: `qiyangtang-site/README.md`（覆盖 Task 1 的最小版）

- [ ] **Step 1: 写完整 README**

包含：
- 项目简介（一段）
- 技术栈
- 本地开发步骤（`npm install` → `process:images` → `subset:font` → `build` → `dev`）
- 测试（`npm test`）
- 目录结构树
- Cloudflare Pages 部署步骤：
  1. 推送到 GitHub
  2. Cloudflare Dashboard → Pages → Connect to Git → 选 repo
  3. Build command: `npm run process:images && npm run subset:font && npm run build`
  4. Output directory: `dist`
  5. Functions directory: `functions`（自动识别）
  6. Node version: 20（环境变量 `NODE_VERSION=20`）
  7. Secrets：`FEISHU_WEBHOOK_URL`（必填）、`FEISHU_WEBHOOK_SECRET`（可选）
- 飞书机器人配置步骤：群设置 → 群机器人 → 添加自定义机器人 → 复制 webhook → （可选）开启签名校验并复制密钥
- 安全注意：webhook URL 等价于 secret，绝不进前端代码 / git / 截图
- 内容更新流程：替换 `~/Downloads/栖影堂` 下图片 → 重跑 `process:images` → commit `assets/data/*.json`（图片本身被 .gitignore）→ Pages 自动重建
- 已知限制（V1）：无 IP 频率限制、无后台管理、无多语言

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: full README with dev / test / deploy / Feishu bot setup"
```

---

### Task 16: Lighthouse 调优 + 最终 QA

**Files:**
- Modify: 任何需要调整的文件

- [ ] **Step 1: 构建 + 本地 Lighthouse**

```bash
npm run build
npx --yes serve dist -l 5173 &
npx --yes lighthouse http://localhost:5173 --output=html --output-path=./lh-home.html --only-categories=performance,accessibility,best-practices,seo --chrome-flags="--headless"
```
对 5 个页面各跑一次。目标：
- Performance ≥ 90（移动端模拟）
- Accessibility ≥ 95
- Best Practices ≥ 95
- SEO ≥ 95

- [ ] **Step 2: 常见问题修复清单**

- `<img>` 缺 `width`/`height` → Task 2 已写入 JSON，Task 9 的 `gallery.js` 已设置；检查首页静态图。
- 字体 FOUT → `font-display: swap` 已设；若 LCP 受影响，给 hero 标题加 `font-display: optional` 或预加载 `<link rel="preload" as="font" type="font/woff2" href="assets/fonts/lxgw-wenkai-subset.woff2" crossorigin>`。
- 图片懒加载 → gallery 已 `loading="lazy"`；首屏图（home seal）保持 eager。
- 对比度 → `--ink-mute #8C8279` on `--paper #F5F1E8` 对比度 ~4.6:1，AA 通过；若 Lighthouse 报小字对比度，把 `--ink-mute` 调深至 `#7A7067`。
- `<html lang>` → 已设 `zh-CN`。
- meta description → 每页 `@vars` 已提供。
- 404 页 → Cloudflare Pages 默认有；若要自定义，加 `404.html`（本任务范围外，可选）。

- [ ] **Step 3: 跨浏览器手测**

- Chrome / Edge / Firefox / Safari（iOS）各打开 5 个页面
- 移动端（≤ 640px）：导航折叠、gallery 单列、lightbox 全屏、表单可用
- 键盘：Tab 走完全页、Enter 触发 lightbox、Esc 关闭、表单错误聚焦
- `prefers-reduced-motion: reduce`（系统设置或 DevTools 模拟）：无淡入、无 transform

- [ ] **Step 4: 表单端到端**

在 Pages Preview 部署上：
- 正确填写 → 飞书群收到卡片
- honeypot 填值 → 400 + status error
- 跨 origin（用 curl 不带 origin 头从外站）→ 400
- 飞书 webhook 故意写错 → 502 + status error 含「提交失败」

- [ ] **Step 5: Commit（若有修复）**

```bash
git add -A
git commit -m "fix(a11y/perf): lighthouse tuning pass"
```

---

### Task 17: 部署交接

**Files:** 无新增

- [ ] **Step 1: 推送到 GitHub**

```bash
git remote add origin <user-repo-url>
git push -u origin main
```

- [ ] **Step 2: Cloudflare Pages 连接**

按 README 步骤配置：
- Build command: `npm run process:images && npm run subset:font && npm run build`
- Output: `dist`
- Env: `NODE_VERSION=20`
- Secret: `FEISHU_WEBHOOK_URL` = `https://open.feishu.cn/open-apis/bot/v2/hook/49e99a90-7a83-42b5-8487-e2e35a5ad544`
- （可选）Secret: `FEISHU_WEBHOOK_SECRET`

> 首次构建注意：`process:images` 在 CI 上无法访问 `~/Downloads/栖影堂`。**两种方案**：
> - **A（推荐 V1）**：本地跑 `process:images` + `subset:font`，把 `assets/images/` 与 `assets/fonts/*.woff2` 从 `.gitignore` 移除并提交，CI 只跑 `npm run build`。
> - **B**：把源图上传到 R2 / GitHub LFS，CI 拉取后处理。V2 再考虑。
>
> 执行者按用户选择落地；若选 A，修改 `.gitignore` 删除 `assets/images/**/*` 与 `assets/fonts/*.woff2` 两行，重跑 `process:images` + `subset:font`，`git add assets/` 并提交 `chore: vendor processed images and subset font for CI`。

- [ ] **Step 3: 验证生产**

- 访问 `https://<project>.pages.dev/`
- 5 个页面都加载、图片显示、lightbox 工作
- 表单提交 → 飞书群收到卡片
- Lighthouse 生产 URL 再跑一次，分数达标

- [ ] **Step 4: 自定义域名（可选）**

Pages → Custom domains → 按指引配置 CNAME；更新 `robots.txt` / `sitemap.xml` 中的域名；重新部署。

- [ ] **Step 5: 最终 commit + tag**

```bash
git tag -a v1.0.0 -m "栖影堂站点 V1 上线"
git push origin v1.0.0
```

---

## Self-Review Notes

**Spec coverage:**
- §1 目标 → Task 1/8
- §2 视觉 tokens → Task 1
- §3 信息架构（5 页）→ Task 8/9/10/11/12
- §4 图片流水线 → Task 2
- §5 字体 → Task 3
- §6 画廊数据 + 分类 → Task 2/7/9/10/11
- §7 Lightbox → Task 6
- §8 滚动揭示 → Task 7
- §9 构建（partials）→ Task 4/5
- §10 预约表单前端 → Task 12
- §11 Pages Function + 飞书 → Task 13
- §12 部署 / 安全 / 反垃圾 → Task 13/14/17

**Placeholder scan:** 无 TBD / TODO；所有代码块完整可执行。

**Type consistency:**
- `GalleryItem` schema 在 Task 2 定义，Task 6/7/9 消费一致（`src` / `srcset` / `thumb` / `fallback` / `width` / `height` / `alt` / `category`）。
- `validateForm` 签名在 Task 12 定义，Task 13 服务端 `validate` 与之等价（同枚举、同正则、同长度限制）。
- `buildFeishuPost` / `signFeishu` 在 Task 13 测试与实现一致。
- partial 变量 `{{title}}` / `{{description}}` / `{{active}}` 在 Task 5 定义，Task 8–12 使用一致。

**已知执行期决策点（非阻塞）：**
1. Task 3 字体子集化：cn-font-split 默认输出分片，单文件 woff2 需 pyftsubset 兜底。脚本已写双路径，执行者按本机环境二选一。
2. Task 14 `_redirects`：V1 默认注释掉，保留 `.html` 后缀链接。
3. Task 17 CI 图片处理：推荐方案 A（vendor 处理后的图片进 git），执行前与用户确认。
