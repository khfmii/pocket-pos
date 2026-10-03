import { describe, expect, it } from 'vitest';
import type { Block } from './receipt';
import { fitLogo, layoutReceipt, RECEIPT_WIDTH, wrapText, type Measure, type Op } from './receiptImage';

// 10 units per character, 20 per CJK character — enough to exercise wrapping without a canvas.
const measure: Measure = (s) => [...s].reduce((w, ch) => w + (ch.codePointAt(0)! > 0x2e80 ? 20 : 10), 0);
const texts = (ops: Op[]) => ops.filter((o): o is Extract<Op, { t: 'text' }> => o.t === 'text');

describe('wrapText', () => {
  it('breaks at spaces and never exceeds the width', () => {
    const lines = wrapText('the quick brown fox jumps over the lazy dog', 150, 'x', measure);
    expect(lines.length).toBeGreaterThan(2);
    for (const l of lines) expect(measure(l, 'x')).toBeLessThanOrEqual(150);
    expect(lines.join(' ')).toBe('the quick brown fox jumps over the lazy dog');
  });

  it('breaks an unbroken run (URL, long word) by character instead of overflowing', () => {
    const lines = wrapText('www.averyveryverylongshopwebsite.example.com', 120, 'x', measure);
    for (const l of lines) expect(measure(l, 'x')).toBeLessThanOrEqual(120);
    expect(lines.join('')).toBe('www.averyveryverylongshopwebsite.example.com');
  });

  it('wraps CJK text that has no spaces, and keeps explicit newlines', () => {
    const lines = wrapText('抹茶蛋糕和巧克力蛋糕套餐优惠\n第二行', 100, 'x', measure);
    for (const l of lines) expect(measure(l, 'x')).toBeLessThanOrEqual(100);
    expect(lines.join('')).toBe('抹茶蛋糕和巧克力蛋糕套餐优惠第二行');
    expect(lines.length).toBeGreaterThan(2);
  });
});

describe('layoutReceipt', () => {
  const blocks: Block[] = [
    { k: 'text', text: 'Corner Café', center: true, size: 'xl', bold: true },
    { k: 'rule' },
    { k: 'text', text: 'Latte (Large)' },
    { k: 'row', left: '2 x $4.50', right: '$9.00', indent: true, size: 'sm' },
    { k: 'rule' },
    { k: 'row', left: 'TOTAL', right: '$9.00', bold: true, size: 'lg' },
  ];

  it('stacks blocks top to bottom inside the page', () => {
    const { ops, height } = layoutReceipt(blocks, { measure });
    const ys = ops.map((o) => o.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys.slice().sort((a, b) => a - b));
    expect(Math.max(...ys)).toBeLessThan(height);
    expect(height).toBeGreaterThan(150);
  });

  it('right-aligns amounts to the right margin and centres headings', () => {
    const { ops } = layoutReceipt(blocks, { measure });
    const t = texts(ops);
    expect(t.find((o) => o.text === 'Corner Café')).toMatchObject({ align: 'center', x: RECEIPT_WIDTH / 2 });
    const amount = t.filter((o) => o.text === '$9.00');
    expect(amount).toHaveLength(2);
    for (const a of amount) expect(a).toMatchObject({ align: 'right', x: RECEIPT_WIDTH - 22 });
    // the amount sits on the same line as its description
    expect(amount[0].y).toBe(t.find((o) => o.text === '2 x $4.50')!.y);
  });

  it('long descriptions wrap without touching the amount column', () => {
    const { ops } = layoutReceipt([{ k: 'row', left: 'An extremely long description of a thing', right: '$123.45' }], { measure });
    const t = texts(ops);
    const amount = t.find((o) => o.text === '$123.45')!;
    const left = t.filter((o) => o.align === 'left');
    expect(left.length).toBeGreaterThan(1);
    for (const l of left) expect(l.x + measure(l.text, '') + 12).toBeLessThanOrEqual(amount.x - measure(amount.text, ''));
  });

  it('places the logo centred above everything and skips it when there is none', () => {
    const withLogo = layoutReceipt([{ k: 'logo' }, ...blocks], { measure, logo: { w: 480, h: 240 } });
    const logo = withLogo.ops[0];
    expect(logo).toMatchObject({ t: 'logo', y: 22 });
    const { w, h } = fitLogo(480, 240);
    expect(logo).toMatchObject({ w, h, x: Math.round((RECEIPT_WIDTH - w) / 2) });
    expect(withLogo.height).toBeGreaterThan(layoutReceipt(blocks, { measure }).height + h);
    expect(layoutReceipt([{ k: 'logo' }, ...blocks], { measure, logo: null }).ops.some((o) => o.t === 'logo')).toBe(false);
  });

  it('keeps small logos at their size and shrinks big ones to fit', () => {
    expect(fitLogo(64, 64)).toEqual({ w: 64, h: 64 });
    const big = fitLogo(1000, 1000);
    expect(big.h).toBeLessThanOrEqual(96);
    expect(big.w).toBe(big.h);
  });
});
