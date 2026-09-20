/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initCarousel } from '../assets/js/carousel.js';

function mount(n = 3) {
  const slides = Array.from({ length: n }, (_, i) =>
    `<img class="hero-slide${i === 0 ? ' is-active' : ''}">`).join('');
  document.body.innerHTML =
    `<section class="hero"><div class="hero-slides" data-carousel>${slides}</div>` +
    `<div data-carousel-dots></div></section>`;
  return {
    slidesEl: document.querySelector('[data-carousel]'),
    dotsEl: document.querySelector('[data-carousel-dots]'),
  };
}
const activeIdx = () =>
  [...document.querySelectorAll('.hero-slide')].findIndex(s => s.classList.contains('is-active'));

describe('carousel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  });
  it('initializes with slide 0 active and one dot per slide', () => {
    const { slidesEl, dotsEl } = mount();
    initCarousel(slidesEl, dotsEl);
    expect(activeIdx()).toBe(0);
    expect(dotsEl.querySelectorAll('.hero-dot')).toHaveLength(3);
    expect(dotsEl.children[0].getAttribute('aria-selected')).toBe('true');
  });
  it('advances on interval and wraps around', () => {
    const { slidesEl, dotsEl } = mount();
    initCarousel(slidesEl, dotsEl, { interval: 6000 });
    vi.advanceTimersByTime(6000);
    expect(activeIdx()).toBe(1);
    expect(slidesEl.style.transform).toBe('translateX(-100%)');
    vi.advanceTimersByTime(12000);
    expect(activeIdx()).toBe(0);
    expect(slidesEl.style.transform).toBe('translateX(-0%)');
  });
  it('clicking a dot jumps to that slide', () => {
    const { slidesEl, dotsEl } = mount();
    initCarousel(slidesEl, dotsEl);
    dotsEl.children[2].click();
    expect(activeIdx()).toBe(2);
    expect(dotsEl.children[2].getAttribute('aria-selected')).toBe('true');
    expect(dotsEl.children[0].getAttribute('aria-selected')).toBe('false');
  });
  it('single slide is a no-op (no dots, no timer)', () => {
    const { slidesEl, dotsEl } = mount(1);
    initCarousel(slidesEl, dotsEl);
    expect(dotsEl.children).toHaveLength(0);
  });
});
