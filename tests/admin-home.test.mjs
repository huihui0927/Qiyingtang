// /admin → 首页精选：后台面板的上限必须和接口一致，清单不能被限宽（限宽正是这页右侧大片空白的来源）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const adminJs = read('../assets/js/admin.js');
const adminCss = read('../assets/css/admin.css');
const homeApi = read('../functions/api/home.js');

const cap = (src, name) => {
  const m = src.match(new RegExp(`${name}\\s*=\\s*(\\d+)`));
  expect(m, `${name} 未找到`).not.toBeNull();
  return Number(m[1]);
};

describe('首页精选后台', () => {
  it('前后端槽位上限一致', () => {
    expect(cap(adminJs, 'MAX_HOME_PHOTOS')).toBe(cap(homeApi, 'MAX_PHOTO_SLOTS'));
    expect(cap(adminJs, 'MAX_HOME_STORIES')).toBe(cap(homeApi, 'MAX_STORY_SLOTS'));
  });

  it('清单没被限宽，两栏铺满内容区', () => {
    const rule = adminCss.match(/\.home-slots\s*\{([^}]*)\}/)[1];
    expect(rule).not.toMatch(/max-width/);
    expect(adminCss).toMatch(/\.home-grid\s*\{[^}]*grid-template-columns/);
  });
});
