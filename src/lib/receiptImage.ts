import { t } from '../i18n';
import { dotsFor, type Region } from './escpos';
import { imagePdf, mmToPt } from './pdf';
import type { Block, ReceiptSize } from './receipt';

/**
 * Draws a receipt (the same Block list the text and on-screen versions use) onto a canvas, so it can be shared as
 * an image or PDF. Layout is a pure function of a text-measuring callback, which keeps it testable without a browser.
 */

export const RECEIPT_WIDTH = 380; // layout units; the canvas is drawn at 2x for sharpness
const PAD = 22;
const INDENT = 14;
const LINE_HEIGHT = 1.38;
const SIZE: Record<ReceiptSize, number> = { sm: 16, md: 19, lg: 24, xl: 28 };
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif';
const LOGO_BOX = { w: 220, h: 96 };

export type Measure = (text: string, font: string) => number;

export type Op =
  | { t: 'text'; x: number; y: number; text: string; font: string; align: 'left' | 'right' | 'center' }
  | { t: 'rule'; y: number }
  | { t: 'logo'; x: number; y: number; w: number; h: number };

export interface Layout {
  ops: Op[];
  height: number;
}

type Segmenter = new (locale?: string, o?: { granularity: 'word' | 'grapheme' }) => { segment(s: string): Iterable<{ segment: string }> };
const SegmenterCtor = (Intl as unknown as { Segmenter?: Segmenter }).Segmenter;

/** Words, spaces and punctuation; CJK and Thai (no spaces between words) come out in dictionary-sized pieces. */
function pieces(s: string): string[] {
  if (SegmenterCtor) return Array.from(new SegmenterCtor(undefined, { granularity: 'word' }).segment(s), (x) => x.segment);
  return s.match(/\s+|[^\s⺀-꓏가-힣＀-｠]+|[⺀-꓏가-힣＀-｠]/gu) ?? [];
}

/** User-perceived characters, so a Thai vowel mark or an emoji is never split from its base. */
function graphemes(s: string): string[] {
  if (SegmenterCtor) return Array.from(new SegmenterCtor(undefined, { granularity: 'grapheme' }).segment(s), (x) => x.segment);
  return Array.from(s);
}

export function wrapText(text: string, maxW: number, font: string, measure: Measure): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let cur = '';
    for (const piece of pieces(para)) {
      const p = /^\s+$/.test(piece) ? ' ' : piece;
      if (cur === '' && p === ' ') continue;
      if (measure(cur + p, font) <= maxW) {
        cur += p;
        continue;
      }
      if (cur.trim()) out.push(cur.trimEnd());
      cur = '';
      if (p === ' ') continue;
      let rest = p;
      if (measure(rest, font) > maxW) {
        // One unbroken run (a URL, a long word) wider than the line: break it by character.
        let chunk = '';
        for (const g of graphemes(rest)) {
          if (chunk && measure(chunk + g, font) > maxW) {
            out.push(chunk);
            chunk = '';
          }
          chunk += g;
        }
        rest = chunk;
      }
      cur = rest;
    }
    out.push(cur.trimEnd());
  }
  return out;
}

export function fitLogo(w: number, h: number) {
  const k = Math.min(1, LOGO_BOX.w / w, LOGO_BOX.h / h);
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

const fontOf = (size: ReceiptSize, bold?: boolean) => `${bold ? 700 : 400} ${SIZE[size]}px ${FONT}`;

export function layoutReceipt(blocks: Block[], o: { measure: Measure; logo?: { w: number; h: number } | null; width?: number }): Layout {
  const W = o.width ?? RECEIPT_WIDTH;
  const inner = W - PAD * 2;
  const ops: Op[] = [];
  let y = PAD;

  for (const blk of blocks) {
    if (blk.k === 'logo') {
      if (!o.logo) continue;
      const { w, h } = fitLogo(o.logo.w, o.logo.h);
      ops.push({ t: 'logo', x: Math.round((W - w) / 2), y, w, h });
      y += h + 12;
    } else if (blk.k === 'rule') {
      y += 8;
      ops.push({ t: 'rule', y });
      y += 9;
    } else if (blk.k === 'text') {
      const size = blk.size ?? 'md';
      const font = fontOf(size, blk.bold);
      const lh = Math.round(SIZE[size] * LINE_HEIGHT);
      const indent = blk.indent ? INDENT : 0;
      if (size === 'md' && !blk.indent && !blk.bold && !blk.center) y += 4; // air between items
      for (const line of wrapText(blk.text, inner - indent, font, o.measure)) {
        ops.push({ t: 'text', x: blk.center ? W / 2 : PAD + indent, y: y + lh / 2, text: line, font, align: blk.center ? 'center' : 'left' });
        y += lh;
      }
    } else {
      const size = blk.size ?? 'md';
      const font = fontOf(size, blk.bold);
      const lh = Math.round(SIZE[size] * LINE_HEIGHT);
      const indent = blk.indent ? INDENT : 0;
      const rightW = o.measure(blk.right, font);
      ops.push({ t: 'text', x: W - PAD, y: y + lh / 2, text: blk.right, font, align: 'right' });
      // The amount keeps its column; a long description wraps in the space that is left.
      for (const line of wrapText(blk.left, Math.max(60, inner - indent - rightW - 12), font, o.measure)) {
        ops.push({ t: 'text', x: PAD + indent, y: y + lh / 2, text: line, font, align: 'left' });
        y += lh;
      }
    }
  }
  return { ops, height: y + PAD };
}

function draw(ctx: CanvasRenderingContext2D, layout: Layout, width: number, scale: number, logo: CanvasImageSource | null) {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, layout.height);
  ctx.fillStyle = '#111';
  ctx.textBaseline = 'middle';
  for (const op of layout.ops) {
    if (op.t === 'text') {
      ctx.font = op.font;
      ctx.textAlign = op.align;
      ctx.fillText(op.text, op.x, op.y);
    } else if (op.t === 'rule') {
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = '#8a949c';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, op.y + 0.5);
      ctx.lineTo(width - PAD, op.y + 0.5);
      ctx.stroke();
      ctx.restore();
    } else if (logo) {
      ctx.drawImage(logo, op.x, op.y, op.w, op.h);
    }
  }
  ctx.restore();
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

async function prepare(blocks: Block[], logo: string, width?: number) {
  const img = logo && blocks.some((b) => b.k === 'logo') ? await loadImage(logo).catch(() => null) : null;
  const scratch = document.createElement('canvas').getContext('2d')!;
  const measure: Measure = (text, font) => {
    scratch.font = font;
    return scratch.measureText(text).width;
  };
  const layout = layoutReceipt(blocks, { measure, logo: img ? { w: img.naturalWidth, h: img.naturalHeight } : null, width });
  return { img, layout };
}

/**
 * Draws the receipt exactly `paperMm` wide in printer dots (58 mm → 384, 80 mm → 576), slightly enlarged so thermal
 * print stays easy to read, and reports where the logo is so it can be dithered instead of thresholded.
 */
export async function renderForPrint(blocks: Block[], logo: string, paperMm: number): Promise<{ canvas: HTMLCanvasElement; logoRect: Region | null }> {
  const dots = dotsFor(paperMm);
  const width = Math.round(dots / 1.2); // layout units; the canvas is then scaled to exactly `dots` wide
  const scale = dots / width;
  const { img, layout } = await prepare(blocks, logo, width);
  const canvas = document.createElement('canvas');
  canvas.width = dots;
  canvas.height = Math.ceil(layout.height * scale);
  draw(canvas.getContext('2d')!, layout, width, scale, img);
  const l = layout.ops.find((o): o is Extract<Op, { t: 'logo' }> => o.t === 'logo');
  return { canvas, logoRect: l && img ? { x: l.x * scale, y: l.y * scale, w: l.w * scale, h: l.h * scale } : null };
}

/** Renders the receipt to a canvas (white paper, 2x resolution). `logo` is the shop's logo data URL, or ''. */
export async function renderReceipt(blocks: Block[], logo: string): Promise<HTMLCanvasElement> {
  const { img, layout } = await prepare(blocks, logo);
  const scale = Math.max(1, Math.min(2, 12_000 / layout.height)); // 2x is sharp on phone screens and print; very long receipts stay inside canvas memory limits
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(RECEIPT_WIDTH * scale);
  canvas.height = Math.round(layout.height * scale);
  draw(canvas.getContext('2d')!, layout, RECEIPT_WIDTH, scale, img);
  return canvas;
}

const toBlob = (c: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error(t('Could not create the receipt.')))), type, quality));

export async function receiptPng(blocks: Block[], logo: string): Promise<Blob> {
  return toBlob(await renderReceipt(blocks, logo), 'image/png');
}

/** A one-page PDF as wide as the paper roll (58/80 mm) and as tall as the receipt. */
export async function receiptPdf(blocks: Block[], logo: string, o: { paperMm: number; title: string }): Promise<Blob> {
  const canvas = await renderReceipt(blocks, logo);
  const jpeg = new Uint8Array(await (await toBlob(canvas, 'image/jpeg', 0.88)).arrayBuffer());
  return new Blob([imagePdf(jpeg, { w: canvas.width, h: canvas.height }, mmToPt(o.paperMm), { title: o.title }) as BlobPart], { type: 'application/pdf' });
}
