import { signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from './i18n';
import { setEmptyBackHandler } from './lib/sheets';
import { can, needsSignIn, ready, session, settings, shift, signOut, users } from './lib/store';
import { Host, Icon } from './ui/components';
import { ImageEditorHost } from './ui/ImageEditor';
import { ScannerHost } from './ui/scanner';
import { agoText, backupReminder, DataBackup } from './screens/DataBackup';
import { Lock } from './screens/Lock';
import { More } from './screens/More';
import { Orders } from './screens/Orders';
import { Products } from './screens/Products';
import { Reports } from './screens/Reports';
import { Sell } from './screens/Sell';
import { Setup } from './screens/Setup';
import { ShiftScreen } from './screens/Shift';

type Tab = 'sell' | 'orders' | 'items' | 'reports' | 'more';
const tab = signal<Tab>('sell');
const reminderDismissed = signal(false);

setEmptyBackHandler(() => {
  if (tab.value !== 'sell') {
    tab.value = 'sell';
    return true;
  }
  return false;
});

export function App() {
  return (
    <>
      <Root />
      <Host />
      <ScannerHost />
      <ImageEditorHost />
    </>
  );
}

function Root() {
  if (!ready.value) return <div class="splash">{t('Loading…')}</div>;
  if (!settings.value.setupDone) return <Setup />;
  if (needsSignIn.value || !session.value) return <Lock />;
  return <Shell />;
}

// Labels are resolved at render time so they follow the language setting.
const TABS: { id: Tab; label: () => string; icon: string; need?: Parameters<typeof can>[0] }[] = [
  { id: 'sell', label: () => t('Sell'), icon: 'cart', need: 'sell' },
  { id: 'orders', label: () => t('Orders'), icon: 'receipt', need: 'sell' },
  { id: 'items', label: () => t('Items'), icon: 'box', need: 'manageProducts' },
  { id: 'reports', label: () => t('Reports'), icon: 'chart', need: 'reports' },
  { id: 'more', label: () => t('More'), icon: 'more' },
];

function Shell() {
  const s = settings.value;
  const [shiftOpen, setShiftOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const locks = users.value.some((u) => u.active && u.pinHash);
  const visible = TABS.filter((x) => !x.need || can(x.need));
  const current = visible.some((x) => x.id === tab.value) ? tab.value : 'sell';
  const reminder = can('settings') && !reminderDismissed.value ? backupReminder() : null;
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => { mainRef.current?.scrollTo(0, 0); }, [current]); // each tab starts at the top

  // Auto-lock after inactivity.
  useEffect(() => {
    if (!locks || !s.lockMinutes) return;
    let last = Date.now();
    const bump = () => (last = Date.now());
    const events = ['pointerdown', 'keydown', 'scroll'] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const timer = setInterval(() => {
      if (Date.now() - last > s.lockMinutes * 60_000) signOut();
    }, 10_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(timer);
    };
  }, [locks, s.lockMinutes]);

  return (
    <>
      <header class="header">
        <div class="grow" style="min-width:0">
          <h1 class="ellipsis">{s.storeName}</h1>
        </div>
        <button class={`shift-chip ${shift.value ? 'open' : ''}`} onClick={() => setShiftOpen(true)}>
          <i /> {shift.value ? t('Shift open') : t('No shift')}
        </button>
        {locks && (
          <button class="iconbtn" onClick={signOut} aria-label={t('Lock')}>
            <Icon name="lock" />
          </button>
        )}
      </header>
      {reminder !== null && (
        <div class="banner" style="border-radius:0;padding:0.5rem 0.875rem;font-size:0.8438rem">
          <Icon name="alert" size="sm" />
          <span>{reminder === Infinity ? t('No backup file saved yet.') : t('Last backup {when}.', { when: agoText(s.lastBackupAt) })}</span>
          <button class="btn sm" onClick={() => setBackupOpen(true)}>{t('Back up')}</button>
          <button class="iconbtn" style="width:2rem;height:2rem" onClick={() => (reminderDismissed.value = true)} aria-label={t('Dismiss')}><Icon name="close" size="sm" /></button>
        </div>
      )}
      <main class="main" ref={mainRef} style={current === 'sell' ? 'overflow:hidden' : ''}>
        {current === 'sell' && <Sell />}
        {current === 'orders' && <Orders />}
        {current === 'items' && <Products />}
        {current === 'reports' && <Reports />}
        {current === 'more' && <More />}
      </main>
      <nav class="tabbar" aria-label={t('Main')}>
        {visible.map((tab_) => (
          <button key={tab_.id} class={current === tab_.id ? 'on' : ''} onClick={() => (tab.value = tab_.id)} aria-current={current === tab_.id ? 'page' : undefined}>
            <Icon name={tab_.icon} />
            <span class="lbl">{tab_.label()}</span>
          </button>
        ))}
      </nav>
      {shiftOpen && <ShiftScreen onClose={() => setShiftOpen(false)} />}
      {backupOpen && <DataBackup onClose={() => setBackupOpen(false)} />}
    </>
  );
}
