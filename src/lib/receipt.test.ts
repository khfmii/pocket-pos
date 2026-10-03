import { describe, expect, it } from 'vitest';
import { buildReceipt, depositSlip, receiptText, sampleOrder } from './receipt';
import { defaultSettings } from './store';
import type { CartLine, CartState, Order, OrderLine, Settings } from './types';

const line = (over: Partial<OrderLine> = {}): OrderLine => ({
  id: 'l', productId: 'p', variantId: '', name: 'Item', variantName: '', sku: '', qty: 1, unitPrice: 500, unitCost: 0,
  taxable: true, note: '', gross: 500, discount: 0, orderDiscountShare: 0, tax: 0, total: 500, refundedQty: 0, refundedAmount: 0, ...over,
});

const AT = new Date(2026, 9, 2, 14, 30).getTime();

const order = (over: Partial<Order> = {}): Order => ({
  id: 'o1', updatedAt: 1, number: '#0042', seq: 42, at: AT, shiftId: '', userId: 'u', userName: 'Amy', customerId: '', customerName: '',
  lines: [], subtotal: 0, orderDiscount: 0, orderDiscountAdj: null, tax: 0, total: 0, taxName: 'VAT', taxRate: 10, taxInclusive: false,
  payments: [], change: 0, status: 'paid', refunds: [], note: '', pointsEarned: 0, pointsRedeemed: 0, ...over,
});

const shop = (over: Partial<Settings> = {}): Settings => ({
  ...defaultSettings(), storeName: 'Corner Café', address: '12 High Street\nSpringfield', phone: '555-0100', taxId: 'TX-99',
  receiptHeader: 'Open daily 8–8', receiptFooter: 'Thank you!', paperWidth: 58, ...over,
});

/** A busy receipt: variant, line discount, custom price, note, CJK name, tax, split payment, refund, points. */
const busy = () =>
  order({
    customerName: 'Bob',
    lines: [
      line({ name: 'Latte', variantName: 'Large', qty: 2, unitPrice: 450, gross: 900, discount: 90, total: 810 }),
      line({ name: '抹茶蛋糕 Matcha cake', qty: 1, unitPrice: 600, gross: 600, note: 'no nuts please' }),
      line({ name: 'Bagels', qty: 12, unitPrice: 300, gross: 3000 }), // 12 × 3.00 would be 36.00, so this is a custom price
      line({ name: 'Cookies', qty: 3, unitPrice: 200, gross: 600 }),
    ],
    subtotal: 5000, orderDiscount: 100, tax: 490, total: 5390, taxInclusive: false,
    payments: [{ method: 'cash', amount: 3000, tendered: 4000 }, { method: 'card', amount: 2390, tendered: 2390 }],
    change: 1000,
    refunds: [{ id: 'r', at: AT + 86_400_000, by: 'u', lines: [], amount: 450, method: 'cash', reason: '', restock: false }],
    pointsEarned: 53, pointsRedeemed: 20,
  });

describe('receiptText', () => {
  const stamp = new Date(AT).toLocaleString('en');
  const refundDay = new Date(AT + 86_400_000).toLocaleDateString('en');

  it('lays out a full receipt (58 mm)', () => {
    expect(receiptText(busy(), shop())).toBe(
      [
        '          Corner Café',
        '         12 High Street',
        '          Springfield',
        '          Tel 555-0100',
        '          Tax ID TX-99',
        '         Open daily 8–8',
        '--------------------------------',
        'Receipt #0042',
        stamp,
        'Served by Amy',
        'Customer: Bob',
        '--------------------------------',
        'Latte (Large)',
        '  2 x $4.50                $9.00',
        '  Discount                -$0.90',
        '抹茶蛋糕 Matcha cake',
        '  1 x $6.00                $6.00',
        '  * no nuts please',
        'Bagels',
        '  12 x custom price       $30.00',
        'Cookies',
        '  3 x $2.00                $6.00',
        '--------------------------------',
        'Subtotal                  $50.00',
        'Discount                  -$1.00',
        'VAT 10%                    $4.90',
        'TOTAL                     $53.90',
        '--------------------------------',
        'Cash                      $40.00',
        'Card                      $23.90',
        'Change                    $10.00',
        '--------------------------------',
        `Refund ${refundDay}          -$4.50`,
        '--------------------------------',
        'Points earned: 53',
        'Points used: 20',
        '--------------------------------',
        '           Thank you!',
      ].join('\n'),
    );
  });

  it('wraps to the wider 80 mm paper', () => {
    const text = receiptText(order({ lines: [line({ name: 'A rather long item name that needs more than one line to print' })], subtotal: 500, total: 500 }), shop({ paperWidth: 80 }));
    const rows = text.split('\n');
    expect(Math.max(...rows.map((r) => r.length))).toBeLessThanOrEqual(48);
    expect(rows).toContain('A rather long item name that needs more than one');
    expect(rows).toContain('line to print');
  });

  it('marks voided receipts and skips empty header fields', () => {
    const text = receiptText(order({ status: 'void', lines: [line()], subtotal: 500, total: 500 }), shop({ address: '', phone: '', taxId: '', receiptHeader: '', receiptFooter: '' }));
    expect(text.split('\n')[0].trim()).toBe('Corner Café');
    expect(text.split('\n')[1]).toMatch(/^-+$/);
    expect(text).toContain('*** VOIDED ***');
    expect(text.trimEnd().endsWith('*** VOIDED ***')).toBe(true);
  });
});

describe('deposits', () => {
  it('a deposit taken before the sale was finished says so on the receipt', () => {
    const o = order({
      lines: [line({ gross: 1200, total: 1200 })], subtotal: 1200, total: 1200,
      payments: [{ method: 'cash', amount: 500, tendered: 500, deposit: true }, { method: 'card', amount: 700, tendered: 700 }],
    });
    const text = receiptText(o, shop());
    expect(text).toMatch(/Cash \(deposit\)\s+\$5\.00/);
    expect(text).toMatch(/Card\s+\$7\.00/);
  });
});

describe('deposit slip', () => {
  const cartLine = (over: Partial<CartLine> = {}): CartLine => ({
    id: 'c1', productId: 'p', variantId: '', name: 'Birthday cake', variantName: '', sku: '', unitPrice: 12000, unitCost: 0, taxable: false,
    qty: 1, discount: null, note: '', ...over,
  });
  const pending = (over: Partial<CartState> = {}) => ({
    createdAt: AT + 5000,
    cart: { lines: [cartLine()], discount: null, customerId: 'c', note: 'Pick-up Sat 10am', paid: [{ method: 'cash' as const, amount: 5000, tendered: 5000, deposit: true, at: AT }], ...over } as CartState,
  });

  it('is the order with its deposits and what is still owed, dated when the money was taken', () => {
    const o = depositSlip(pending(), shop({ taxRate: 0 }), { customerName: 'Mei', userName: 'Amy' });
    expect(o.total).toBe(12000);
    expect(o.pending).toEqual({ balance: 7000 });
    expect(o.at).toBe(AT); // the deposit's time, not when it was set aside
    expect(o.payments).toHaveLength(1);
    expect(o.customerName).toBe('Mei');
  });

  it('never shows a negative balance when the deposit exceeds a reduced total', () => {
    const o = depositSlip(pending({ lines: [cartLine({ unitPrice: 3000 })] }), shop({ taxRate: 0 }), { customerName: '', userName: '' });
    expect(o.pending!.balance).toBe(0);
  });

  it('prints as a deposit receipt with the balance, not as a sale', () => {
    const text = receiptText(depositSlip(pending(), shop({ taxRate: 0 }), { customerName: 'Mei', userName: 'Amy' }), shop({ taxRate: 0 }));
    expect(text).toContain('Deposit receipt');
    expect(text).not.toContain('Receipt #');
    expect(text).toContain('Order: Pick-up Sat 10am');
    expect(text).toMatch(/Cash \(deposit\)\s+\$50\.00/);
    expect(text).toMatch(/Paid so far\s+\$50\.00/);
    expect(text).toMatch(/Balance due\s+\$70\.00/);
    expect(text).toContain('Not a final receipt');
  });

  it('an ordinary receipt is unchanged', () => {
    const text = receiptText(order({ lines: [line()], subtotal: 500, total: 500, payments: [{ method: 'cash', amount: 500, tendered: 500 }] }), shop());
    expect(text).not.toContain('Deposit');
    expect(text).not.toContain('Balance due');
  });
});

describe('shop details on the receipt', () => {
  const details = shop({ email: 'hello@corner.cafe', website: '@cornercafe', logo: 'data:image/png;base64,AAAA' });

  it('prints email and website under the phone, in text', () => {
    const rows = receiptText(order({ lines: [line()], subtotal: 500, total: 500 }), details).split('\n');
    const i = rows.findIndex((r) => r.includes('Tel 555-0100'));
    expect(rows[i + 1].trim()).toBe('hello@corner.cafe');
    expect(rows[i + 2].trim()).toBe('@cornercafe');
    expect(rows[i + 3].trim()).toBe('Tax ID TX-99');
  });

  it('puts the logo first in the block list, and only when one is set', () => {
    const o = order({ lines: [line()], subtotal: 500, total: 500 });
    expect(buildReceipt(o, details)[0]).toEqual({ k: 'logo' });
    expect(buildReceipt(o, shop())[0]).toMatchObject({ k: 'text', text: 'Corner Café' });
    expect(buildReceipt(o, shop()).some((b) => b.k === 'logo')).toBe(false);
  });

  it('plain text never contains the logo data', () => {
    expect(receiptText(order({ lines: [line()], subtotal: 500, total: 500 }), details)).not.toContain('base64');
  });
});

describe('sampleOrder', () => {
  it('is internally consistent for exclusive, inclusive and zero tax', () => {
    for (const [taxRate, taxInclusive] of [[0, false], [10, false], [10, true], [6.5, false]] as const) {
      const s = shop({ taxRate, taxInclusive });
      const o = sampleOrder(s);
      expect(o.subtotal).toBe(o.lines.reduce((a, l) => a + l.gross, 0));
      expect(o.total).toBe(taxInclusive ? o.subtotal : o.subtotal + o.tax);
      expect(o.payments[0].tendered - o.total).toBe(o.change);
      expect(o.change).toBeGreaterThanOrEqual(0);
      expect(receiptText(o, s)).toContain('TOTAL');
    }
  });

  it('works for currencies without decimals and uses the next receipt number', () => {
    const s = shop({ currency: 'JPY', currencyDecimals: 0, receiptPrefix: 'INV-', receiptNext: 7 });
    const o = sampleOrder(s);
    expect(o.number).toBe('INV-0007');
    expect(o.lines[0].unitPrice).toBe(380); // ¥380 — not a ¥4 latte
  });
});

