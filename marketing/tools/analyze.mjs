import fs from 'node:fs';
const b = fs.readFileSync(process.argv[2]);
const n = (b.length - 44) / 4, SR = 44100;
const x = new Float32Array(n * 2);
for (let i = 0; i < n * 2; i++) x[i] = b.readInt16LE(44 + i * 2) / 32768;
let peak = 0, hot = 0, sum = 0;
for (const v of x) { peak = Math.max(peak, Math.abs(v)); if (Math.abs(v) > 0.8) hot++; sum += v * v; }
console.log('peak', peak.toFixed(3), 'rms dBFS', (10 * Math.log10(sum / x.length)).toFixed(1), 'samples >0.8:', (100 * hot / x.length).toFixed(2) + '%');
const row = [];
for (let t = 0; t < n / SR; t += 0.5) {
  let s = 0, p = 0, c = 0;
  for (let i = Math.floor(t * SR); i < Math.min(n, Math.floor((t + 0.5) * SR)); i++) { const v = x[i * 2]; s += v * v; p = Math.max(p, Math.abs(v)); c++; }
  row.push(`${t.toFixed(1)}s ${(10 * Math.log10(s / c + 1e-12)).toFixed(0)}dB pk${p.toFixed(2)}`);
}
console.log(row.join(' | '));
