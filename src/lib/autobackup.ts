import { registerPlugin } from '@capacitor/core';
import { signal } from '@preact/signals';
import { t } from '../i18n';
import { createBackup, encodeBackup } from './backup';
import { db } from './db';
import { isNative } from './device';
import { saveSettings } from './store';

/**
 * Automatic backup files (Android app). The user picks a folder once with the system folder picker; from then on the
 * app writes a dated backup file into it by itself and keeps only the newest few. There is no background service:
 * the check runs when the app opens, comes back to the foreground, every 30 minutes while it is open, and when a
 * shift is closed. The settings are device-local on purpose (the folder grant and the password belong to this phone,
 * and a password must never end up inside the backup files it protects).
 */

// Local Android plugin (android/app/src/main/java/com/pocketpos/app/BackupFolderPlugin.java).
export interface FolderFile {
  uri: string;
  name: string;
  size: number;
  modified: number;
}
export interface BackupFolderApi {
  pick(): Promise<{ cancelled?: boolean; uri?: string; name?: string }>;
  write(o: { uri: string; name: string; data: string; mime: string }): Promise<{ uri: string; bytes: number }>;
  list(o: { uri: string }): Promise<{ files: FolderFile[] }>;
  remove(o: { uri: string }): Promise<void>;
}

/** Replaceable in tests. */
export const deps: { native: BackupFolderApi; isNative: () => boolean; now: () => number } = {
  native: registerPlugin<BackupFolderApi>('BackupFolder'),
  isNative,
  now: () => Date.now(),
};

export const KEEP_COPIES = 7;
export type Every = 'daily' | 'weekly';

export interface AutoBackupConfig {
  on: boolean;
  uri: string; // the chosen folder (persisted Storage Access Framework tree URI)
  folder: string; // its display name
  every: Every;
  proofs: boolean; // include payment-proof photos
  password: string; // '' = not encrypted. Stored on this phone so backups can run unattended.
  lastAt: number; // last successful copy
  lastTry: number; // last attempt (so a failing folder isn't retried on every resume)
  lastName: string;
  lastError: string;
}

const KEY = 'pocketpos.autobackup';

const defaults = (): AutoBackupConfig => ({
  on: false, uri: '', folder: '', every: 'daily', proofs: true, password: '', lastAt: 0, lastTry: 0, lastName: '', lastError: '',
});

/** Accepts only well-typed fields from storage, so a damaged value can never break startup. */
export function sanitize(v: unknown): AutoBackupConfig {
  const d = defaults();
  if (!v || typeof v !== 'object') return d;
  const o = v as Record<string, unknown>;
  const str = (k: keyof AutoBackupConfig) => (typeof o[k] === 'string' ? (o[k] as string) : (d[k] as string));
  const num = (k: keyof AutoBackupConfig) => (typeof o[k] === 'number' && Number.isFinite(o[k]) ? (o[k] as number) : (d[k] as number));
  return {
    on: o.on === true,
    uri: str('uri'),
    folder: str('folder'),
    every: o.every === 'weekly' ? 'weekly' : 'daily',
    proofs: o.proofs !== false,
    password: str('password'),
    lastAt: num('lastAt'),
    lastTry: num('lastTry'),
    lastName: str('lastName'),
    lastError: str('lastError'),
  };
}

function read(): AutoBackupConfig {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return defaults();
  }
}

export const autoBackup = signal<AutoBackupConfig>(read());

export function updateAutoBackup(patch: Partial<AutoBackupConfig>) {
  autoBackup.value = { ...autoBackup.value, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(autoBackup.value));
  } catch {
    /* storage unavailable: the setting just won't survive a restart */
  }
}

export const canAutoBackup = () => deps.isNative();

const DAY = 86_400_000;

/** Is a new automatic copy due? Daily = the first run on each calendar day; weekly = about every 7 days. */
export function isDue(c: Pick<AutoBackupConfig, 'on' | 'uri' | 'every' | 'lastAt' | 'lastTry'>, now: number): boolean {
  if (!c.on || !c.uri) return false;
  if (c.lastTry > c.lastAt && now - c.lastTry < 30 * 60_000) return false; // last attempt failed: retry in 30 min, not on every resume
  if (!c.lastAt) return true;
  if (c.every === 'weekly') return now - c.lastAt >= 6.5 * DAY;
  return new Date(c.lastAt).toDateString() !== new Date(now).toDateString();
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `pocketpos-auto-20261002-143015.json` — sorts oldest → newest by name, and is never confused with a manual backup. */
export function autoBackupName(ts: number, encrypted: boolean): string {
  const d = new Date(ts);
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `pocketpos-auto-${stamp}${encrypted ? '.enc' : ''}.json`;
}

const AUTO_NAME = /^pocketpos-auto-\d{8}-\d{6}(\.enc)?\.json$/;

/** Names to delete so only the newest `keep` automatic copies stay. Anything else in the folder is never touched. */
export function copiesToDelete(names: string[], keep = KEEP_COPIES): string[] {
  const mine = names.filter((n) => AUTO_NAME.test(n)).sort();
  return mine.slice(0, Math.max(0, mine.length - keep));
}

/** Turns a native error code into something a shop owner can act on. */
export function describeError(e: unknown): string {
  const m = String((e as Error)?.message ?? e);
  if (/folder-unavailable/.test(m)) return t('The backup folder is no longer available. Choose a folder again.');
  return t('Could not write the backup file.');
}

export type RunResult = 'saved' | 'skipped' | 'failed';
export type Reason = 'startup' | 'resume' | 'timer' | 'shift' | 'manual';

let running = false;

/**
 * Writes an automatic copy if one is due (or `force`). Never throws: a failure is recorded in `lastError`, which the
 * Data & backup screen shows, and `lastBackupAt` only advances on success so the usual "save a backup" reminder still
 * fires if this keeps failing.
 */
export async function runAutoBackup(reason: Reason, force = false): Promise<RunResult> {
  if (running || !deps.isNative()) return 'skipped';
  const c = autoBackup.value;
  if (!c.on || !c.uri) return 'skipped';
  const now = deps.now();
  // Closing a shift is a natural save point, but not worth a new file if one was just made.
  const due = force || (reason === 'shift' ? now - c.lastAt > 60 * 60_000 : isDue(c, now));
  if (!due) return 'skipped';
  running = true;
  try {
    const d = await db();
    if (!force && (await d.count('orders')) + (await d.count('products')) === 0) return 'skipped'; // nothing worth saving yet
    updateAutoBackup({ lastTry: now });
    const b = await createBackup({ attachments: c.proofs, now });
    const text = await encodeBackup(b, c.password || undefined);
    const name = autoBackupName(b.createdAt, !!c.password);
    await deps.native.write({ uri: c.uri, name, data: text, mime: 'application/json' });
    updateAutoBackup({ lastAt: b.createdAt, lastName: name, lastError: '' });
    await saveSettings({ lastBackupAt: b.createdAt });
    try {
      const { files } = await deps.native.list({ uri: c.uri });
      for (const n of copiesToDelete(files.map((f) => f.name))) await deps.native.remove({ uri: files.find((f) => f.name === n)!.uri });
    } catch {
      /* the new copy is safely written; tidying up can wait for next time */
    }
    return 'saved';
  } catch (e) {
    updateAutoBackup({ lastError: describeError(e) });
    return 'failed';
  } finally {
    running = false;
  }
}

let started = false;

/** Call once after the app has loaded its data. */
export function startAutoBackup() {
  if (started || !deps.isNative()) return;
  started = true;
  void runAutoBackup('startup');
  setInterval(() => void runAutoBackup('timer'), 30 * 60_000);
  void import('@capacitor/app').then(({ App }) => {
    void App.addListener('appStateChange', (s) => {
      if (s.isActive) void runAutoBackup('resume');
    });
  });
}
