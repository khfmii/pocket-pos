import { useState } from 'preact/hooks';
import { t, tn } from '../i18n';
import { APP_VERSION } from '../lib/backup';
import { pickLogo } from '../lib/image';
import { CURRENCIES, currencyName, decimalsFor } from '../lib/money';
import { clearUserPin, saveSettings, saveUser, session, settings, showToast, users } from '../lib/store';
import type { Role, Settings as SettingsRec, User } from '../lib/types';
import { confirmDialog, digitsOnly, Avatar, Field, Icon, MoneyInput, NumberInput, Row, SectionTitle, Segmented, Sheet, Switch, TextInput } from '../ui/components';
import { DataBackup, agoText } from './DataBackup';
import { DisplayPrefs } from './DisplayPrefs';
import { NameLanguagesSheet } from './ItemNames';
import { PrinterSection } from './Printer';
import { ReceiptPreviewSheet } from './Receipt';

type Page = null | 'store' | 'tax' | 'receipt' | 'names' | 'loyalty' | 'staff' | 'data' | 'display' | 'about';

export function SettingsScreen({ onClose }: { onClose: () => void }) {
  const s = settings.value;
  const [page, setPage] = useState<Page>(null);
  const n = String(s.receiptNext).padStart(4, '0');
  return (
    <Sheet title={t('Settings')} onClose={onClose} full>
      <div class="stack">
        <div class="list">
          <Row icon="store" title={t('Store profile')} sub={s.storeName} onClick={() => setPage('store')} />
          <Row icon="percent" title={t('Currency & tax')} sub={`${s.currency} · ${s.taxRate ? `${s.taxName} ${s.taxRate}%${s.taxInclusive ? ` ${t('included')}` : ''}` : t('No tax')}`} onClick={() => setPage('tax')} />
          <Row icon="receipt" title={t('Receipts')} sub={t('{width} mm · next {number}', { width: s.paperWidth, number: `${s.receiptPrefix}${n}` })} onClick={() => setPage('receipt')} />
          <Row icon="type" title={t('Item name languages')} sub={s.nameLangs?.length ? s.nameLangs.join(' · ') : t('Off')} onClick={() => setPage('names')} />
          <Row icon="star" title={t('Loyalty points')} sub={s.loyaltyEnabled ? t('{n} pt per 1 {currency}', { n: s.pointsPerUnit, currency: s.currency }) : t('Off')} onClick={() => setPage('loyalty')} />
        </div>
        <div class="list">
          <Row icon="globe" title={t('Language & display size')} sub={t('Language, bigger text, high contrast')} onClick={() => setPage('display')} />
          <Row icon="users" title={t('Staff & security')} sub={tn(users.value.filter((u) => u.active).length, '{n} account', '{n} accounts') + (s.lockMinutes ? ` · ${t('auto-lock {n} min', { n: s.lockMinutes })}` : '')} onClick={() => setPage('staff')} />
          <Row icon="database" title={t('Data & backup')} sub={t('Last backup file: {when}', { when: agoText(s.lastBackupAt) })} onClick={() => setPage('data')} />
        </div>
        <div>
          <SectionTitle>{t('Theme')}</SectionTitle>
          <Segmented value={s.theme} onChange={(theme) => saveSettings({ theme })} options={[{ value: 'system', label: t('Automatic') }, { value: 'light', label: t('Light') }, { value: 'dark', label: t('Dark') }]} />
        </div>
        <div class="list">
          <Row icon="shield" title={t('About Pocket POS')} sub={t('Version {v} · works fully offline', { v: APP_VERSION })} onClick={() => setPage('about')} />
        </div>
      </div>
      {page === 'store' && <StoreSheet onClose={() => setPage(null)} />}
      {page === 'tax' && <TaxSheet onClose={() => setPage(null)} />}
      {page === 'receipt' && <ReceiptSheet onClose={() => setPage(null)} />}
      {page === 'names' && <NameLanguagesSheet onClose={() => setPage(null)} />}
      {page === 'loyalty' && <LoyaltySheet onClose={() => setPage(null)} />}
      {page === 'staff' && <StaffSheet onClose={() => setPage(null)} />}
      {page === 'data' && <DataBackup onClose={() => setPage(null)} />}
      {page === 'display' && (
        <Sheet title={t('Language & display size')} onClose={() => setPage(null)} full>
          <DisplayPrefs />
        </Sheet>
      )}
      {page === 'about' && (
        <Sheet title={t('About')} onClose={() => setPage(null)}>
          <div class="stack">
            <div class="muted">{t('Pocket POS keeps everything on this device. There is no account and no server, so it works without internet.')}</div>
            <div class="muted">{t('Because nothing is stored in the cloud, backup files are your safety net. Save one regularly from Settings → Data & backup.')}</div>
            <div class="small muted">{t('Version {v}', { v: APP_VERSION })}</div>
          </div>
        </Sheet>
      )}
    </Sheet>
  );
}

function useDraft(keys: (keyof SettingsRec)[], onClose: () => void) {
  const [d, setD] = useState<SettingsRec>(settings.value);
  const set = <K extends keyof SettingsRec>(k: K, v: SettingsRec[K]) => setD((c) => ({ ...c, [k]: v }));
  const save = async () => {
    const patch: Partial<SettingsRec> = {};
    for (const k of keys) (patch as any)[k] = d[k];
    await saveSettings(patch);
    showToast(t('Saved'));
    onClose();
  };
  return { d, set, save };
}

const SaveBtn = ({ onClick }: { onClick: () => void }) => <button class="btn primary" onClick={onClick}>{t('Save')}</button>;
const val = (e: Event) => (e.currentTarget as HTMLInputElement).value;

function LogoEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function choose() {
    setBusy(true);
    try {
      const img = await pickLogo();
      if (img) onChange(img);
    } catch {
      showToast(t('Could not read that photo.'), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div class="label muted small bold" style="margin-bottom:0.375rem">{t('Logo')}</div>
      <div class="photo-edit">
        <div class="logo-box">{value ? <img src={value} alt="" /> : <Icon name="image" />}</div>
        <div class="stack grow" style="gap:0.5rem">
          <button class="btn sm" disabled={busy} onClick={choose}><Icon name="image" size="sm" /> {t('Choose logo')}</button>
          {value && <button class="btn sm danger-ghost" onClick={() => onChange('')}>{t('Remove logo')}</button>}
        </div>
      </div>
      <div class="hint">{t('Shown at the top of receipts. A simple, high-contrast image works best.')}</div>
    </div>
  );
}

function StoreSheet({ onClose }: { onClose: () => void }) {
  const { d, set, save } = useDraft(['storeName', 'address', 'phone', 'email', 'website', 'taxId', 'logo'], onClose);
  const [preview, setPreview] = useState(false);
  return (
    <Sheet title={t('Store profile')} onClose={onClose} footer={<SaveBtn onClick={save} />}>
      <div class="stack">
        <LogoEditor value={d.logo} onChange={(v) => set('logo', v)} />
        <TextInput label={t('Store name')} value={d.storeName} onInput={(e) => set('storeName', val(e))} />
        <Field label={t('Address')}>
          <textarea class="textarea" rows={3} value={d.address} onInput={(e) => set('address', (e.currentTarget as HTMLTextAreaElement).value)} />
        </Field>
        <TextInput label={t('Phone')} type="tel" value={d.phone} onInput={(e) => set('phone', val(e))} />
        <TextInput label={t('Email')} type="email" value={d.email} onInput={(e) => set('email', val(e))} />
        <TextInput label={t('Website or social')} value={d.website} onInput={(e) => set('website', val(e))} placeholder={t('e.g. www.mycafe.com or @mycafe')} />
        <TextInput label={t('Tax / business ID')} value={d.taxId} onInput={(e) => set('taxId', val(e))} hint={t('Printed on receipts if filled in.')} />
        <button class="btn soft block" onClick={() => setPreview(true)}><Icon name="receipt" /> {t('Preview receipt')}</button>
      </div>
      {preview && <ReceiptPreviewSheet draft={d} onClose={() => setPreview(false)} />}
    </Sheet>
  );
}

function TaxSheet({ onClose }: { onClose: () => void }) {
  const { d, set, save } = useDraft(['currency', 'currencyDecimals', 'taxName', 'taxRate', 'taxInclusive'], onClose);
  const hasSales = settings.value.receiptNext > 1;
  return (
    <Sheet title={t('Currency & tax')} onClose={onClose} footer={<SaveBtn onClick={save} />}>
      <div class="stack">
        <label class="field">
          <span class="label">{t('Currency')}</span>
          <select class="select" value={d.currency} onChange={(e) => { const c = val(e); set('currency', c); set('currencyDecimals', decimalsFor(c)); }}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {currencyName(c.code, c.name)}</option>)}
          </select>
        </label>
        {hasSales && d.currencyDecimals !== settings.value.currencyDecimals && (
          <div class="banner bad"><div>{t('Changing between currencies with different decimals will misread past amounts. Only change currency before your first sales.')}</div></div>
        )}
        <div class="grid2">
          <TextInput label={t('Tax name')} value={d.taxName} onInput={(e) => set('taxName', val(e))} placeholder={t('VAT, GST, SST…')} />
          <NumberInput label={t('Tax rate %')} value={d.taxRate} decimals max={100} onChange={(n) => set('taxRate', n)} />
        </div>
        <Segmented
          value={d.taxInclusive ? 'in' : 'ex'}
          onChange={(v) => set('taxInclusive', v === 'in')}
          options={[{ value: 'ex', label: t('Added on top') }, { value: 'in', label: t('Included in price') }]}
        />
        <div class="hint">
          {d.taxInclusive ? t('Prices already contain tax; receipts show how much of the total is tax.') : t('Tax is added to the total at checkout.')} {t('Each item can be marked tax-free in its settings. Past receipts keep the rate they were sold with.')}
        </div>
      </div>
    </Sheet>
  );
}

function ReceiptSheet({ onClose }: { onClose: () => void }) {
  const { d, set, save } = useDraft(['receiptHeader', 'receiptFooter', 'receiptPrefix', 'receiptNext', 'paperWidth'], onClose);
  const [preview, setPreview] = useState(false);
  return (
    <Sheet title={t('Receipts')} onClose={onClose} footer={<SaveBtn onClick={save} />}>
      <div class="stack">
        <button class="btn soft block" onClick={() => setPreview(true)}><Icon name="receipt" /> {t('Preview receipt')}</button>
        <div class="hint" style="margin-top:-0.375rem">{t('Your logo, address and contact details are set in Store profile.')}</div>
        <TextInput label={t('Header message')} value={d.receiptHeader} onInput={(e) => set('receiptHeader', val(e))} placeholder={t('e.g. Open daily 8am–8pm')} />
        <TextInput label={t('Footer message')} value={d.receiptFooter} onInput={(e) => set('receiptFooter', val(e))} placeholder={t('Thank you!')} />
        <div class="grid2">
          <TextInput label={t('Number prefix')} value={d.receiptPrefix} onInput={(e) => set('receiptPrefix', val(e))} />
          <NumberInput label={t('Next number')} value={d.receiptNext} min={1} onChange={(n) => set('receiptNext', Math.max(1, Math.floor(n)))} />
        </div>
        <div>
          <div class="label muted small bold" style="margin-bottom:0.375rem">{t('Paper width')}</div>
          <Segmented value={String(d.paperWidth) as '58' | '80'} onChange={(v) => set('paperWidth', Number(v) as 58 | 80)} options={[{ value: '58', label: '58 mm' }, { value: '80', label: '80 mm' }]} />
        </div>
        <PrinterSection />
      </div>
      {preview && <ReceiptPreviewSheet draft={d} onClose={() => setPreview(false)} />}
    </Sheet>
  );
}

function LoyaltySheet({ onClose }: { onClose: () => void }) {
  const { d, set, save } = useDraft(['loyaltyEnabled', 'pointsPerUnit', 'pointValue'], onClose);
  return (
    <Sheet title={t('Loyalty points')} onClose={onClose} footer={<SaveBtn onClick={save} />}>
      <div class="stack">
        <Switch label={t('Reward customers with points')} hint={t('Points are earned when a customer is attached to a sale')} checked={d.loyaltyEnabled} onChange={(v) => set('loyaltyEnabled', v)} />
        {d.loyaltyEnabled && (
          <>
            <NumberInput label={t('Points earned per 1 {currency} spent', { currency: d.currency })} value={d.pointsPerUnit} decimals onChange={(n) => set('pointsPerUnit', n)} />
            <MoneyInput label={t('Value of one point when redeemed')} value={d.pointValue} onChange={(n) => set('pointValue', n)} hint={t('e.g. 1 point = 0.01 means 100 points pay 1.00.')} />
          </>
        )}
      </div>
    </Sheet>
  );
}

// ---------- staff ----------

function StaffSheet({ onClose }: { onClose: () => void }) {
  const s = settings.value;
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  const pinsOn = users.value.some((u) => u.active && u.pinHash);
  return (
    <Sheet title={t('Staff & security')} onClose={onClose} full actions={<button class="btn sm primary" onClick={() => setEditing('new')}><Icon name="plus" size="sm" /> {t('Add')}</button>}>
      <div class="stack">
        <div class="list">
          {users.value.map((u) => (
            <button class="list-row" key={u.id} onClick={() => setEditing(u)} style={u.active ? '' : 'opacity:.5'}>
              <Avatar name={u.name} />
              <div class="grow">
                <div class="bold">{u.name}{u.id === session.value?.id && ` ${t('(you)')}`}</div>
                <div class="sub">{u.role === 'owner' ? t('Owner · full access') : t('Cashier · selling only')}{u.pinHash ? ` · ${t('PIN set')}` : ` · ${t('no PIN')}`}{!u.active && ` · ${t('disabled')}`}</div>
              </div>
              <Icon name="right" class="chev" />
            </button>
          ))}
        </div>
        <div class="hint">{t('Set a PIN on each account to turn on the lock screen. PINs keep casual users out; they do not encrypt the data on the phone.')}</div>
        <div class="card pad">
          <Switch label={t('Cashiers can refund & void')} hint={t('Otherwise only owners can')} checked={s.cashierRefunds} onChange={(v) => saveSettings({ cashierRefunds: v })} />
          <Switch label={t('Require an open shift to sell')} hint={t('Forces cash drawer counting')} checked={s.requireShift} onChange={(v) => saveSettings({ requireShift: v })} />
          {pinsOn && (
            <label class="field" style="margin-top:0.375rem">
              <span class="label">{t('Auto-lock after inactivity')}</span>
              <select class="select" value={s.lockMinutes} onChange={(e) => saveSettings({ lockMinutes: Number(val(e)) })}>
                <option value={0}>{t('Never')}</option>
                <option value={1}>{tn(1, '{n} minute', '{n} minutes')}</option>
                <option value={2}>{tn(2, '{n} minute', '{n} minutes')}</option>
                <option value={5}>{tn(5, '{n} minute', '{n} minutes')}</option>
                <option value={15}>{tn(15, '{n} minute', '{n} minutes')}</option>
              </select>
            </label>
          )}
        </div>
      </div>
      {editing && <StaffEditor user={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Sheet>
  );
}

function StaffEditor({ user, onClose }: { user: User | null; onClose: () => void }) {
  const [name, setName] = useState(user?.name ?? '');
  const [role, setRole] = useState<Role>(user?.role ?? 'cashier');
  const [pin, setPin] = useState('');
  const [active, setActive] = useState(user?.active ?? true);
  const owners = users.value.filter((u) => u.active && u.role === 'owner' && u.id !== user?.id);
  const lastOwner = !!user && user.role === 'owner' && owners.length === 0;
  const pinBad = pin !== '' && !/^\d{4,6}$/.test(pin);

  return (
    <Sheet
      title={user ? t('Edit account') : t('New account')}
      onClose={onClose}
      footer={
        <button class="btn primary" disabled={!name.trim() || pinBad} onClick={async () => {
          await saveUser({ id: user?.id, name, role: lastOwner ? 'owner' : role, pin: pin || undefined, active: lastOwner ? true : active });
          showToast(t('Saved'));
          onClose();
        }}>{t('Save')}</button>
      }
    >
      <div class="stack">
        <TextInput label={t('Name')} value={name} onInput={(e) => setName(val(e))} autofocus={!user} />
        <div>
          <div class="label muted small bold" style="margin-bottom:0.375rem">{t('Role')}</div>
          <Segmented value={lastOwner ? 'owner' : role} onChange={setRole} options={[{ value: 'owner', label: t('Owner') }, { value: 'cashier', label: t('Cashier') }]} />
          <div class="hint">{lastOwner ? t('The only owner account must stay an owner.') : role === 'owner' ? t('Owners can see reports, edit items, change settings and issue refunds.') : t('Cashiers can sell, manage customers and run their shift.')}</div>
        </div>
        <TextInput
          label={user?.pinHash ? t('New PIN (leave empty to keep)') : t('PIN (4–6 digits)')}
          type="password" inputMode="numeric" maxLength={6} value={pin}
          onInput={(e) => setPin(digitsOnly(e))}
          hint={pinBad ? t('Use 4 to 6 digits') : t('Required to sign in. Leave empty for no PIN.')}
        />
        {user?.pinHash && (
          <button class="btn block" onClick={async () => {
            if (await confirmDialog({ title: t('Remove this PIN?'), message: t('This account will sign in without a PIN.'), confirmLabel: t('Remove PIN') })) {
              await clearUserPin(user.id);
              onClose();
            }
          }}>{t('Remove PIN')}</button>
        )}
        {user && !lastOwner && user.id !== session.value?.id && <Switch label={t('Account active')} checked={active} onChange={setActive} />}
      </div>
    </Sheet>
  );
}
