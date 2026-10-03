/**
 * Crop-box maths for the image editor. Everything is in *normalised* coordinates (0–1 of the image as it is currently
 * rotated), so it doesn't depend on how large the preview happens to be drawn. Pure functions: the editor only turns
 * pointer movement into `dx`/`dy` fractions and calls these.
 */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Smallest crop side, as a fraction of the image — keeps the box big enough to grab. */
export const MIN_SIDE = 0.1;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const fullBox = (): Box => ({ x: 0, y: 0, w: 1, h: 1 });

/** The largest centred box with the given pixel aspect ratio (width ÷ height); `null` = the whole image. */
export function boxForAspect(imgW: number, imgH: number, aspect: number | null): Box {
  if (!aspect) return fullBox();
  const imgAspect = imgW / imgH;
  if (imgAspect > aspect) {
    const w = aspect / imgAspect;
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  const h = imgAspect / aspect;
  return { x: 0, y: (1 - h) / 2, w: 1, h };
}

export function moveBox(b: Box, dx: number, dy: number): Box {
  return { ...b, x: clamp(b.x + dx, 0, 1 - b.w), y: clamp(b.y + dy, 0, 1 - b.h) };
}

/**
 * Drags a handle by (dx, dy), also as fractions of the image. Free mode moves just the touched edges; with an
 * `aspect` lock only the corners resize (the opposite corner stays put) and the ratio is kept exactly.
 */
export function resizeBox(b: Box, handle: Handle, dx: number, dy: number, o: { imgW: number; imgH: number; aspect: number | null }): Box {
  if (handle === 'move') return moveBox(b, dx, dy);

  let left = b.x;
  let top = b.y;
  let right = b.x + b.w;
  let bottom = b.y + b.h;

  if (!o.aspect) {
    if (handle.includes('w')) left = clamp(left + dx, 0, right - MIN_SIDE);
    if (handle.includes('e')) right = clamp(right + dx, left + MIN_SIDE, 1);
    if (handle.includes('n')) top = clamp(top + dy, 0, bottom - MIN_SIDE);
    if (handle.includes('s')) bottom = clamp(bottom + dy, top + MIN_SIDE, 1);
    return { x: left, y: top, w: right - left, h: bottom - top };
  }

  if (handle.length !== 2) return b; // edges don't make sense with a fixed ratio
  // normalised width per unit of normalised height that keeps the pixel ratio
  const k = (o.imgH * o.aspect) / o.imgW;
  const fromRight = handle.includes('w'); // dragging a west corner: the east edge is the anchor
  const fromBottom = handle.includes('n'); // dragging a north corner: the south edge is the anchor
  const anchorX = fromRight ? right : left;
  const anchorY = fromBottom ? bottom : top;
  const cornerX = clamp((fromRight ? left : right) + dx, 0, 1);
  const cornerY = clamp((fromBottom ? top : bottom) + dy, 0, 1);

  const wantW = Math.abs(cornerX - anchorX);
  const wantH = Math.abs(cornerY - anchorY);
  const maxW = fromRight ? anchorX : 1 - anchorX;
  const maxH = fromBottom ? anchorY : 1 - anchorY;
  let w = Math.max(wantW, wantH * k);
  w = clamp(w, Math.max(MIN_SIDE, MIN_SIDE * k), Math.min(maxW, maxH * k));
  const h = w / k;
  return { x: fromRight ? anchorX - w : anchorX, y: fromBottom ? anchorY - h : anchorY, w, h };
}

/** The crop in whole pixels of an image `w`×`h`, never empty and never outside the image. */
export function cropRect(b: Box, w: number, h: number) {
  const x = clamp(Math.round(b.x * w), 0, w - 1);
  const y = clamp(Math.round(b.y * h), 0, h - 1);
  return { x, y, w: clamp(Math.round(b.w * w), 1, w - x), h: clamp(Math.round(b.h * h), 1, h - y) };
}

/** Size of an image after `turns` quarter-turns (odd = width and height swap). */
export const rotatedSize = (w: number, h: number, turns: number) => (turns % 2 === 0 ? { w, h } : { w: h, h: w });
