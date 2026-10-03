// Renders public/icon.svg into the PNG sizes the PWA manifest and the Android project need.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url));
const out = (n) => new URL(`../public/${n}`, import.meta.url).pathname;

await sharp(svg).resize(192, 192).png().toFile(out('icon-192.png'));
await sharp(svg).resize(512, 512).png().toFile(out('icon-512.png'));

// Maskable: full-bleed background with the glyph shrunk into the safe zone (inner 80%).
const glyph = await sharp(svg).resize(360, 360).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#0f766e' } })
  .composite([{ input: glyph, gravity: 'center' }])
  .png()
  .toFile(out('icon-maskable-512.png'));

// Sources for @capacitor/assets (Android adaptive launcher icon + splash screens) in ./assets.
const assets = (n) => new URL(`../assets/${n}`, import.meta.url).pathname;
const GLYPH = `<path d="M168 104h176a16 16 0 0 1 16 16v288l-24-16-24 16-24-16-24 16-24-16-24 16-24-16-24 16V120a16 16 0 0 1 16-16z" fill="#fff"/>
  <rect x="200" y="152" width="112" height="16" rx="8" fill="#0f766e"/><rect x="200" y="196" width="112" height="16" rx="8" fill="#99d5cf"/>
  <rect x="200" y="240" width="72" height="16" rx="8" fill="#99d5cf"/><circle cx="300" cy="320" r="30" fill="#0f766e"/>
  <path d="M287 320l9 9 18-20" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
const glyphSvg = (bg) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg ? `<rect width="512" height="512" fill="#0f766e"/>` : ''}${GLYPH}</svg>`);

await sharp(svg).resize(1024, 1024).png().toFile(assets('icon-only.png'));
// Adaptive icon: glyph sits inside the central ~66% safe zone so no launcher mask can clip it.
const fg = await sharp(glyphSvg(false)).resize(680, 680).png().toBuffer();
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: fg, gravity: 'center' }]).png().toFile(assets('icon-foreground.png'));
await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#0f766e' } }).png().toFile(assets('icon-background.png'));
const mark = await sharp(svg).resize(560, 560).png().toBuffer();
for (const [name, bg] of [['splash.png', '#0f766e'], ['splash-dark.png', '#0b1013']])
  await sharp({ create: { width: 2732, height: 2732, channels: 3, background: bg } }).composite([{ input: mark, gravity: 'center' }]).png().toFile(assets(name));
console.log('icons written');
