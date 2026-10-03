/**
 * ESC/POS encoding for Bluetooth thermal receipt printers. The receipt is drawn as a picture first (see receiptImage.ts)
 * and sent as a monochrome raster, so every script (Chinese, Thai, accents…) and the shop logo print exactly like they
 * look on screen — no per-printer code pages or fonts.
 */

export interface Mono {
  width: number; // dots
  height: number; // dots
  rowBytes: number; // ceil(width / 8)
  data: Uint8Array; // rowBytes × height; bit 7 of each byte is the left-most dot; 1 = black
}

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Dots per line: 58 mm printers print 384 dots, 80 mm ones 576. */
export const dotsFor = (paperMm: number) => (paperMm >= 80 ? 576 : 384);

const luma = (r: number, g: number, b: number, a: number) => {
  const l = 0.299 * r + 0.587 * g + 0.114 * b;
  return 255 - ((255 - l) * a) / 255; // transparent pixels count as white paper
};

/**
 * Black and white from RGBA pixels. Text is simply thresholded (crisp), a slightly high threshold makes thin
 * anti-aliased strokes print dark enough. `dither` regions (the logo) use error diffusion so photos and gradients keep
 * their shading on a printer that can only do black or nothing.
 */
export function monoFromRgba(rgba: ArrayLike<number>, width: number, height: number, o: { threshold?: number; dither?: Region[] } = {}): Mono {
  const threshold = o.threshold ?? 170;
  const rowBytes = Math.ceil(width / 8);
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) gray[i] = luma(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2], rgba[i * 4 + 3]);

  // Floyd–Steinberg inside the given regions only.
  for (const r of o.dither ?? []) {
    const x0 = Math.max(0, Math.floor(r.x));
    const y0 = Math.max(0, Math.floor(r.y));
    const x1 = Math.min(width, Math.ceil(r.x + r.w));
    const y1 = Math.min(height, Math.ceil(r.y + r.h));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = y * width + x;
        const old = gray[i];
        const next = old < 128 ? 0 : 255;
        gray[i] = next;
        const err = old - next;
        if (x + 1 < x1) gray[i + 1] += (err * 7) / 16;
        if (y + 1 < y1) {
          if (x > x0) gray[i + width - 1] += (err * 3) / 16;
          gray[i + width] += (err * 5) / 16;
          if (x + 1 < x1) gray[i + width + 1] += err / 16;
        }
      }
    }
  }

  const data = new Uint8Array(rowBytes * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (gray[y * width + x] < threshold) data[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return { width, height, rowBytes, data };
}

const ESC = 0x1b;
const GS = 0x1d;

/** `GS v 0` raster bit-image commands, in bands so a printer's small receive buffer is never overrun. */
export function rasterCommands(m: Mono, bandRows = 96): Uint8Array {
  const parts: Uint8Array[] = [];
  for (let y = 0; y < m.height; y += bandRows) {
    const rows = Math.min(bandRows, m.height - y);
    const head = new Uint8Array([GS, 0x76, 0x30, 0x00, m.rowBytes & 0xff, m.rowBytes >> 8, rows & 0xff, rows >> 8]);
    parts.push(head, m.data.subarray(y * m.rowBytes, (y + rows) * m.rowBytes));
  }
  return concat(parts);
}

export function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** A complete job: initialise, the picture, a little paper feed so the last line clears the tear bar, optional cut. */
export function printJob(m: Mono, o: { cut?: boolean; feedLines?: number } = {}): Uint8Array {
  const parts = [new Uint8Array([ESC, 0x40]), rasterCommands(m), new Uint8Array([ESC, 0x64, o.feedLines ?? 4])];
  if (o.cut) parts.push(new Uint8Array([GS, 0x56, 0x42, 0x00])); // partial cut after feeding to the cutter
  return concat(parts);
}

/** Base64 without blowing the call stack on large jobs. */
export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Reads the raster commands back out of a job (used by tests, and to preview exactly what would print). */
export function decodeRaster(bytes: Uint8Array): Mono | null {
  const rows: Uint8Array[] = [];
  let rowBytes = 0;
  let i = 0;
  while (i < bytes.length) {
    if (bytes[i] === GS && bytes[i + 1] === 0x76 && bytes[i + 2] === 0x30) {
      const rb = bytes[i + 4] | (bytes[i + 5] << 8);
      const h = bytes[i + 6] | (bytes[i + 7] << 8);
      rowBytes = rb;
      const start = i + 8;
      for (let r = 0; r < h; r++) rows.push(bytes.subarray(start + r * rb, start + (r + 1) * rb));
      i = start + rb * h;
    } else if (bytes[i] === ESC && bytes[i + 1] === 0x40) i += 2;
    else if (bytes[i] === ESC && bytes[i + 1] === 0x64) i += 3;
    else if (bytes[i] === GS && bytes[i + 1] === 0x56) i += bytes[i + 2] === 0x42 ? 4 : 3;
    else i++;
  }
  if (!rows.length) return null;
  return { width: rowBytes * 8, height: rows.length, rowBytes, data: concat(rows) };
}
