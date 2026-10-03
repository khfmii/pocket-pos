import { describe, expect, it } from 'vitest';
import { buildReport, presetRange } from './report';
import { computeCart, toOrderLines } from './cart';
import type { CartLine, Order } from './types';

const cl = (over: Partial<CartLine>): CartLine => ({
  id: 'l' + Math.random(), productId: 'p1', variantId: '', name: 'Latte', variantName: '', sku: '', unitPrice: 1000,
  unitCost: 300, taxable: true, qty: 1, discount: null, note: '', ...over,
});

function mkOrder(at: number, lines: CartLine[], over: Partial<Order> = {}): Order {
  const t = computeCart({ lines, discount: null }, { rate: 10, inclusive: false });
  return {
    id: 'o' + Math.random(), updatedAt: at, number: '#1', seq: 1, at, shiftId: '', userId: '', userName: '', customerId: '',
    customerName: '', lines: toOrderLines(lines, t), subtotal: t.subtotal, orderDiscount: 0, orderDiscountAdj: null,
    tax: t.tax, total: t.total, taxName: 'Tax', taxRate: 10, taxInclusive: false,
    payments: [{ method: 'cash', amount: t.total, tendered: t.total }], change: 0, status: 'paid', refunds: [], note: '',
    pointsEarned: 0, pointsRedeemed: 0, ...over,
  };
}

describe('buildReport', () => {
  const now = new Date(2026, 9, 2, 14, 0).getTime();
  const range = presetRange('today', now);

  it('totals sales, tax and profit (tax is not profit)', () => {
    const r = buildReport([mkOrder(now, [cl({ qty: 2 })])], [], [], range);
    expect(r.gross).toBe(2200);
    expect(r.tax).toBe(200);
    expect(r.profit).toBe(2000 - 600); // ex-tax revenue minus cost
    expect(r.orders).toBe(1);
    expect(r.items).toBe(2);
  });

  it('excludes voids and out-of-range orders', () => {
    const r = buildReport(
      [mkOrder(now, [cl({})]), mkOrder(now, [cl({})], { status: 'void' }), mkOrder(now - 3 * 86_400_000, [cl({})])],
      [], [], range,
    );
    expect(r.orders).toBe(1);
  });

  it('subtracts refunds from net, items, tax and profit', () => {
    const o = mkOrder(now, [cl({ qty: 2 })]);
    o.lines[0].refundedQty = 1;
    o.lines[0].refundedAmount = 1100;
    o.refunds = [{ id: 'r', at: now, by: '', lines: [{ lineId: o.lines[0].id, qty: 1, amount: 1100 }], amount: 1100, method: 'cash', reason: '', restock: true }];
    o.status = 'partial';
    const r = buildReport([o], [], [], range);
    expect(r.net).toBe(1100);
    expect(r.items).toBe(1);
    expect(r.tax).toBe(100);
    expect(r.profit).toBe(1000 - 300);
    expect(r.byMethod).toEqual([{ method: 'cash', amount: 1100 }]);
  });

  it('buckets a single day by hour and a week by day, with empty gaps filled', () => {
    expect(buildReport([], [], [], range, now).byBucket.length).toBeGreaterThan(1);
    expect(buildReport([], [], [], presetRange('7d', now), now).byBucket.length).toBe(7);
  });
});
