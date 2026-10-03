import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  autoBackup, autoBackupName, copiesToDelete, deps, describeError, isDue, runAutoBackup, sanitize, updateAutoBackup, type BackupFolderApi,
  type FolderFile,
} from './autobackup';
import { decodeBackup } from './backup';
import { closeDb } from './db';
import { blankProduct, completeSetup, defaultSettings, loadAll, saveProduct, session, settings } from './store';

const DAY = 86_400_000;
const at = (y: number, mo: number, d: number, h = 9, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

describe('isDue', () => {
  const base = { on: true, uri: 'content://tree', every: 'daily' as const, lastAt: 0, lastTry: 0 };

  it('is never due while switched off or without a folder', () => {
    expect(isDue({ ...base, on: false }, Date.now())).toBe(false);
    expect(isDue({ ...base, uri: '' }, Date.now())).toBe(false);
  });

  it('is due straight away the first time', () => {
    expect(isDue(base, Date.now())).toBe(true);
  });

  it('daily: once per calendar day, whatever time the app is opened', () => {
    const lastAt = at(2026, 10, 2, 21, 30);
    expect(isDue({ ...base, lastAt }, at(2026, 10, 2, 23, 59))).toBe(false); // same evening
    expect(isDue({ ...base, lastAt }, at(2026, 10, 3, 8, 0))).toBe(true); // next morning, only ~10 h later
    expect(isDue({ ...base, lastAt: at(2026, 10, 2, 8, 0) }, at(2026, 10, 2, 20, 0))).toBe(false);
  });

  it('weekly: roughly every seven days', () => {
    const lastAt = at(2026, 10, 2);
    const weekly = { ...base, every: 'weekly' as const, lastAt };
    expect(isDue(weekly, lastAt + 3 * DAY)).toBe(false);
    expect(isDue(weekly, lastAt + 6 * DAY)).toBe(false);
    expect(isDue(weekly, lastAt + 7 * DAY)).toBe(true);
  });

  it('after a failed attempt waits 30 minutes instead of retrying on every resume', () => {
    const lastAt = at(2026, 10, 1);
    const now = at(2026, 10, 2, 9, 0);
    expect(isDue({ ...base, lastAt, lastTry: now - 5 * 60_000 }, now)).toBe(false);
    expect(isDue({ ...base, lastAt, lastTry: now - 31 * 60_000 }, now)).toBe(true);
  });
});

describe('file names and clean-up', () => {
  it('names sort oldest to newest and mark encrypted copies', () => {
    const a = autoBackupName(at(2026, 10, 2, 9, 5), false);
    expect(a).toBe('pocketpos-auto-20261002-090500.json');
    expect(autoBackupName(at(2026, 10, 2, 9, 5), true)).toBe('pocketpos-auto-20261002-090500.enc.json');
    expect([autoBackupName(at(2026, 11, 1), false), a, autoBackupName(at(2025, 12, 31), true)].sort()[1]).toBe(a);
  });

  it('keeps the newest N automatic copies and never touches other files', () => {
    const autos = Array.from({ length: 10 }, (_, i) => autoBackupName(at(2026, 10, 1 + i), i % 2 === 0));
    const others = ['pocketpos-backup-20261001-0900.json', 'holiday.jpg', 'pocketpos-auto-notes.txt', 'pocketpos-auto-20261001-0900.json.bak'];
    const del = copiesToDelete([...others, ...autos.slice().reverse()], 7);
    expect(del).toEqual(autos.slice(0, 3)); // the three oldest, oldest first
    expect(copiesToDelete(autos.slice(0, 5), 7)).toEqual([]);
  });
});

describe('sanitize', () => {
  it('ignores damaged storage and unknown types', () => {
    expect(sanitize(null).on).toBe(false);
    expect(sanitize('garbage').every).toBe('daily');
    const c = sanitize({ on: 'yes', uri: 5, every: 'hourly', lastAt: 'x', proofs: false, password: 'pw' });
    expect(c).toMatchObject({ on: false, uri: '', every: 'daily', lastAt: 0, proofs: false, password: 'pw' });
  });
});

describe('describeError', () => {
  it('turns native codes into readable text', () => {
    expect(describeError(new Error('folder-unavailable'))).toMatch(/no longer available/);
    expect(describeError(new Error('write-failed'))).toMatch(/Could not write/);
    expect(describeError('anything else')).toMatch(/Could not write/);
  });
});

// ------------------------------------------------------------------ the whole run, against a fake folder

class FakeFolder implements BackupFolderApi {
  files = new Map<string, string>();
  failWith: string | null = null;
  async pick() {
    return { uri: 'content://tree/backups', name: 'Backups' };
  }
  async write(o: { uri: string; name: string; data: string }) {
    if (this.failWith) throw new Error(this.failWith);
    this.files.set(o.name, o.data);
    return { uri: `${o.uri}/doc/${o.name}`, bytes: o.data.length };
  }
  async list(): Promise<{ files: FolderFile[] }> {
    if (this.failWith) throw new Error(this.failWith);
    return { files: [...this.files].map(([name, data]) => ({ name, uri: `content://tree/backups/doc/${name}`, size: data.length, modified: 0 })) };
  }
  async remove(o: { uri: string }) {
    this.files.delete(decodeURIComponent(o.uri.split('/doc/')[1]));
  }
}

const real = { ...deps };
let folder: FakeFolder;
let clock: number;

async function wipe() {
  await closeDb();
  await new Promise<void>((res) => {
    const r = indexedDB.deleteDatabase('pocket-pos');
    r.onsuccess = r.onerror = r.onblocked = () => res();
  });
  session.value = null;
  settings.value = defaultSettings();
}

beforeEach(async () => {
  await wipe();
  await loadAll();
  await completeSetup({ storeName: 'Corner Shop' }, { name: 'Owner', pin: '' }, false);
  folder = new FakeFolder();
  clock = at(2026, 10, 2, 9, 0);
  deps.native = folder;
  deps.isNative = () => true;
  deps.now = () => clock;
  updateAutoBackup({ on: true, uri: 'content://tree/backups', folder: 'Backups', every: 'daily', proofs: true, password: '', lastAt: 0, lastTry: 0, lastName: '', lastError: '' });
});
afterEach(() => Object.assign(deps, real));

describe('runAutoBackup', () => {
  async function addItem() {
    await saveProduct({ ...blankProduct(), name: 'Latte', price: 380 });
  }

  it('writes a backup that restores, stamps the "last backup" time, and records success', async () => {
    await addItem();
    expect(await runAutoBackup('startup')).toBe('saved');

    const [[name, text]] = [...folder.files];
    expect(name).toBe(autoBackupName(clock, false));
    const b = await decodeBackup(text);
    expect(b.data.products.map((p) => p.name)).toEqual(['Latte']);
    expect(b.attachmentsIncluded).toBe(true);
    expect(autoBackup.value).toMatchObject({ lastAt: clock, lastName: name, lastError: '' });
    expect(settings.value.lastBackupAt).toBe(clock); // the "no recent backup" reminder is satisfied
  });

  it('does nothing until something is due, then writes once per day', async () => {
    await addItem();
    expect(await runAutoBackup('startup')).toBe('saved');
    clock += 5 * 3600_000; // same day, 14:00
    expect(await runAutoBackup('resume')).toBe('skipped');
    expect(await runAutoBackup('timer')).toBe('skipped');
    clock = at(2026, 10, 3, 8, 0);
    expect(await runAutoBackup('resume')).toBe('saved');
    expect(folder.files.size).toBe(2);
  });

  it('closing a shift saves again, but not if a copy was made within the hour', async () => {
    await addItem();
    await runAutoBackup('startup');
    clock += 20 * 60_000;
    expect(await runAutoBackup('shift')).toBe('skipped');
    clock += 90 * 60_000;
    expect(await runAutoBackup('shift')).toBe('saved');
  });

  it('keeps only the newest 7 copies and leaves the owner’s other files alone', async () => {
    await addItem();
    folder.files.set('pocketpos-backup-20250101-0000.json', 'manual');
    folder.files.set('notes.txt', 'hi');
    for (let day = 1; day <= 10; day++) {
      clock = at(2026, 10, day, 9, 0);
      expect(await runAutoBackup('startup')).toBe('saved');
    }
    const autos = [...folder.files.keys()].filter((n) => n.startsWith('pocketpos-auto-')).sort();
    expect(autos).toHaveLength(7);
    expect(autos[0]).toBe(autoBackupName(at(2026, 10, 4), false));
    expect(autos.at(-1)).toBe(autoBackupName(at(2026, 10, 10), false));
    expect(folder.files.has('pocketpos-backup-20250101-0000.json')).toBe(true);
    expect(folder.files.has('notes.txt')).toBe(true);
  });

  it('encrypts when a password is set, and the file only opens with it', async () => {
    await addItem();
    updateAutoBackup({ password: 'correct horse' });
    expect(await runAutoBackup('manual', true)).toBe('saved');
    const [[name, text]] = [...folder.files];
    expect(name).toMatch(/\.enc\.json$/);
    expect(text).not.toContain('Latte');
    await expect(decodeBackup(text)).rejects.toMatchObject({ code: 'needs-password' });
    expect((await decodeBackup(text, 'correct horse')).data.products[0].name).toBe('Latte');
  });

  it('leaves payment-proof photos out when asked', async () => {
    await addItem();
    updateAutoBackup({ proofs: false });
    await runAutoBackup('manual', true);
    expect((await decodeBackup([...folder.files.values()][0])).attachmentsIncluded).toBe(false);
  });

  it('a missing folder is reported, is not counted as a backup, and backs off before retrying', async () => {
    await addItem();
    folder.failWith = 'folder-unavailable';
    expect(await runAutoBackup('startup')).toBe('failed');
    expect(autoBackup.value.lastError).toMatch(/no longer available/);
    expect(settings.value.lastBackupAt).toBe(0);
    expect(autoBackup.value.lastAt).toBe(0);

    clock += 10 * 60_000;
    expect(await runAutoBackup('resume')).toBe('skipped'); // too soon
    clock += 30 * 60_000;
    folder.failWith = null; // the user fixed the folder
    expect(await runAutoBackup('resume')).toBe('saved');
    expect(autoBackup.value.lastError).toBe('');
  });

  it('does nothing in a browser, when switched off, or while the shop is still empty', async () => {
    deps.isNative = () => false;
    expect(await runAutoBackup('manual', true)).toBe('skipped');
    deps.isNative = () => true;
    updateAutoBackup({ on: false });
    expect(await runAutoBackup('manual', true)).toBe('skipped');
    updateAutoBackup({ on: true });
    expect(await runAutoBackup('startup')).toBe('skipped'); // no items or sales yet
    expect(folder.files.size).toBe(0);
  });

  it('never runs two copies at once', async () => {
    await addItem();
    const [a, b] = await Promise.all([runAutoBackup('startup'), runAutoBackup('resume')]);
    expect([a, b].sort()).toEqual(['saved', 'skipped']);
    expect(folder.files.size).toBe(1);
  });
});
