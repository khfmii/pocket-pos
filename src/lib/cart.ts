import type { Adjustment, CartLine, CartState, Order, OrderLine, Payment } from './types';

export interface TaxConfig {
  rate: number; // percent
  inclusive: boolean;
}

export interface ComputedLine {
  gross: number;
  discount: number;
  orderDiscountShare: number;
  tax: number;
  total: number;
}

export interface CartTotals {
  lines: ComputedLine[];
  itemCount: number;
  subtotal: number; // after line discounts, before order discount
  orderDiscount: number;
  tax: number;
  total: number;
}

/** Splits `total` across `weights` so the parts sum exactly to `total` (largest remainder). */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (total === 0 || sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; left > 0 && k < order.length; k++, left--) out[order[k].i] += 1;
  return out;
}

export function adjustmentAmount(adj: Adjustment | null, base: number): number {
  if (!adj || base <= 0) return 0;
  const v = adj.type === 'percent' ? Math.round((base * Math.min(adj.value, 100)) / 100) : adj.value;
  return Math.max(0, Math.min(v, base));
}

/** What a line costs before discounts: a custom item total if one was set, else qty × price. */
export const lineGross = (l: Pick<CartLine, 'qty' | 'unitPrice' | 'lineTotal'>): number =>
  l.lineTotal != null ? Math.max(0, l.lineTotal) : l.qty * l.unitPrice;

export function computeCart(cart: Pick<CartState, 'lines' | 'discount'>, tax: TaxConfig): CartTotals {
  const gross = cart.lines.map(lineGross);
  const lineDisc = cart.lines.map((l, i) => adjustmentAmount(l.discount, gross[i]));
  const net = gross.map((g, i) => g - lineDisc[i]);
  const subtotal = net.reduce((a, b) => a + b, 0);
  const orderDiscount = adjustmentAmount(cart.discount, subtotal);
  const shares = allocate(orderDiscount, net);
  const after = net.map((n, i) => n - shares[i]);

  const rate = tax.rate / 100;
  const pool = cart.lines.map((l, i) => (l.taxable ? after[i] : 0));
  const poolSum = pool.reduce((a, b) => a + b, 0);
  const taxTotal =
    rate <= 0 || poolSum <= 0
      ? 0
      : tax.inclusive
        ? Math.round(poolSum - poolSum / (1 + rate))
        : Math.round(poolSum * rate);
  const lineTax = allocate(taxTotal, pool);

  const lines = cart.lines.map((_, i) => ({
    gross: gross[i],
    discount: lineDisc[i],
    orderDiscountShare: shares[i],
    tax: lineTax[i],
    total: after[i] + (tax.inclusive ? 0 : lineTax[i]),
  }));
  return {
    lines,
    itemCount: cart.lines.reduce((a, l) => a + l.qty, 0),
    subtotal,
    orderDiscount,
    tax: taxTotal,
    total: subtotal - orderDiscount + (tax.inclusive ? 0 : taxTotal),
  };
}

export function toOrderLines(lines: CartLine[], totals: CartTotals): OrderLine[] {
  return lines.map((l, i) => ({
    id: l.id,
    productId: l.productId,
    variantId: l.variantId,
    name: l.name,
    variantName: l.variantName,
    sku: l.sku,
    qty: l.qty,
    unitPrice: l.unitPrice,
    unitCost: l.unitCost,
    taxable: l.taxable,
    note: l.note,
    ...totals.lines[i],
    refundedQty: 0,
    refundedAmount: 0,
  }));
}

/** Amount to give back for refunding `qty` more units of a line; the final unit absorbs rounding. */
export function refundAmountFor(line: OrderLine, qty: number): number {
  const remaining = line.qty - line.refundedQty;
  if (qty >= remaining) return line.total - line.refundedAmount;
  return Math.round((line.total * qty) / line.qty);
}

export function orderNetOfRefunds(o: Pick<Order, 'total' | 'refunds' | 'status'>): number {
  if (o.status === 'void') return 0;
  return o.total - o.refunds.reduce((a, r) => a + r.amount, 0);
}

/** Money already taken on an order that was set aside part-paid. */
export const depositSum = (paid?: Payment[]): number => (paid ?? []).reduce((a, p) => a + p.amount, 0);

/**
 * Deposits can outgrow the order when items are taken off after they were paid. The excess comes off the most recent
 * deposits first and is handed back to the customer; what is kept still covers at most the total.
 */
export function settleDeposits(paid: Payment[], total: number): { kept: Payment[]; returned: Payment[] } {
  let over = depositSum(paid) - total;
  if (over <= 0) return { kept: paid, returned: [] };
  const kept = paid.map((p) => ({ ...p }));
  const returned: Payment[] = [];
  for (let i = kept.length - 1; i >= 0 && over > 0; i--) {
    const cut = Math.min(kept[i].amount, over);
    over -= cut;
    returned.push({ ...kept[i], amount: cut, tendered: cut });
    kept[i].amount -= cut;
    kept[i].tendered = kept[i].amount;
  }
  return { kept: kept.filter((p) => p.amount > 0), returned };
}

/** What a set-aside order is called in the pending list: who it is for, else its note (a table number, say), else the first items. */
export function pendingLabel(c: Pick<CartState, 'lines' | 'note'>, customerName: string): string {
  const note = c.note.trim().split('\n')[0].slice(0, 60);
  return customerName.trim() || note || c.lines.map((l) => l.name).slice(0, 2).join(', ');
}
