import { locale } from '../i18n';
import type { Category, Expense, Order, PayMethod, Product } from './types';

export interface RangeKey {
  from: number;
  to: number;
}

export interface Report {
  orders: number;
  gross: number; // sum of order totals (incl. tax)
  refunds: number;
  net: number; // gross - refunds
  tax: number; // tax net of refunded share
  discounts: number;
  items: number;
  avgOrder: number;
  profit: number; // net revenue ex-tax minus cost, after refunds
  byBucket: { label: string; key: number; net: number; orders: number }[];
  topProducts: { name: string; qty: number; net: number }[];
  byCategory: { name: string; net: number }[];
  byMethod: { method: PayMethod; amount: number }[];
}

const DAY = 86_400_000;

export const startOfDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function presetRange(preset: 'today' | 'yesterday' | '7d' | '30d' | 'month', now = Date.now()): RangeKey {
  const today = startOfDay(now);
  switch (preset) {
    case 'today':
      return { from: today, to: today + DAY - 1 };
    case 'yesterday':
      return { from: today - DAY, to: today - 1 };
    case '7d':
      return { from: today - 6 * DAY, to: today + DAY - 1 };
    case '30d':
      return { from: today - 29 * DAY, to: today + DAY - 1 };
    case 'month': {
      const d = new Date(now);
      return { from: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), to: today + DAY - 1 };
    }
  }
}

export function buildReport(orders: Order[], products: Product[], categories: Category[], range: RangeKey, now = Date.now()): Report {
  const live = orders.filter((o) => o.status !== 'void' && o.at >= range.from && o.at <= range.to);
  const catOf = new Map(products.map((p) => [p.id, p.categoryId]));
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const hourly = range.to - range.from <= DAY;

  let gross = 0, refunds = 0, tax = 0, discounts = 0, items = 0, profit = 0;
  const buckets = new Map<number, { net: number; orders: number }>();
  const prod = new Map<string, { name: string; qty: number; net: number }>();
  const cats = new Map<string, number>();
  const methods = new Map<PayMethod, number>();

  for (const o of live) {
    const refunded = o.refunds.reduce((a, r) => a + r.amount, 0);
    const net = o.total - refunded;
    gross += o.total;
    refunds += refunded;
    discounts += o.orderDiscount + o.lines.reduce((a, l) => a + l.discount, 0);

    const key = hourly ? new Date(o.at).setMinutes(0, 0, 0) : startOfDay(o.at);
    const b = buckets.get(key) ?? { net: 0, orders: 0 };
    b.net += net;
    b.orders += 1;
    buckets.set(key, b);

    for (const p of o.payments) methods.set(p.method, (methods.get(p.method) ?? 0) + p.amount);
    for (const r of o.refunds) methods.set(r.method, (methods.get(r.method) ?? 0) - r.amount);

    for (const l of o.lines) {
      const keep = (l.qty - l.refundedQty) / l.qty;
      const keptQty = l.qty - l.refundedQty;
      const keptTotal = l.total - l.refundedAmount;
      const keptTax = Math.round(l.tax * keep);
      tax += keptTax;
      items += keptQty;
      profit += keptTotal - keptTax - l.unitCost * keptQty;
      const name = l.variantName ? `${l.name} (${l.variantName})` : l.name;
      const k = l.productId + '|' + l.variantId;
      const cur = prod.get(k) ?? { name, qty: 0, net: 0 };
      cur.qty += keptQty;
      cur.net += keptTotal;
      prod.set(k, cur);
      const cn = catName.get(catOf.get(l.productId) ?? '') ?? 'Uncategorised';
      cats.set(cn, (cats.get(cn) ?? 0) + keptTotal);
    }
  }

  // Fill gaps so charts show empty days/hours instead of skipping them.
  const step = hourly ? 3_600_000 : DAY;
  const start = hourly ? new Date(range.from).setMinutes(0, 0, 0) : startOfDay(range.from);
  const byBucket: Report['byBucket'] = [];
  const last = Math.min(range.to, now + step);
  for (let t = start; t <= last; t += step) {
    const key = hourly ? t : startOfDay(t);
    const b = buckets.get(key);
    byBucket.push({
      key,
      net: b?.net ?? 0,
      orders: b?.orders ?? 0,
      label: hourly ? new Date(key).toLocaleTimeString(locale.value, { hour: 'numeric' }) : new Date(key).toLocaleDateString(locale.value, { day: 'numeric', month: 'short' }),
    });
  }

  const net = gross - refunds;
  return {
    orders: live.length,
    gross,
    refunds,
    net,
    tax,
    discounts,
    items,
    avgOrder: live.length ? Math.round(net / live.length) : 0,
    profit,
    byBucket,
    topProducts: [...prod.values()].filter((p) => p.qty > 0).sort((a, b) => b.net - a.net).slice(0, 10),
    byCategory: [...cats.entries()].map(([name, n]) => ({ name, net: n })).filter((c) => c.net > 0).sort((a, b) => b.net - a.net),
    byMethod: [...methods.entries()].map(([method, amount]) => ({ method, amount })).filter((m) => m.amount !== 0).sort((a, b) => b.amount - a.amount),
  };
}

// ---------- costs the shop added, for the "net profit" option ----------

export const totalCosts = (costs: Pick<Expense, 'amount'>[]): number => costs.reduce((a, c) => a + c.amount, 0);

/** Net profit from the costs added: sales without tax (after refunds), minus those costs. */
export const netProfitFrom = (r: Pick<Report, 'net' | 'tax'>, costs: number): number => r.net - r.tax - costs;

const pad2 = (n: number) => String(n).padStart(2, '0');
/** A day as an `<input type="date">` reads it (local time). */
export const dayInput = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
/** The timestamp a cost on that day is stored with: local noon, so it stays inside that day whatever the timezone. */
export const costTime = (day: string): number => new Date(`${day}T12:00:00`).getTime();
