import { describe, expect, it } from 'vitest';
import { buildReport, costTime, dayInput, netProfitFrom, presetRange, startOfDay, totalCosts } from './report';
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

describe('net profit from the costs added', () => {
  const now = new Date(2026, 9, 2, 14, 0).getTime();
  const range = presetRange('today', now);

  it('is sales without tax (after refunds) minus the costs, and ignores the cost of the items sold', () => {
    const r = buildReport([mkOrder(now, [cl({ qty: 2, unitCost: 300 })])], [], [], range);
    expect(r.net).toBe(2200);
    expect(r.tax).toBe(200);
    expect(netProfitFrom(r, 0)).toBe(2000); // no costs added yet: every sale dollar (ex tax) is profit
    expect(netProfitFrom(r, 750)).toBe(1250);
    expect(r.profit).toBe(1400); // the other basis is untouched
  });

  it('can go negative when more was spent than sold', () => {
    const r = buildReport([mkOrder(now, [cl({})])], [], [], range);
    expect(netProfitFrom(r, 5000)).toBeLessThan(0);
    expect(netProfitFrom(buildReport([], [], [], range), 1200)).toBe(-1200); // costs but no sales
  });

  it('refunds reduce it like they reduce net sales', () => {
    const o = mkOrder(now, [cl({ qty: 2 })]);
    o.lines[0].refundedQty = 1;
    o.lines[0].refundedAmount = 1100;
    o.refunds = [{ id: 'r', at: now, by: '', lines: [{ lineId: o.lines[0].id, qty: 1, amount: 1100 }], amount: 1100, method: 'cash', reason: '', restock: false }];
    const r = buildReport([o], [], [], range);
    expect(netProfitFrom(r, 0)).toBe(r.net - r.tax);
    expect(r.net - r.tax).toBe(1000);
  });

  it('adds costs up', () => {
    expect(totalCosts([])).toBe(0);
    expect(totalCosts([{ amount: 500 }, { amount: 250 }])).toBe(750);
  });
});

describe('cost dates', () => {
  it('a cost entered for a day is stored at that day’s noon, inside that day’s report range', () => {
    const at = costTime('2026-10-02');
    expect(new Date(at).getHours()).toBe(12);
    const range = presetRange('today', new Date(2026, 9, 2, 9, 0).getTime());
    expect(at >= range.from && at <= range.to).toBe(true);
    const yesterday = presetRange('yesterday', new Date(2026, 9, 3, 9, 0).getTime());
    expect(at >= yesterday.from && at <= yesterday.to).toBe(true);
  });

  it('round-trips through the date input in local time', () => {
    expect(dayInput(new Date(2026, 0, 5, 23, 30).getTime())).toBe('2026-01-05'); // late evening stays the same day
    expect(dayInput(costTime('2026-12-31'))).toBe('2026-12-31');
    expect(startOfDay(costTime('2026-03-08'))).toBe(new Date(2026, 2, 8).getTime());
  });
});
