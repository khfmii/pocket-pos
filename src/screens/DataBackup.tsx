import { useEffect, useState } from 'preact/hooks';
import {
  attachmentStats, autoSnapshotIfDue, BackupError, backupFilename, createBackup, createSnapshot, decodeBackup, deleteSnapshot,
  describeBackup, encodeBackup, getSnapshotText, isEncryptedBackup, listSnapshots, type BackupFile, type RestoreMode,
  type RestoreResult, type SnapshotInfo,
} from '../lib/backup';
import { t, tn } from '../i18n';
import { hasSubtle } from '../lib/crypto';
import { toCsv } from '../lib/csv';
import { db, ordersBetween } from '../lib/db';
import { loadSampleData } from '../lib/demo';
import { toInput } from '../lib/money';
import { formatBytes, formatDate, formatDateTime, isNative, pickFile, saveTextFile, shareTextFile } from '../lib/platform';
import {
  applyRestore, clearCart, customers, deleteAttachmentsOlderThan, ingredients, loadAll, products, resetAllData, saveSettings, settings,
  showToast, users,
} from '../lib/store';
import { confirmDialog, Icon, Row, SectionTitle, Segmented, Sheet, Switch, TextInput } from '../ui/components';
import { AutoBackupSection } from './AutoBackup';
import { importProductsCsv, productsCsv } from './Products';

/** Days since the last backup file, `Infinity` if never, or null when no reminder is due. */
export function backupReminder(): number | null {
  const s = settings.value;
  if (!s.setupDone || s.backupReminderDays <= 0) return null;
  if (!products.value.length && !customers.value.length) return null;
  if (!s.lastBackupAt) return Infinity;
  const days = (Date.now() - s.lastBackupAt) / 86_400_000;
  return days >= s.backupReminderDays ? Math.floor(days) : null;
}

export const agoText = (ts: number) => {
  if (!ts) return t('never');
  const mins = Math.round((Date.now() - ts) / 60_000);
  if (mins < 1) return t('just now');
  if (mins < 60) return t('{n} min ago', { n: mins });
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return t('{n} h ago', { n: hrs });
  const days = Math.round(hrs / 24);
  return days === 1 ? t('yesterday') : t('{n} days ago', { n: days });
};

// ============================================================ main screen

export function DataBackup({ onClose }: { onClose: () => void }) {
  const s = settings.value;
  const [counts, setCounts] = useState({ orders: 0, products: 0, customers: 0 });
  const [proofs, setProofs] = useState({ count: 0, bytes: 0 });
  const [snaps, setSnaps] = useState<SnapshotInfo[]>([]);
  const [making, setMaking] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [restoreText, setRestoreText] = useState<{ text: string; source: string; fromFile: boolean } | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((x) => x + 1);

  useEffect(() => {
    (async () => {
      const d = await db();
      setCounts({ orders: await d.count('orders'), products: await d.count('products'), customers: await d.count('customers') });
      setProofs(await attachmentStats());
      setSnaps(await listSnapshots());
    })();
  }, [tick, s.lastBackupAt]);

  async function chooseFile() {
    const f = await pickFile('.json,application/json,text/plain,*/*');
    if (!f) return;
    try {
      setRestoreText({ text: await f.text(), source: f.name, fromFile: true });
    } catch {
      showToast(t('Could not read that file'), 'error');
    }
  }

  const stale = !s.lastBackupAt || (s.backupReminderDays > 0 && Date.now() - s.lastBackupAt > s.backupReminderDays * 86_400_000);
  const hasData = counts.orders + counts.products + counts.customers > 0;

  return (
    <Sheet title={t('Data & backup')} onClose={onClose} full>
      <div class="stack">
        <div class={`banner ${!hasData ? 'info' : stale ? '' : 'ok'}`} style="align-items:flex-start">
          <Icon name={stale && hasData ? 'alert' : 'shield'} />
          <div>
            <div class="bold">{!hasData ? t('Nothing to back up yet') : s.lastBackupAt ? t('Last backup file: {when}', { when: agoText(s.lastBackupAt) }) : t('You have never saved a backup file')}</div>
            <div class="small" style="margin-top:2px">
              {t('{sales} sales · {items} items · {customers} customers are stored only on this phone.', { sales: counts.orders, items: counts.products, customers: counts.customers })}
              {hasData && stale && ` ${t('If the phone is lost, reset or the app is uninstalled, they are gone. Save a backup file somewhere safe (Drive, email, computer).')}`}
            </div>
          </div>
        </div>

        <button class="btn primary lg block" onClick={() => setMaking(true)}>
          <Icon name="download" /> {t('Back up now')}
        </button>
        <button class="btn lg block" onClick={chooseFile}>
          <Icon name="restore" /> {t('Restore from backup file')}
        </button>

        <AutoBackupSection proofs={proofs} ago={agoText} />

        <SectionTitle>{t('Safety copies on this device')}</SectionTitle>
        <div class="hint" style="margin-top:-4px">
          {t('The app keeps recent copies automatically (daily, at the end of each shift, and before any restore or reset), so a mistake can be undone. These live inside the app, so they do not protect against losing the phone or uninstalling — save a backup file for that.')}
        </div>
        {snaps.length === 0 ? (
          <div class="card pad muted small">{t('No safety copies yet.')}</div>
        ) : (
          <div class="list">
            {snaps.map((sn) => (
              <SnapshotRow key={sn.id} sn={sn} onChanged={refresh} onRestore={(text) => setRestoreText({ text, source: t('Safety copy · {when}', { when: formatDateTime(sn.at) }), fromFile: false })} />
            ))}
          </div>
        )}
        <button
          class="btn block"
          onClick={async () => {
            await createSnapshot(t('Manual copy'), 'manual');
            showToast(t('Safety copy saved'));
            refresh();
          }}
        >
          {t('Save a safety copy now')}
        </button>

        <SectionTitle>{t('Automation')}</SectionTitle>
        <div class="card pad">
          <Switch label={t('Daily safety copy')} hint={t('Taken the first time you open the app each day')} checked={s.autoSnapshot} onChange={async (v) => { await saveSettings({ autoSnapshot: v }); if (v) await autoSnapshotIfDue(); refresh(); }} />
          <label class="field" style="margin-top:0.375rem">
            <span class="label">{t('Remind me to save a backup file')}</span>
            <select class="select" value={s.backupReminderDays} onChange={(e) => saveSettings({ backupReminderDays: Number((e.currentTarget as HTMLSelectElement).value) })}>
              <option value={0}>{t('Never')}</option>
              <option value={1}>{t('Every day')}</option>
              <option value={3}>{t('Every 3 days')}</option>
              <option value={7}>{t('Every week')}</option>
              <option value={14}>{t('Every 2 weeks')}</option>
              <option value={30}>{t('Every month')}</option>
            </select>
          </label>
        </div>

        <SectionTitle>{t('Payment proofs')}</SectionTitle>
        <div class="list">
          <Row
            icon="paperclip"
            title={tn(proofs.count, '{n} photo', '{n} photos')}
            sub={proofs.count ? `${formatBytes(proofs.bytes)} · ${t('Bank slips and other proofs attached to sales')}` : t('Bank slips and other proofs attached to sales')}
          />
          {proofs.count > 0 && <Row icon="trash" title={t('Delete old payment proofs…')} sub={t('Free up space; the sales stay')} onClick={() => setCleaning(true)} />}
        </div>

        <SectionTitle>{t('Spreadsheets (CSV)')}</SectionTitle>
        <div class="list">
          <Row icon="file" title={t('Export items')} sub={t('Name, price, stock, barcode…')} onClick={() => saveTextFile('pocketpos-items.csv', productsCsv(), 'text/csv')} />
          <Row icon="file" title={t('Export customers')} onClick={() => saveTextFile('pocketpos-customers.csv', toCsv([['name', 'phone', 'email', 'points', 'remark'], ...customers.value.map((c) => [c.name, c.phone, c.email, c.points, c.note])]), 'text/csv')} />
          <Row icon="file" title={t('Export all sales')} sub={t('Every receipt, one row each')} onClick={async () => {
            const dec = settings.value.currencyDecimals;
            const m = (n: number) => toInput(n, dec) || '0';
            const all = (await ordersBetween(0, Date.now() + 86_400_000)).sort((a, b) => a.at - b.at);
            await saveTextFile('pocketpos-sales-all.csv', toCsv([['receipt', 'date', 'time', 'status', 'staff', 'customer', 'subtotal', 'discount', 'tax', 'total'], ...all.map((o) => [o.number, new Date(o.at).toISOString().slice(0, 10), new Date(o.at).toTimeString().slice(0, 5), o.status, o.userName, o.customerName, m(o.subtotal), m(o.orderDiscount), m(o.tax), m(o.total)])]), 'text/csv');
          }} />
          <Row icon="upload" title={t('Import items from CSV')} sub={csvBusy ? t('Importing…') : t('Adds or updates items')} onClick={async () => {
            const f = await pickFile('.csv,text/csv');
            if (!f) return;
            setCsvBusy(true);
            try { const r = await importProductsCsv(await f.text()); showToast(t('{created} added, {updated} updated', { created: r.created, updated: r.updated })); refresh(); } catch (e) { showToast((e as Error).message, 'error'); } finally { setCsvBusy(false); }
          }} />
        </div>
        <div class="hint">{t('CSV files are for spreadsheets. To move or protect everything (sales, staff, settings), use a backup file.')}</div>

        <SectionTitle>{t('Danger zone')}</SectionTitle>
        <div class="list">
          {counts.products === 0 && <Row icon="star" title={t('Load sample data')} sub={t('A demo shop with two weeks of sales')} onClick={async () => { await loadSampleData(); await loadAll(); refresh(); showToast(t('Sample data loaded')); }} />}
          <Row icon="trash" title={t('Erase all data')} sub={t('Removes everything from this device')} onClick={() => eraseAll(refresh)} />
        </div>
      </div>

      {making && <MakeBackup onClose={() => setMaking(false)} onDone={refresh} proofs={proofs} />}
      {cleaning && <CleanProofs onClose={() => setCleaning(false)} onDone={refresh} />}
      {restoreText && (
        <RestoreFlow
          text={restoreText.text}
          source={restoreText.source}
          fromFile={restoreText.fromFile}
          onClose={() => { setRestoreText(null); refresh(); }}
          onRestored={refresh}
        />
      )}
    </Sheet>
  );
}

async function eraseAll(after: () => void) {
  if (!(await confirmDialog({ title: t('Erase everything?'), message: t('All sales, items, customers, staff and settings on this device will be deleted. A safety copy is kept inside the app for now, but save a backup file first if you might want this data again.'), confirmLabel: t('Erase all data'), danger: true }))) return;
  if (!(await confirmDialog({ title: t('Are you sure?'), message: t('This cannot be undone from outside the app.'), confirmLabel: t('Yes, erase'), danger: true }))) return;
  clearCart();
  await resetAllData();
  showToast(t('All data erased'));
  after();
}

function CleanProofs({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [days, setDays] = useState('90');
  return (
    <Sheet
      title={t('Delete old payment proofs')}
      onClose={onClose}
      footer={
        <button
          class="btn danger"
          onClick={async () => {
            if (!(await confirmDialog({ title: t('Delete payment proofs older than {n} days?', { n: days }), message: t('The photos are removed for good. The sales themselves are not touched. Save a backup file first if you may need them.'), confirmLabel: t('Delete'), danger: true }))) return;
            const n = await deleteAttachmentsOlderThan(Number(days));
            showToast(tn(n, 'Deleted {n} photo', 'Deleted {n} photos'));
            onDone();
            onClose();
          }}
        >
          {t('Delete')}
        </button>
      }
    >
      <div class="stack">
        <div class="muted">{t('Keep recent payment proofs and remove older ones to save space on the phone.')}</div>
        <Segmented value={days} onChange={setDays} options={[{ value: '30', label: t('30 days') }, { value: '90', label: t('90 days') }, { value: '180', label: t('180 days') }, { value: '365', label: t('1 year') }]} />
      </div>
    </Sheet>
  );
}

function SnapshotRow({ sn, onChanged, onRestore }: { sn: SnapshotInfo; onChanged: () => void; onRestore: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button class="list-row" onClick={() => setOpen(true)}>
        <div class="lead"><Icon name="history" /></div>
        <div class="grow">
          <div class="bold">{sn.reason}</div>
          <div class="sub">{formatDateTime(sn.at)} · {formatBytes(sn.size)}</div>
        </div>
        <Icon name="right" class="chev" />
      </button>
      {open && (
        <Sheet title={sn.reason} onClose={() => setOpen(false)}>
          <div class="muted small" style="margin-bottom:0.75rem">{formatDateTime(sn.at)} · {formatBytes(sn.size)}</div>
          <div class="list">
            <Row icon="restore" title={t('Restore this copy')} onClick={async () => { const x = await getSnapshotText(sn.id); if (x) { setOpen(false); onRestore(x); } }} />
            <Row icon="share" title={t('Save as a backup file')} onClick={async () => { const x = await getSnapshotText(sn.id); if (x) await saveTextFile(backupFilename(sn.at, false), x); }} />
            <Row icon="trash" title={t('Delete')} onClick={async () => { await deleteSnapshot(sn.id); setOpen(false); onChanged(); }} />
          </div>
        </Sheet>
      )}
    </>
  );
}

// ============================================================ make a backup

function MakeBackup({ onClose, onDone, proofs }: { onClose: () => void; onDone: () => void; proofs: { count: number; bytes: number } }) {
  const [protect, setProtect] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [withProofs, setWithProofs] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ name: string; size: number; encrypted: boolean; where: string; proofs: boolean } | null>(null);
  const canEncrypt = hasSubtle();
  const pwOk = !protect || (pw.length >= 6 && pw === pw2);

  async function run(share: boolean) {
    setBusy(true);
    try {
      const b = await createBackup({ attachments: withProofs });
      const text = await encodeBackup(b, protect ? pw : undefined);
      const name = backupFilename(b.createdAt, protect);
      const outcome = await (share ? shareTextFile : saveTextFile)(name, text);
      if (outcome === 'cancelled') return;
      await saveSettings({ lastBackupAt: Date.now() });
      setResult({ name, size: text.length, encrypted: protect, where: outcome === 'saved' ? t('your Downloads folder') : t('the app you picked'), proofs: withProofs && proofs.count > 0 });
      onDone();
    } catch (e) {
      showToast(t('Backup failed: {msg}', { msg: (e as Error).message }), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (result)
    return (
      <Sheet title={t('Backup saved')} onClose={onClose} footer={<button class="btn primary" onClick={onClose}>{t('Done')}</button>}>
        <div class="stack center">
          <div class="success-mark"><Icon name="check" size="lg" /></div>
          <div class="bold">{result.name}</div>
          <div class="muted small">{formatBytes(result.size)} · {t('sent to {where}', { where: result.where })}{result.encrypted ? ` · ${t('password protected')}` : ''}{result.proofs ? ` · ${t('includes payment proofs')}` : ''}</div>
          <div class="banner info" style="text-align:start"><div>
            {t('Keep this file somewhere other than this phone — Google Drive, email to yourself, or a computer. To restore, open Data & backup → Restore from backup file.')}{result.encrypted ? ` ${t('Enter your password when asked.')}` : ''}
          </div></div>
        </div>
      </Sheet>
    );

  return (
    <Sheet
      title={t('Back up now')}
      onClose={onClose}
      footer={
        <button class="btn primary" disabled={busy || !pwOk} onClick={() => run(false)}>
          {busy ? t('Working…') : isNative() ? t('Create & choose where to save') : t('Download backup file')}
        </button>
      }
    >
      <div class="stack">
        <div class="muted">
          {t('One file with all your sales, items, customers, staff and settings.')} {isNative() ? t('You will pick where to save it (Drive, Files, email…).') : t('It is saved to your Downloads folder.')}
        </div>
        {proofs.count > 0 && (
          <div class="card pad">
            <Switch label={t('Include payment proofs')} hint={`${tn(proofs.count, '{n} photo', '{n} photos')} · ${formatBytes(proofs.bytes)}`} checked={withProofs} onChange={setWithProofs} />
            {!withProofs && <div class="hint">{t('The file will be smaller. When you restore it, photos already on the phone are kept.')}</div>}
          </div>
        )}
        <div class="card pad">
          <Switch label={t('Protect with a password')} hint={canEncrypt ? t('Recommended — the file contains customer details') : t('Needs a secure (https) connection')} checked={protect && canEncrypt} onChange={(v) => canEncrypt && setProtect(v)} />
          {protect && (
            <div class="stack" style="margin-top:0.625rem">
              <TextInput label={t('Password (6+ characters)')} type="password" value={pw} onInput={(e) => setPw((e.currentTarget as HTMLInputElement).value)} autocomplete="new-password" />
              <TextInput label={t('Repeat password')} type="password" value={pw2} onInput={(e) => setPw2((e.currentTarget as HTMLInputElement).value)} autocomplete="new-password" hint={pw2 && pw !== pw2 ? t('Passwords do not match') : undefined} />
              <div class="banner bad"><div>{t('If you forget this password the backup cannot be opened — not even by us. Write it down.')}</div></div>
            </div>
          )}
        </div>
        {!isNative() && typeof navigator.share === 'function' && (
          <button class="btn block" disabled={busy || !pwOk} onClick={() => run(true)}><Icon name="share" /> {t('Share instead…')}</button>
        )}
      </div>
    </Sheet>
  );
}

// ============================================================ restore

const backupErrorText = (e: BackupError): string => {
  switch (e.code) {
    case 'needs-password':
      return t('This backup is password protected.');
    case 'wrong-password':
      return t('Wrong password, or the file is damaged.');
    case 'newer-version':
      return t('This backup was made by a newer version of Pocket POS. Update the app first.');
    case 'not-backup':
      return t('This file is not a Pocket POS backup.');
    default:
      return t('The backup is damaged or incomplete.');
  }
};

export function RestoreFlow({
  text, source, onClose, onRestored, fromFile = true,
}: {
  text: string;
  source: string;
  onClose: () => void;
  onRestored: (r: RestoreResult) => void;
  /** True for a backup file the user saved elsewhere; false for the app's own safety copies. */
  fromFile?: boolean;
}) {
  const [password, setPassword] = useState('');
  const [backup, setBackup] = useState<BackupFile | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<RestoreMode>('replace');
  const [clearPins, setClearPins] = useState(false);
  const [result, setResult] = useState<RestoreResult | null>(null);
  const [current, setCurrent] = useState({ orders: 0, products: 0, customers: 0, proofs: 0, costs: 0 });
  const encrypted = isEncryptedBackup(text);

  async function decode(pw?: string) {
    setBusy(true);
    setError('');
    try {
      setBackup(await decodeBackup(text, pw));
    } catch (e) {
      setError(e instanceof BackupError ? backupErrorText(e) : t('This file could not be read.'));
      if (!(e instanceof BackupError) || e.code !== 'wrong-password') setBackup(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!encrypted) decode();
    (async () => {
      const d = await db();
      setCurrent({ orders: await d.count('orders'), products: await d.count('products'), customers: await d.count('customers'), proofs: await d.count('attachments'), costs: await d.count('expenses') });
    })();
  }, []);

  async function run() {
    if (!backup) return;
    const hasLocal = current.orders + current.products + current.customers > 0;
    if (mode === 'replace' && hasLocal && !(await confirmDialog({
      title: t('Replace data on this device?'),
      message: t('This device has {sales} sales, {items} items and {customers} customers that will be replaced by the backup. A safety copy is kept so you can undo.', { sales: current.orders, items: current.products, customers: current.customers }),
      confirmLabel: t('Replace'), danger: true,
    }))) return;
    setBusy(true);
    try {
      const r = await applyRestore(backup, mode, { fromFile, clearPins });
      setResult(r);
      showToast(r.mode === 'replace' ? t('Backup restored') : t('Backup merged'));
      onRestored(r);
    } catch (e) {
      setError(t('Restore failed and nothing was changed. ({msg})', { msg: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  }

  if (result)
    return (
      <Sheet title={t('Restore complete')} onClose={onClose} footer={<button class="btn primary" onClick={onClose}>{t('Done')}</button>}>
        <div class="stack center">
          <div class="success-mark"><Icon name="check" size="lg" /></div>
          <div class="bold">{result.mode === 'replace' ? t('Restored {n} records', { n: result.added }) : t('Merged: {added} added, {updated} updated, {skipped} already up to date', { added: result.added, updated: result.updated, skipped: result.skipped })}</div>
          <div class="muted small">{t('Your data from {when} is now on this device.', { when: backup ? formatDateTime(backup.createdAt) : '' })}</div>
        </div>
      </Sheet>
    );

  // Password gate for encrypted backups.
  if (encrypted && !backup)
    return (
      <Sheet title={t('Password needed')} onClose={onClose} footer={<button class="btn primary" disabled={!password || busy} onClick={() => decode(password)}>{busy ? t('Unlocking…') : t('Unlock backup')}</button>}>
        <div class="stack">
          <div class="muted small">{source}</div>
          <TextInput label={t('Backup password')} type="password" value={password} autofocus onInput={(e) => setPassword((e.currentTarget as HTMLInputElement).value)} />
          {error && <div class="banner bad"><div>{error}</div></div>}
        </div>
      </Sheet>
    );

  if (!backup)
    return (
      <Sheet title={t('Can’t restore')} onClose={onClose} footer={<button class="btn" onClick={onClose}>{t('Close')}</button>}>
        {busy ? <div class="muted">{t('Reading backup…')}</div> : <div class="banner bad"><div>{error || t('This file could not be read.')}</div></div>}
      </Sheet>
    );

  const info = describeBackup(backup);
  const row = (label: string, inB: number, now: number) => (
    <>
      <dt>{label}</dt>
      <dd>{inB} <span class="muted">({t('now {n}', { n: now })})</span></dd>
    </>
  );

  return (
    <Sheet
      title={t('Restore backup')}
      onClose={onClose}
      footer={
        <button class={`btn ${mode === 'replace' ? 'danger' : 'primary'}`} disabled={busy} onClick={run}>
          {busy ? t('Restoring…') : mode === 'replace' ? t('Replace my data') : t('Merge into my data')}
        </button>
      }
    >
      <div class="stack">
        <div class="card pad">
          <div class="bold">{info.storeName || t('Pocket POS backup')}</div>
          <div class="muted small">{source} · {t('made {when}', { when: formatDateTime(info.createdAt) })}</div>
          <dl class="dl" style="margin-top:0.625rem">
            {row(t('Sales'), info.counts.orders, current.orders)}
            {row(t('Items'), info.counts.products, current.products)}
            {row(t('Ingredients'), info.counts.ingredients, ingredients.value.length)}
            {row(t('Customers'), info.counts.customers, current.customers)}
            {row(t('Costs'), info.counts.expenses, current.costs)}
            {row(t('Staff accounts'), info.counts.users, users.value.length)}
            {info.attachmentsIncluded ? row(t('Payment proofs'), info.counts.attachments, current.proofs) : (<><dt>{t('Payment proofs')}</dt><dd class="muted">{t('not included')}</dd></>)}
          </dl>
          {info.firstOrderAt > 0 && <div class="small muted" style="margin-top:0.5rem">{t('Sales from {a} to {b}', { a: formatDate(info.firstOrderAt), b: formatDate(info.lastOrderAt) })}</div>}
          {!info.attachmentsIncluded && current.proofs > 0 && <div class="small muted" style="margin-top:0.375rem">{t('Payment proof photos already on this phone will be kept.')}</div>}
        </div>

        <Segmented value={mode} onChange={setMode} options={[{ value: 'replace', label: t('Replace') }, { value: 'merge', label: t('Merge') }]} />
        {mode === 'replace' ? (
          <div class="banner">
            <Icon name="alert" />
            <div>{t('Replace makes this device exactly match the backup. Anything added since the backup was made will be removed. Best for a new phone or after a reset.')}</div>
          </div>
        ) : (
          <div class="banner info">
            <Icon name="shield" />
            <div>{t('Merge adds anything missing from this device and keeps whichever copy of an item was edited most recently. Nothing is deleted and your current settings stay. Best for combining two devices — it is not live sync.')}</div>
          </div>
        )}
        {mode === 'replace' && backup.data.users.some((u) => u.pinHash) && (
          <Switch label={t('Remove staff PINs after restoring')} hint={t('Use this if you forgot the owner PIN. You can set new PINs in Settings.')} checked={clearPins} onChange={setClearPins} />
        )}
        {error && <div class="banner bad"><div>{error}</div></div>}
      </div>
    </Sheet>
  );
}
