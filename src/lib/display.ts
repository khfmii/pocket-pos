import { signal } from '@preact/signals';

/** Device-local display preferences (not part of backups: a shop owner's big-text setting shouldn't follow a restore). */
export const TEXT_SCALES = [1, 1.15, 1.3, 1.5] as const;
export type TextScale = (typeof TEXT_SCALES)[number];

const SCALE_KEY = 'pocketpos.scale';
const CONTRAST_KEY = 'pocketpos.contrast';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* ignore */
  }
}

const savedScale = Number(read(SCALE_KEY));
export const textScale = signal<TextScale>((TEXT_SCALES as readonly number[]).includes(savedScale) ? (savedScale as TextScale) : 1);
export const highContrast = signal(read(CONTRAST_KEY) === '1');

// The layout reacts to the *effective* width (screen width ÷ text scale), not raw pixels, so a phone at "Huge"
// gets the same compact layout a smaller screen would. CSS media queries can't see our scale, so we set classes.
const BREAKPOINTS = [420, 560, 720, 900];

export function applyDisplay() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--scale', String(textScale.value));
  root.toggleAttribute('data-contrast', highContrast.value);
  if (highContrast.value) root.setAttribute('data-contrast', 'high');
  const eff = window.innerWidth / textScale.value;
  for (const bp of BREAKPOINTS) root.classList.toggle(`bp-${bp}`, eff >= bp);
}

export function setTextScale(s: TextScale) {
  textScale.value = s;
  write(SCALE_KEY, String(s));
  applyDisplay();
}

export function setHighContrast(on: boolean) {
  highContrast.value = on;
  write(CONTRAST_KEY, on ? '1' : '0');
  applyDisplay();
}

export function initDisplay() {
  applyDisplay();
  window.addEventListener('resize', applyDisplay, { passive: true });
}
