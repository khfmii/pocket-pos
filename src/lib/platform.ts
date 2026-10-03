import { isNative } from './device';
import { locale } from '../i18n';

export { isNative };

export type SaveOutcome = 'saved' | 'shared' | 'cancelled';

const isCancel = (e: unknown) => /cancel|abort|dismiss/i.test(String((e as Error)?.message ?? e));

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Hands a text file to the user.
 * Android app: written to cache and opened in the system share sheet (Drive, Files, WhatsApp, email…),
 * because WebView ignores <a download>. Browser/PWA: normal download.
 */
export async function saveTextFile(filename: string, text: string, mime = 'application/json'): Promise<SaveOutcome> {
  if (isNative()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const written = await Filesystem.writeFile({ path: filename, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    try {
      await Share.share({ title: filename, url: written.uri, dialogTitle: 'Save or send file' });
      return 'shared';
    } catch (e) {
      if (isCancel(e)) return 'cancelled';
      throw e;
    }
  }
  download(filename, new Blob([text], { type: mime }));
  return 'saved';
}

/** Optional secondary action: the OS share sheet (browser: Web Share API with a file). */
export async function shareTextFile(filename: string, text: string, mime = 'application/json'): Promise<SaveOutcome> {
  if (isNative()) return saveTextFile(filename, text, mime);
  const file = new File([text], filename, { type: mime });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (e) {
      if (isCancel(e)) return 'cancelled';
      throw e;
    }
  }
  download(filename, file);
  return 'saved';
}

export async function shareText(title: string, text: string): Promise<boolean> {
  try {
    if (isNative()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text, dialogTitle: title });
      return true;
    }
    if (navigator.share) {
      await navigator.share({ title, text });
      return true;
    }
    await navigator.clipboard?.writeText(text);
    return false;
  } catch (e) {
    if (isCancel(e)) return true;
    return false;
  }
}

export function pickFile(accept: string, opts: { capture?: 'environment' | 'user' } = {}): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    if (opts.capture) input.setAttribute('capture', opts.capture); // opens the camera directly on phones
    input.style.display = 'none';
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => resolve(null), { once: true });
    // Some WebViews never fire 'cancel'. A chosen file always arrives before the app regains focus, so if focus
    // returns and nothing was chosen, treat it as cancelled — otherwise callers would wait forever (and, say,
    // leave a "busy" button disabled).
    window.addEventListener('focus', () => setTimeout(() => resolve(null), 2000), { once: true });
    document.body.appendChild(input);
    input.click();
    setTimeout(() => input.remove(), 60_000);
  });
}

export const canPrint = () => !isNative() && typeof window.print === 'function';

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString(locale.value, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(locale.value, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' });
}

const blobToBase64 = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });

/**
 * Hands any binary file (PNG, PDF, JPEG…) to the user.
 * Android app: written to cache and opened in the system share sheet. Browser: the Web Share API with the file
 * where supported (phones), otherwise a normal download — 'saved' tells the caller it went to Downloads.
 */
export async function shareFile(blob: Blob, filename: string, title = filename): Promise<SaveOutcome> {
  if (isNative()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const written = await Filesystem.writeFile({ path: filename, data: await blobToBase64(blob), directory: Directory.Cache });
    try {
      await Share.share({ title, url: written.uri, dialogTitle: title });
      return 'shared';
    } catch (e) {
      if (isCancel(e)) return 'cancelled';
      throw e;
    }
  }
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if (isCancel(e)) return 'cancelled';
      // any other failure: fall back to a plain download
    }
  }
  download(filename, file);
  return 'saved';
}

/** Shares or downloads a JPEG data URL (e.g. a payment slip). */
export async function shareImage(dataUrl: string, filename: string): Promise<void> {
  await shareFile(await (await fetch(dataUrl)).blob(), filename);
}
