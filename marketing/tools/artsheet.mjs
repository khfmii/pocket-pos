// node artsheet.mjs <scratchpad> : contact sheet of every product illustration (each as its own <img>, so gradient ids don't clash)
import { launch, shot, sleep } from './chrome.mjs';
import { ART } from './art.mjs';
import { CAFE, FASHION, LOGO_CAFE, LOGO_FASHION } from './art2.mjs';
import fs from 'node:fs';
const SP = process.argv[2];
const all = [...Object.values(ART), ...Object.values(CAFE), LOGO_CAFE, ...Object.values(FASHION), LOGO_FASHION];
const html = `<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(6,200px);gap:6px;padding:6px">${all.map((s) => `<img width="200" height="200" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}">`).join('')}</body>`;
fs.writeFileSync(`${SP}/artsheet2.html`, html);
const c = await launch({ port: 9340, profile: `${SP}/prof-art`, width: 1260, height: 1100 });
await c.send('Page.enable');
await c.send('Page.navigate', { url: `file://${SP}/artsheet2.html` });
await sleep(900);
await shot(c, `${SP}/artsheet2.png`);
await c.close();
