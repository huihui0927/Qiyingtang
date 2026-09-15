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
