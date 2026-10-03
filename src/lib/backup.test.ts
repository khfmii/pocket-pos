import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  autoSnapshotIfDue,
  BACKUP_SCHEMA,
  BackupError,
  createBackup,
  createSnapshot,
  decodeBackup,
  describeBackup,
  encodeBackup,
  getSnapshotText,
  isEncryptedBackup,
  listSnapshots,
  restoreBackup,
} from './backup';
import { closeDb, db, getAll, put } from './db';
import { sha256Hex } from './crypto';
import type { Order, Product, Settings } from './types';

const settings = (over: Partial<Settings> = {}): Settings => ({
  id: 'main', updatedAt: 1, setupDone: true, storeName: 'Corner Shop', address: '', phone: '', email: '', website: '', logo: '', taxId: '',
  currency: 'USD', currencyDecimals: 2, taxName: 'Tax', taxRate: 5, taxInclusive: false, receiptHeader: '',
  receiptFooter: '', receiptPrefix: '#', receiptNext: 3, paperWidth: 58, theme: 'system', loyaltyEnabled: false,
  pointsPerUnit: 1, pointValue: 1, requireShift: false, cashierRefunds: false, lockMinutes: 0, lowStockDefault: 5, autoSnapshot: true,
  backupReminderDays: 7, lastBackupAt: 0, ...over,
});

const product = (id: string, over: Partial<Product> = {}): Product => ({
  id, updatedAt: 10, name: id, categoryId: '', price: 500, cost: 200, sku: '', barcode: '', emoji: '🍎', color: '',
  taxable: true, trackStock: true, stock: 10, lowStock: 2, variants: [], active: true, createdAt: 1, ...over,
});

const order = (id: string, at: number): Order => ({
  id, updatedAt: at, number: '#' + id, seq: 1, at, shiftId: '', userId: '', userName: 'Owner', customerId: '',
  customerName: '', lines: [], subtotal: 500, orderDiscount: 0, orderDiscountAdj: null, tax: 25, total: 525,
  taxName: 'Tax', taxRate: 5, taxInclusive: false, payments: [{ method: 'cash', amount: 525, tendered: 600 }],
  change: 75, status: 'paid', refunds: [], note: '', pointsEarned: 0, pointsRedeemed: 0,
});

async function wipe() {
  await closeDb();
  await new Promise<void>((res) => {
    const r = indexedDB.deleteDatabase('pocket-pos');
    r.onsuccess = r.onerror = r.onblocked = () => res();
  });
}

async function seed() {
  await put('settings', settings());
  await put('products', product('p1'));
  await put('products', product('p2', { stock: 3 }));
  await put('orders', order('o1', 1_700_000_000_000));
  await put('orders', order('o2', 1_700_100_000_000));
}

beforeEach(wipe);

describe('backup round trip', () => {
  it('restores exactly what was backed up after the data is lost', async () => {
    await seed();
    const text = await encodeBackup(await createBackup());
    await wipe();
    expect(await getAll('orders')).toHaveLength(0);

    const parsed = await decodeBackup(text);
    const res = await restoreBackup(parsed, 'replace', { safetySnapshot: false });
    expect(res.added).toBeGreaterThan(0);
    expect((await getAll('orders')).map((o) => o.id).sort()).toEqual(['o1', 'o2']);
    expect((await getAll('products')).find((p) => p.id === 'p2')?.stock).toBe(3);
    expect((await getAll('settings'))[0].storeName).toBe('Corner Shop');
  });

  it('replace removes records that are not in the backup', async () => {
    await seed();
    const text = await encodeBackup(await createBackup());
    await put('products', product('extra'));
    await restoreBackup(await decodeBackup(text), 'replace', { safetySnapshot: false });
    expect((await getAll('products')).map((p) => p.id).sort()).toEqual(['p1', 'p2']);
  });

  it('describes a backup for the confirmation screen', async () => {
    await seed();
    const d = describeBackup(await createBackup());
    expect(d.storeName).toBe('Corner Shop');
    expect(d.counts.orders).toBe(2);
    expect(d.lastOrderAt).toBe(1_700_100_000_000);
  });
});

describe('merge restore', () => {
  it('adds missing records, keeps the newest edit, never deletes', async () => {
    await seed();
    const text = await encodeBackup(await createBackup());
    // Local drift after the backup: p1 edited later, new product p3, order o1 removed locally.
    await put('products', product('p1', { name: 'edited-later' }));
    await put('products', product('p3'));
    await (await db()).delete('orders', 'o1');

    const r = await restoreBackup(await decodeBackup(text), 'merge', { safetySnapshot: false });
    const products = await getAll('products');
    expect(products.map((p) => p.id).sort()).toEqual(['p1', 'p2', 'p3']); // p3 kept
    expect(products.find((p) => p.id === 'p1')?.name).toBe('edited-later'); // newer local edit kept
    expect((await getAll('orders')).map((o) => o.id).sort()).toEqual(['o1', 'o2']); // o1 re-added
    expect(r.added).toBeGreaterThanOrEqual(1);
  });

  it('keeps local settings but never lets the receipt counter go backwards', async () => {
    await put('settings', settings({ receiptNext: 50, storeName: 'Other device' }));
    const text = await encodeBackup(await createBackup());
    await put('settings', settings({ receiptNext: 10, storeName: 'Local' }));
    await restoreBackup(await decodeBackup(text), 'merge', { safetySnapshot: false });
    const s = (await getAll('settings'))[0];
    expect(s.storeName).toBe('Local');
    expect(s.receiptNext).toBe(50);
  });
});

describe('encryption', () => {
  it('requires the right password', async () => {
    await seed();
    const text = await encodeBackup(await createBackup(), 'hunter2');
    expect(isEncryptedBackup(text)).toBe(true);
    expect(text).not.toContain('Corner Shop');

    await expect(decodeBackup(text)).rejects.toMatchObject({ code: 'needs-password' });
    await expect(decodeBackup(text, 'wrong')).rejects.toMatchObject({ code: 'wrong-password' });
    const ok = await decodeBackup(text, 'hunter2');
    expect(ok.counts.orders).toBe(2);
  });
});

describe('validation', () => {
  it('rejects non-backups and damaged files with a specific reason', async () => {
    await expect(decodeBackup('hello')).rejects.toMatchObject({ code: 'not-backup' });
    await expect(decodeBackup('{"app":"other"}')).rejects.toMatchObject({ code: 'not-backup' });

    await seed();
    const b = await createBackup();
    const tampered = JSON.parse(await encodeBackup(b));
    tampered.data.orders[0].total = 1; // edit data without fixing the checksum
    await expect(decodeBackup(JSON.stringify(tampered))).rejects.toMatchObject({ code: 'corrupt' });

    const missing = JSON.parse(await encodeBackup(b));
    delete missing.data.products;
    await expect(decodeBackup(JSON.stringify(missing))).rejects.toMatchObject({ code: 'corrupt' });
  });

  it('refuses backups from a newer app version', async () => {
    await seed();
    const b = await createBackup();
    const future = { ...b, schema: 99 };
    await expect(decodeBackup(JSON.stringify(future))).rejects.toBeInstanceOf(BackupError);
    await expect(decodeBackup(JSON.stringify(future))).rejects.toMatchObject({ code: 'newer-version' });
  });

  it('a failed restore is all-or-nothing', async () => {
    await seed();
    const b = await createBackup();
    await put('products', product('only-local')); // a replace would delete this...
    // ...but the last store holds a record with an unusable key, so the restore must fail part-way.
    (b.data.parked as any[]).push({ id: { bad: true } });
    await expect(restoreBackup(b, 'replace', { safetySnapshot: false })).rejects.toBeDefined();
    expect((await getAll('products')).map((p) => p.id).sort()).toEqual(['only-local', 'p1', 'p2']);
    expect((await getAll('orders')).length).toBe(2);
  });
});

describe('snapshots', () => {
  it('can be restored and are pruned per kind', async () => {
    await seed();
    const snap = await createSnapshot('before edits', 'manual');
    await put('products', product('p9'));
    const text = await getSnapshotText(snap.id);
    await restoreBackup(await decodeBackup(text!), 'replace', { safetySnapshot: false });
    expect((await getAll('products')).some((p) => p.id === 'p9')).toBe(false);

    for (let i = 0; i < 6; i++) await createSnapshot('x' + i, 'manual');
    const list = await listSnapshots();
    expect(list.filter((s) => s.kind === 'manual').length).toBe(3);
    expect(list[0]).not.toHaveProperty('json');
  });

  it('takes at most one automatic snapshot a day and skips an empty shop', async () => {
    expect(await autoSnapshotIfDue()).toBe(false);
    await seed();
    expect(await autoSnapshotIfDue()).toBe(true);
    expect(await autoSnapshotIfDue()).toBe(false);
    expect(await autoSnapshotIfDue(Date.now() + 25 * 3600_000)).toBe(true);
  });

  it('restoring takes a safety snapshot first so a restore can be undone', async () => {
    await seed();
    const text = await encodeBackup(await createBackup());
    await put('products', product('only-now'));
    await restoreBackup(await decodeBackup(text), 'replace');
    const safety = (await listSnapshots()).find((s) => s.reason === 'Before restore');
    expect(safety).toBeDefined();
    const back = await decodeBackup((await getSnapshotText(safety!.id))!);
    expect(back.data.products.some((p) => p.id === 'only-now')).toBe(true);
  });
});

describe('sha256', () => {
  it('matches the known vector', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('older backups and payment proofs', () => {
  const att = (id: string, orderId: string, at = 1) => ({ id, updatedAt: at, orderId, at, by: 'Owner', name: '', image: 'data:image/jpeg;base64,AAAA', bytes: 3 });

  async function v1File(): Promise<string> {
    // What a v1 app wrote: no ingredients, no attachments, schema 1.
    const data = {
      settings: [settings({ storeName: 'Old shop' })], categories: [], products: [product('p1')], customers: [], users: [],
      orders: [order('o1', 1_700_000_000_000)], shifts: [], cashMovements: [], stockMoves: [], parked: [],
    };
    return JSON.stringify({
      app: 'pocket-pos', kind: 'backup', schema: 1, appVersion: '0.1.0', createdAt: 1, counts: {}, checksum: await sha256Hex(JSON.stringify(data)), data,
    });
  }

  it('restores a schema-1 file (migrated) without wiping photos already on the device', async () => {
    await put('orders', order('keep', 5));
    await (await db()).put('attachments', att('a1', 'keep'));
    const b = await decodeBackup(await v1File());
    expect(b.schema).toBe(BACKUP_SCHEMA); // upgraded step by step: v1 → v2 → v3
    expect(b.data.ingredients).toEqual([]);
    expect(b.data.expenses).toEqual([]);
    expect(b.attachmentsIncluded).toBe(false);

    await restoreBackup(b, 'replace', { safetySnapshot: false });
    expect((await getAll('orders')).map((o) => o.id)).toEqual(['o1']);
    // the order the photo belonged to is gone, so the photo is cleaned up rather than left orphaned
    expect(await getAll('attachments')).toHaveLength(0);
  });

  it('restores a schema-2 file (no costs yet) and a current backup keeps its costs', async () => {
    const cost = { id: 'e1', updatedAt: 5, at: 1_700_000_000_000, amount: 1200, label: 'Flour', kind: 'ingredients' as const };
    await put('expenses', cost);
    const current = await createBackup();
    expect(current.schema).toBe(BACKUP_SCHEMA);
    expect(current.data.expenses.map((e) => e.id)).toEqual(['e1']);
    expect(current.counts.expenses).toBe(1);

    // What a v2 app wrote: the same file without the costs store.
    const { expenses: _gone, ...data } = current.data;
    const v2 = JSON.stringify({ ...current, schema: 2, counts: {}, checksum: await sha256Hex(JSON.stringify(data)), data });
    const b = await decodeBackup(v2);
    expect(b.schema).toBe(BACKUP_SCHEMA);
    expect(b.data.expenses).toEqual([]);
    await restoreBackup(b, 'replace', { safetySnapshot: false });
    expect(await getAll('expenses')).toHaveLength(0); // replace makes the device match the file, which had none

    await restoreBackup(current, 'replace', { safetySnapshot: false });
    expect((await getAll('expenses')).map((e) => e.label)).toEqual(['Flour']);
  });

  it('keeps photos whose sale survives a backup that left photos out', async () => {
    await seed();
    await (await db()).put('attachments', att('a1', 'o1'));
    const text = await encodeBackup(await createBackup({ attachments: false }));
    const b = await decodeBackup(text);
    expect(b.data.attachments).toEqual([]);
    expect(b.attachmentsIncluded).toBe(false);
    await restoreBackup(b, 'replace', { safetySnapshot: false });
    expect((await getAll('attachments')).map((a) => a.id)).toEqual(['a1']);
  });

  it('round-trips photos when included, and replace removes ones not in the backup', async () => {
    await seed();
    await (await db()).put('attachments', att('a1', 'o1'));
    const text = await encodeBackup(await createBackup());
    await (await db()).put('attachments', att('a2', 'o2'));
    await restoreBackup(await decodeBackup(text), 'replace', { safetySnapshot: false });
    expect((await getAll('attachments')).map((a) => a.id)).toEqual(['a1']);
  });

  it('automatic snapshots skip photos but pre-restore ones keep them', async () => {
    await seed();
    await (await db()).put('attachments', att('a1', 'o1'));
    const auto = await createSnapshot('auto', 'auto');
    const manual = await createSnapshot('manual', 'manual');
    expect((await decodeBackup((await getSnapshotText(auto.id))!)).data.attachments).toHaveLength(0);
    expect((await decodeBackup((await getSnapshotText(manual.id))!)).data.attachments).toHaveLength(1);
  });
});
