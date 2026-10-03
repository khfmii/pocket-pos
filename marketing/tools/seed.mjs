// Seeds a demo shop (see shops.mjs) into the dev app's IndexedDB through the app's own modules.
import { SHOPS } from './shops.mjs';
import { sleep } from './chrome.mjs';

const PAGE = String.raw`(async (ART, LOGO, SHOP) => {
  const dbm = await import('/src/lib/db.ts');
  const { uid } = await import('/src/lib/crypto.ts');
  const { computeCart, toOrderLines } = await import('/src/lib/cart.ts');
  const store = await import('/src/lib/store.ts');
  const { put, getAll } = dbm;

  const img = (svg, size, type, q) => new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, size, size); x.drawImage(im, 0, 0, size, size); res(c.toDataURL(type, q)); };
    im.onerror = rej; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });

  const logo = await img(LOGO, 160, 'image/png');
  await store.saveSettings({ ...SHOP.settings, logo });
  await store.saveUser({ name: 'Mika', role: 'owner', pin: '' });

  const cid = {};
  for (const [i, [name, emoji]] of SHOP.cats.entries()) { const id = uid(); cid[name] = id; await put('categories', { id, updatedAt: 0, name, emoji, sort: i }); }

  const prods = [];
  for (const [i, [key, name, cat, price, cost, stock, names]] of SHOP.items.entries()) {
    const image = await img(ART[key], 360, 'image/jpeg', 0.9);
    prods.push(await put('products', {
      id: uid(), updatedAt: 0, name, categoryId: cid[cat], price, cost, sku: 'PP' + String(i + 1).padStart(3, '0'),
      barcode: '88000000' + String(i + 1).padStart(4, '0'), emoji: '', color: '', taxable: true, trackStock: stock > 0, stock, lowStock: 5,
      variants: [], active: true, createdAt: Date.now(), image, ...(names ? { names, namesAuto: Object.keys(names) } : {}),
    }));
  }
  const custs = [];
  for (const [name, phone, note] of SHOP.customers)
    custs.push(await put('customers', { id: uid(), updatedAt: 0, name, phone, email: '', note, points: 0, createdAt: Date.now() }));

  if (!SHOP.history) { await store.loadAll(); return { products: prods.length, orders: 0 }; }

  // Two weeks of believable sales: busier weekends and evenings, gently rising.
  const s = (await getAll('settings'))[0];
  let seq = s.receiptNext || 1;
  let r = 7;
  const rnd = () => { r |= 0; r = (r + 0x6d2b79f5) | 0; let t = Math.imul(r ^ (r >>> 15), 1 | r); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const weights = SHOP.weights;
  const wsum = weights.reduce((a, b) => a + b, 0);
  const pick = () => { let x = rnd() * wsum; for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x <= 0) return prods[i]; } return prods[0]; };
  const hourW = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 3, 3, 4, 6, 8, 9, 9, 7, 4, 0, 0, 0];
  const hsum = hourW.reduce((a, b) => a + b, 0);
  const hour = () => { let x = rnd() * hsum; for (let h = 0; h < 24; h++) { x -= hourW[h]; if (x <= 0) return h; } return 18; };
  const now = Date.now();
  for (let day = 13; day >= 0; day--) {
    const d0 = new Date(now - day * 86400000);
    const weekend = [0, 6].includes(d0.getDay());
    const n = Math.round((5 + (13 - day) * 1.5 + (weekend ? 2 : 0)) * (0.94 + rnd() * 0.12));
    for (let k = 0; k < n; k++) {
      const at = new Date(d0); at.setHours(hour(), Math.floor(rnd() * 60), 0, 0);
      if (at.getTime() > now) continue;
      const lines = [];
      for (let j = 0, m = 1 + Math.floor(rnd() * 3); j < m; j++) {
        const p = pick();
        lines.push({ id: uid(), productId: p.id, variantId: '', name: p.name, variantName: '', sku: p.sku, unitPrice: p.price, unitCost: p.cost, taxable: true, qty: 1 + (rnd() < 0.25 ? 1 : 0), discount: null, note: '' });
      }
      const t = computeCart({ lines, discount: null }, { rate: s.taxRate, inclusive: s.taxInclusive });
      const method = ['cash', 'card', 'ewallet', 'ewallet'][Math.floor(rnd() * 4)];
      const c = rnd() < 0.18 ? custs[Math.floor(rnd() * custs.length)] : undefined;
      await put('orders', {
        id: uid(), updatedAt: at.getTime(), number: s.receiptPrefix + String(seq).padStart(4, '0'), seq: seq++, at: at.getTime(), shiftId: '', userId: '', userName: 'Mika',
        customerId: c ? c.id : '', customerName: c ? c.name : '', lines: toOrderLines(lines, t), subtotal: t.subtotal, orderDiscount: 0, orderDiscountAdj: null, tax: t.tax,
        total: t.total, taxName: s.taxName, taxRate: s.taxRate, taxInclusive: s.taxInclusive, payments: [{ method, amount: t.total, tendered: t.total }], change: 0,
        status: 'paid', refunds: [], note: '', pointsEarned: 0, pointsRedeemed: 0,
      });
    }
  }
  await put('settings', { ...(await getAll('settings'))[0], receiptNext: seq });
  await store.loadAll();
  return { products: prods.length, orders: seq - 1 };
})`;

export async function seed(c, shop = 'acg') {
  const d = SHOPS[shop];
  const out = await c.evaluate(`${PAGE}(${JSON.stringify(d.art)}, ${JSON.stringify(d.logo)}, ${JSON.stringify({ history: d.history, settings: d.settings, cats: d.cats, items: d.items, weights: d.weights, customers: d.customers })})`);
  await sleep(200);
  return out;
}
