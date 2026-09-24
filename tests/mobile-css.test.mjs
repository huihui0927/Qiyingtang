// 两处纯样式的回归锁：都是「肉眼看一眼就知道、但没人看就会悄悄漂回去」的规则。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = p => readFileSync(resolve(process.cwd(), p), 'utf8');
const adminCss = read('assets/css/admin.css');
const layoutCss = read('assets/css/layout.css');

describe('≤720px 后台侧栏是横滑标签条', () => {
  it('移动端块里 .nav-item 保持自身宽度且不折行', () => {
    const at = adminCss.indexOf('@media (max-width: 720px)');
    expect(at, '找不到 720px 断点').toBeGreaterThan(-1);
    const rule = adminCss.slice(at).match(/\.sidebar \.nav-item \{([^}]*)\}/);
    expect(rule, '移动端块里缺 .sidebar .nav-item 规则').not.toBeNull();
    // 横排 flex 里 width:100% 会让五个标签均分宽度，「作品管理」折成六行
    expect(rule[1]).toMatch(/flex:\s*none/);
    expect(rule[1]).toMatch(/width:\s*auto/);
    expect(rule[1]).toMatch(/white-space:\s*nowrap/);
    // 网格会把侧栏行拉伸到半屏高，导航条悬在深色大块中间；收成一条顶栏
    const sb = adminCss.slice(at).match(/\.sidebar \{([^}]*)\}/);
    expect(sb, '移动端块里缺 .sidebar 规则').not.toBeNull();
    expect(sb[1]).toMatch(/align-self:\s*start/);
  });
});

describe('页脚签名句', () => {
  it('字号用 --fs-xl：手书笔画细，正文字号在页脚压不住', () => {
    const m = layoutCss.match(/\.footer-slogan \{[^}]*font-size:\s*var\((--fs-[a-z0-9]+)\)/);
    expect(m, '找不到 .footer-slogan 的字号').not.toBeNull();
    expect(m[1]).toBe('--fs-xl');
  });
});
