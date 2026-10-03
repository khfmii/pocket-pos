// Back-button handling shared by the Android app and the browser (PWA).
// Every open sheet (and the setup wizard past step 1) registers a close callback. A back press closes the top-most one;
// with nothing open the app gets a chance to handle it (leave a tab), otherwise the platform takes over.
import { isNative } from './device';

const stack: (() => void)[] = [];
let onEmptyBack: (() => boolean) | null = null;

export function registerSheet(close: () => void): () => void {
  stack.push(close);
  return () => {
    const i = stack.lastIndexOf(close);
    if (i >= 0) stack.splice(i, 1);
  };
}

export const openSheetCount = () => stack.length;

/** Called when back is pressed with no sheet open. Return true if handled. */
export function setEmptyBackHandler(fn: () => boolean) {
  onEmptyBack = fn;
}

/** One back press. Returns false when there was nothing left in the app to go back to. */
export function handleBack(): boolean {
  const top = stack[stack.length - 1];
  if (top) {
    top();
    return true;
  }
  return onEmptyBack?.() ?? false;
}

const arm = () => history.pushState({ pocketGuard: true }, '');

export function installBackGuard() {
  if (isNative()) {
    // Android: take the back button over completely instead of walking WebView history. A guard history entry per
    // press is fragile there — Chromium flags entries a page adds by script as skippable, after which canGoBack()
    // turns false and Capacitor's default handler silently ignores back (e.g. Settings could no longer be closed).
    void import('@capacitor/app').then(({ App }) => {
      void App.addListener('backButton', () => {
        // At the very root, behave like a normal Android app (go to the home screen) but keep the app — and any
        // sale in progress — alive in memory.
        if (!handleBack()) void App.minimizeApp();
      });
    });
    return;
  }
  // Browser / PWA: one guard history entry above the root. Back pops it; we close a sheet and re-arm the guard.
  history.replaceState({ pocketRoot: true }, '');
  arm();
  window.addEventListener('popstate', () => {
    if (handleBack()) arm();
  });
}
