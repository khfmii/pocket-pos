// node andtakes30.mjs <translate|backup> <scratchpad>   (real Android app in the emulator, WebView captured over CDP)
import { connect } from './android.mjs';
import { sleep } from './chrome.mjs';
import { Recorder, prepare } from './vrecord.mjs';
const [, , which, SP] = process.argv;
const c = await connect(); await c.send('Page.enable'); await c.send('Runtime.enable');
await prepare(c, { reload: true });
await c.evaluate(`localStorage.setItem('pocketpos.lang','en'); localStorage.removeItem('pocketpos.cart')`);
const setup = new Recorder(c, `${SP}/takes/and-setup`);
const opt = { kind: 'android' };
let r;
if (which === 'translate') {
  await setup.tap('button', 'Items'); await setup.advance(600);
  r = new Recorder(c, `${SP}/takes/translate30`, opt);
  await r.capture();
  await r.until(0.15); r.mark('fab'); await r.tap('.fab', 'Add item');
  await r.until(0.62); await r.tap('input[placeholder="e.g. Iced latte"]');
  await r.until(0.72); await r.type('Fox Mask Keychain', 30);
  await r.until(1.4); r.mark('translate'); await r.tap('.btn.sm', 'Translate');
  await r.waitFor(`[...document.querySelectorAll('.sheet label.field input.input.grow')].length === 3 && [...document.querySelectorAll('.sheet label.field input.input.grow')].every(e => e.value)`, 30000);
  r.mark('translated');
  await r.until(2.25);
} else {
  r = new Recorder(c, `${SP}/takes/backup30`, opt);
  await r.capture();
  await r.until(0.25); await r.tap('button', 'More');
  await r.until(0.8); await r.tap('.list-row, button', 'Data & backup');
  await r.until(1.9); r.mark('backup');
  const before = await r.ev(`document.body.innerText.match(/pocketpos-auto-[0-9-]+\\.json/)?.[0] || ''`);
  await r.tap('.btn.block', 'Back up now to this folder');
  await r.waitFor(`(document.body.innerText.match(/pocketpos-auto-[0-9-]+\\.json/)?.[0] || '') !== ${JSON.stringify(before)}`, 30000);
  r.mark('saved');
  await r.until(3.75);
}
const out = await r.finish();
console.log(which, 'frames', out.frames, 'dur', out.duration.toFixed(2), JSON.stringify(out.view), JSON.stringify(Object.fromEntries(Object.entries(out.marks).map(([k, v]) => [k, +v.toFixed(2)]))));
await c.close();
