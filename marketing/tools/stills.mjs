// node stills.mjs <scratchpad> : one Sell-screen still per demo shop (with two items in the cart) for the "any shop" montage.
import fs from 'node:fs';
import { launch, phone, sleep } from './chrome.mjs';
import { Recorder, prepare } from './vrecord.mjs';
import { seed } from './seed.mjs';
const SP = process.argv[2];
const PICK = { acg: ['Mecha', 'Booster'], cafe: ['Latte', 'Croissant'], fashion: ['Classic Tee', 'Baseball Cap'] };
for (const shop of Object.keys(PICK)) {
  const profile = `${SP}/prof-${shop}`;
  fs.rmSync(profile, { recursive: true, force: true });
  let c = await launch({ port: 9346, profile }); await phone(c);
  await c.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 30, bottom: 22, left: 0, right: 0 } });
  await c.send('Page.navigate', { url: 'http://localhost:5173/' }); await sleep(2500);
  console.log(shop, await seed(c, shop));
  await c.close();
  c = await launch({ port: 9347, profile }); await phone(c);
  await c.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 30, bottom: 22, left: 0, right: 0 } });
  await prepare(c);
  const r = new Recorder(c, `${SP}/takes/shop-${shop}`, { quality: 94 });
  await r.advance(200);
  for (const n of PICK[shop]) { await r.tap('.tile', n); await r.advance(250); }
  await r.advance(500);
  const last = r.k - 1;
  const out = r.finish();
  // keep only the final frame as the still
  const dir = `${SP}/takes/shop-${shop}`;
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.jpg') && f !== String(last).padStart(5, '0') + '.jpg') fs.rmSync(`${dir}/${f}`);
  fs.renameSync(`${dir}/${String(last).padStart(5, '0')}.jpg`, `${dir}/still.jpg`);
  await c.close();
}
