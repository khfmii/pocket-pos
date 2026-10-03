// Minimal headless-Chrome driver over CDP (no dependencies; Node 22+ has global WebSocket/fetch).
import { spawn } from 'node:child_process';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export { sleep };

export async function launch({ port = 9333, profile, width = 390, height = 844 }) {
  const proc = spawn(
    CHROME,
    ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run',
      '--no-default-browser-check', '--hide-scrollbars', '--mute-audio', `--window-size=${width},${height}`,
      '--force-color-profile=srgb', 'about:blank'],
    { stdio: 'ignore' },
  );
  let targets;
  for (let i = 0; i < 100; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (targets.find((t) => t.type === 'page')) break; } catch {}
    await sleep(100);
  }
  const page = targets.find((t) => t.type === 'page');
  const c = await attach(page.webSocketDebuggerUrl);
  c.proc = proc;
  c.close = async () => { try { await c.send('Browser.close'); } catch {} c.ws.close(); proc.kill(); };
  return c;
}

/** Connect to any CDP page target (headless Chrome, or an Android WebView forwarded with adb). */
export async function attach(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const handlers = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(`${msg.error.message}`)) : res(msg.result);
    } else if (msg.method) (handlers.get(msg.method) ?? []).forEach((h) => h(msg.params));
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const on = (ev, h) => handlers.set(ev, [...(handlers.get(ev) ?? []), h]);
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const close = async () => { ws.close(); };
  return { send, on, evaluate, close, ws };
}

export async function phone(c, { width = 390, height = 844, dpr = 3 } = {}) {
  await c.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: true });
  await c.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await c.send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' });
  await c.send('Page.enable');
  await c.send('Runtime.enable');
}

export async function shot(c, path, { format = 'png', quality = 90 } = {}) {
  const { data } = await c.send('Page.captureScreenshot', { format, quality, captureBeyondViewport: false });
  const fs = await import('node:fs');
  fs.writeFileSync(path, Buffer.from(data, 'base64'));
}
