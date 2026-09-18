/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openLightbox, closeLightbox, nextLightbox, prevLightbox, getLightboxState } from '../assets/js/lightbox.js';

const ITEMS = [
  { id:'a', src:'a.webp', srcset:'a-thumb.webp 800w, a.webp 2000w', fallback:'a.jpg', thumb:'a-thumb.webp', width:2000, height:1333, alt:'A' },
  { id:'b', src:'b.webp', srcset:'b-thumb.webp 800w, b.webp 2000w', fallback:'b.jpg', thumb:'b-thumb.webp', width:2000, height:1333, alt:'B' },
  { id:'c', src:'c.webp', srcset:'c-thumb.webp 800w, c.webp 2000w', fallback:'c.jpg', thumb:'c-thumb.webp', width:2000, height:1333, alt:'C' },
];

describe('lightbox', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => closeLightbox());

  it('opens with correct image and counter', () => {
    openLightbox(ITEMS, 1);
    const s = getLightboxState();
    expect(s.open).toBe(true);
    expect(s.index).toBe(1);
    expect(document.querySelector('.lightbox img').getAttribute('src')).toBe('b.webp');
    expect(document.querySelector('.lightbox-counter').textContent).toBe('2 / 3');
    expect(document.querySelector('.lightbox').getAttribute('aria-modal')).toBe('true');
  });
  it('next wraps around', () => {
    openLightbox(ITEMS, 2); nextLightbox();
    expect(getLightboxState().index).toBe(0);
  });
  it('prev wraps around', () => {
    openLightbox(ITEMS, 0); prevLightbox();
    expect(getLightboxState().index).toBe(2);
  });
  it('Esc closes', () => {
    openLightbox(ITEMS, 0);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(getLightboxState().open).toBe(false);
  });
  it('ArrowRight advances', () => {
    openLightbox(ITEMS, 0);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(getLightboxState().index).toBe(1);
  });
  it('restores focus to trigger on close', () => {
    const btn = document.createElement('button'); document.body.append(btn); btn.focus();
    openLightbox(ITEMS, 0, btn);
    closeLightbox();
    expect(document.activeElement).toBe(btn);
  });
});
