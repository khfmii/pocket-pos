import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();

/** True on phones and tablets (the Android app, or a mobile browser/PWA). False on desktop/laptop browsers. */
export function isMobileDevice(): boolean {
  if (isNative()) return true;
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  // iPadOS reports itself as a Mac; touch + coarse pointer gives it away.
  return (navigator.maxTouchPoints ?? 0) > 1 && typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}
