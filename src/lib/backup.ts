import { BACKUP_STORES, db, type BackupStoreName, type StoreMap } from './db';
import { decryptText, encryptText, sha256Hex, uid, type EncryptedPayload } from './crypto';
import type { Settings, Snapshot } from './types';

export const BACKUP_SCHEMA = 2;
export const APP_VERSION = '0.1.0';

export type BackupData = { [K in BackupStoreName]: StoreMap[K][] };

export interface BackupFile {
  app: 'pocket-pos';
  kind: 'backup';
  schema: number;
  appVersion: string;
  createdAt: number;
  counts: Record<BackupStoreName, number>;
  checksum: string; // SHA-256 of JSON.stringify(data)
  /** False when payment-proof photos were left out; a restore then keeps the device's own photos instead of wiping them. */
  attachmentsIncluded: boolean;
  data: BackupData;
}

export interface EncryptedBackupFile extends EncryptedPayload {
  app: 'pocket-pos';
  kind: 'backup-encrypted';
  schema: number;
  createdAt: number;
}

export type BackupErrorCode = 'not-backup' | 'needs-password' | 'wrong-password' | 'corrupt' | 'newer-version';

export class BackupError extends Error {
  constructor(
    public code: BackupErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export type RestoreMode = 'replace' | 'merge';

export interface RestoreResult {
  mode: RestoreMode;
  added: number;
  updated: number;
  skipped: number;
}

async function collect(): Promise<BackupData> {
  const d = await db();
  const tx = d.transaction([...BACKUP_STORES], 'readonly');
  const entries = await Promise.all(BACKUP_STORES.map(async (s) => [s, await tx.objectStore(s).getAll()] as const));
  return Object.fromEntries(entries) as unknown as BackupData;
}

function countsOf(data: BackupData) {
  return Object.fromEntries(BACKUP_STORES.map((s) => [s, data[s].length])) as Record<BackupStoreName, number>;
}

export async function createBackup(opts: { attachments?: boolean; now?: number } = {}): Promise<BackupFile> {
  const { attachments = true, now = Date.now() } = opts;
  const data = await collect();
  if (!attachments) data.attachments = [];
  return {
    app: 'pocket-pos',
    kind: 'backup',
    schema: BACKUP_SCHEMA,
    appVersion: APP_VERSION,
    createdAt: now,
    counts: countsOf(data),
    checksum: await sha256Hex(JSON.stringify(data)),
    attachmentsIncluded: attachments,
    data,
  };
}

/** Number and approximate size of payment-proof photos on this device (shown next to the "include" switch). */
export async function attachmentStats(): Promise<{ count: number; bytes: number }> {
  const d = await db();
  let count = 0;
  let bytes = 0;
  let cur = await d.transaction('attachments').store.openCursor();
  while (cur) {
    count++;
    bytes += (cur.value as { bytes?: number }).bytes ?? 0;
    cur = await cur.continue();
  }
  return { count, bytes };
}

/** Serialises a backup to the text written to disk, optionally password-encrypted. */
export async function encodeBackup(b: BackupFile, password?: string): Promise<string> {
  if (!password) return JSON.stringify(b);
  const payload = await encryptText(JSON.stringify(b), password);
  const wrapper: EncryptedBackupFile = {
    app: 'pocket-pos',
    kind: 'backup-encrypted',
    schema: b.schema,
    createdAt: b.createdAt,
    ...payload,
  };
  return JSON.stringify(wrapper);
}

export function backupFilename(createdAt: number, encrypted: boolean): string {
  const d = new Date(createdAt);
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  return `pocketpos-backup-${stamp}${encrypted ? '.enc' : ''}.json`;
}

/** True when the text is a password-protected backup (so the UI can ask for the password first). */
export function isEncryptedBackup(text: string): boolean {
  try {
    const o = JSON.parse(text);
    return o?.app === 'pocket-pos' && o?.kind === 'backup-encrypted';
  } catch {
    return false;
  }
}

// Upgrade hooks for older backup schemas, keyed by the schema they upgrade FROM. Add a step whenever BACKUP_SCHEMA is bumped.
const MIGRATIONS: Record<number, (b: BackupFile) => BackupFile> = {
  // v1 → v2: ingredients + attachments stores added. Product/cart/order additions are optional fields, so nothing else changes.
  // A v1 file never had payment proofs, so mark them "not included" — restoring it must not wipe the device's photos.
  1: (b) => ({ ...b, attachmentsIncluded: false, data: { ...b.data, ingredients: [], attachments: [] } }),
};

function migrate(b: BackupFile): BackupFile {
  let cur = b;
  while (cur.schema < BACKUP_SCHEMA) {
    const step = MIGRATIONS[cur.schema];
    if (!step) throw new BackupError('corrupt', `No upgrade path from backup version ${cur.schema}.`);
    cur = step(cur);
    cur.schema += 1;
  }
  return cur;
}

export async function decodeBackup(text: string, password?: string): Promise<BackupFile> {
  let outer: any;
  try {
    outer = JSON.parse(text);
  } catch {
    throw new BackupError('not-backup', 'This file is not a Pocket POS backup.');
  }
  if (outer?.app !== 'pocket-pos') throw new BackupError('not-backup', 'This file is not a Pocket POS backup.');
  if (typeof outer.schema === 'number' && outer.schema > BACKUP_SCHEMA)
    throw new BackupError('newer-version', 'This backup was made by a newer version of Pocket POS. Update the app first.');

  let file: any = outer;
  if (outer.kind === 'backup-encrypted') {
    if (!password) throw new BackupError('needs-password', 'This backup is password protected.');
    try {
      file = JSON.parse(await decryptText(outer, password));
    } catch {
      throw new BackupError('wrong-password', 'Wrong password, or the file is damaged.');
    }
  }
  if (file?.kind !== 'backup' || typeof file.schema !== 'number' || typeof file.data !== 'object' || !file.data)
    throw new BackupError('corrupt', 'The backup file is incomplete.');
  if (file.schema > BACKUP_SCHEMA)
    throw new BackupError('newer-version', 'This backup was made by a newer version of Pocket POS. Update the app first.');

  // Integrity is checked against the file exactly as written, before any migration changes it.
  if (file.checksum !== (await sha256Hex(JSON.stringify(file.data))))
    throw new BackupError('corrupt', 'The backup failed its integrity check (file changed or damaged).');

  const migrated = migrate(file as BackupFile);
  for (const s of BACKUP_STORES) {
    const rows = migrated.data[s];
    if (!Array.isArray(rows)) throw new BackupError('corrupt', `The backup is missing its "${s}" data.`);
    if (rows.some((r: any) => !r || typeof r !== 'object' || typeof r.id !== 'string'))
      throw new BackupError('corrupt', `The backup has damaged "${s}" records.`);
  }
  migrated.attachmentsIncluded = migrated.attachmentsIncluded !== false;
  migrated.counts = countsOf(migrated.data);
  return migrated;
}

/** Human-friendly numbers for the restore confirmation screen. */
export function describeBackup(b: BackupFile) {
  const orders = b.data.orders;
  const times = orders.map((o) => o.at);
  const settings = b.data.settings[0] as Settings | undefined;
  return {
    storeName: settings?.storeName || '',
    createdAt: b.createdAt,
    counts: b.counts,
    firstOrderAt: times.length ? Math.min(...times) : 0,
    lastOrderAt: times.length ? Math.max(...times) : 0,
    attachmentsIncluded: b.attachmentsIncluded,
  };
}

export async function restoreBackup(
  b: BackupFile,
  mode: RestoreMode,
  opts: { safetySnapshot?: boolean } = {},
): Promise<RestoreResult> {
  // Keep a way back: a failed or unwanted restore can be undone from Settings → Data → Local snapshots.
  if (opts.safetySnapshot !== false) await createSnapshot('Before restore', 'manual').catch(() => {});

  const d = await db();
  const tx = d.transaction([...BACKUP_STORES], 'readwrite');
  const result: RestoreResult = { mode, added: 0, updated: 0, skipped: 0 };
  const done = tx.done.catch(() => {}); // surfaced via the thrown error below

  try {
  for (const name of BACKUP_STORES) {
    // A backup made without payment proofs must not erase the photos already on this device.
    if (name === 'attachments' && !b.attachmentsIncluded) continue;
    const store = tx.objectStore(name);
    const incoming = b.data[name] as { id: string; updatedAt?: number }[];
    if (mode === 'replace') {
      await store.clear();
      for (const rec of incoming) await store.put(rec);
      result.added += incoming.length;
      continue;
    }
    if (name === 'settings') {
      // Merge never overwrites this device's settings, but receipt numbers must not go backwards.
      const cur = (await store.get('main')) as Settings | undefined;
      const inc = incoming.find((r) => r.id === 'main') as Settings | undefined;
      if (cur && inc && inc.receiptNext > cur.receiptNext) await store.put({ ...cur, receiptNext: inc.receiptNext, updatedAt: Date.now() });
      else if (!cur && inc) await store.put(inc);
      continue;
    }
    for (const rec of incoming) {
      const existing = (await store.get(rec.id)) as { updatedAt?: number } | undefined;
      if (!existing) {
        await store.put(rec);
        result.added++;
      } else if ((rec.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
        await store.put(rec);
        result.updated++;
      } else result.skipped++;
    }
  }
  // Photos whose sale no longer exists (e.g. after a replace restore) are unreachable: drop them. A deposit's photos wait
  // under the key of its pending order until the sale is finished, so those stay.
  const owners = new Set((await tx.objectStore('orders').getAllKeys()) as string[]);
  for (const p of (await tx.objectStore('parked').getAll()) as { cart?: { proofKey?: string } }[]) if (p.cart?.proofKey) owners.add(p.cart.proofKey);
  const photos = tx.objectStore('attachments');
  for (const a of (await photos.getAll()) as { id: string; orderId: string }[]) if (!owners.has(a.orderId)) await photos.delete(a.id);
  } catch (e) {
    // A synchronous failure (e.g. a record with an invalid key) does not abort the transaction by itself,
    // so abort explicitly: restore is all-or-nothing.
    try { tx.abort(); } catch { /* already finished */ }
    await done;
    throw e;
  }
  await tx.done;
  return result;
}

// ---- Local snapshots: automatic safety copies kept inside the app's own storage ----

const KEEP: Record<Snapshot['kind'], number> = { auto: 5, manual: 3 };

/**
 * Automatic snapshots leave payment-proof photos out (they would multiply storage). Snapshots taken before a
 * restore/reset keep them, so those can be undone completely.
 */
export async function createSnapshot(
  reason: string,
  kind: Snapshot['kind'] = 'manual',
  opts: { attachments?: boolean } = {},
): Promise<Snapshot> {
  const json = await encodeBackup(await createBackup({ attachments: opts.attachments ?? kind === 'manual' }));
  const snap: Snapshot = { id: uid(), at: Date.now(), kind, reason, size: json.length, json };
  const d = await db();
  await d.put('snapshots', snap);
  // Prune oldest beyond the per-kind limit.
  const all = (await d.getAllFromIndex('snapshots', 'at')) as Snapshot[];
  const mine = all.filter((s) => s.kind === kind);
  for (const old of mine.slice(0, Math.max(0, mine.length - KEEP[kind]))) await d.delete('snapshots', old.id);
  return snap;
}

export type SnapshotInfo = Omit<Snapshot, 'json'>;

export async function listSnapshots(): Promise<SnapshotInfo[]> {
  const d = await db();
  const out: SnapshotInfo[] = [];
  let cur = await d.transaction('snapshots').store.index('at').openCursor(null, 'prev');
  while (cur) {
    const { json: _json, ...info } = cur.value as Snapshot;
    out.push(info);
    cur = await cur.continue();
  }
  return out;
}

export async function getSnapshotText(id: string): Promise<string | undefined> {
  return ((await (await db()).get('snapshots', id)) as Snapshot | undefined)?.json;
}

export async function deleteSnapshot(id: string) {
  await (await db()).delete('snapshots', id);
}

/** Takes a daily automatic snapshot if the last one is older than ~a day. Returns true if one was made. */
export async function autoSnapshotIfDue(now = Date.now()): Promise<boolean> {
  const list = await listSnapshots();
  const last = list.find((s) => s.kind === 'auto');
  if (last && now - last.at < 20 * 3600_000) return false;
  const counts = await Promise.all(['orders', 'products'].map(async (s) => (await db()).count(s)));
  if (counts.every((c) => c === 0)) return false; // nothing worth saving yet
  await createSnapshot('Automatic daily copy', 'auto');
  return true;
}
