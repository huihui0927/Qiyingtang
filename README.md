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
