import { useState } from 'preact/hooks';
import { t } from '../i18n';
import { can, money, session, settings, shift, signOut, users } from '../lib/store';
import { Avatar, Row, SectionTitle } from '../ui/components';
import { Customers } from './Customers';
import { agoText, DataBackup } from './DataBackup';
import { SettingsScreen } from './Settings';
import { ShiftScreen } from './Shift';

export function More() {
  const [page, setPage] = useState<null | 'customers' | 'shift' | 'data' | 'settings'>(null);
  const u = session.value;
  const s = settings.value;
  const locks = users.value.some((x) => x.active && x.pinHash);
  return (
    <div class="page-pad">
      <div class="card pad row" style="margin-bottom:0.375rem">
        <Avatar name={u?.name ?? '?'} />
        <div class="grow">
          <div class="bold">{u?.name}</div>
          <div class="small muted">{u?.role === 'owner' ? t('Owner') : t('Cashier')} · {s.storeName}</div>
        </div>
      </div>
      <SectionTitle>{t('Shop')}</SectionTitle>
      <div class="list">
        <Row icon="users" title={t('Customers')} onClick={() => setPage('customers')} />
        <Row icon="clock" title={t('Shift & cash drawer')} sub={shift.value ? t('Open · opened {amount} float', { amount: money(shift.value.openingFloat) }) : t('No shift open')} onClick={() => setPage('shift')} />
      </div>
      {can('settings') && (
        <>
          <SectionTitle>{t('Manage')}</SectionTitle>
          <div class="list">
            <Row icon="database" title={t('Data & backup')} sub={t('Last backup file: {when}', { when: agoText(s.lastBackupAt) })} onClick={() => setPage('data')} />
            <Row icon="sliders" title={t('Settings')} sub={t('Store, tax, receipts, staff')} onClick={() => setPage('settings')} />
          </div>
        </>
      )}
      {locks && (
        <div class="list" style="margin-top:1.125rem">
          <Row icon="logout" title={t('Lock / switch user')} onClick={signOut} />
        </div>
      )}
      {page === 'customers' && <Customers onClose={() => setPage(null)} />}
      {page === 'shift' && <ShiftScreen onClose={() => setPage(null)} />}
      {page === 'data' && <DataBackup onClose={() => setPage(null)} />}
      {page === 'settings' && <SettingsScreen onClose={() => setPage(null)} />}
    </div>
  );
}
