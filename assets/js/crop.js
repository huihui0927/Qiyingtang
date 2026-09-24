// 后台裁剪的纯计算部分：目标几何、居中裁切矩形、出片尺寸。
// 抽出来单测，是因为这几条数学决定了「前台卡片框」和「后台产物」是否同比例 ——
// 不同比例的封面会被 CSS 裁掉左右各一条，正是之前横图婚礼封面变窄的原因。

// 首页「客片故事」卡片图框写死 4:5（assets/css/home.css .story-card-media img），
// 封面就按同一比例出片；上限 1120×1400，卡片实际显示只有 ~370 CSS px，再大是浪费。
export const COVER = { ratio: 4 / 5, width: 1120, height: 1400 };

// 在 srcW×srcH 里取居中的一块 ratio 矩形：长边填满、短边内缩（CSS object-fit: cover 的语义）。
export function centerRect(srcW, srcH, ratio) {
  if (!(srcW > 0) || !(srcH > 0) || !(ratio > 0)) return { x: 0, y: 0, w: 0, h: 0 };
  const w = Math.min(srcW, srcH * ratio);
  const h = w / ratio;
  return { x: (srcW - w) / 2, y: (srcH - h) / 2, w, h };
}

// 比例永远锁死；像素只降不升 —— 原图给不到 1120×1400 就按它自己的尺寸出片，
// 硬放大只会糊，而卡片实际宽度用不到那么大。tooSmall 用于弹窗里说明为什么没出满尺寸。
export function coverOutput(cropW, cropH) {
  const natural = Math.floor(Math.min(cropW || 0, (cropH || 0) * COVER.ratio));
  if (!(natural > 0)) return { width: COVER.width, height: COVER.height, tooSmall: true };
  const width = Math.min(natural, COVER.width);
  return { width, height: Math.round(width / COVER.ratio), tooSmall: natural < COVER.width };
}

// 把画布钉成精确 width×height 的新画布。裁剪框已锁比例，所以这一步基本只是缩放；
// 万一源画布有 1px 级的比例漂移，就按居中裁切补齐 —— 保证落进 R2 的封面比例精确。
export function toExactSize(src, width, height) {
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('当前浏览器不支持 Canvas 2D，请改用 Chrome/Edge');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const r = centerRect(src.width, src.height, width / height);
  ctx.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, width, height);
  return out;
}

// 设计软件导出的 PNG/WebP 常自带一圈透明边：裁剪框锁的是比例，空边会原样进封面，
// 前台卡片里照片就只剩一条。这里算出「有内容的最小矩形」，进裁剪器之前先把空边吃掉。
// alpha 是每像素一个字节（RGBA 里的 A 通道）；threshold 容忍压缩带来的边缘噪点。
// 全透明返回 null —— 调用方据此保持原图不动。
export function trimRect(width, height, alpha, threshold = 12) {
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (alpha[row + x] > threshold) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
