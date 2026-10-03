import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createBackup, decodeBackup, encodeBackup } from './backup';
import { closeDb, getAll } from './db';
import {
  applyRestore, cart, checkout, completeSetup, defaultSettings, loadAll, products, refundOrder, saveCustomer, saveProduct,
  saveSettings, settings, signIn, users, session, blankProduct, blankCustomer, addToCart, customers, voidOrder,
} from './store';

async function wipe() {
  await closeDb();
  await new Promise<void>((res) => {
    const r = indexedDB.deleteDatabase('pocket-pos');
    r.onsuccess = r.onerror = r.onblocked = () => res();
  });
  cart.value = { lines: [], discount: null, customerId: '', note: '' };
  session.value = null;
  settings.value = defaultSettings();
}

async function setupShop() {
  await loadAll();
  await completeSetup({ storeName: 'Corner Shop', taxRate: 10 }, { name: 'Owner', pin: '1234' }, false);
}

beforeEach(wipe);

describe('applyRestore', () => {
  it('brings back restored settings instead of overwriting them with stale in-memory ones', async () => {
    await setupShop();
    await saveSettings({ storeName: 'Original Name' });
    const text = await encodeBackup(await createBackup());
    await saveSettings({ storeName: 'Changed After Backup' });

    await applyRestore(await decodeBackup(text), 'replace', { fromFile: true });

    expect(settings.value.storeName).toBe('Original Name');
    expect((await getAll('settings'))[0].storeName).toBe('Original Name'); // and in the database
  });

  it('marks a restored file as the latest backup, but not a safety copy', async () => {
    await setupShop();
    const b = await createBackup({ now: 1_000_000 });
    const text = await encodeBackup(b);

    await applyRestore(await decodeBackup(text), 'replace', { fromFile: true });
    expect(settings.value.lastBackupAt).toBe(1_000_000);

    await saveSettings({ lastBackupAt: 0 });
    await applyRestore(await decodeBackup(text), 'replace', { fromFile: false });
    expect(settings.value.lastBackupAt).toBe(0);
  });

  it('can remove PINs so a locked-out owner can get back in', async () => {
    await setupShop();
    const owner = users.value[0];
    expect(await signIn(owner.id, '0000')).toBe(false);
    const text = await encodeBackup(await createBackup());

    await applyRestore(await decodeBackup(text), 'replace', { fromFile: true, clearPins: true });

    expect(users.value[0].pinHash).toBe('');
    expect(await signIn(users.value[0].id, '')).toBe(true);
  });

  it('restoring after a total wipe restores catalogue and sales', async () => {
    await setupShop();
    const p = await saveProduct({ ...blankProduct(), name: 'Tea', price: 300, trackStock: true, stock: 5 });
    addToCart(p);
    await checkout([{ method: 'cash', amount: 330, tendered: 400 }]);
    const text = await encodeBackup(await createBackup());

    await wipe();
    await loadAll();
    expect(products.value).toHaveLength(0);

    await applyRestore(await decodeBackup(text), 'replace', { fromFile: true });
    expect(products.value.map((x) => x.name)).toEqual(['Tea']);
    expect(products.value[0].stock).toBe(4);
    expect(await getAll('orders')).toHaveLength(1);
  });
});

describe('checkout / refund / void', () => {
  it('sells, decrements stock, and numbers receipts sequentially', async () => {
    await setupShop();
    const p = await saveProduct({ ...blankProduct(), name: 'Tea', price: 1000, trackStock: true, stock: 10 });
    addToCart(p, undefined, 2);
    const o1 = await checkout([{ method: 'cash', amount: 2200, tendered: 2500 }]);
    expect(o1.total).toBe(2200);
    expect(o1.change).toBe(300);
    expect(o1.number).toBe('#0001');
    expect(products.value[0].stock).toBe(8);

    addToCart(p);
    const o2 = await checkout([{ method: 'card', amount: 1100, tendered: 1100 }]);
    expect(o2.number).toBe('#0002');
  });

  it('rejects payments that do not cover the total', async () => {
    await setupShop();
    const p = await saveProduct({ ...blankProduct(), name: 'Tea', price: 1000 });
    addToCart(p);
    await expect(checkout([{ method: 'cash', amount: 500, tendered: 500 }])).rejects.toThrow(/do not match/);
  });

  it('refunds partially, restocks, and a later full refund returns exactly the sale total', async () => {
    await setupShop();
    const p = await saveProduct({ ...blankProduct(), name: 'Tea', price: 333, trackStock: true, stock: 10 });
    addToCart(p, undefined, 3);
    const o = await checkout([{ method: 'cash', amount: 1099, tendered: 1099 }]);
    expect(o.total).toBe(1099);
    const line = o.lines[0].id;

    const r1 = await refundOrder(o.id, [{ lineId: line, qty: 1 }], { method: 'cash', reason: '', restock: true });
    expect(r1.status).toBe('partial');
    const r2 = await refundOrder(o.id, [{ lineId: line, qty: 2 }], { method: 'cash', reason: '', restock: true });
    expect(r2.status).toBe('refunded');
    expect(r2.refunds.reduce((a, r) => a + r.amount, 0)).toBe(1099);
    expect(products.value[0].stock).toBe(10);
    await expect(refundOrder(o.id, [{ lineId: line, qty: 1 }], { method: 'cash', reason: '', restock: true })).rejects.toThrow();
  });

  it('voiding returns stock and reverses loyalty points', async () => {
    await setupShop();
    await saveSettings({ loyaltyEnabled: true, pointsPerUnit: 1 });
    const c = await saveCustomer({ ...blankCustomer(), name: 'Sam' });
    const p = await saveProduct({ ...blankProduct(), name: 'Tea', price: 1000, trackStock: true, stock: 5 });
    addToCart(p);
    cart.value = { ...cart.value, customerId: c.id };
    const o = await checkout([{ method: 'cash', amount: 1100, tendered: 1100 }]);
    expect(customers.value[0].points).toBe(11);

    await voidOrder(o.id, 'mistake');
    expect(products.value[0].stock).toBe(5);
    expect(customers.value[0].points).toBe(0);
    expect((await getAll('orders'))[0].status).toBe('void');
  });
});

import { addAttachment, attachmentsFor, deleteAttachmentsOlderThan, deleteIngredient, ingredients, blankIngredient, removeAttachment, saveIngredient, setLineTotal, setQty } from './store';
import { getOne } from './db';

describe('ingredients and recipe costs', () => {
  it('keeps recipe-costed items in step with ingredient prices', async () => {
    await setupShop();
    const flour = (await saveIngredient({ ...blankIngredient(), name: 'Flour', unit: 'kg', packSize: 1, packCost: 250 })).ingredient;
    const p = await saveProduct({
      ...blankProduct(), name: 'Bun', price: 500, costMode: 'recipe', recipeYield: 10,
      recipe: [{ ingredientId: flour.id, qty: 500, unit: 'g' }],
    });
    expect(p.cost).toBe(13); // 500 g × 0.25¢ = 125¢ per batch ÷ 10 = 12.5 → 13

    const r = await saveIngredient({ ...flour, packCost: 500 });
    expect(r.itemsUpdated).toBe(1);
    expect(products.value.find((x) => x.id === p.id)!.cost).toBe(25);
    expect((await getOne('products', p.id))!.cost).toBe(25);
  });

  it('refuses to delete an ingredient a recipe still uses', async () => {
    await setupShop();
    const i = (await saveIngredient({ ...blankIngredient(), name: 'Sugar', unit: 'kg', packSize: 1, packCost: 100 })).ingredient;
    await saveProduct({ ...blankProduct(), name: 'Candy', costMode: 'recipe', recipe: [{ ingredientId: i.id, qty: 10, unit: 'g' }] });
    expect(await deleteIngredient(i.id)).toEqual({ ok: false, usedBy: ['Candy'] });
    expect(ingredients.value).toHaveLength(1);
  });

  it('past sales keep the cost they were made with', async () => {
    await setupShop();
    const i = (await saveIngredient({ ...blankIngredient(), name: 'Beans', unit: 'kg', packSize: 1, packCost: 2000 })).ingredient;
    const p = await saveProduct({ ...blankProduct(), name: 'Coffee', price: 400, taxable: false, costMode: 'recipe', recipe: [{ ingredientId: i.id, qty: 10, unit: 'g' }] });
    addToCart(p);
    const order = await checkout([{ method: 'cash', amount: 400, tendered: 400 }]);
    expect(order.lines[0].unitCost).toBe(20);
    await saveIngredient({ ...i, packCost: 4000 });
    expect((await getAll('orders'))[0].lines[0].unitCost).toBe(20);
  });
});

describe('custom line totals in the cart', () => {
  it('scale with quantity so the per-unit price is kept', async () => {
    await setupShop();
    const p = await saveProduct({ ...blankProduct(), name: 'Tea', price: 300, taxable: false });
    addToCart(p);
    const id = cart.value.lines[0].id;
    setLineTotal(id, 200); // special price for one
    setQty(id, 3);
    expect(cart.value.lines[0].lineTotal).toBe(600);
    expect(cart.value.lines[0].qty).toBe(3);
    const o = await checkout([{ method: 'cash', amount: 600, tendered: 600 }]);
    expect(o.total).toBe(600);
    expect(o.lines[0].gross).toBe(600);
  });

  it('a custom line is not merged with a normal one of the same item', async () => {
    await setupShop();
    const p = await saveProduct({ ...blankProduct(), name: 'Tea', price: 300 });
    addToCart(p);
    setLineTotal(cart.value.lines[0].id, 250);
    addToCart(p);
    expect(cart.value.lines).toHaveLength(2);
  });

  it('refunds a custom-priced line by what was actually charged', async () => {
    await setupShop();
    const p = await saveProduct({ ...blankProduct(), name: 'Tea', price: 300, taxable: false });
    addToCart(p, undefined, 2);
    setLineTotal(cart.value.lines[0].id, 500);
    const o = await checkout([{ method: 'cash', amount: 500, tendered: 500 }]);
    const r = await refundOrder(o.id, [{ lineId: o.lines[0].id, qty: 2 }], { method: 'cash', reason: '', restock: false });
    expect(r.refunds[0].amount).toBe(500);
  });
});

describe('payment proof photos', () => {
  const img = 'data:image/jpeg;base64,QUJD';

  it('are saved with the sale and counted on it', async () => {
    await setupShop();
    const p = await saveProduct({ ...blankProduct(), name: 'Tea', price: 300, taxable: false });
    addToCart(p);
    const o = await checkout([{ method: 'card', amount: 300, tendered: 300 }], [img, img]);
    expect(o.attachmentCount).toBe(2);
    expect(await attachmentsFor(o.id)).toHaveLength(2);
  });

  it('can be added and removed later, keeping the count in sync', async () => {
    await setupShop();
    const p = await saveProduct({ ...blankProduct(), name: 'Tea', price: 300, taxable: false });
    addToCart(p);
    const o = await checkout([{ method: 'ewallet', amount: 300, tendered: 300 }]);
    const a = await addAttachment(o.id, img);
    expect((await getOne('orders', o.id))!.attachmentCount).toBe(1);
    await removeAttachment(a.id);
    expect((await getOne('orders', o.id))!.attachmentCount).toBe(0);
    expect(await attachmentsFor(o.id)).toHaveLength(0);
  });

  it('old ones can be cleared to free space without touching sales', async () => {
    await setupShop();
    const p = await saveProduct({ ...blankProduct(), name: 'Tea', price: 300, taxable: false });
    addToCart(p);
    const o = await checkout([{ method: 'card', amount: 300, tendered: 300 }], [img]);
    // age the photo by 200 days
    const d = await (await import('./db')).db();
    const [a] = await getAll('attachments');
    await d.put('attachments', { ...a, at: Date.now() - 200 * 86_400_000 });
    expect(await deleteAttachmentsOlderThan(90)).toBe(1);
    expect(await getAll('orders')).toHaveLength(1);
    expect((await getOne('orders', o.id))!.attachmentCount).toBe(0);
  });
});

import { cancelCart, cancelPending, openShift, parkCart, parkedList, recallParked, removeOne, shift, shiftSummary } from './store';

describe('taking items off from the sell grid', () => {
  it('removes one unit at a time, and the line when it reaches zero', async () => {
    await setupShop();
    const p = await saveProduct({ ...blankProduct(), name: 'Tea', price: 300 });
    addToCart(p, undefined, 2);
    expect(removeOne(p.id)).toBe(true);
    expect(cart.value.lines[0].qty).toBe(1);
    expect(removeOne(p.id)).toBe(true);
    expect(cart.value.lines).toHaveLength(0);
  });

  it('asks which line when the item is in the order more than once', async () => {
    await setupShop();
    const p = await saveProduct({ ...blankProduct(), name: 'Tea', price: 300 });
    addToCart(p);
    setLineTotal(cart.value.lines[0].id, 250);
    addToCart(p); // its own line: the first has a special price
    expect(removeOne(p.id)).toBe(false);
    expect(cart.value.lines.map((l) => l.qty)).toEqual([1, 1]);
  });
});

describe('pending orders', () => {
  const img = 'data:image/jpeg;base64,QUJD';
  const shop = async () => {
    await setupShop();
    const cake = await saveProduct({ ...blankProduct(), name: 'Cake', price: 12000, taxable: false });
    const tea = await saveProduct({ ...blankProduct(), name: 'Tea', price: 3000, taxable: false });
    return { cake, tea };
  };

  it('sets an unpaid order aside under a name and brings it back', async () => {
    const { tea } = await shop();
    addToCart(tea, undefined, 2);
    cart.value = { ...cart.value, note: 'Table 4' };
    const rec = await parkCart();
    expect(rec!.name).toBe('Table 4');
    expect(cart.value.lines).toHaveLength(0);
    expect(await getAll('parked')).toHaveLength(1);
    await recallParked(rec!.id);
    expect(cart.value.lines[0].qty).toBe(2);
    expect(cart.value.note).toBe('Table 4');
    expect(parkedList.value).toHaveLength(0);
    expect(await getAll('parked')).toHaveLength(0);
  });

  it('recalling one sets aside whatever is on screen, so nothing is lost', async () => {
    const { cake, tea } = await shop();
    addToCart(tea);
    const first = await parkCart();
    addToCart(cake);
    await recallParked(first!.id);
    expect(cart.value.lines[0].name).toBe('Tea');
    expect(parkedList.value.map((p) => p.cart.lines[0].name)).toEqual(['Cake']);
  });

  it('keeps a deposit with the order, puts cash in the drawer, and counts it once when the sale is finished', async () => {
    const { cake } = await shop();
    await openShift(10000);
    addToCart(cake);
    const rec = await parkCart({ payments: [{ method: 'cash', amount: 5000, tendered: 8000 }] });
    expect(rec!.cart.paid).toEqual([{ method: 'cash', amount: 5000, tendered: 5000, deposit: true }]); // no change on a deposit
    let sum = await shiftSummary(shift.value!);
    expect(sum.cashIn).toBe(5000);
    expect(sum.expectedCash).toBe(15000);
    expect(sum.movements[0].reason).toBe('Deposit: Cake');

    await recallParked(rec!.id);
    expect(cart.value.paid).toHaveLength(1);
    const o = await checkout([{ method: 'cash', amount: 7000, tendered: 10000 }]);
    expect(o.status).toBe('paid');
    expect(o.payments.map((p) => [p.amount, !!p.deposit])).toEqual([[5000, true], [7000, false]]);
    expect(o.change).toBe(3000);
    sum = await shiftSummary(shift.value!);
    expect(sum.byMethod.cash).toBe(7000); // the deposit is already in cash-in
    expect(sum.expectedCash).toBe(10000 + 5000 + 7000);
    expect(cart.value.paid).toBeUndefined();
  });

  it('a card or transfer deposit is not a drawer entry but still counts toward the sale', async () => {
    const { cake } = await shop();
    await openShift(0);
    addToCart(cake);
    const rec = await parkCart({ payments: [{ method: 'ewallet', amount: 2000, tendered: 2000 }] });
    await recallParked(rec!.id);
    const o = await checkout([{ method: 'cash', amount: 10000, tendered: 10000 }]);
    const sum = await shiftSummary(shift.value!);
    expect(sum.cashIn).toBe(0);
    expect(sum.byMethod).toMatchObject({ ewallet: 2000, cash: 10000 });
    expect(o.total).toBe(12000);
  });

  it('refuses a finish that does not cover the balance', async () => {
    const { cake } = await shop();
    addToCart(cake);
    const rec = await parkCart({ payments: [{ method: 'card', amount: 5000, tendered: 5000 }] });
    await recallParked(rec!.id);
    await expect(checkout([{ method: 'card', amount: 6000, tendered: 6000 }])).rejects.toThrow(/do not match/);
    expect(cart.value.paid).toHaveLength(1); // still there to try again
  });

  it('deposit photos wait with the order and move to the sale', async () => {
    const { cake } = await shop();
    addToCart(cake);
    const rec = await parkCart({ payments: [{ method: 'ewallet', amount: 3000, tendered: 3000 }], proofs: [img] });
    const key = rec!.cart.proofKey!;
    expect(await attachmentsFor(key)).toHaveLength(1);
    await recallParked(rec!.id);
    const again = await parkCart({ payments: [{ method: 'ewallet', amount: 1000, tendered: 1000 }], proofs: [img] }); // second deposit, same key
    expect(again!.cart.proofKey).toBe(key);
    await recallParked(again!.id);
    const o = await checkout([{ method: 'ewallet', amount: 8000, tendered: 8000 }], [img]);
    expect(o.attachmentCount).toBe(3);
    expect(await attachmentsFor(o.id)).toHaveLength(3);
    expect(await attachmentsFor(key)).toHaveLength(0);
  });

  it('deleting a part-paid order gives the cash back out of the drawer and drops its photos', async () => {
    const { cake } = await shop();
    await openShift(0);
    addToCart(cake);
    const rec = await parkCart({ payments: [{ method: 'cash', amount: 5000, tendered: 5000 }, { method: 'card', amount: 1000, tendered: 1000 }], proofs: [img] });
    const returned = await cancelPending(rec!.id);
    expect(returned.map((p) => p.amount)).toEqual([5000, 1000]);
    expect(parkedList.value).toHaveLength(0);
    expect(await getAll('parked')).toHaveLength(0);
    expect(await getAll('attachments')).toHaveLength(0);
    const sum = await shiftSummary(shift.value!);
    expect([sum.cashIn, sum.cashOut, sum.expectedCash]).toEqual([5000, 5000, 0]); // card is not drawer money
  });

  it('clearing a recalled part-paid order does the same', async () => {
    const { cake } = await shop();
    await openShift(0);
    addToCart(cake);
    const rec = await parkCart({ payments: [{ method: 'cash', amount: 4000, tendered: 4000 }] });
    await recallParked(rec!.id);
    const returned = await cancelCart();
    expect(returned).toHaveLength(1);
    expect(cart.value.lines).toHaveLength(0);
    expect((await shiftSummary(shift.value!)).expectedCash).toBe(0);
  });

  it('items taken off after a deposit: the excess is returned instead of overpaying the sale', async () => {
    const { cake, tea } = await shop();
    await openShift(0);
    addToCart(cake);
    addToCart(tea);
    const rec = await parkCart({ payments: [{ method: 'cash', amount: 5000, tendered: 5000 }] });
    await recallParked(rec!.id);
    setQty(cart.value.lines.find((l) => l.name === 'Cake')!.id, 0); // total is now 3000, deposit 5000
    const o = await checkout([]);
    expect(o.total).toBe(3000);
    expect(o.payments.map((p) => p.amount)).toEqual([3000]);
    const sum = await shiftSummary(shift.value!);
    expect([sum.cashIn, sum.cashOut, sum.expectedCash]).toEqual([5000, 2000, 3000]);
  });

  it('only takes deposits while a required shift is open, and never in points', async () => {
    const { cake } = await shop();
    addToCart(cake);
    await expect(parkCart({ payments: [{ method: 'points', amount: 500, tendered: 500 }] })).rejects.toThrow(/points/i);
    await saveSettings({ requireShift: true });
    await expect(parkCart({ payments: [{ method: 'cash', amount: 500, tendered: 500 }] })).rejects.toThrow(/shift/i);
    expect(cart.value.lines).toHaveLength(1); // nothing was lost
    expect(await parkCart()).not.toBeNull(); // an unpaid hold needs no shift
  });

  it('pending orders and their deposits survive a backup and restore', async () => {
    const { cake } = await shop();
    addToCart(cake);
    await parkCart({ payments: [{ method: 'card', amount: 2500, tendered: 2500 }], proofs: [img] });
    const text = await encodeBackup(await createBackup());
    await wipe();
    await loadAll();
    expect(parkedList.value).toHaveLength(0);
    await applyRestore(await decodeBackup(text), 'replace', { fromFile: true });
    expect(parkedList.value).toHaveLength(1);
    expect(parkedList.value[0].cart.paid?.[0].amount).toBe(2500);
    expect(await getAll('attachments')).toHaveLength(1);
  });

  it('a part-paid order on screen is not lost when a backup is restored', async () => {
    const { cake } = await shop();
    addToCart(cake);
    const text = await encodeBackup(await createBackup());
    const rec = await parkCart({ payments: [{ method: 'card', amount: 1500, tendered: 1500 }], proofs: [img] });
    await recallParked(rec!.id);
    await applyRestore(await decodeBackup(text), 'merge', { fromFile: true });
    expect(cart.value.lines).toHaveLength(0);
    expect(parkedList.value).toHaveLength(1);
    expect(parkedList.value[0].cart.paid?.[0].amount).toBe(1500);
    expect(await attachmentsFor(parkedList.value[0].cart.proofKey!)).toHaveLength(1);
  });
});
