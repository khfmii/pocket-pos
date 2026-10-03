// node takes30.mjs <seed|sell|lang|reports> <scratchpad>   (web takes for the 30 s cut; natural pace, played back 1:1)
import { launch, phone, sleep } from './chrome.mjs';
import { Recorder, prepare } from './vrecord.mjs';
import { seed } from './seed.mjs';
import fs from 'node:fs';

const [, , which, SP] = process.argv;
const profile = `${SP}/prof-app`;
async function open(port) {
  const c = await launch({ port, profile }); await phone(c);
  await c.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 30, bottom: 22, left: 0, right: 0 } });
  return c;
}

if (which === 'seed') {
  fs.rmSync(profile, { recursive: true, force: true });
  const c = await open(9341);
  await c.send('Page.navigate', { url: 'http://localhost:5173/' }); await sleep(2500);
  console.log(await seed(c));
  await c.close();
} else {
  const c = await open(9343);
  await prepare(c);
  await c.evaluate(`localStorage.setItem('pocketpos.lang','en'); localStorage.removeItem('pocketpos.cart')`);
  await c.send('Page.reload'); await sleep(2500);
  for (let i = 0; i < 40; i++) { await c.evaluate('window.__vt.tick(50)'); await sleep(10); }
  const r = new Recorder(c, `${SP}/takes/${which}30`);
  if (which === 'sell') {
    await r.capture();
    await r.until(0.45); await r.tap('.tile', 'Mecha');
    await r.until(0.95); await r.tap('.tile', 'Booster');
    await r.until(1.35); await r.tap('.tile', 'Booster');
    await r.until(1.85); await r.tap('.tile', 'Star Enamel');
    await r.until(2.45); r.mark('cartbar'); await r.tap('.cartbar');
    await r.until(3.55); r.mark('charge'); await r.tap('.btn.primary.lg.grow', 'Charge');
    await r.until(4.15); r.mark('ewallet'); await r.tap('.btn', 'E-wallet');
    await r.until(4.55); await r.tap('input.input.big'); await r.type('30', 120);
    await r.until(5.3); r.mark('addpay'); await r.tap('.btn.primary.lg.block');
    await r.until(5.75); r.mark('cash'); await r.tap('.btn', 'Cash');
    await r.until(6.1); await r.tap('input.input.big'); await r.type('40', 120);
    await r.until(6.95); r.mark('finish'); await r.tap('.btn.primary.lg.block'); await r.settle(500);
    await r.until(7.9); r.mark('complete');
    await r.scroll('.sheet-body', 560, 700);
    await r.until(8.95);
    await r.scroll('.sheet-body', 0, 400);
    await r.until(9.5); r.mark('share'); await r.tap('.btn.grow', 'Share');
    await r.until(11.25);
  } else if (which === 'lang') {
    await r.capture();
    for (const [code, at] of [['zh-CN', 0.2], ['ja', 0.7], ['es', 1.2]]) {
      await r.until(at); r.mark(code);
      await r.ev(`import('/src/i18n/index.ts').then(m=>m.setLangPref(${JSON.stringify(code)}))`); await r.settle(250);
    }
    await r.until(1.5);
  } else if (which === 'reports') {
    await r.capture();
    await r.until(0.3); await r.tap('button', 'Reports');
    await r.until(1.2); r.mark('range'); await r.tap('.chip', '7 days');
    await r.until(2.0); r.mark('scroll'); await r.scroll('.page, .content, main, .scroll', 330, 800, 0);
    await r.until(3.75);
  }
  const out = await r.finish();
  console.log(which, 'frames', out.frames, 'dur', out.duration.toFixed(2), JSON.stringify(Object.fromEntries(Object.entries(out.marks).map(([k, v]) => [k, +v.toFixed(2)]))));
  await c.evaluate(`localStorage.setItem('pocketpos.lang','en')`);
  await c.close();
}
