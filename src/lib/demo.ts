import { t } from '../i18n';
import { computeCart, toOrderLines } from './cart';
import { uid } from './crypto';
import { put, getAll } from './db';
import { recipeCost } from './recipe';
import type { CartLine, Customer, Ingredient, Order, Product, Settings } from './types';

const CATS = [
  { name: () => t('Coffee'), emoji: '☕' },
  { name: () => t('Tea & Drinks'), emoji: '🧋' },
  { name: () => t('Bakery'), emoji: '🥐' },
  { name: () => t('Snacks'), emoji: '🍫' },
];

// [name, category index, price, cost, emoji, stock (0 = untracked)]
const ITEMS: [() => string, number, number, number, string, number][] = [
  [() => t('Espresso'), 0, 250, 60, '☕', 0],
  [() => t('Latte'), 0, 380, 90, '🥛', 0],
  [() => t('Cappuccino'), 0, 380, 90, '☕', 0],
  [() => t('Iced Americano'), 0, 320, 50, '🧊', 0],
  [() => t('Green Tea'), 1, 280, 40, '🍵', 0],
  [() => t('Bubble Tea'), 1, 450, 130, '🧋', 0],
  [() => t('Orange Juice'), 1, 350, 110, '🍊', 24],
  [() => t('Bottled Water'), 1, 150, 40, '💧', 48],
  [() => t('Croissant'), 2, 300, 100, '🥐', 18],
  [() => t('Blueberry Muffin'), 2, 320, 110, '🧁', 12],
  [() => t('Bagel'), 2, 280, 80, '🥯', 15],
  [() => t('Cheesecake Slice'), 2, 520, 190, '🍰', 8],
  [() => t('Chocolate Bar'), 3, 220, 90, '🍫', 40],
  [() => t('Potato Chips'), 3, 250, 100, '🥔', 30],
  [() => t('Granola Bar'), 3, 200, 80, '🌾', 3],
  [() => t('Cookie'), 3, 180, 50, '🍪', 20],
];

export async function loadSampleData() {
  const existing = await getAll('products');
  if (existing.length) return; // never mix sample items into a real catalogue

  const catIds: string[] = [];
  for (const [i, c] of CATS.entries()) {
    const id = uid();
    catIds.push(id);
    await put('categories', { id, updatedAt: 0, name: c.name(), emoji: c.emoji, sort: i });
  }
  // Ingredients so the recipe-costing feature has something to show: espresso drinks are costed from them.
  const ingredients: Ingredient[] = [];
  for (const [name, unit, packSize, packCost] of [
    [t('Coffee beans'), 'kg', 1, 2400],
    [t('Fresh milk'), 'l', 1, 180],
    [t('Paper cup'), 'pcs', 50, 600],
  ] as const)
    ingredients.push(await put('ingredients', { id: uid(), updatedAt: 0, name, unit, packSize, packCost, note: '', createdAt: Date.now() }));
  const [beans, milk, cups] = ingredients;
  const RECIPES: Record<number, { beansG: number; milkMl: number }> = { 0: { beansG: 18, milkMl: 0 }, 1: { beansG: 18, milkMl: 200 }, 2: { beansG: 18, milkMl: 150 } };

  const products: Product[] = [];
  for (const [i, [nameOf, cat, price, cost0, emoji, stock]] of ITEMS.entries()) {
    const name = nameOf();
    const r = RECIPES[i];
    const recipeBits = r
      ? {
          costMode: 'recipe' as const,
          recipeYield: 1,
          recipe: [
            { ingredientId: beans.id, qty: r.beansG, unit: 'g' as const },
            ...(r.milkMl ? [{ ingredientId: milk.id, qty: r.milkMl, unit: 'ml' as const }] : []),
            { ingredientId: cups.id, qty: 1, unit: 'pcs' as const },
          ],
        }
      : {};
    const cost = r ? recipeCost(recipeBits, ingredients).perItem : cost0;
    products.push(
      await put('products', {
        ...recipeBits,
        id: uid(), updatedAt: 0, name, categoryId: catIds[cat], price, cost, sku: `SKU${String(i + 1).padStart(3, '0')}`,
        barcode: `20000000${String(i + 1).padStart(4, '0')}`, emoji, color: '', taxable: true, trackStock: stock > 0, stock,
        lowStock: 5,
        variants: i === 1 || i === 2 ? [{ id: uid(), name: t('Large'), price: price + 60, barcode: '' }] : [],
        active: true, createdAt: Date.now(),
      }),
    );
  }
  const customers: Customer[] = [];
  for (const [name, phone] of [['Alex Tan', '555-0101'], ['Maya Lopez', '555-0102'], ['Sam Okoro', '555-0103']]) {
    customers.push(await put('customers', { id: uid(), updatedAt: 0, name, phone, email: '', note: '', points: 0, createdAt: Date.now() }));
  }

  // Two weeks of plausible history so Reports isn't empty on first look.
  const s = (await getAll('settings'))[0] as Settings;
  let seq = s.receiptNext;
  const rnd = mulberry(42);
  const now = Date.now();
  for (let day = 13; day >= 0; day--) {
    const n = 6 + Math.floor(rnd() * 9);
    for (let k = 0; k < n; k++) {
      const at = new Date(now - day * 86_400_000);
      at.setHours(8 + Math.floor(rnd() * 11), Math.floor(rnd() * 60), 0, 0);
      if (at.getTime() > now) continue;
      const lines: CartLine[] = [];
      for (let j = 0, m = 1 + Math.floor(rnd() * 3); j < m; j++) {
        const p = products[Math.floor(rnd() * products.length)];
        lines.push({
          id: uid(), productId: p.id, variantId: '', name: p.name, variantName: '', sku: p.sku, unitPrice: p.price,
          unitCost: p.cost, taxable: p.taxable, qty: 1 + Math.floor(rnd() * 2), discount: null, note: '',
        });
      }
      const t = computeCart({ lines, discount: null }, { rate: s.taxRate, inclusive: s.taxInclusive });
      const method = (['cash', 'card', 'card', 'ewallet'] as const)[Math.floor(rnd() * 4)];
      const c = rnd() < 0.2 ? customers[Math.floor(rnd() * customers.length)] : undefined;
      const order: Order = {
        id: uid(), updatedAt: at.getTime(), number: `${s.receiptPrefix}${String(seq).padStart(4, '0')}`, seq: seq++,
        at: at.getTime(), shiftId: '', userId: '', userName: 'Owner', customerId: c?.id ?? '', customerName: c?.name ?? '',
        lines: toOrderLines(lines, t), subtotal: t.subtotal, orderDiscount: 0, orderDiscountAdj: null, tax: t.tax,
        total: t.total, taxName: s.taxName, taxRate: s.taxRate, taxInclusive: s.taxInclusive,
        payments: [{ method, amount: t.total, tendered: t.total }], change: 0, status: 'paid', refunds: [], note: '',
        pointsEarned: 0, pointsRedeemed: 0,
      };
      await put('orders', order);
    }
  }
  await put('settings', { ...s, receiptNext: seq });
}

function mulberry(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
