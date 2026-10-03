import { useState } from 'preact/hooks';
import { t } from '../i18n';
import { resetAllData, settings, signIn, users } from '../lib/store';
import type { User } from '../lib/types';
import { Avatar, confirmDialog, Icon, PinPad } from '../ui/components';

export function Lock() {
  const [user, setUser] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [bad, setBad] = useState(false);
  const [help, setHelp] = useState(false);
  const list = users.value.filter((u) => u.active);

  async function attempt(p: string, final: boolean) {
    if (!user) return;
    if (await signIn(user.id, p)) return;
    // Wrong PIN: only complain once the user has had a chance to type all of it.
    if (final || p.length >= 6) {
      setBad(true);
      setTimeout(() => { setBad(false); setPin(''); }, 350);
    }
  }

  const change = (v: string) => {
    setPin(v);
    if (v.length >= 4) attempt(v, false);
  };

  return (
    <div class="main" style="display:grid;place-items:center">
      <div style="width:100%;max-width:21.25rem;padding:1.5rem 1.25rem">
        <div class="center" style="margin-bottom:1.125rem">
          <img src="icon.svg" alt="" width="56" height="56" style="border-radius:0.875rem" />
          <div class="bold" style="font-size:1.25rem;margin-top:0.5rem">{settings.value.storeName}</div>
          <div class="muted small">{user ? t('Enter PIN for {name}', { name: user.name }) : t('Who’s signing in?')}</div>
        </div>
        {!user ? (
          <div class="list">
            {list.map((u) => (
              <button class="list-row" key={u.id} onClick={async () => { setPin(''); if (!u.pinHash) await signIn(u.id, ''); else setUser(u); }}>
                <Avatar name={u.name} />
                <div class="grow"><div class="bold">{u.name}</div><div class="sub">{u.role === 'owner' ? t('Owner') : t('Cashier')}</div></div>
                {u.pinHash && <Icon name="lock" size="sm" class="chev" />}
              </button>
            ))}
          </div>
        ) : (
          <>
            <PinPad value={pin} onChange={change} onSubmit={() => attempt(pin, true)} shake={bad} />
            <button class="btn ghost block" style="margin-top:0.625rem" onClick={() => { setUser(null); setPin(''); }}>{t('Switch user')}</button>
          </>
        )}
        <div class="center" style="margin-top:1.125rem">
          <button class="btn ghost sm" onClick={() => setHelp(!help)}>{t('Forgot PIN?')}</button>
        </div>
        {help && (
          <div class="card pad small" style="margin-top:0.5rem">
            <p style="margin:0 0 0.5rem">{t('PINs are not stored anywhere that can be read back, and all data lives only on this phone — so there is no remote reset.')}</p>
            <p style="margin:0 0 0.625rem">{t('The way back in is to erase this phone’s data and restore a backup file; tick “Remove staff PINs after restoring” during the restore.')}</p>
            <button class="btn danger-ghost block" onClick={async () => {
              if (await confirmDialog({
                title: t('Erase data and start over?'),
                message: t('Everything on this device will be deleted. Only do this if you have a backup file to restore from.'),
                confirmLabel: t('Erase this device'), danger: true,
              })) await resetAllData();
            }}>{t('Erase this device & restore')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
