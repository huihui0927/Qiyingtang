# 栖影堂 | Lrishui 摄影工作室宣传站 — Design Doc

- 日期：2026-09-14
- 路径：architectural
- 部署目标：Cloudflare Pages
- 状态：待用户 review

---

## 1. 项目目标

为"栖影堂 | Lrishui"摄影工作室建一个**符合品牌格调**的静态宣传网站，承担三类访客：

1. 被小红书/朋友圈/口碑导流来的**潜在客户**（人像、婚礼为主），需在 30 秒内被作品+调性打动并发起咨询
2. 想了解企业实力与档期的**B 端客户**（活动摄影）
3. 已经决定下单、需要填写**预约信息**的客户

成功标准（非量化但可验证）：

- 视觉调性一眼区别于市面 90% 暗调画廊风摄影站
- 移动端 Lighthouse 性能 ≥ 90、可访问性 ≥ 95
- 表单提交后 5 秒内推送到工作室飞书群
- 仓库可直接 `git push` 触发 Cloudflare Pages 自动部署

---

## 2. 品牌与视觉系统

### 2.1 品牌核心

| 项目 | 内容 |
|---|---|
| 中文名 | 栖影堂 |
| 英文名 | Lrishui |
| Slogan | 栖一方光影，留半盏流年，用影像留住细碎时光 |
| 业务 | 人像写真 / 婚礼摄影 / 活动摄影 |
| 邮箱 | lrishui@163.com |
| 电话 | 15210475723（10:00–18:00） |
| 微信 | 二维码图片（来自 `1.首页/图片和附件/image.png`） |

### 2.2 视觉调性：米白宣纸风（Oriental Minimal）

**配色**

| Token | HEX | 用途 |
|---|---|---|
| `--paper` | `#F5F1E8` | 主背景（暖米白，宣纸感） |
| `--paper-warm` | `#EDE6D6` | 次级背景 / 卡片底 |
| `--ink` | `#1F1B16` | 主文字（墨色，不用纯黑） |
| `--ink-soft` | `#4A423A` | 次级文字 |
| `--ink-mute` | `#8C8279` | 注释、说明、占位 |
| `--seal` | `#A8321E` | 朱红印章 / 强调 / 链接 hover |
| `--gold` | `#B8945F` | 细金线 / 分隔符 / 装饰 |
| `--line` | `rgba(31,27,22,0.12)` | 默认细线 |

**字体**

| 角色 | 字体 | 加载方式 | 字重 |
|---|---|---|---|
| 标题 / Slogan / 品牌名 | LXGW WenKai (霞鹜文楷) | 本地子集化（`cn-font-split` 输出 woff2，约 150-250 KB） | 400 / 700 |
| 正文 | Noto Serif SC (思源宋体) | 国内可访问 CDN（`chinese-fonts-cdn` 或字节静态镜像） | 400 / 500 / 700 |
| 英文 / 数字 | Cormorant Garamond | Google Fonts（用 `fonts.googleapis.com`，国内可访问；fallback：`font-display: swap`） | 400 / 500 |
| Fallback 栈 | `"Songti SC", "Source Han Serif SC", serif` | 系统兜底 | — |

**装饰元素**

- 朱红印章：SVG 内联，刻"栖影堂"三字（小篆风格），用于 LOGO、章节末尾、表单提交成功提示
- 细金线：1px `--gold` 实线或 `linear-gradient` 渐隐，用于章节分隔
- 留白：章节间距至少 `clamp(80px, 12vh, 160px)`
- 圆角：极克制，仅 `2px`（卡片）/ `50%`（印章/头像）

**动效原则**

- 滚动入场：`opacity` + `transform: translateY(20px)`，300ms `ease-out`，使用 `IntersectionObserver`
- 图片懒加载：`loading="lazy"` + `decoding="async"` + 淡入
- 拒绝弹跳、拒绝 3D 旋转、拒绝粒子。所有动效服务于"安静地呈现"

---

## 3. 站点结构

```
qiyangtang-site/
├── index.html              首页
├── portrait.html           人像写真
├── wedding.html            婚礼摄影
├── event.html              活动摄影
├── booking.html            预约咨询
├── 404.html                Cloudflare Pages 自定义 404
├── assets/
│   ├── css/
│   │   ├── main.css        全局样式（reset + tokens + layout + components）
│   │   └── pages.css       页面专属样式（按 section 分块）
│   ├── js/
│   │   ├── main.js         导航、滚动入场、印章动画
│   │   ├── lightbox.js     灯箱（A 功能）
│   │   ├── filter.js       分类筛选（B 功能）
│   │   └── booking.js      表单校验 + 提交（D 功能）
│   ├── fonts/
│   │   ├── lxgw-wenkai-subset.woff2
│   │   └── LICENSE-OFL.txt
│   ├── images/
│   │   ├── home/           首页精选
│   │   ├── portrait/       人像（按风格分子目录或加 data- 前缀）
│   │   ├── wedding/
│   │   ├── event/
│   │   └── meta/           微信二维码、印章 SVG、og-image
│   └── data/
│       ├── portrait.json   人像作品索引（src、风格标签、alt）
│       ├── wedding.json    婚礼作品索引（领证/跟拍 分组）
│       └── event.json      活动作品索引
├── functions/
│   └── contact.js          Pages Function：POST /api/contact → 飞书 webhook
├── scripts/
│   ├── optimize-images.mjs sharp 批处理（webp + 多尺寸 + thumb）
│   ├── build-font-subset.mjs cn-font-split 子集化霞鹜文楷
│   └── build-gallery-data.mjs 扫描 assets/images/ 生成 JSON 索引
├── _headers                Cloudflare Pages 缓存与安全头
├── _redirects              （可选）尾斜杠归一
├── package.json            dev deps：sharp、cn-font-split、wrangler（本地预览）
├── .gitignore              node_modules、原图缓存、.wrangler、.dev.vars
├── .dev.vars.example       本地环境变量样例
└── README.md               部署说明 + 后续维护指南
```

### 3.1 五个页面的内容架构

**index.html（首页）**

| Section | 内容 |
|---|---|
| Hero | 纯文字 + 朱红印章（10.2-d）。居中大字"栖影堂 / Lrishui"，下方一行 slogan，再下方印章。背景纯 `--paper`，留白至少 70vh |
| 三大业务入口 | 三列卡片：人像写真 / 婚礼摄影 / 活动摄影。每张卡：业务名（霞鹜文楷）+ 一句简介 + 一张代表小图（thumb）+ 细金线 + "前往 →" |
| 精选作品 | 9 宫格（移动端 2 列、平板 3 列、桌面 3×3）。从三大业务里各挑 3 张，点击进灯箱 |
| 工作室简介 | 一段约 80-120 字的"关于栖影堂"短文 + 一枚小印章（取代独立的 About 页） |
| 为什么选我们 | 5 个图标卡：全风格拍摄 / 后期精修 / 视频拍摄 / 一对一沟通 / 快速交付 |
| 联系引导 | 大字"想留下你的细碎时光？" + 按钮"前往预约" |
| Footer | 全站统一：slogan、邮箱、电话、微信二维码（hover 显示）、Copyright、备案号占位 |

**portrait.html（人像写真）**

- Hero：小一号的标题"人像写真"+ 一句副标题（如"每一面，都是你"）
- 风格筛选条：粘性顶部，5 个标签 [全部 / 清新日系 / 情绪写真 / 韩系风 / 港风 / 夜景写真]
- 作品网格：masonry 风格（CSS columns 或 grid + auto-rows），每张图带 `data-style` 标签
- 点击 → 灯箱，灯箱内左右切换、显示风格标签、ESC 关闭
- 末尾 CTA：「想拍一组属于自己的人像？前往预约」

**wedding.html（婚礼摄影）**

- Hero：标题"婚礼摄影" + 副标题（如"仪式之外，是细碎时光"）
- 业务标签：仪式 / 接亲 / 宴会 / 外景（仅作说明，不做筛选，因为案例本身已分组）
- 分组 1：领证跟拍（约 23 张）
- 分组 2：婚礼跟拍（约 42 张）
- 每组：标题（霞鹜文楷）+ 细金线 + 网格 + 灯箱
- 末尾 CTA

**event.html（活动摄影）**

- Hero：标题"活动摄影" + 副标题
- 业务标签：企业活动 / 年会 / 发布会 / 路演 / 展会
- 单一网格（约 18 张），不做分组（案例本身没有明确分组）
- 末尾 CTA：「企业客户可直接邮件咨询：lrishui@163.com」

**booking.html（预约咨询）**

- Hero：标题"预约栖影堂"
- 左侧：表单（姓名 / 微信或电话 / 拍摄类型 select / 期望档期 date / 备注 textarea / 提交按钮）
- 右侧：联系方式卡（微信二维码大图 + 电话 + 邮箱 + 工作时间）
- 提交逻辑：见 §5
- 提交成功：弹出"已收到，我们会在 24 小时内联系你" + 印章动画
- 提交失败：内联错误提示 + 保留用户输入

### 3.2 公共组件

- **导航栏**：sticky top，米白底 + 细金线下边框。LOGO（栖影堂 + 小印章 SVG）+ 5 个链接 + 移动端汉堡菜单
- **Footer**：宣纸纹理底 + 三段式（品牌信息 / 联系 / 导航）
- **灯箱**：纯 JS，无依赖。背景 `rgba(31,27,22,0.94)`，图片居中，左右切换箭头，顶部显示分类标签，底部显示序号

---

## 4. 功能模块

### 4.1 A — 图片灯箱

- 触发：所有 `.gallery-item` 点击
- 状态：当前图片索引、当前画廊列表（按页面或按分组隔离）
- 交互：← / → 切换、ESC 关闭、点击背景关闭、滑动手势（移动端）
- 可访问性：`role="dialog"` `aria-modal="true"`、焦点陷阱、键盘导航
- 体积预算：< 4 KB（minified）

### 4.2 B — 分类筛选（仅人像页）

- 实现：每张图带 `data-style="rixi|qingxu|hanxi|gangfeng|yejing"`
- 筛选条按钮点击 → 切换 active 类 → 遍历图片，不匹配的 `display: none` + 出场动画
- URL 同步：`?style=hanxi` 可分享
- 不引入 Isotope / Masonry 库，纯 CSS columns + JS 显隐

### 4.3 C — 滚动动效（克制版）

- `IntersectionObserver` 监听 `.reveal` 元素
- 进入视口 → 加 `.is-visible` → CSS transition `opacity 0 → 1`, `translateY(20px → 0)`，600ms
- 仅作用于：章节标题、卡片、图片网格的容器（不逐张图触发，避免抖动）
- 尊重 `prefers-reduced-motion: reduce`，全程禁用动效
- 体积预算：< 2 KB

### 4.4 D — 预约表单 + 飞书 Webhook

**前端**

- HTML5 校验 + JS 二次校验（手机号 / 微信号格式）
- 提交时按钮置灰、文案变"提交中…"
- `fetch('/api/contact', { method: 'POST', body: JSON.stringify(...) })`
- 成功 → 显示成功状态（含印章动画）+ 重置表单
- 失败 → 内联红字提示 + 保留输入

**后端（`functions/contact.js`）**

- 仅接受 `POST`，其他方法返回 405
- V1 防刷策略：honeypot + Origin/Referer 同源校验。**不实现** IP 限流（Cloudflare Pages Functions 无内置 KV 绑定，引入 KV 会增加配置步骤；个人工作室流量下 honeypot + Origin 已足够）。若上线后被刷，再加 KV 限流
- 输入校验：
  - 姓名：1-30 字符
  - 微信/电话：至少一项，符合 `^1[3-9]\d{9}$` 或微信号正则
  - 拍摄类型：枚举 `portrait | wedding | event`
  - 期望档期：YYYY-MM-DD，不早于今天
  - 备注：≤ 500 字符
- 转发到飞书 webhook（环境变量 `FEISHU_WEBHOOK_URL`）：
  - 使用飞书"富文本"消息（`msg_type: 'post'`），结构清晰
  - 标题：`📷 新预约 · {拍摄类型} · {姓名}`
  - 正文：所有字段 + 提交时间 + IP（仅工作室可见）
- 返回 `{ ok: true }` 或 `{ ok: false, error: '...' }`
- 失败重试：fetch 飞书 webhook 失败时，重试 1 次，仍失败则返回 502 并记录 `console.error`
- 签名校验：V1 实现完整逻辑。若用户在飞书机器人后台开启"签名校验"并设置 `FEISHU_WEBHOOK_SECRET`，Function 自动按官方算法（`HmacSHA256(timestamp + "\n" + secret)` → base64）计算 `sign` 并拼到 payload；未配置 secret 则跳过签名（兼容默认"自定义关键词"或"无校验"模式）

**安全**

- Webhook URL 存 Cloudflare Pages Secret，**绝不进前端代码**
- 前端表单加 honeypot 字段（隐藏的 `website` 输入框，机器人会填，后端检测到则静默返回成功不真发）
- `Origin` / `Referer` 校验：仅接受同域请求（防 CSRF 与外部刷量）
- 响应头：`Content-Type: application/json; charset=utf-8`

---

## 5. 图片处理流水线

### 5.1 输入

- 来源：`C:\Users\ThinkPad\Downloads\栖影堂\{1.首页,2.人像写真,3.活动摄影,4.婚礼摄影}\图片和附件\`
- 总数：104 张
- 总大小：约 407 MB
- 格式：jpg / jpeg / png / webp 混合

### 5.2 处理脚本 `scripts/optimize-images.mjs`

- 依赖：`sharp` ^0.33
- 输入参数：`--src` `--dst` `--category`
- 每张原图输出：
  - `{name}.webp`：最大边 2000px，quality 80，progressive
  - `{name}@2x.webp`：最大边 2800px，quality 82（仅当原图 ≥ 2800px 时生成）
  - `{name}-thumb.webp`：最大边 800px，quality 75
  - `{name}.jpg`：最大边 1600px，quality 78，mozjpeg（兜底，仅给 < 1% 旧浏览器）
- EXIF：保留方向，剥离 GPS / 设备信息（隐私）
- 色彩空间：sRGB
- 输出体积预算：总 ≤ 50 MB

### 5.3 画廊索引脚本 `scripts/build-gallery-data.mjs`

- 扫描 `assets/images/{portrait,wedding,event}/`
- 对每张图生成条目：`{ id, src, srcset, thumb, alt, style?, group?, width, height }`
- 风格标签来源：手写映射表 `scripts/gallery-meta.json`（首次运行后由我根据原文件夹结构 + 文件名预填，用户可后续修改）
- 输出：`assets/data/{portrait,wedding,event}.json`
- 前端通过 `fetch` 加载并渲染（避免 HTML 体积爆炸 + 利于后期接 CMS）

### 5.4 HTML 中的图片标记

```html
<picture>
  <source
    type="image/webp"
    srcset="assets/images/portrait/xxx-thumb.webp 800w,
            assets/images/portrait/xxx.webp 2000w,
            assets/images/portrait/xxx@2x.webp 2800w"
    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw">
  <img
    src="assets/images/portrait/xxx.jpg"
    alt="..."
    loading="lazy"
    decoding="async"
    width="2000" height="1333">
</picture>
```

---

## 6. 部署 — Cloudflare Pages

### 6.1 项目配置

| 项 | 值 |
|---|---|
| Build command | `npm run build`（执行图片处理 + 字体子集 + 索引生成；如果 assets 已预生成则跳过） |
| Build output directory | `.`（仓库根即站点根，无打包步骤） |
| Node version | 20 |
| Root directory | `/`（仓库根） |

### 6.2 环境变量（Pages → Settings → Environment variables → Secret）

| Key | 示例 | 必需 |
|---|---|---|
| `FEISHU_WEBHOOK_URL` | `https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx` | ✅ |
| `FEISHU_WEBHOOK_SECRET` | （可选，若启用签名校验） | ⬜ |
| `ALLOWED_ORIGINS` | `https://qiyangtang.pages.dev,https://lrishui.com` | ⬜（默认同源） |

### 6.3 `_headers`

```
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), camera=(), microphone=()

/assets/images/*
  Cache-Control: public, max-age=31536000, immutable

/assets/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/assets/css/*
  Cache-Control: public, max-age=86400

/assets/js/*
  Cache-Control: public, max-age=86400

/*.html
  Cache-Control: public, max-age=0, must-revalidate
```

### 6.4 自定义域名

- 留作 TODO，README 中说明：用户后续若购买 `lrishui.com` 等域名，在 Pages → Custom domains 绑定即可，DNS 自动接管

---

## 7. 测试策略

| 层级 | 方法 |
|---|---|
| 视觉 | 本地 `npx wrangler pages dev` 预览，桌面 Chrome / 移动 Safari / 微信内置浏览器 三端目测 |
| 性能 | Lighthouse 桌面+移动，目标：性能 ≥ 90 / 可访问性 ≥ 95 / 最佳实践 ≥ 95 / SEO ≥ 95 |
| 表单 | 本地 `wrangler pages dev` + `.dev.vars` 配置真实 webhook，提交后检查飞书群是否收到 |
| 安全 | curl 测试：GET /api/contact 应 405、跨域 POST 应 403、honeypot 触发应静默 200 但不推送 |
| 可访问性 | 键盘 Tab 走完全站、屏幕阅读器（NVDA / VoiceOver）抽测首页与表单 |
| 兼容性 | Chrome / Safari / Firefox / Edge 最新两版 + iOS Safari 16+ + 微信内置浏览器 |

---

## 8. 范围之外（YAGNI 清单）

明确**不做**：

- 多语言（中英双语）
- 暗色模式切换
- 价格表 / 套餐展示
- 博客 / 拍摄手记
- 后台管理 / CMS
- 在线选片 / 客片下载系统
- Google Analytics / 百度统计（如需，后续单独加，不阻塞上线）
- SEO 站点地图 / sitemap.xml（5 页站，手写 robots.txt 足够）
- 表单数据持久化（D1 / KV）— 飞书推送成功即可，不存数据库
- 服务地区限制 / 多币种 / 支付

---

## 9. 实现顺序（粗）

1. 项目脚手架 + package.json + 目录结构 + 全局 tokens.css / main.css
2. 图片批处理脚本 → 跑一次 → 把 104 张原图压到 ≤ 50 MB
3. 字体子集化脚本 → 跑一次 → 生成 lxgw-wenkai-subset.woff2
4. 公共组件：导航 / Footer / 印章 SVG / 灯箱 / 滚动入场
5. 首页（含 Hero、三大业务、精选九宫格、关于、卖点、CTA）
6. 人像写真页（含筛选）
7. 婚礼摄影页（含两组分组）
8. 活动摄影页
9. 预约页 + Pages Function + 飞书 webhook 联调
10. `_headers` / `404.html` / `robots.txt` / README
11. Lighthouse 调优 + 跨端目测 + 修 bug
12. 部署到 Cloudflare Pages + 配置 Secret + 真实表单测试

每个步骤完成后会进入 review checkpoint（superpowers:executing-plans 流程）。

---

## 10. 风险与已知约束

| 风险 | 缓解 |
|---|---|
| 飞书 webhook URL 泄漏被刷量 | Secret 环境变量 + Origin 校验 + honeypot + （可选）IP 限流 |
| 霞鹜文楷子集化漏字 | 子集化时扫描所有 .html / .json / .css 内容文本；预留 fallback 系统字体 |
| Cloudflare Pages 国内访问慢 | 用户后续可绑定自定义域名 + 启用 Cloudflare 中国网络（需企业版） / 或镜像到国内 OSS。MVP 不处理 |
| 原图含 EXIF GPS | sharp 处理时显式 `rotate()` + 剥离元数据 |
| 婚礼页 65 张图首屏卡顿 | 严格懒加载 + 缩略图网格 + 分组分块渲染 + `content-visibility: auto` |
| 微信内置浏览器 webp 兼容性 | iOS 微信 8.0+ / Android 微信 7.0+ 已全支持 webp；保留 jpg fallback |

---

## 11. 交付物

- 完整可部署的仓库（`qiyangtang-site/`）
- README：本地预览、构建、部署、后续加新作品的步骤
- 一次成功的本地 `wrangler pages dev` 演示
- 一份"上线 checklist"（环境变量、域名、首次提交测试）

---

## 12. 下一步

用户 review 本 spec → 通过后调用 `superpowers:writing-plans` 生成详细实现计划（任务级，每任务有 verify 步骤）→ 计划批准后进入实施。
