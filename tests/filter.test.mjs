/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { initFilter } from '../assets/js/filter.js';

const ITEMS = [
  { id:'1', category:'清新日系' }, { id:'2', category:'情绪写真' },
  { id:'3', category:'清新日系' }, { id:'4', category:'港风' },
];

describe('filter', () => {
  let container, rendered;
  beforeEach(() => {
    document.body.innerHTML = '<div id="c"></div>';
    container = document.getElementById('c');
    rendered = [];
    history.replaceState({}, '', '/');
  });

  it('renders chips for each unique category + "全部"', () => {
    initFilter({ container, items: ITEMS, render: x => rendered.push(x) });
    const chips = [...container.querySelectorAll('[data-filter]')].map(b => b.dataset.filter);
    expect(chips).toEqual(['all','清新日系','情绪写真','港风']);
  });
  it('initial render shows all items', () => {
    initFilter({ container, items: ITEMS, render: x => rendered.push(x) });
    expect(rendered[0]).toHaveLength(4);
  });
  it('clicking chip filters and updates URL', () => {
    initFilter({ container, items: ITEMS, render: x => rendered.push(x), paramKey: 'style' });
    container.querySelector('[data-filter="清新日系"]').click();
    expect(rendered.at(-1)).toHaveLength(2);
    expect(location.search).toBe('?style=%E6%B8%85%E6%96%B0%E6%97%A5%E7%B3%BB');
  });
  it('respects ?style= on init', () => {
    history.replaceState({}, '', '/?style=港风');
    initFilter({ container, items: ITEMS, render: x => rendered.push(x) });
    expect(rendered[0]).toHaveLength(1);
    expect(container.querySelector('[data-filter="港风"]').getAttribute('aria-pressed')).toBe('true');
  });
});
