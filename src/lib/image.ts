import { pickFile } from './platform';

/** Anything the canvas can draw: a decoded camera/gallery picture, or an edited canvas. */
export type ImageSource = ImageBitmap | HTMLImageElement | HTMLCanvasElement;

export type EditKind = 'product' | 'proof' | 'logo';

const SIZE = 320; // px; tiles show ~120px, so this stays sharp on 3x screens while keeping each photo ~15-30 KB

/** Decodes a picked file, applying the camera's EXIF rotation so portrait photos aren't sideways. */
export async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export const release = (s: ImageSource) => {
  if ('close' in s) (s as ImageBitmap).close();
};

/** Centre-crops to a square, scales down and re-encodes as JPEG so photos stay small inside the database and backups. */
export function thumbnailFrom(src: ImageSource, size = SIZE, quality = 0.78): string {
  const side = Math.min(src.width, src.height);
  const canvas = document.createElement('canvas');
  const out = Math.min(size, side);
  canvas.width = canvas.height = out;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; // JPEG has no alpha: transparent PNGs would turn black
  ctx.fillRect(0, 0, out, out);
  ctx.drawImage(src, (src.width - side) / 2, (src.height - side) / 2, side, side, 0, 0, out, out);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Keeps the whole picture (no crop) at up to 1280px on the long side — legible enough to read a bank slip's text. */
export function photoFrom(src: ImageSource, max = 1280, quality = 0.72): string {
  const scale = Math.min(1, max / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Shop logo: keeps the whole picture (no crop) within 480×240, flattened onto white (receipts are white paper) and
 * stored as PNG so line art stays crisp — or JPEG when a photo-like logo would make the PNG large.
 */
export function logoFrom(src: ImageSource, maxW = 480, maxH = 240): string {
  if (!src.width || !src.height) throw new Error('Could not read that image.');
  const scale = Math.min(1, maxW / src.width, maxH / src.height);
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0, w, h);
  const png = canvas.toDataURL('image/png');
  return png.length <= 90_000 ? png : canvas.toDataURL('image/jpeg', 0.88);
}

// ---- the editing step between "picked a file" and "stored the picture" ----

/** Opens the crop / rotate / adjust screen; resolves the edited picture, or null if the user cancels. Set by the UI. */
type Editor = (file: File, kind: EditKind) => Promise<HTMLCanvasElement | null>;
let editor: Editor | null = null;
export const setImageEditor = (fn: Editor | null) => {
  editor = fn;
};

/** Every picked picture passes through the editor (when the app has one) before it is processed and stored. */
async function chosen(file: File, kind: EditKind): Promise<ImageSource | null> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.');
  return editor ? editor(file, kind) : decode(file);
}

async function pick<T>(kind: EditKind, opts: { capture?: 'environment' | 'user' }, make: (src: ImageSource) => T): Promise<T | null> {
  const f = await pickFile('image/*', opts);
  if (!f) return null;
  const src = await chosen(f, kind);
  if (!src) return null;
  try {
    return make(src);
  } finally {
    release(src);
  }
}

/** Opens the camera ('camera') or the photo library ('library') and returns a square thumbnail data URL, or null if cancelled. */
export const pickPhoto = (source: 'camera' | 'library') => pick('product', source === 'camera' ? { capture: 'environment' } : {}, (s) => thumbnailFrom(s));

/** Camera or library → compressed full-frame photo (for payment proofs). Returns null if cancelled. */
export const pickProofPhoto = (source: 'camera' | 'library') => pick('proof', source === 'camera' ? { capture: 'environment' } : {}, (s) => photoFrom(s));

/** Opens the photo library and returns a receipt-ready logo data URL, or null if cancelled. */
export const pickLogo = () => pick('logo', {}, (s) => logoFrom(s));
