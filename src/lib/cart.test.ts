import { describe, expect, it } from 'vitest';
import { allocate, computeCart, depositSum, pendingLabel, refundAmountFor, settleDeposits, toOrderLines } from './cart';
import { parseMoney, quickCash } from './money';
import type { CartLine, Payment } from './types';

const line = (over: Partial<CartLine> = {}): CartLine => ({
  id: Math.random().toString(36),
  productId: 'p',
  variantId: '',
  name: 'Item',
  variantName: '',
  sku: '',
  unitPrice: 1000,
  unitCost: 400,
  taxable: true,
  qty: 1,
  discount: null,
  note: '',
  ...over,
});

describe('allocate', () => {
  it('always sums exactly to the total', () => {
    for (const [total, weights] of [
      [100, [1, 1, 1]],
      [1, [5, 5, 5]],
      [999, [333, 333, 334]],
      [7, [0, 3, 0, 9]],
    ] as [number, number[]][]) {
      expect(allocate(total, weights).reduce((a, b) => a + b, 0)).toBe(total);
    }
  });
  it('returns zeros when there is nothing to split over', () => {
    expect(allocate(50, [0, 0])).toEqual([0, 0]);
  });
});

describe('computeCart', () => {
  it('adds tax on top when exclusive', () => {
    const t = computeCart({ lines: [line({ qty: 2 })], discount: null }, { rate: 10, inclusive: false });
    expect(t.subtotal).toBe(2000);
    expect(t.tax).toBe(200);
    expect(t.total).toBe(2200);
  });

  it('extracts tax from the price when inclusive', () => {
    const t = computeCart({ lines: [line({ unitPrice: 1100 })], discount: null }, { rate: 10, inclusive: true });
    expect(t.total).toBe(1100);
    expect(t.tax).toBe(100);
  });

  it('skips tax-exempt lines', () => {
    const t = computeCart(
      { lines: [line(), line({ taxable: false })], discount: null },
      { rate: 10, inclusive: false },
    );
    expect(t.tax).toBe(100);
    expect(t.total).toBe(2100);
  });

  it('applies line then order discounts before tax', () => {
    const t = computeCart(
      {
        lines: [line({ qty: 2, discount: { type: 'percent', value: 10 } })], // 2000 - 200
        discount: { type: 'amount', value: 300 },
      },
      { rate: 10, inclusive: false },
    );
    expect(t.subtotal).toBe(1800);
    expect(t.orderDiscount).toBe(300);
    expect(t.tax).toBe(150); // (1800-300)*10%
    expect(t.total).toBe(1650);
  });

  it('never discounts below zero', () => {
    const t = computeCart(
      { lines: [line({ discount: { type: 'amount', value: 99999 } })], discount: { type: 'percent', value: 500 } },
      { rate: 10, inclusive: false },
    );
    expect(t.total).toBe(0);
    expect(t.tax).toBe(0);
  });

  it('keeps per-line figures consistent with order totals', () => {
    const cart = {
      lines: [line({ unitPrice: 333 }), line({ unitPrice: 333, qty: 3 }), line({ unitPrice: 101, taxable: false })],
      discount: { type: 'percent', value: 7 } as const,
    };
    for (const inclusive of [false, true]) {
      const t = computeCart(cart, { rate: 8.25, inclusive });
      expect(t.lines.reduce((a, l) => a + l.total, 0)).toBe(t.total);
      expect(t.lines.reduce((a, l) => a + l.tax, 0)).toBe(t.tax);
      expect(t.lines.reduce((a, l) => a + l.orderDiscountShare, 0)).toBe(t.orderDiscount);
    }
  });
});

describe('refundAmountFor', () => {
  it('refunds the full line to the cent across partial refunds', () => {
    const cart = { lines: [line({ unitPrice: 333, qty: 3 })], discount: null };
    const t = computeCart(cart, { rate: 8.25, inclusive: false });
    const [ol] = toOrderLines(cart.lines, t);
    let refunded = 0;
    for (let i = 0; i < 3; i++) {
      const amt = refundAmountFor(ol, 1);
      refunded += amt;
      ol.refundedQty += 1;
      ol.refundedAmount += amt;
    }
    expect(refunded).toBe(ol.total);
  });
});

describe('money helpers', () => {
  it('parses user-typed amounts', () => {
    expect(parseMoney('12.5', 2)).toBe(1250);
    expect(parseMoney('12,50', 2)).toBe(1250);
    expect(parseMoney('1,234.00', 2)).toBe(123400);
    expect(parseMoney('abc', 2)).toBe(0);
    expect(parseMoney('500', 0)).toBe(500);
  });
  it('suggests cash amounts that cover the bill', () => {
    const s = quickCash(1730, 2);
    expect(s[0]).toBe(1730);
    expect(s.every((v) => v >= 1730)).toBe(true);
    expect(s).toContain(2000);
  });
});

describe('custom item totals', () => {
  it('replaces qty × price for that line only, and tax/discounts apply to the custom amount', () => {
    const t = computeCart(
      { lines: [line({ qty: 3, unitPrice: 1000, lineTotal: 2500 }), line({ qty: 1, unitPrice: 500 })], discount: null },
      { rate: 10, inclusive: false },
    );
    expect(t.lines[0].gross).toBe(2500);
    expect(t.subtotal).toBe(3000);
    expect(t.total).toBe(3300);
  });

  it('a discount applies on top of the custom total', () => {
    const t = computeCart(
      { lines: [line({ qty: 1, unitPrice: 1000, lineTotal: 800, discount: { type: 'percent', value: 10 } })], discount: null },
      { rate: 0, inclusive: false },
    );
    expect(t.total).toBe(720);
  });

  it('can be set below list price or to zero, never negative', () => {
    expect(computeCart({ lines: [line({ lineTotal: 0 })], discount: null }, { rate: 10, inclusive: false }).total).toBe(0);
    expect(computeCart({ lines: [line({ lineTotal: -50 })], discount: null }, { rate: 0, inclusive: false }).total).toBe(0);
  });
});

describe('deposits on a pending order', () => {
  const dep = (amount: number, method: Payment['method'] = 'cash'): Payment => ({ method, amount, tendered: amount, deposit: true });

  it('adds up what was paid so far', () => {
    expect(depositSum(undefined)).toBe(0);
    expect(depositSum([dep(500), dep(250, 'card')])).toBe(750);
  });

  it('keeps every deposit while they still fit the total', () => {
    const paid = [dep(500), dep(250, 'card')];
    expect(settleDeposits(paid, 750)).toEqual({ kept: paid, returned: [] });
    expect(settleDeposits(paid, 5000).returned).toEqual([]);
  });

  it('hands the excess back from the newest deposit first, never more than was paid', () => {
    const r = settleDeposits([dep(500), dep(300, 'card')], 600);
    expect(r.kept).toEqual([dep(500), dep(100, 'card')]);
    expect(r.returned).toEqual([dep(200, 'card')]);
    const all = settleDeposits([dep(500), dep(300, 'card')], 100); // card is returned in full, then part of the cash
    expect(all.kept).toEqual([dep(100)]);
    expect(all.returned).toEqual([dep(300, 'card'), dep(400)]);
    expect(settleDeposits([dep(500)], 0)).toEqual({ kept: [], returned: [dep(500)] });
  });

  it('does not touch the deposits it was given', () => {
    const paid = [dep(500), dep(300)];
    settleDeposits(paid, 100);
    expect(paid).toEqual([dep(500), dep(300)]);
  });
});

describe('pending order names', () => {
  const c = (note: string) => ({ note, lines: [line({ name: 'Latte' }), line({ name: 'Bagel' }), line({ name: 'Tea' })] });

  it('is the customer, else the first line of the note, else the first two items', () => {
    expect(pendingLabel(c('Table 4'), ' Mei ')).toBe('Mei');
    expect(pendingLabel(c('Table 4\ngift wrap'), '')).toBe('Table 4');
    expect(pendingLabel(c('  '), '')).toBe('Latte, Bagel');
  });
});
