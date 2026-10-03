// Original 15 s promo track + SFX, synthesised in code (no samples, no licensing). 128 BPM = exactly 8 bars.
// node music.mjs <scratchpad>   -> <scratchpad>/audio.wav
import fs from 'node:fs';
import { DUR, SEGMENTS, takeToVideo } from './timeline.mjs';

const SP = process.argv[2];
const SR = 44100, N = Math.round(SR * DUR);
const L = new Float32Array(N), R = new Float32Array(N), SEND = new Float32Array(N), DUCKED = { L: new Float32Array(N), R: new Float32Array(N) };
const BPM = 128, BEAT = 60 / BPM, BAR = BEAT * 4;
let seed = 12345;
const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const noise = () => rnd() * 2 - 1;
const midi = (m) => 440 * 2 ** ((m - 69) / 12);
const TAU = Math.PI * 2;

// ---- mixing helpers ----
function put(arr, t, gain = 1, pan = 0, send = 0, duck = false) {
  const i0 = Math.round(t * SR), a = Math.cos(((pan + 1) * Math.PI) / 4) * gain, b = Math.sin(((pan + 1) * Math.PI) / 4) * gain;
  const [bl, br] = duck ? [DUCKED.L, DUCKED.R] : [L, R];
  for (let i = 0; i < arr.length; i++) {
    const k = i0 + i; if (k < 0 || k >= N) continue;
    bl[k] += arr[i] * a; br[k] += arr[i] * b; SEND[k] += arr[i] * send;
  }
}
const mk = (sec, fn) => { const n = Math.round(sec * SR), o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = fn(i / SR, i); return o; };
function lp1(fc) { const a = 1 - Math.exp((-TAU * fc) / SR); let y = 0; return (x) => (y += a * (x - y)); }
function hp1(fc) { const l = lp1(fc); return (x) => x - l(x); }
function bp(fc, q) { // RBJ biquad band-pass
  const w = (TAU * fc) / SR, al = Math.sin(w) / (2 * q), b0 = al, b2 = -al, a0 = 1 + al, a1 = -2 * Math.cos(w), a2 = 1 - al;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => { const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}
const saw = (ph) => 2 * (ph - Math.floor(ph + 0.5));

// ---- instruments ----
function kick() {
  let ph = 0;
  return mk(0.5, (t) => { ph += (TAU * (46 + 120 * Math.exp(-t * 30))) / SR; return (Math.sin(ph) * Math.exp(-t * 7.5) + (t < 0.003 ? noise() * 0.5 : 0)) * 0.95; });
}
function clap() {
  const f = bp(1500, 0.9);
  return mk(0.35, (t) => { const e = (t < 0.012 ? 1 : 0) + (t > 0.011 && t < 0.024 ? 0.9 : 0) + (t > 0.022 && t < 0.036 ? 0.8 : 0) + (t > 0.03 ? Math.exp(-(t - 0.03) * 16) : 0); return f(noise()) * e * 1.4; });
}
function hat(open) { const f = hp1(7500); return mk(open ? 0.25 : 0.07, (t) => f(noise()) * Math.exp(-t * (open ? 18 : 80)) * 0.6); }
function bass(freq, len) {
  const f = lp1(520); let ph = 0;
  return mk(len + 0.08, (t) => { ph += freq / SR; const env = Math.min(1, t / 0.006) * (t < len ? 1 : Math.exp(-(t - len) * 40)) * (0.55 + 0.45 * Math.exp(-t * 5)); return (Math.sin(TAU * ph) * 0.8 + f(saw(ph)) * 0.55) * env; });
}
function pluck(freq, len = 0.28) {
  let p1 = 0, p2 = 0, y = 0;
  return mk(len, (t) => {
    p1 += freq / SR; p2 += (freq * 1.006) / SR;
    const a = 1 - Math.exp((-TAU * (700 + 5200 * Math.exp(-t * 16))) / SR);
    y += a * ((saw(p1) + saw(p2)) * 0.5 - y);
    return y * Math.exp(-t * 9) * 0.9;
  });
}
function pad(freqs, len) {
  const f = lp1(1700), ph = freqs.flatMap((fr) => [0.997, 1, 1.004].map((d) => ({ fr: fr * d, p: rnd() })));
  return mk(len + 0.5, (t) => {
    let s = 0; for (const o of ph) { o.p += o.fr / SR; s += saw(o.p); }
    const env = Math.min(1, t / 0.35) * (t < len ? 1 : Math.exp(-(t - len) * 7));
    return f(s / ph.length) * env * 0.9;
  });
}
function bell(freq, len = 0.9, bright = 3) {
  return mk(len, (t) => { const idx = bright * Math.exp(-t * 7); return (Math.sin(TAU * freq * t + idx * Math.sin(TAU * freq * 3.5 * t)) * Math.exp(-t * 3.4) + 0.25 * Math.sin(TAU * freq * 2.005 * t) * Math.exp(-t * 6)) * Math.min(1, t / 0.002); });
}
function tick(hi = 1) { const f = hp1(2800); return mk(0.06, (t) => (f(noise()) * Math.exp(-t * 160) * 0.5 + Math.sin(TAU * 1700 * hi * t) * Math.exp(-t * 90) * 0.5)); }
function whoosh(len, up = true, width = 1) {
  const f = hp1(220); let y1 = 0, y2 = 0;
  return mk(len, (t) => { const p = t / len; const fc = up ? 250 * 20 ** p : 5200 * 0.06 ** p; const a = 1 - Math.exp((-TAU * fc) / SR); const x = f(noise()); y1 += a * (x - y1); y2 += a * (y1 - y2); return y2 * Math.sin(Math.PI * Math.min(1, p ** (up ? 1.6 : 0.6))) * 2.2 * width; });
}
function riser(len) {
  const f = hp1(300); let y1 = 0, y2 = 0;
  return mk(len, (t) => { const p = t / len; const fc = 300 + 9000 * p * p; const a = 1 - Math.exp((-TAU * fc) / SR); y1 += a * (f(noise()) - y1); y2 += a * (y1 - y2); return y2 * p * p * 2.4; });
}
function boom(len = 1.1) { let ph = 0; return mk(len, (t) => { ph += (TAU * (34 + 90 * Math.exp(-t * 14))) / SR; return Math.sin(ph) * Math.exp(-t * 3.2) * 1.1; }); }
function crash(len = 1.4) { const f = hp1(3800); return mk(len, (t) => f(noise()) * Math.exp(-t * 3.1) * 0.55); }

// ---- arrangement ----
const T = (beat) => beat * BEAT;
const CH = [ // bars 1..8
  { root: 36, notes: [60, 64, 67, 72] }, { root: 31, notes: [59, 62, 67, 71] }, { root: 33, notes: [60, 64, 69, 72] }, { root: 29, notes: [60, 65, 69, 72] },
  { root: 36, notes: [60, 64, 67, 72] }, { root: 31, notes: [59, 62, 67, 71] }, { root: 29, notes: [60, 65, 69, 72] }, { root: 36, notes: [60, 64, 67, 72] },
];
const GAP = [12.612, 12.656]; // brief silence before the end-card impact
const kickTimes = [];
const K = kick(), C = clap(), HC = hat(false), HO = hat(true);
for (let bar = 0; bar < 8; bar++) {
  const b0 = bar * 4, ch = CH[bar];
  const last = bar === 7, build = bar === 6;
  // drums
  for (let b = 0; b < 4; b++) {
    const t = T(b0 + b);
    if (t >= GAP[0] && t < GAP[1]) continue;
    if (last && b > 0) continue;
    if (bar === 0 && b % 2 === 1) continue;
    kickTimes.push(t); put(K, t, bar === 0 ? 0.7 : 0.95, 0);
    if (bar > 0 && !last && (b === 1 || b === 3)) { put(C, t, 0.55, 0.05, 0.12); }
  }
  if (bar > 0 && !last) for (let e = 0; e < 8; e++) {
    const t = T(b0 + e * 0.5), off = e % 2 === 1;
    if (t >= GAP[0] && t < GAP[1]) continue;
    put(off ? HO : HC, t, off ? 0.28 : 0.16, off ? 0.25 : -0.2);
  }
  // bass: 8ths, octave jumps; skipped in bar 1 / last
  if (bar > 0 && !last) for (let e = 0; e < 8; e++) {
    const t = T(b0 + e * 0.5); if (t >= GAP[0] && t < GAP[1]) continue;
    const oct = [0, 0, 12, 0, 0, 12, 0, 12][e];
    put(bass(midi(ch.root + oct), BEAT * 0.42), t, 0.62, 0, 0, true);
  }
  // 16th pluck arpeggio
  for (let s = 0; s < (last ? 8 : 16); s++) {
    const t = T(b0 + s * 0.25); if (t >= GAP[0] && t < GAP[1]) continue;
    const seq = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 1, 0, 1], n = ch.notes[seq[s]];
    put(pluck(midi(n + (s % 4 === 0 ? 12 : 0)), 0.26), t, last ? 0.15 : bar === 0 ? 0.24 : 0.2, ((s % 5) - 2) * 0.18, 0.25, true);
  }
  // pad
  put(pad(ch.notes.slice(0, 3).map((m) => midi(m - 12)), last ? BAR * 1.6 : BAR), T(b0), last ? 0.62 : 0.3, 0, 0.22, true);
  if (last) { put(bass(midi(36), 1.6), T(b0), 0.5, 0); put(pad(ch.notes.map((m) => midi(m)), BAR * 1.4), T(b0), 0.2, 0, 0.3, true); }
}
// melody (bells)
const MEL = [
  [16, 76], [16.5, 79], [17, 84], [17.5, 79], [18, 81], [18.5, 79], [19, 76], [19.5, 74],
  [20, 74], [20.5, 79], [21, 83], [21.5, 79], [22, 81], [22.5, 83], [23, 86], [23.5, 83],
  [24, 84], [24.5, 81], [25, 77], [25.5, 81], [26, 84], [26.5, 81],
];
for (const [b, m] of MEL) put(bell(midi(m), 0.7, 2.6), T(b), 0.2, ((m % 5) - 2) * 0.15, 0.35);
put(bell(midi(84), 1.8, 2.4), T(28), 0.3, -0.1, 0.45); put(bell(midi(88), 1.6, 2.4), T(30), 0.26, 0.1, 0.45);
put(bell(midi(91), 1.6, 2.4), T(30.5), 0.24, -0.1, 0.45); put(bell(midi(96), 2.0, 2.2), T(31), 0.22, 0.1, 0.5);

// build into the end-card hit
const IMPACT = 12.656;
put(riser(IMPACT - 11.25 - 0.04), 11.25, 0.5, 0, 0.1);
const rollStart = IMPACT - 1.2;
for (let t = rollStart, step = 0.234; t < IMPACT - 0.045; t += step, step = Math.max(0.06, step * 0.86)) put(C, t, 0.35 + 0.35 * ((t - rollStart) / 1.2), 0, 0.1);
put(boom(1.2), IMPACT, 0.9, 0); put(crash(1.6), IMPACT, 0.55, 0, 0.3); put(K, IMPACT, 1, 0);
put(whoosh(0.45, false), IMPACT, 0.35, 0);

// ---- SFX tied to the picture ----
const takes = Object.fromEntries(['sell', 'lang', 'reports'].map((n) => [n, JSON.parse(fs.readFileSync(`${SP}/takes/${n}/take.json`, 'utf8'))]));
const PENT = [76, 79, 81, 84, 86, 88, 91];
let tileN = 0;
for (const [name, tk] of Object.entries(takes)) for (const tp of tk.taps) {
  const v = takeToVideo(name, tp.t); if (v === null) continue;
  if (/^(Mecha|Booster|Star)/.test(tp.label)) { put(bell(midi(PENT[tileN++ % PENT.length] - 12), 0.5, 3.4), v, 0.34, 0, 0.3); put(tick(1.2), v, 0.35); }
  else put(tick(0.9 + (tp.x % 7) * 0.02), v, 0.5);
}
const finish = takes.sell.marks.finish, vDone = takeToVideo('sell', finish + 0.32);
if (vDone !== null) [72, 76, 79, 84].forEach((m, i) => put(bell(midi(m + 12), 1.0, 3.2), vDone + i * 0.055, 0.3, ((i % 2) - 0.5) * 0.4, 0.4));
put(whoosh(0.95, true), 0.0, 0.5, 0); put(boom(0.6), 0.84, 0.35, 0);
put(whoosh(0.4, true, 0.7), 1.68, 0.4, 0);
put(whoosh(0.3, true), 3.30, 0.28, 0); put(whoosh(0.35, true), 4.0, 0.3, 0); put(whoosh(0.35, true), 6.0, 0.35, 0);
put(whoosh(0.4, true), 8.28, 0.5, 0); put(boom(0.45), 8.672, 0.4, 0);
put(whoosh(0.35, true), 10.7, 0.45, 0); put(boom(0.4), 11.016, 0.35, 0);
put(whoosh(0.5, false), 12.4, 0.35, 0);

// ---- sidechain + reverb + master ----
const duck = new Float32Array(N).fill(1);
for (const t of kickTimes) { const i0 = Math.round(t * SR); for (let i = 0; i < 0.34 * SR && i0 + i < N; i++) duck[i0 + i] = Math.min(duck[i0 + i], 1 - 0.62 * Math.exp((-i / SR) / 0.11)); }
function reverb(x, seedOff) {
  const delays = [1557, 1617, 1491, 1422].map((d) => d + seedOff), fb = 0.8;
  const out = new Float32Array(N), bufs = delays.map((d) => new Float32Array(d)), idx = delays.map(() => 0);
  for (let i = 0; i < N; i++) { let s = 0; for (let k = 0; k < 4; k++) { const y = bufs[k][idx[k]]; s += y; bufs[k][idx[k]] = x[i] + y * fb * (1 - 0.35 * (k % 2)); if (++idx[k] >= delays[k]) idx[k] = 0; } out[i] = s * 0.22; }
  for (const d of [225 + seedOff, 556 + seedOff]) { const buf = new Float32Array(d); let j = 0; for (let i = 0; i < N; i++) { const y = buf[j]; const v = out[i] + y * 0.5; buf[j] = v; out[i] = y - v * 0.5; if (++j >= d) j = 0; } }
  return out;
}
const wetL = reverb(SEND, 0), wetR = reverb(SEND, 37);
const peakIn = { v: 0 };
for (let i = 0; i < N; i++) {
  const t = i / SR, fade = t > DUR - 0.5 ? Math.max(0, (DUR - t) / 0.5) : 1;
  let l = (L[i] + DUCKED.L[i] * duck[i] + wetL[i] * 1.0) * fade, r = (R[i] + DUCKED.R[i] * duck[i] + wetR[i] * 1.0) * fade;
  L[i] = Math.tanh(l * 0.95); R[i] = Math.tanh(r * 0.95);
  peakIn.v = Math.max(peakIn.v, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.89 / peakIn.v;
const pcm = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) { pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * norm)) * 32767), i * 4); pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * norm)) * 32767), i * 4 + 2); }
const hdr = Buffer.alloc(44);
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(pcm.length, 40);
fs.writeFileSync(`${SP}/audio.wav`, Buffer.concat([hdr, pcm]));
console.log(`audio.wav ${DUR}s, peak before norm ${peakIn.v.toFixed(2)}, kicks ${kickTimes.length}`);
