import { useState } from 'preact/hooks';
import { t, tn } from '../i18n';
import { autoBackup, canAutoBackup, deps, describeError, KEEP_COPIES, runAutoBackup, updateAutoBackup, type Every } from '../lib/autobackup';
import { hasSubtle } from '../lib/crypto';
import { formatBytes } from '../lib/platform';
import { showToast } from '../lib/store';
import { Icon, SectionTitle, Segmented, Sheet, Switch, TextInput } from '../ui/components';

/** Chooses (or re-chooses) the folder. Resolves true when a folder was picked. */
async function chooseFolder(): Promise<boolean> {
  try {
    const r = await deps.native.pick();
    if (r.cancelled || !r.uri) return false;
    updateAutoBackup({ uri: r.uri, folder: r.name ?? '', lastError: '' });
    return true;
  } catch (e) {
    showToast(describeError(e), 'error');
    return false;
  }
}

export function AutoBackupSection({ proofs, ago }: { proofs: { count: number; bytes: number }; ago: (ts: number) => string }) {
  const c = autoBackup.value;
  const [busy, setBusy] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  if (!canAutoBackup())
    return (
      <>
        <SectionTitle>{t('Automatic backup')}</SectionTitle>
        <div class="card pad muted small">{t('Automatic backup to a folder is available in the Android app. In a browser, use Back up now.')}</div>
      </>
    );

  async function backupNow(first = false) {
    setBusy(true);
    const r = await runAutoBackup('manual', true);
    setBusy(false);
    if (r === 'saved') showToast(first ? t('Automatic backup is on — first copy saved') : t('Backup saved to the folder'));
    else showToast(autoBackup.value.lastError || t('Could not write the backup file.'), 'error');
  }

  async function toggle(on: boolean) {
    if (!on) return updateAutoBackup({ on: false });
    if (!c.uri && !(await chooseFolder())) return; // no folder picked → it stays off
    updateAutoBackup({ on: true });
    await backupNow(true);
  }

  async function changeFolder() {
    if (await chooseFolder()) await backupNow();
  }

  return (
    <>
      <SectionTitle>{t('Automatic backup')}</SectionTitle>
      <div class="card pad stack">
        <Switch
          label={t('Back up automatically to a folder')}
          hint={t('Saves a backup file on its own into a folder you choose. Pick a folder that a sync app (Drive, Dropbox, OneDrive…) uploads, so a copy survives losing this phone.')}
          checked={c.on}
          onChange={toggle}
        />
        {c.on && (
          <>
            <div class="row between" style="gap:0.75rem">
              <div style="min-width:0">
                <div class="small muted">{t('Folder')}</div>
                <div class="bold ellipsis">{c.folder || '—'}</div>
              </div>
              <button class="btn sm" disabled={busy} onClick={changeFolder}>{t('Change folder')}</button>
            </div>

            <div>
              <div class="label muted small bold" style="margin-bottom:0.375rem">{t('How often')}</div>
              <Segmented<Every>
                value={c.every}
                onChange={(every) => updateAutoBackup({ every })}
                options={[{ value: 'daily', label: t('Every day') }, { value: 'weekly', label: t('Every week') }]}
              />
              <div class="hint">{t('Also saved when you close a shift. The newest {n} copies are kept; older automatic copies are deleted.', { n: KEEP_COPIES })}</div>
            </div>

            {proofs.count > 0 && (
              <Switch
                label={t('Include payment proofs')}
                hint={`${tn(proofs.count, '{n} photo', '{n} photos')} · ${formatBytes(proofs.bytes)}`}
                checked={c.proofs}
                onChange={(proofs) => updateAutoBackup({ proofs })}
              />
            )}

            <Switch
              label={t('Protect with a password')}
              hint={hasSubtle() ? t('Recommended — the file contains customer details') : t('Needs a secure (https) connection')}
              checked={!!c.password}
              onChange={(v) => (v ? hasSubtle() && setPwOpen(true) : updateAutoBackup({ password: '' }))}
            />
            {c.password && <button class="btn sm" onClick={() => setPwOpen(true)}>{t('Change password')}</button>}

            {c.lastError ? (
              <div class="banner bad" style="align-items:flex-start">
                <Icon name="alert" />
                <div>
                  <div class="bold">{t('Automatic backup needs attention')}</div>
                  <div class="small">{c.lastError}</div>
                </div>
              </div>
            ) : (
              <div class="small muted">
                {t('Last automatic backup: {when}', { when: ago(c.lastAt) })}
                {c.lastName && <div class="ellipsis">{c.lastName}</div>}
              </div>
            )}
            <button class="btn block" disabled={busy} onClick={() => backupNow()}>
              <Icon name="download" /> {busy ? t('Working…') : t('Back up now to this folder')}
            </button>
            <div class="hint">{t('To restore, use Restore from backup file and pick one of the files in this folder.')}</div>
          </>
        )}
      </div>
      {pwOpen && <PasswordSheet onClose={() => setPwOpen(false)} />}
    </>
  );
}

function PasswordSheet({ onClose }: { onClose: () => void }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const ok = pw.length >= 6 && pw === pw2;
  return (
    <Sheet
      title={t('Protect with a password')}
      onClose={onClose}
      footer={
        <button class="btn primary" disabled={!ok} onClick={() => { updateAutoBackup({ password: pw }); onClose(); }}>
          {t('Save')}
        </button>
      }
    >
      <div class="stack">
        <TextInput label={t('Password (6+ characters)')} type="password" value={pw} autofocus onInput={(e) => setPw((e.currentTarget as HTMLInputElement).value)} autocomplete="new-password" />
        <TextInput label={t('Repeat password')} type="password" value={pw2} onInput={(e) => setPw2((e.currentTarget as HTMLInputElement).value)} autocomplete="new-password" hint={pw2 && pw !== pw2 ? t('Passwords do not match') : undefined} />
        <div class="banner bad"><div>{t('If you forget this password the backup cannot be opened — not even by us. Write it down.')}</div></div>
        <div class="hint">{t('The password is kept on this phone so backups can run by themselves. Keep a copy of it somewhere else — you need it to restore.')}</div>
      </div>
    </Sheet>
  );
}
