import { connect, adb } from './android.mjs';
import { sleep } from './chrome.mjs';
import { Recorder } from './vrecord.mjs';
import fs from 'node:fs';
const SP = process.argv[2];
const c = await connect(); await c.send('Page.enable'); await c.send('Runtime.enable');
await c.send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(new URL('./inject.js', import.meta.url), 'utf8') });
await c.evaluate('location.reload()'); await sleep(3500);
for (let i = 0; i < 40; i++) { await c.evaluate('window.__vt.tick(50)'); await sleep(10); }
const r = new Recorder(c, `${SP}/takes/andfolder`);
await r.tap('button', 'More'); await r.advance(400);
await r.tap('.list-row, button', 'Data & backup'); await r.advance(600);
await r.ev(`[...document.querySelectorAll('.sheet-body')].at(-1).scrollTop = 0`); await r.advance(300);
const pos = await r.ev(`(() => { const row=[...document.querySelectorAll('.switch-row')].find(e=>e.textContent.includes('Back up automatically')); row.scrollIntoView({block:'center'}); const sw=row.querySelector('.switch'); const q=sw.getBoundingClientRect(); return {x:q.x+q.width/2,y:q.y+q.height/2}; })()`);
await r.advance(200);
console.log('switch at', JSON.stringify(pos));
await r.tap('.switch-row .switch', '', 0, {});
await sleep(2500);
await c.close();
