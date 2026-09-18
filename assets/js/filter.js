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
