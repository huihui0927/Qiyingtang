import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { COVER, centerRect, coverOutput, trimRect } from '../assets/js/crop.js';

// 前端卡片框和后台出片必须同比例：这一条守住「改了一个忘了另一个」的漂移。
const homeCss = readFileSync(new URL('../assets/css/home.css', import.meta.url), 'utf8');
const adminJs = readFileSync(new URL('../assets/js/admin.js', import.meta.url), 'utf8');

describe('封面几何与首页卡片框一致', () => {
  it('home.css 的 4:5 框在容器上，不在 <img> 上', () => {
    const containerAt = homeCss.indexOf('.story-card-media {');
    const imgAt = homeCss.indexOf('.story-card-media img');
    const afterAt = homeCss.indexOf('.story-card-media::after');
    expect(containerAt, '找不到 .story-card-media 规则').toBeGreaterThan(-1);
    expect(imgAt, '找不到 .story-card-media img 规则').toBeGreaterThan(containerAt);
    expect(afterAt, '找不到 .story-card-media::after 规则').toBeGreaterThan(imgAt);
    expect(homeCss.slice(containerAt, imgAt)).toMatch(/aspect-ratio:\s*4\s*\/\s*5/);
    // 框子写在 <img> 上时，浏览器会拿原图固有尺寸参与算高，横竖混排的封面就会把卡片撑得高低不一
    expect(homeCss.slice(imgAt, afterAt)).not.toMatch(/aspect-ratio/);
  });
  it('COVER 常量与之一致', () => {
    expect(COVER.ratio).toBeCloseTo(4 / 5, 10);
    expect(COVER.width / COVER.height).toBeCloseTo(COVER.ratio, 10);
  });
});

describe('centerRect', () => {
  it('竖图只裁掉顶部一条，宽度用满', () => {
    const r = centerRect(972, 1296, COVER.ratio);
    expect(r.w).toBeCloseTo(972, 6);
    expect(r.h).toBeCloseTo(1215, 6);
    expect(r.x).toBeCloseTo(0, 6);
    expect(r.y).toBeCloseTo(40.5, 6);
  });
  it('横图高度用满、左右居中裁切', () => {
    const r = centerRect(1400, 933, COVER.ratio);
    expect(r.h).toBeCloseTo(933, 6);
    expect(r.w).toBeCloseTo(746.4, 4);
    expect(r.x).toBeCloseTo(326.8, 4);
    expect(r.y).toBeCloseTo(0, 6);
  });
  it('方图裁成 4:5', () => {
    const r = centerRect(1000, 1000, COVER.ratio);
    expect([Math.round(r.w), Math.round(r.h), r.x, r.y]).toEqual([800, 1000, 100, 0]);
  });
  it('裁切块永不出界且严格等于目标比例', () => {
    for (const [w, h] of [[3000, 200], [200, 3000], [1600, 1200], [1120, 1400]]) {
      const r = centerRect(w, h, COVER.ratio);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(w + 1e-6);
      expect(r.y + r.h).toBeLessThanOrEqual(h + 1e-6);
      expect(r.w / r.h).toBeCloseTo(COVER.ratio, 6);
      expect(Math.max(r.w, r.h)).toBeGreaterThan(0);
    }
  });
  it('非法尺寸返回空矩形而不是 NaN', () => {
    expect(centerRect(0, 100, COVER.ratio)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(centerRect(100, 100, 0)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});

describe('coverOutput', () => {
  it('够大的裁切块出满 1120×1400', () => {
    expect(coverOutput(1400, 1750)).toEqual({ width: 1120, height: 1400, tooSmall: false });
    expect(coverOutput(1120, 1400)).toEqual({ width: 1120, height: 1400, tooSmall: false });
    expect(coverOutput(2000, 2500)).toEqual({ width: 1120, height: 1400, tooSmall: false });
  });
  it('原图不够大时按比例缩着出，绝不放大', () => {
    const r = coverOutput(746, 933);
    expect(r).toEqual({ width: 746, height: 933, tooSmall: true });
    expect(r.width / r.height).toBeCloseTo(COVER.ratio, 3);
  });
  it('出片尺寸恒为 4:5 且不超过上限', () => {
    for (const [w, h] of [[3000, 3750], [1120, 1400], [746, 933], [400, 500], [0, 0]]) {
      const r = coverOutput(w, h);
      expect(r.width).toBeLessThanOrEqual(COVER.width);
      expect(r.height).toBeLessThanOrEqual(COVER.height);
      expect(r.width / r.height).toBeCloseTo(COVER.ratio, 2);
    }
  });
});

// Cropper.js 1.2.2 的实例上没有 .on()：事件全部派发在 <img> 元素上。
// 写成 cropper.on(...) 会在 openCropper 中途抛 TypeError，弹窗的「确认裁剪」监听器根本没绑上。
describe('裁剪弹窗的事件绑定', () => {
  it('绝不调用 cropper.on', () => {
    expect(adminJs).not.toMatch(/cropper\.on\(/);
  });
  it('监听器绑在传给 new Cropper 的同一个元素上', () => {
    const target = adminJs.match(/new Cropper\((\w+),/);
    expect(target).not.toBeNull();
    expect(adminJs).toMatch(new RegExp(`\\.forEach\\(ev => ${target[1]}\\.addEventListener\\(ev,`));
  });
});

// 设计软件导出的封面常自带一圈透明边；裁剪框锁的是比例，空边会原样进封面，
// 前台卡片里照片就只剩一条。trimRect 负责在进裁剪器之前找到「有内容的最小矩形」。
describe('trimRect', () => {
  const grid = (w, h, paint) => {
    const a = new Uint8ClampedArray(w * h);
    for (const [x, y, v] of paint) a[y * w + x] = v;
    return a;
  };

  it('全透明返回 null，调用方保持原图不动', () => {
    expect(trimRect(4, 4, new Uint8ClampedArray(16))).toBeNull();
  });

  it('只认有内容的矩形：左侧一块，四周空边全部吃掉', () => {
    const alpha = grid(6, 5, [[0, 1, 255], [1, 1, 255], [0, 3, 255], [1, 3, 255]]);
    expect(trimRect(6, 5, alpha)).toEqual({ x: 0, y: 1, w: 2, h: 3 });
  });

  it('没有透明边时返回整幅，不多裁一个像素', () => {
    const alpha = new Uint8ClampedArray(3 * 2).fill(255);
    expect(trimRect(3, 2, alpha)).toEqual({ x: 0, y: 0, w: 3, h: 2 });
  });

  it('threshold 之下算空边，之上算内容', () => {
    const alpha = grid(3, 3, [[1, 1, 12], [2, 2, 13]]);
    expect(trimRect(3, 3, alpha)).toEqual({ x: 2, y: 2, w: 1, h: 1 });
    expect(trimRect(3, 3, alpha, 11)).toEqual({ x: 1, y: 1, w: 2, h: 2 });
  });
});

// 空边要在 openCropper 里、交给 Cropper 之前吃掉：晚了就锁进比例框了。
describe('后台进裁剪器前先裁掉透明边', () => {
  it('openCropper 等 trimTransparentEdges 的结果，再拿它建 URL', () => {
    const from = adminJs.indexOf('async function openCropper(');
    const body = adminJs.slice(from, adminJs.indexOf('// —— 作品管理 ——', from));
    expect(from).toBeGreaterThan(-1);
    expect(body).toMatch(/await trimTransparentEdges\(file\)/);
    expect(body).toMatch(/URL\.createObjectURL\(trimmed \|\| file\)/);
  });
  it('裁过空边时弹窗要说清楚，免得以为图被裁坏了', () => {
    expect(adminJs).toMatch(/已自动裁掉原图四周的透明边/);
  });
});
