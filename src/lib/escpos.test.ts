import { describe, expect, it } from 'vitest';
import { decodeRaster, dotsFor, monoFromRgba, printJob, rasterCommands, toBase64, type Mono } from './escpos';

/** RGBA pixels from a little ASCII picture: '#' black, '.' white. */
function pixels(rows: string[]) {
  const h = rows.length;
  const w = rows[0].length;
  const px = new Uint8ClampedArray(w * h * 4);
  rows.forEach((r, y) => [...r].forEach((ch, x) => px.set(ch === '#' ? [0, 0, 0, 255] : [255, 255, 255, 255], (y * w + x) * 4)));
  return { px, w, h };
}
const bit = (m: Mono, x: number, y: number) => (m.data[y * m.rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;

describe('monochrome conversion', () => {
  it('packs dots left to right into bytes, 1 = black', () => {
    const { px, w, h } = pixels(['#.......#', '.#######.']);
    const m = monoFromRgba(px, w, h);
    expect(m.rowBytes).toBe(2);
    expect([...m.data]).toEqual([0b10000000, 0b10000000, 0b01111111, 0b00000000]);
    expect(bit(m, 0, 0)).toBe(1);
    expect(bit(m, 8, 0)).toBe(1);
    expect(bit(m, 4, 0)).toBe(0);
  });

  it('treats transparent pixels as white paper and applies the threshold to greys', () => {
    const px = new Uint8ClampedArray([0, 0, 0, 0, /* clear */ 100, 100, 100, 255, /* dark grey */ 200, 200, 200, 255 /* light grey */]);
    const m = monoFromRgba(px, 3, 1);
    expect([bit(m, 0, 0), bit(m, 1, 0), bit(m, 2, 0)]).toEqual([0, 1, 0]);
    expect(bit(monoFromRgba(px, 3, 1, { threshold: 220 }), 2, 0)).toBe(1);
  });

  it('dithers only inside the given region', () => {
    const w = 16;
    const h = 8;
    const px = new Uint8ClampedArray(w * h * 4).fill(255);
    for (let i = 0; i < w * h; i++) px.set([150, 150, 150, 255], i * 4); // mid-grey everywhere
    const plain = monoFromRgba(px, w, h);
    const dithered = monoFromRgba(px, w, h, { dither: [{ x: 0, y: 0, w: 8, h: 8 }] });
    const count = (m: Mono, x0: number, x1: number) => {
      let n = 0;
      for (let y = 0; y < h; y++) for (let x = x0; x < x1; x++) n += bit(m, x, y);
      return n;
    };
    expect(count(plain, 0, 8)).toBe(64); // plain threshold: all black
    const mid = count(dithered, 0, 8);
    expect(mid).toBeGreaterThan(8);
    expect(mid).toBeLessThan(56); // a mix, so the grey keeps its tone
    expect(count(dithered, 8, 16)).toBe(64); // outside the region: unchanged
  });
});

describe('raster commands', () => {
  const m = monoFromRgba(...((p) => [p.px, p.w, p.h] as const)(pixels(['#.#.#.#.#', '.#.#.#.#.', '#########'])));

  it('starts each band with GS v 0, the byte width and the row count (little-endian)', () => {
    const bytes = rasterCommands(m, 2);
    expect([...bytes.subarray(0, 8)]).toEqual([0x1d, 0x76, 0x30, 0x00, 2, 0, 2, 0]); // 2 bytes wide, 2 rows
    // a second band for the remaining row
    const second = 8 + 2 * 2;
    expect([...bytes.subarray(second, second + 8)]).toEqual([0x1d, 0x76, 0x30, 0x00, 2, 0, 1, 0]);
    expect(bytes.length).toBe(8 + 4 + 8 + 2);
  });

  it('encodes tall pictures in bands and decodes back to exactly the same dots', () => {
    const w = 100;
    const h = 250;
    const px = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const v = (i * 7919) % 13 < 5 ? 0 : 255; // pseudo-random black/white
      px.set([v, v, v, 255], i * 4);
    }
    const mono = monoFromRgba(px, w, h);
    const decoded = decodeRaster(printJob(mono, { cut: true }))!;
    expect(decoded.height).toBe(h);
    expect(decoded.rowBytes).toBe(mono.rowBytes);
    expect([...decoded.data]).toEqual([...mono.data]);
  });

  it('bands never exceed the requested size, so a small printer buffer is not overrun', () => {
    const big: Mono = { width: 576, height: 1000, rowBytes: 72, data: new Uint8Array(72 * 1000) };
    const bytes = rasterCommands(big, 96);
    let i = 0;
    let bands = 0;
    while (i < bytes.length) {
      const rows = bytes[i + 6] | (bytes[i + 7] << 8);
      expect(rows).toBeLessThanOrEqual(96);
      i += 8 + 72 * rows;
      bands++;
    }
    expect(bands).toBe(Math.ceil(1000 / 96));
  });
});

describe('print job', () => {
  const m: Mono = { width: 8, height: 1, rowBytes: 1, data: new Uint8Array([0xff]) };

  it('initialises, prints, feeds, and cuts only when asked', () => {
    const plain = printJob(m);
    expect([...plain.subarray(0, 2)]).toEqual([0x1b, 0x40]); // ESC @
    expect([...plain.subarray(-3)]).toEqual([0x1b, 0x64, 4]); // ESC d 4
    expect([...printJob(m, { feedLines: 2 }).subarray(-3)]).toEqual([0x1b, 0x64, 2]);
    const cut = printJob(m, { cut: true });
    expect([...cut.subarray(-4)]).toEqual([0x1d, 0x56, 0x42, 0x00]); // GS V 66 0
    expect(cut.length).toBe(plain.length + 4);
  });

  it('picks the dot width from the paper roll', () => {
    expect(dotsFor(58)).toBe(384);
    expect(dotsFor(80)).toBe(576);
    expect(dotsFor(57)).toBe(384);
  });

  it('base64-encodes large jobs without overflowing the stack', () => {
    const big = new Uint8Array(300_000).map((_, i) => i & 255);
    const b64 = toBase64(big);
    const back = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    expect(back.length).toBe(big.length);
    expect(back[299_999]).toBe(big[299_999]);
    expect(toBase64(new Uint8Array([1, 2, 3]))).toBe('AQID');
  });
});
