# 栖影堂 | Lrishui

栖影堂 | Lrishui 是一个个人摄影工作室网站，采用米白宣纸风设计，纯静态 HTML/CSS/JS 构建，部署在 Cloudflare Pages。包含人像写真、婚礼摄影、活动摄影三个画廊，以及预约表单（通过飞书 Webhook 通知）。

## 技术栈

- HTML5, CSS3 (Custom Properties), Vanilla JS (ES2022 modules)
- Node.js 20+ (构建工具)
- sharp (图片处理)
- fonttools + brotli (字体子集化，需 Python 3.10+)
- Vitest + jsdom (前端 JS 单元测试)
- Cloudflare Pages + Pages Functions (部署)

## 本地开发

```bash
npm install
npm run process:images   # 从 ~/Downloads/栖影堂 生成 assets/images + assets/data
npm run subset:font      # 生成 assets/fonts/lxgw-wenkai-subset.woff2（需要 Python 3.10+ 与 fonttools/brotli）
npm run build            # 编译 partials → dist/
npm run dev              # 监听 + 本地预览 http://localhost:5173
npm test                 # 运行测试
```

**字体子集化依赖**：`npm run subset:font` 需要 Python 3.10+ 及 `fonttools`、`brotli` 包：

```bash
pip install fonttools brotli
```

## 目录结构

```
qiyangtang-site/
├── index.html              首页
├── portrait.html           人像写真
├── wedding.html            婚礼摄影
├── event.html              活动摄影
├── booking.html            预约表单
├── 404.html                404 页面
├── partials/               HTML 模板片段（head/nav/footer）
├── assets/
│   ├── css/                样式（tokens/base/fonts/layout/components/lightbox/gallery/home/booking）
│   ├── js/                 脚本（reveal/filter/lightbox/gallery/validate/booking）
│   ├── images/             图片（process:images 生成）
│   ├── fonts/              子集字体（subset:font 生成）
│   └── data/               画廊 JSON（process:images 生成）
├── functions/              Cloudflare Pages Functions
│   └── api/contact.js      预约表单后端
├── scripts/                构建脚本
│   ├── process-images.mjs  图片处理 + JSON 生成
│   ├── subset-font.mjs     字体子集化
│   ├── build.mjs           站点构建
│   └── dev.mjs             开发服务器
├── tests/                  单元测试
├── _headers                缓存/安全头
├── _redirects              重定向规则
├── robots.txt              搜索引擎爬虫
├── sitemap.xml             站点地图
└── dist/                   构建输出（gitignore）
```

## Cloudflare Pages 部署

1. 推送到 GitHub
2. Cloudflare Dashboard → Pages → Connect to Git → 选 repo
3. Build command: `npm run build`
4. Output directory: `dist`
5. Functions directory: `functions`（自动识别）
6. Node version: 20（环境变量 `NODE_VERSION=20`）
7. Secrets：
   - `FEISHU_WEBHOOK_URL`（必填）— 飞书自定义机器人 Webhook URL
   - `FEISHU_WEBHOOK_SECRET`（可选）— 飞书机器人签名校验密钥

**注意**：`process:images` 和 `subset:font` 需要在本地运行（依赖本地文件 `~/Downloads/栖影堂` 和 Python），构建产物（`assets/images/`、`assets/fonts/`）需要提交到 git。详见"内容更新流程"章节。

## 飞书机器人配置

1. 飞书群 → 设置 → 群机器人 → 添加机器人 → 自定义机器人
2. 复制 Webhook 地址 → 填入 Cloudflare Pages Secret `FEISHU_WEBHOOK_URL`
3. （可选）开启"签名校验" → 复制密钥 → 填入 Secret `FEISHU_WEBHOOK_SECRET`

## 安全注意

- Webhook URL 等价于密码，**绝不**进入前端代码、git 提交、或截图
- 仅存于 Cloudflare Pages Secret 和本地 `.dev.vars`（已 gitignore）

## 内容更新流程

1. 替换 `~/Downloads/栖影堂` 下的图片（按页面分目录：`1.首页`、`2.人像写真`、`3.婚礼摄影`、`4.活动摄影`）
2. 本地运行 `npm run process:images`（重新生成图片和 JSON）
3. `git add assets/data/*.json`（图片本身被 .gitignore，但 JSON 需要提交）
4. 如果新增了需要子集化的文字，运行 `npm run subset:font`
5. Commit + push → Cloudflare Pages 自动重建

**已处理图片的 git 策略**：由于 CI 无法访问 `~/Downloads/栖影堂`，`assets/images/` 和 `assets/fonts/*.woff2` 需要提交到 git。`.gitignore` 中这些路径已被注释掉或由 `.gitattributes` 管理。

## 测试

```bash
npm test            # 运行所有测试
npm run test:watch  # 监听模式
```

测试覆盖：

- `tests/build.test.mjs` — 构建脚本
- `tests/process-images.test.mjs` — 图片处理
- `tests/filter.test.mjs` — 分类筛选
- `tests/lightbox.test.mjs` — 灯箱
- `tests/validate.test.mjs` — 表单校验
- `tests/contact.test.mjs` — Pages Function

## 已知限制（V1）

- 无 IP 频率限制（honeypot + Origin 校验已足够）
- 无后台管理（内容更新通过本地文件 + git）
- 无多语言（仅中文）
- 图片按字母序排列（非时间/叙事序）
- 画廊分类标签为占位文字（人像/活动页），可在 `assets/data/*.json` 中手动编辑
