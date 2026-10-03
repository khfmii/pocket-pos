import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import { applyLangPref } from './i18n';
import { startAutoBackup } from './lib/autobackup';
import { initDisplay } from './lib/display';
import { isNative } from './lib/platform';
import { installBackGuard } from './lib/sheets';
import { boot } from './lib/store';
import './styles.css';

initDisplay();
installBackGuard();
// Language file is tiny and local, so wait for it: avoids a flash of English before the right language appears.
await applyLangPref();
render(<App />, document.getElementById('app')!);
void boot().then(startAutoBackup);

// Offline support for the browser/PWA build. The Android app ships its files inside the APK, and a
// service worker there would only risk serving stale files after an app update.
if (!isNative()) registerSW({ immediate: true });
