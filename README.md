# 栖影堂 | Lrishui

栖影堂 | Lrishui 是一个个人摄影工作室网站，采用米白宣纸风设计，纯静态 HTML/CSS/JS 构建，部署在 Cloudflare Pages。包含人像写真、婚礼摄影、活动摄影三个画廊，以及预约表单（通过飞书 Webhook 通知）。

## 技术栈

- HTML5, CSS3 (Custom Properties), Vanilla JS (ES2022 modules)
- Node.js 20+ (构建工具)
- sharp (图片处理)
- fonttools + brotli (字体子集化，需 Python 3.10+)
- Vitest + jsdom (前端 JS 单元测试)
- Cloudflare Pages + Pages Functions + D1 + R2 (部署与作品管理后台 CMS)

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
├── admin.html              作品管理后台 (CMS) → /admin
├── 404.html                404 页面
├── partials/               HTML 模板片段（head/nav/footer）
├── assets/
│   ├── css/                样式（…/home/admin）
│   ├── js/                 脚本（…/gallery/home/admin）
│   ├── images/             图片（process:images 生成）
│   ├── fonts/              子集字体（subset:font 生成）
│   └── data/               画廊 JSON fallback（process:images 生成）
├── functions/              Cloudflare Pages Functions（CMS 后端）
│   ├── _middleware.js      统一鉴权
│   ├── _lib.js             session/校验/工具
│   └── api/                auth / gallery / photos / stories / home / upload / media / stats / contact
├── schema.sql              D1 建表
├── wrangler.toml           本地开发用 D1/R2/vars 绑定
├── scripts/                构建脚本
│   ├── process-images.mjs  图片处理 + JSON 生成
│   ├── subset-font.mjs     字体子集化
│   ├── migrate-legacy.mjs  读 assets/data/*.json → 生成 legacy.sql（历史照片导入 D1）
│   ├── build.mjs           站点构建
│   └── dev.mjs             （旧）静态预览；新 dev 用 wrangler pages dev
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

## 作品管理后台 (CMS)

摄影师在 `/admin` 登录后台即可：**上传照片 → 浏览器内裁剪 → 建/改客片故事 → 选首页精选**，无需 Git / 编辑器 / 重新构建。后台是纯 Vanilla JS 单页应用，后端为 Cloudflare Pages Functions + D1（元数据）+ R2（图片），图片压缩/裁剪全部在浏览器完成。

> **⚠️ 关于"免费"的如实说明**：本项目按 Cloudflare 免费额度设计，并用应用层限制**尽量避免**产生费用，但**不能保证永久零费用**。
> - **R2 需要在 Cloudflare 账户绑定一张支付方式才能开通**（额度内金额为 0，但"绑卡"这一步无法绕过）。
> - 免费额度：Pages Functions 10 万请求/天；D1 5GB 存储 + 每日大量免费读；R2 10GB 存储 + A 类 100 万 / B 类 1000 万次/月。正常个人工作室用量远低于这些。
> - 应用层已设软上限：作品总数 `MAX_PHOTOS=1000`（超限拒绝新增）、单张 `MAX_UPLOAD_BYTES=20MB`、单次批量 `≤30` 张、概览页用量 80%/95% 预警。**这些是降低风险，不是账单硬上限**——请在 Cloudflare 账户侧自行设置用量提醒。

### 架构与数据流

```
浏览器 Canvas/Cropper → WebP → POST /api/upload → R2(photos/{id}/…)
                                                   ↓
                POST /api/photos（仅元数据）→ D1   ← _middleware 鉴权(HttpOnly cookie)
                                                   ↓
前台：GET /api/gallery/{cat}、GET /api/home（失败→回落静态 assets/data/*.json）
```

- 图片只存 `image.webp`(≤2000px q0.85) + `thumbnail.webp`(≤600px q0.80)，不存原图。
- R2 对象 key 由不可变 `id` 派生 → URL 永久缓存 `immutable`；改图=上传新 id+删旧，绝不覆盖旧 URL。
- 线上图片建议走 **R2 公开域名**（`R2_PUBLIC_BASE`）直接由 CDN 提供，不经过 Worker，省 CPU/请求。

### 集成边界（当前版本已完成 / 尚未接线）

| 前台区块 | 数据源 | 状态 |
|---|---|---|
| 首页「客片故事」 | `GET /api/home`，失败回落静态 | ✅ CMS 驱动 |
| 人像/婚礼/活动画廊页 | `GET /api/gallery/{cat}`，失败/空回落 `assets/data/*.json` | ✅ CMS 驱动 |
| 首页 bento / hero / service 缩略图 | 静态资源 | ⏳ 未 CMS 化 |

**画廊页数据流**：三张画廊页优先读 `/api/gallery/{cat}`（唯一来源，后台可增删改/隐藏/排序）；接口不可用、返回非 2xx 或 `items` 为空（如线上 D1 尚未迁移）时，自动回落历史静态 `assets/data/*.json`，保证站点永不空页。

**历史照片迁移**：婚礼页"领证/婚礼"、人像页风格标签等旧 JSON 的 `category` 实为页内子标签，迁移时写入新列 `subcategory`，`/api/gallery` 再把它作为 `category` 返回，前端 `filter.js` / `wedding.html` 无需改动即可分组。旧图以 `source='site'` 入库（图片仍是 Pages 静态路径，不进 R2），新上传图为 `source='r2'`。步骤见下文「迁移历史照片」。

### 本地跑通（需 Node 20+）

```bash
npm install                       # 首次会拉 wrangler 等
npx wrangler login                # 浏览器授权你的 Cloudflare 账号

# 建库（本地 SQLite + 本地 R2 模拟都在 .wrangler/ 里）
npx wrangler d1 create qiyingtang          # 记下返回的 database_id → 填进 wrangler.toml
npx wrangler r2 bucket create qiyingtang-media

npm run db:migrate:local          # 把 schema.sql 应用到本地 D1
npm run db:legacy:local           # 生成并导入历史照片（source='site'），让画廊/婚礼分组与线上现状一致

cp .dev.vars.example .dev.vars    # 填 ADMIN_PASSWORD（自定）与 SESSION_SECRET（随机串）
# SESSION_SECRET 生成：node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

npm run dev                       # = build + `wrangler pages dev dist`，打开 http://localhost:8788/admin
```

在 `/admin` 用 `ADMIN_PASSWORD` 登录即可试上传/裁剪/建故事/设首页。本地未配 `R2_PUBLIC_BASE` 时，图片经 `/api/media/...` 代理显示。

### 上线部署（Cloudflare 控制台，点选式）

1. **建 D1**：Dashboard → Workers & Pages → **D1** → Create database → 名称 `qiyingtang` → 复制 `database_id` 填进 `wrangler.toml`（本地用；线上在下一步绑定）。
2. **建 R2**：Dashboard → **R2** → Create bucket → 名称 `qiyingtang-media`（**需先在该页绑定支付方式才能开通**，额度内不扣费）。
3. **开 R2 公开访问**（线上图片绕过 Worker）：R2 → 你的 bucket → **Settings** → Public development URL 开启（或用"Custom domain"绑你自己的子域），复制该公开域名（形如 `https://pub-xxxx.r2.dev`）。
4. **配 Pages 绑定**：Pages 项目 → Settings → **Functions** → Add bindings：
   - D1 → 变量名 `DB` → 选 `qiyingtang`
   - R2 → 变量名 `MEDIA` → 选 `qiyingtang-media`
5. **配环境变量**（同页 Environment variables / Secrets）：
   - Secret：`ADMIN_PASSWORD`、`SESSION_SECRET`、（已有的 `FEISHU_WEBHOOK_URL`）
   - Variable（非机密）：`R2_PUBLIC_BASE` = 第 3 步公开域名；`MAX_PHOTOS` `1000`；`MAX_UPLOAD_BYTES` `20971520`
6. **迁移表结构到线上 D1**：`npm run db:migrate:remote`（或 D1 控制台 Console 里粘贴 `schema.sql` 执行）。
7. **迁移历史照片**：`npm run db:legacy:remote`（先本地生成 `legacy.sql` 再导入线上 D1）。这一步把现有 102 张静态图以 `source='site'` 写入 photos 表，之后画廊页即由 `/api/gallery` 供数、后台可管理。**若不执行此步，画廊页会自动回落静态 JSON，站点照常显示。**
8. **推送部署**：`git add -A && git commit && git push` → Pages 自动 `npm run build` 并带上 `functions/`。
9. 访问 `https://<你的域名>/admin` 登录后台。

### 后台安全要点

- 单管理员、无注册、无 RBAC；密码只存 Cloudflare Secret，绝不入库/入代码/入 Git。
- 会话为 HMAC 签名的 HttpOnly / Secure / SameSite=Lax cookie（7 天），无状态不需 KV。
- 登录接口按 IP 内存限流：5 次失败锁 ~15 分钟（尽力而为，每 isolate 计数）。
- 所有 SQL 参数化；上传服务端校验 WebP 魔数+大小+合法 id；后台所有用户文本渲染前转义（防 XSS）；`/admin` 带 `noindex`。

### 如何回滚 CMS

删除 `admin.html`、`assets/css/admin.css`、`assets/js/admin.js`、`assets/js/home.js`，还原 `index.html`、`package.json`、`schema.sql`、`wrangler.toml` 与 `functions/` 下新增文件即可。前台在兜底逻辑下不受影响；D1/R2 可在 Cloudflare 控制台随时删除。

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
- 后台管理见上文「作品管理后台 (CMS)」；画廊页（人像/婚礼/活动）已接 `/api/gallery`，D1 未迁移或接口失败时回落静态 `assets/data/*.json`
- 无多语言（仅中文）
- 图片按字母序排列（非时间/叙事序）；迁移后在后台按 `sort_order` 排序，可在「作品管理」调整
- 页内子分类/标签（人像风格、婚礼的"领证/婚礼"）现由 photos 表 `subcategory` 列承载，可在后台「子分类/标签」字段编辑；旧值由迁移脚本从 `assets/data/*.json` 导入


# 免责声明 | Disclaimer

**项目名称：** 栖影堂 | Lirshui
**最后更新日期：** 2026年9月18日

## 1. 总则与接受条款
本开源项目“栖影堂”（以下简称“本项目”）由 Lirshui（以下简称“原作者”）提供。无论您作为开发者下载、修改、分发本项目的源代码，还是作为终端用户访问基于本项目部署的网站，均代表您已阅读、理解并同意本免责声明的全部内容。如果您不同意本声明的任何内容，请立即停止使用本项目。

本项目包含两部分：源代码（受开源许可证约束）和演示内容（包括但不限于 `assets/` 和 `photos/` 目录下的占位图片）。本免责声明适用于本项目的所有部分。

## 2. 开源代码免责（按原样提供）
本项目代码遵循国际通用的开源惯例，按“原样（As-Is）”提供，不附带任何明示或暗示的担保，包括但不限于对适销性、特定用途适用性及非侵权的保证。

* **技术与部署风险**：原作者及贡献者不对因使用本项目代码、脚本（如 `scripts/`、`functions/`、`api/`）或依赖项导致的任何直接、间接、附带或衍生的损失负责。包括但不限于：
  - 因 Cloudflare Pages 部署失败、服务中断或配置错误造成的数据丢失或业务中断。
  - 因 Node.js 环境版本差异、依赖包更新导致的构建失败（如 `npm run build` 报错）。
  - 因飞书（Feishu）Webhook API 变更、网络波动或鉴权失效导致的预约通知未送达。
* **安全性**：原作者不对代码中可能存在的漏洞（含 XSS、CSRF、数据注入等）负责。使用者应自行评估代码安全性，并承担由于未妥善保护 `FEISHU_WEBHOOK_URI` 等环境变量、或未及时更新依赖导致的任何安全风险。

## 3. 内容与知识产权免责（包括肖像权、著作权）
本项目仅提供技术框架和前端交互演示。使用者（部署本项目的摄影工作室运营者）在将本项目投入实际运营前，**必须自行替换或移除演示图片**。

* **图片与素材风险**：原作者对 `assets/`、`photos/` 以及相关目录中的任何演示图片、字体、图标不拥有合法授权或已获授权用于演示，**仅限技术测试使用**。使用者若未替换这些演示素材并用于商业用途，导致的任何版权纠纷、肖像权侵权、商标侵权或其他知识产权纠纷，均由使用者（运营者）**独立承担全部法律责任**，原作者概不负责。
* **文案与内容责任**：网站的文案（如 `data/` 目录下的内容）、预约条款、服务说明等，由运营者自行拟定并承担相应法律责任。原作者不对运营者发布的内容（包括但不限于违法违规、虚假宣传、侵犯他人名誉权等）承担任何连带责任。

## 4. 用户数据与隐私保护免责（个人信息保护法相关）
本项目包含通过飞书 Webhook 实现预约信息收集的功能，以及通过 Cloudflare Pages 进行托管部署。根据《中华人民共和国个人信息保护法》（PIPL）等法律法规：

* **数据控制者责任**：运营者（网站部署方）是用户数据的**控制者**。运营者需自行履行告知义务，获取访客（客户）的知情同意，并依法保护用户的个人信息（如姓名、联系方式、拍摄需求等）。
* **第三方平台风险**：本项目使用了飞书（Feishu）和 Cloudflare 作为第三方服务提供商。原作者不对上述第三方平台的隐私政策、数据存储位置、数据泄露事件、或被第三方平台违规使用数据承担责任。运营者需自行审查其与第三方平台签订的服务协议。
* **数据安全**：原作者不对因运营者错误配置服务器、泄露环境变量（`.env`）或飞书机器人权限设置不当，导致用户预约数据泄露或被窃取承担任何责任。

## 5. 免责声明的变更与解释
原作者保留随时修改本免责声明的权利，修改后的版本将在 GitHub 仓库中发布并即刻生效。使用者应定期查看本声明以了解最新情况。
本免责声明的最终解释权归原作者所有，但其解释不得违反相关法律法规的强制性规定。

**一旦使用本项目，即视为您完全接受以上所有免责条款。**


## 免责声明

本项目为开源项目，请务必仔细阅读 [DISCLAIMER.md](DISCLAIMER.md)。
- 本项目按“原样”提供，作者不对因使用本项目引发的代码、版权、隐私等纠纷承担任何责任。
- 所有 `assets/` 及 `photos/` 内的图片均为演示使用，实际部署前请务必替换为您拥有合法版权的图片，否则引发的肖像权、著作权纠纷需由部署者承担全部责任。
- 运营者需遵守《个人信息保护法》，自行保障预约客户（飞书 Webhook 收集）的个人数据安全。
