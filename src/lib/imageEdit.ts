import { cropRect, rotatedSize, type Box } from './crop';
import type { ImageSource } from './image';

export interface Edit {
  turns: number; // quarter-turns clockwise
  box: Box; // crop, in fractions of the rotated image
  brightness: number; // -100…100 (percent change)
  contrast: number; // -100…100
}

/**
 * Draws the picture rotated, adjusted and cropped. `maxSide` caps the result so a 12-megapixel photo doesn't need a
 * huge canvas (the preview uses a small cap; the final export a large one).
 */
export function renderEdited(src: ImageSource, e: Edit, maxSide = 2400): HTMLCanvasElement {
  const turns = ((e.turns % 4) + 4) % 4;
  const { w: rw, h: rh } = rotatedSize(src.width, src.height, turns);
  const r = cropRect(e.box, rw, rh);
  const scale = Math.min(1, maxSide / Math.max(r.w, r.h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(r.w * scale));
  canvas.height = Math.max(1, Math.round(r.h * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.filter = `brightness(${100 + e.brightness}%) contrast(${100 + e.contrast}%)`;
  ctx.translate(-r.x * scale, -r.y * scale);
  ctx.scale(scale, scale);
  // Place the rotated picture with its top-left corner at (0, 0).
  if (turns === 1) {
    ctx.translate(rw, 0);
    ctx.rotate(Math.PI / 2);
  } else if (turns === 2) {
    ctx.translate(rw, rh);
    ctx.rotate(Math.PI);
  } else if (turns === 3) {
    ctx.translate(0, rh);
    ctx.rotate(-Math.PI / 2);
  }
  ctx.drawImage(src, 0, 0);
  return canvas;
}

/** A copy no larger than `max` on the long side — what the editor previews and re-draws while sliders move. */
export function downscale(src: ImageSource, max = 1400): ImageSource {
  const scale = Math.min(1, max / Math.max(src.width, src.height));
  if (scale >= 1) return src;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(src.width * scale);
  canvas.height = Math.round(src.height * scale);
  canvas.getContext('2d')!.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}
