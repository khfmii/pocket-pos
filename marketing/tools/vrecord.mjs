// Deterministic recorder: advances the page's virtual clock one frame at a time and screenshots each step.
import fs from 'node:fs';
import { sleep } from './chrome.mjs';

export class Recorder {
  constructor(c, dir, { fps = 30, quality = 90, kind = 'web' } = {}) {
    this.c = c; this.dir = dir; this.fps = fps; this.quality = quality; this.kind = kind; this.k = 0; this.taps = []; this.marks = {};
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
  get t() { return this.k / this.fps; }
  async capture() {
    const { data } = await this.c.send('Page.captureScreenshot', { format: 'jpeg', quality: this.quality, optimizeForSpeed: true });
    fs.writeFileSync(`${this.dir}/${String(this.k++).padStart(5, '0')}.jpg`, Buffer.from(data, 'base64'));
  }
  ev(e) { return this.c.evaluate(e); }
  tick(ms) { return this.ev(`window.__vt.tick(${ms})`); }
  /** Let real async work (IndexedDB, dynamic import) finish, then flush virtual timers without advancing time. */
  async settle(real = 80) { await sleep(real); for (let i = 0; i < 3; i++) { await this.tick(0); await sleep(10); } }
  /** Advance video time by `ms`, capturing a frame per step. */
  async advance(ms) {
    const n = Math.max(1, Math.round((ms / 1000) * this.fps));
    for (let i = 0; i < n; i++) { await this.tick(1000 / this.fps); await this.capture(); }
  }
  mark(name) { this.marks[name] = this.t; }
  /** Advance to take-time `t` (no-op when already past it). */
  async until(t) { const d = t - this.t; if (d > 1 / this.fps) await this.advance(d * 1000); }
  /** Poll a page expression while real async work (native plugins) finishes; virtual time doesn't move. */
  async waitFor(expr, timeoutMs = 20000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) { await this.tick(0); if (await this.ev(expr)) return true; await sleep(60); }
    throw new Error('waitFor timed out: ' + expr);
  }
  async rect(sel, text = '', nth = 0) {
    return this.ev(`(() => { const a=[...document.querySelectorAll(${JSON.stringify(sel)})].filter(e=>${JSON.stringify(text)}===''||e.textContent.includes(${JSON.stringify(text)})); const vis=a.filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'}); const e=vis[${nth}]; if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; })()`);
  }
  async tap(sel, text = '', nth = 0, opt = {}) {
    const r = await this.rect(sel, text, nth);
    if (!r) throw new Error(`not found: ${sel} "${text}"`);
    const x = r.x + r.w * (opt.fx ?? 0.5), y = r.y + r.h * (opt.fy ?? 0.5);
    this.taps.push({ t: this.t, x, y, label: opt.label ?? (text || sel) });
    await this.c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await this.settle(30);
    await this.advance(opt.press ?? 70);
    await this.c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await this.settle(opt.settle ?? 90);
    return { x, y, rect: r };
  }
  async type(str, gapMs = 110) {
    for (const ch of str) {
      await this.c.send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, key: ch, unmodifiedText: ch });
      await this.c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
      await this.settle(20);
      await this.advance(gapMs);
    }
  }
  /** Smooth programmatic scroll of an element (ease in-out), one step per frame. */
  async scroll(sel, to, ms = 700, nth = -1) {
    const els = `[...document.querySelectorAll(${JSON.stringify(sel)})].at(${nth})`;
    const from = await this.ev(`${els}.scrollTop`);
    const n = Math.max(1, Math.round((ms / 1000) * this.fps));
    for (let i = 1; i <= n; i++) {
      const p = i / n, e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      await this.ev(`${els}.scrollTop=${from + (to - from) * e}`);
      await this.advance(1000 / this.fps);
    }
  }
  async finish() {
    const view = await this.ev('({w: innerWidth, h: innerHeight, dpr: devicePixelRatio})');
    const out = { fps: this.fps, frames: this.k, duration: this.k / this.fps, kind: this.kind, view, taps: this.taps, marks: this.marks };
    fs.writeFileSync(`${this.dir}/take.json`, JSON.stringify(out));
    return out;
  }
}

export async function prepare(c, { url = 'http://localhost:5173/', reload = false } = {}) {
  const src = fs.readFileSync(new URL('./inject.js', import.meta.url), 'utf8');
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: src });
  if (reload) await c.evaluate('location.reload()'); else await c.send('Page.navigate', { url });
  await sleep(reload ? 3500 : 2500);
  // flush start-up timers/effects
  for (let i = 0; i < 40; i++) { await c.evaluate('window.__vt.tick(50)'); await sleep(15); }
}
