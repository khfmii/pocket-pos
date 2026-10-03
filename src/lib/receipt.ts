import { locale, t } from '../i18n';
import { formatMoney } from './money';
import type { ItemName } from './names';
import { computeCart, depositSum, toOrderLines } from './cart';
import type { CartState, Order, OrderLine, PayMethod, Payment, Settings } from './types';

/** A payment as it reads on a receipt or list: a deposit taken before the sale was finished says so. */
export const payLine = (p: Pick<Payment, 'method' | 'deposit'>): string => (p.deposit ? t('{method} (deposit)', { method: payLabel(p.method) }) : payLabel(p.method));

export function payLabel(m: PayMethod): string {
  switch (m) {
    case 'cash':
      return t('Cash');
    case 'card':
      return t('Card');
    case 'ewallet':
      return t('E-wallet');
    case 'points':
      return t('Points');
    default:
      return t('Other');
  }
}

// Receipts are monospaced text. CJK / fullwidth characters take two columns, so alignment must count them as 2.
const isWide = (cp: number) =>
  (cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3) ||
  (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe30 && cp <= 0xfe6f) || (cp >= 0xff00 && cp <= 0xff60) || (cp >= 0xffe0 && cp <= 0xffe6);

export function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += isWide(ch.codePointAt(0)!) ? 2 : 1;
  return w;
}

const center = (s: string, w: number) => {
  const sw = textWidth(s);
  return sw >= w ? s : ' '.repeat(Math.floor((w - sw) / 2)) + s;
};

function clip(s: string, w: number): string {
  let out = '';
  let used = 0;
  for (const ch of s) {
    const cw = isWide(ch.codePointAt(0)!) ? 2 : 1;
    if (used + cw > w) break;
    out += ch;
    used += cw;
  }
  return out;
}

function row(left: string, right: string, w: number) {
  const gap = w - textWidth(left) - textWidth(right);
  if (gap >= 1) return left + ' '.repeat(gap) + right;
  return clip(left, Math.max(0, w - textWidth(right) - 1)) + ' ' + right;
}

/** Greedy wrap that also breaks long unspaced runs (CJK, URLs) by display width. */
function wrap(text: string, w: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let cur = '';
    const tokens = para.match(/[^\s⺀-꓏가-힣＀-｠]+|[⺀-꓏가-힣＀-｠]|\s+/gu) ?? [];
    for (const tok of tokens) {
      const piece = /^\s+$/.test(tok) ? ' ' : tok;
      if (textWidth(cur + piece) <= w) {
        cur += piece;
        continue;
      }
      if (cur.trim()) out.push(cur.trimEnd());
      cur = '';
      let rest = piece.trimStart();
      while (textWidth(rest) > w) {
        const head = clip(rest, w);
        out.push(head);
        rest = rest.slice(head.length);
      }
      cur = rest;
    }
    out.push(cur.trimEnd());
  }
  return out;
}

// ---------- one receipt model, three renderers (plain text here, on-screen HTML, image/PDF canvas) ----------

export type ReceiptSize = 'sm' | 'md' | 'lg' | 'xl';

export type Block =
  | { k: 'logo' }
  | { k: 'text'; text: string; center?: boolean; size?: ReceiptSize; bold?: boolean; indent?: boolean }
  | { k: 'row'; left: string; right: string; size?: ReceiptSize; bold?: boolean; indent?: boolean }
  | { k: 'rule' };

/** Everything that appears on a receipt, in order. Renderers only decide how it looks. */
export function buildReceipt(o: Order, s: Settings, nameOf?: (l: OrderLine) => ItemName): Block[] {
  const m = (n: number) => formatMoney(n, s);
  const b: Block[] = [];
  const text = (t_: string, extra: Partial<Extract<Block, { k: 'text' }>> = {}) => b.push({ k: 'text', text: t_, ...extra });
  const row = (left: string, right: string, extra: Partial<Extract<Block, { k: 'row' }>> = {}) => b.push({ k: 'row', left, right, ...extra });

  if (s.logo) b.push({ k: 'logo' });
  text(s.storeName, { center: true, size: 'xl', bold: true });
  for (const x of [s.address, s.phone && t('Tel {phone}', { phone: s.phone }), s.email, s.website, s.taxId && t('Tax ID {id}', { id: s.taxId }), s.receiptHeader])
    if (x) text(x, { center: true, size: 'sm' });
  b.push({ k: 'rule' });
  text(o.pending ? t('Deposit receipt') : t('Receipt {number}', { number: o.number }), { bold: true });
  if (o.pending && o.note.trim()) text(t('Order: {name}', { name: o.note.trim() }), { size: 'sm' }); // a table number, say
  text(new Date(o.at).toLocaleString(locale.value), { size: 'sm' });
  if (o.userName) text(t('Served by {name}', { name: o.userName }), { size: 'sm' });
  if (o.customerName) text(t('Customer: {name}', { name: o.customerName }), { size: 'sm' });
  b.push({ k: 'rule' });
  for (const l of o.lines) {
    const nm = nameOf?.(l) ?? { main: l.name };
    text(l.variantName ? `${nm.main} (${l.variantName})` : nm.main);
    if (nm.sub) text(nm.sub, { indent: true, size: 'sm' }); // the original name under a translated one
    const custom = l.gross !== l.qty * l.unitPrice;
    row(custom ? `${l.qty} x ${t('custom price')}` : `${l.qty} x ${m(l.unitPrice)}`, m(l.gross), { indent: true, size: 'sm' });
    if (l.discount) row(t('Discount'), `-${m(l.discount)}`, { indent: true, size: 'sm' });
    if (l.note) text(`* ${l.note}`, { indent: true, size: 'sm' });
  }
  b.push({ k: 'rule' });
  row(t('Subtotal'), m(o.subtotal));
  if (o.orderDiscount) row(t('Discount'), `-${m(o.orderDiscount)}`);
  if (o.tax) row(`${o.taxName} ${o.taxRate}%${o.taxInclusive ? ` ${t('(incl.)')}` : ''}`, m(o.tax));
  row(t('TOTAL'), m(o.total), { bold: true, size: 'lg' });
  b.push({ k: 'rule' });
  for (const p of o.payments) row(payLine(p), m(p.method === 'cash' ? p.tendered : p.amount));
  if (o.change) row(t('Change'), m(o.change));
  if (o.pending) {
    row(t('Paid so far'), m(depositSum(o.payments)));
    row(t('Balance due'), m(o.pending.balance), { bold: true, size: 'lg' });
    b.push({ k: 'rule' });
    text(t('Not a final receipt. A full receipt is issued when the balance is paid.'), { center: true, size: 'sm' });
  }
  if (o.refunds.length) {
    b.push({ k: 'rule' });
    for (const r of o.refunds) row(`${t('Refund')} ${new Date(r.at).toLocaleDateString(locale.value)}`, `-${m(r.amount)}`);
  }
  if (o.status === 'void') text(t('*** VOIDED ***'), { center: true, bold: true, size: 'lg' });
  if (o.pointsEarned || o.pointsRedeemed) {
    b.push({ k: 'rule' });
    if (o.pointsEarned) text(t('Points earned: {n}', { n: o.pointsEarned }), { size: 'sm' });
    if (o.pointsRedeemed) text(t('Points used: {n}', { n: o.pointsRedeemed }), { size: 'sm' });
  }
  if (s.receiptFooter) {
    b.push({ k: 'rule' });
    text(s.receiptFooter, { center: true });
  }
  return b;
}

/** Monospace rendering for chat apps and thermal printers. The logo can't be shown in plain text. */
export function receiptText(o: Order, s: Settings): string {
  const w = s.paperWidth === 80 ? 48 : 32;
  const out: string[] = [];
  for (const blk of buildReceipt(o, s)) {
    if (blk.k === 'rule') out.push('-'.repeat(w));
    else if (blk.k === 'row') out.push(row(`${blk.indent ? '  ' : ''}${blk.left}`, blk.right, w));
    else if (blk.k === 'text') {
      const raw = `${blk.indent ? '  ' : ''}${blk.text}`;
      // Short single lines go out untouched; long or multi-line text is wrapped to the paper width.
      const lines = !raw.includes('\n') && textWidth(raw) <= w ? [raw] : wrap(raw, w);
      out.push(...(blk.center ? lines.map((l) => center(l, w)) : lines));
    }
  }
  return out.join('\n');
}

/** A made-up sale in the shop's own currency, tax and numbering — used to preview the receipt template. */
export function sampleOrder(s: Settings): Order {
  const unit = 10 ** s.currencyDecimals;
  const big = s.currencyDecimals === 0 ? 100 : 1; // whole-unit currencies (yen, won…) have larger prices
  const items = [
    { name: t('Latte'), qty: 2, price: Math.round(3.8 * unit * big) },
    { name: t('Croissant'), qty: 1, price: Math.round(3 * unit * big) },
  ];
  const subtotal = items.reduce((a, i) => a + i.qty * i.price, 0);
  const tax = s.taxRate ? Math.round(s.taxInclusive ? (subtotal * s.taxRate) / (100 + s.taxRate) : (subtotal * s.taxRate) / 100) : 0;
  const total = subtotal + (s.taxInclusive ? 0 : tax);
  const step = 5 * unit * big;
  const tendered = Math.ceil(total / step) * step; // next round amount of cash
  return {
    id: 'sample', updatedAt: 0, number: `${s.receiptPrefix}${String(s.receiptNext).padStart(4, '0')}`, seq: s.receiptNext, at: Date.now(),
    shiftId: '', userId: '', userName: '', customerId: '', customerName: '',
    lines: items.map((i, n) => ({
      id: String(n), productId: '', variantId: '', name: i.name, variantName: '', sku: '', qty: i.qty, unitPrice: i.price, unitCost: 0,
      taxable: true, note: '', gross: i.qty * i.price, discount: 0, orderDiscountShare: 0, tax: 0, total: i.qty * i.price, refundedQty: 0, refundedAmount: 0,
    })),
    subtotal, orderDiscount: 0, orderDiscountAdj: null, tax, total, taxName: s.taxName, taxRate: s.taxRate, taxInclusive: s.taxInclusive,
    payments: [{ method: 'cash', amount: total, tendered }], change: tendered - total, status: 'paid', refunds: [], note: '', pointsEarned: 0, pointsRedeemed: 0,
  };
}

/**
 * The made-up order a deposit slip is drawn from: a pending order's items and totals, its deposits as the payments, and
 * what is still owed. It is never stored; it only lets the receipt renderers (screen, image, PDF, printer) draw the slip.
 */
export function depositSlip(p: { createdAt: number; cart: CartState }, s: Settings, who: { customerName: string; userName: string }): Order {
  const tot = computeCart(p.cart, { rate: s.taxRate, inclusive: s.taxInclusive });
  const payments = p.cart.paid ?? [];
  const taken = Math.max(0, ...payments.map((x) => x.at ?? 0)) || p.createdAt; // when the latest deposit was received
  return {
    id: 'deposit-slip', updatedAt: 0, number: '', seq: 0, at: taken, shiftId: '', userId: '', userName: who.userName,
    customerId: p.cart.customerId, customerName: who.customerName, lines: toOrderLines(p.cart.lines, tot),
    subtotal: tot.subtotal, orderDiscount: tot.orderDiscount, orderDiscountAdj: p.cart.discount, tax: tot.tax, total: tot.total,
    taxName: s.taxName, taxRate: s.taxRate, taxInclusive: s.taxInclusive, payments, change: 0, status: 'paid', refunds: [],
    note: p.cart.note, pointsEarned: 0, pointsRedeemed: 0,
    pending: { balance: Math.max(0, tot.total - depositSum(payments)) },
  };
}
