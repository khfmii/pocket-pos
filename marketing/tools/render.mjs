// node render.mjs <scratchpad> [--from=0] [--to=15] [--step=1] [--scale=1] [--out=dir]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep } from './chrome.mjs';
const opt0 = Object.fromEntries(process.argv.slice(3).map((a) => a.replace(/^--/, '').split('=')));
const PAGE = opt0.page ?? 'compose.html';
const TL = await import(opt0.page === 'compose30.html' ? './timeline30.mjs' : './timeline.mjs');
const { FPS, DUR } = TL;

const [, , SP, ...rest] = process.argv;
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, '').split('=')));
const from = +(opt.from ?? 0), to = +(opt.to ?? DUR), step = +(opt.step ?? 1), scale = +(opt.scale ?? 1);
const outDir = opt.out ?? `${SP}/frames`;
const HERE = path.dirname(new URL(import.meta.url).pathname);
const PUB = path.resolve(HERE, '../../public');
fs.mkdirSync(outDir, { recursive: true });

const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const file = u.startsWith('/takes/') ? path.join(SP, u) : u.startsWith('/public/') ? path.join(PUB, u.slice(8)) : path.join(HERE, u === '/' ? PAGE : u);
  fs.readFile(file, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }); res.end(d); } });
});
await new Promise((r) => server.listen(8123, r));

const c = await launch({ port: 9344, profile: `${SP}/prof-render`, width: 1080, height: 1920 });
await c.send('Page.enable'); await c.send('Runtime.enable');
await c.send('Emulation.setDeviceMetricsOverride', { width: 1080, height: 1920, deviceScaleFactor: scale, mobile: false });
await c.send('Page.navigate', { url: 'http://127.0.0.1:8123/' + PAGE + '' });
await sleep(800);
await c.evaluate('window.ready');
const t0 = Date.now();
let n = 0;
for (let f = Math.round(from * FPS); f < Math.round(to * FPS); f += step) {
  await c.evaluate(`window.renderAt(${f / FPS})`);
  const { data } = await c.send('Page.captureScreenshot', { format: 'jpeg', quality: 93 });
  fs.writeFileSync(`${outDir}/${String(f).padStart(4, '0')}.jpg`, Buffer.from(data, 'base64'));
  n++;
}
console.log(`rendered ${n} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${outDir}`);
await c.close(); server.close();
