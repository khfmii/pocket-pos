import { connect } from './android.mjs';
import { sleep } from './chrome.mjs';
import { Recorder } from './vrecord.mjs';
import fs from 'node:fs';
const SP = process.argv[2];
const c = await connect(); await c.send('Page.enable'); await c.send('Runtime.enable');
await c.send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(new URL('./inject.js', import.meta.url), 'utf8') });
await c.evaluate('location.reload()'); await sleep(3500);
for (let i = 0; i < 40; i++) { await c.evaluate('window.__vt.tick(50)'); await sleep(10); }
const r = new Recorder(c, `${SP}/takes/andwarm`);
await r.tap('button', 'Items'); await r.advance(400);
await r.tap('.fab', 'Add item'); await r.advance(400);
await r.tap('input[placeholder="e.g. Iced latte"]'); await r.type('Warm Up Cup', 40); await r.advance(200);
await r.tap('.btn.sm', 'Translate');
const t0 = Date.now();
for (;;) {
  await c.evaluate('window.__vt.tick(100)'); await sleep(200);
  const vals = await c.evaluate(`[...document.querySelectorAll('.sheet label.field input.input.grow')].map(e=>e.value)`);
  const msg = await c.evaluate(`document.querySelector('.toast')?.textContent || ''`);
  if (vals.length && vals.every((v) => v)) { console.log('translated:', vals.join(' | '), `${((Date.now()-t0)/1000).toFixed(1)}s`); break; }
  if (Date.now() - t0 > 240000) { console.log('timeout', vals, msg); break; }
  if (msg) console.log('toast:', msg);
}
await sleep(500);
await c.evaluate('history.back()'); await sleep(500);
await c.close();
