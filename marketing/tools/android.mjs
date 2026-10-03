// Attach to the Pocket POS WebView running in the emulator (adb forward → CDP).
import { execFileSync } from 'node:child_process';
import { attach } from './chrome.mjs';
const ADB = `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`;
export const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8' }).trim();

export async function connect(port = 9555) {
  const pid = adb('shell', 'pidof', 'com.pocketpos.app').split(/\s+/)[0];
  adb('forward', `tcp:${port}`, `localabstract:webview_devtools_remote_${pid}`);
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  return attach(page.webSocketDebuggerUrl.replace('ws://127.0.0.1', `ws://127.0.0.1`));
}
