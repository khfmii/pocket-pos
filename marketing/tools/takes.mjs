// node takes.mjs <seed|sell|lang|reports> <scratchpad>
import { launch, phone, sleep } from './chrome.mjs';
import { Recorder, prepare } from './vrecord.mjs';
import { seed } from './seed.mjs';
import fs from 'node:fs';

const [, , which, SP] = process.argv;
const profile = `${SP}/prof-app`;

async function open(port) {
  const c = await launch({ port, profile });
  await phone(c);
  await c.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 30, bottom: 22, left: 0, right: 0 } });
  return c;
}

if (which === 'seed') {
  fs.rmSync(profile, { recursive: true, force: true });
  const c = await open(9341);
  await c.send('Page.navigate', { url: 'http://localhost:5173/' });
  await sleep(2500);
  console.log(await seed(c));
  await c.close();
} else {
  const c = await open(9343);
  await prepare(c);
  await c.evaluate(`localStorage.setItem('pocketpos.lang','en'); localStorage.removeItem('pocketpos.cart')`);
  await c.send('Page.reload'); await sleep(2500);
  for (let i = 0; i < 40; i++) { await c.evaluate('window.__vt.tick(50)'); await sleep(10); }
  const r = new Recorder(c, `${SP}/takes/${which}`);
  const lastBody = 190;
  if (which === 'sell') {
    await r.capture(); await r.advance(400);
    await r.tap('.tile', 'Mecha'); await r.advance(190);
    await r.tap('.tile', 'Booster'); await r.advance(190);
    await r.tap('.tile', 'Booster'); await r.advance(190);
    await r.tap('.tile', 'Star Enamel'); await r.advance(330);
    r.mark('cartbar'); await r.tap('.cartbar'); await r.advance(850);
    r.mark('charge'); await r.tap('.btn.primary.lg.grow', 'Charge'); await r.advance(650);
    r.mark('ewallet'); await r.tap('.btn', 'E-wallet'); await r.advance(200);
    await r.tap('input.input.big'); await r.type('30', 110); await r.advance(250);
    r.mark('addpay'); await r.tap('.btn.primary.lg.block'); await r.advance(450);
    r.mark('cash'); await r.tap('.btn', 'Cash'); await r.advance(150);
    await r.tap('input.input.big'); await r.type('40', 110); await r.advance(450);
    r.mark('finish'); await r.tap('.btn.primary.lg.block'); await r.settle(500); await r.advance(750);
    r.mark('complete');
    await r.scroll('.sheet-body', 560, 650); await r.advance(350);
    await r.scroll('.sheet-body', 0, 380); await r.advance(120);
    r.mark('share'); await r.tap('.btn.grow', 'Share'); await r.advance(1000);
  } else if (which === 'lang') {
    await r.capture(); await r.advance(350);
    for (const code of ['zh-CN', 'ja', 'es']) {
      r.mark(code);
      await r.ev(`import('/src/i18n/index.ts').then(m=>m.setLangPref(${JSON.stringify(code)}))`);
      await r.settle(250);
      await r.advance(620);
    }
  } else if (which === 'reports') {
    await r.capture(); await r.advance(250);
    await r.tap('button', 'Reports'); await r.advance(500);
    r.mark('range'); await r.tap('.chip', '7 days'); await r.advance(550);
    r.mark('scroll'); await r.scroll('.page, .content, main, .scroll', 330, 600, 0).catch(() => {}); await r.advance(250);
  }
  const out = r.finish();
  console.log(which, 'frames', out.frames, 'dur', out.duration.toFixed(2), 'marks', JSON.stringify(Object.fromEntries(Object.entries(out.marks).map(([k, v]) => [k, +v.toFixed(2)]))));
  await c.evaluate(`localStorage.setItem('pocketpos.lang','en')`);
  await c.close();
}
