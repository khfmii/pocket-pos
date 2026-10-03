// node cloneseed.mjs <scratchpad> : export the seeded web profile, import it into the emulator's app, reload.
import fs from 'node:fs';
import { launch, phone, sleep } from './chrome.mjs';
import { exportDb, importDb } from './dbclone.mjs';
import { connect } from './android.mjs';
const SP = process.argv[2];
const w = await launch({ port: 9345, profile: `${SP}/prof-app` });
await phone(w);
await w.send('Page.navigate', { url: 'http://localhost:5173/' }); await sleep(2500);
const json = await exportDb(w);
fs.writeFileSync(`${SP}/db-export.json`, json);
await w.close();
console.log('exported', (json.length / 1024).toFixed(0), 'KB');
const a = await connect(); await a.send('Runtime.enable'); await a.send('Page.enable');
console.log(await importDb(a, json));
await a.evaluate(`localStorage.setItem('pocketpos.lang','en'); localStorage.removeItem('pocketpos.cart'); location.reload()`);
await sleep(3500);
console.log(await a.evaluate(`document.body.innerText.slice(0,120).replace(/\\n/g,' | ')`));
await a.close();
