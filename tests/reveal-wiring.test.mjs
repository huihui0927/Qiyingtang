import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const PAGES = ['index.html', 'portrait.html', 'wedding.html', 'event.html', 'booking.html', '404.html'];

function readPage(name) {
  return readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
}

describe('reveal wiring', () => {
  for (const page of PAGES) {
    it(`${page}: document-level initReveal() is called`, () => {
      const html = readPage(page);
      if (!html.includes('data-reveal')) return;
      expect(html).toMatch(/initReveal\(\s*\)/);
    });
  }
});
