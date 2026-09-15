import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { processOne, buildGalleryJson } from '../scripts/process-images.mjs';

describe('process-images', () => {
  let tmp;
  beforeAll(() => { tmp = mkdtempSync(join(tmpdir(), 'qi-')); });
  afterAll(() => { rmSync(tmp, { recursive: true, force: true }); });

  it('emits webp + thumb + jpg and strips EXIF', async () => {
    const src = join(tmp, 'a.jpg');
    await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#888' } })
      .jpeg().withMetadata({ exif: { IFD0: { ImageDescription: 'secret GPS' } } })
      .toFile(src);
    const outDir = join(tmp, 'out');
    mkdirSync(outDir, { recursive: true });
    const item = await processOne(src, outDir, 'portrait', 'a', '示例');
    expect(existsSync(join(outDir, 'a.webp'))).toBe(true);
    expect(existsSync(join(outDir, 'a-thumb.webp'))).toBe(true);
    expect(existsSync(join(outDir, 'a.jpg'))).toBe(true);
    expect(existsSync(join(outDir, 'a@2x.webp'))).toBe(true); // 原图 3000 ≥ 2800
    expect(item.width).toBe(2000);
    expect(item.height).toBeGreaterThan(0);
    // EXIF stripped
    const meta = await sharp(join(outDir, 'a.jpg')).metadata();
    expect(meta.exif).toBeUndefined();
  });

  it('skips @2x when source < 2800px', async () => {
    const src = join(tmp, 'b.jpg');
    await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#aaa' } }).jpeg().toFile(src);
    const outDir = join(tmp, 'out2'); mkdirSync(outDir, { recursive: true });
    await processOne(src, outDir, 'portrait', 'b', '小图');
    expect(existsSync(join(outDir, 'b@2x.webp'))).toBe(false);
  });

  it('buildGalleryJson returns items grouped by category', () => {
    const items = [
      { id: 'x', category: '清新日系', src: 'p/x.webp' },
      { id: 'y', category: '情绪写真', src: 'p/y.webp' },
    ];
    const data = buildGalleryJson(items);
    expect(data.items).toHaveLength(2);
    expect(data.items[0].category).toBe('清新日系');
  });
});
