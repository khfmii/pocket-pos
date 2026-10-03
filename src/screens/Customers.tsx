import { useEffect, useState } from 'preact/hooks';
import { t, tn } from '../i18n';
import { canPickContact, pickContact } from '../lib/contacts';
import { ordersForCustomer } from '../lib/db';
import { formatDate } from '../lib/platform';
import { blankCustomer, can, customers, deleteCustomer, money, saveCustomer, settings, showToast } from '../lib/store';
import type { Customer, Order } from '../lib/types';
import { confirmDialog, Empty, Field, Icon, NumberInput, Sheet, TextInput } from '../ui/components';

export function Customers({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Customer | null>(null);
  const needle = q.trim().toLowerCase();
  const list = customers.value.filter(
    (c) => !needle || c.name.toLowerCase().includes(needle) || c.phone.includes(needle) || c.email.toLowerCase().includes(needle) || c.note.toLowerCase().includes(needle),
  );

  async function addFromContacts() {
    try {
      const c = await pickContact();
      if (!c) return;
      // Open the editor pre-filled so a remark can be added straight away; nothing is saved until "Save".
      setEditing({ ...blankCustomer(), name: c.name, phone: c.phones[0] ?? '', email: c.emails[0] ?? '' });
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }

  return (
    <Sheet
      title={t('Customers')}
      onClose={onClose}
      full
      actions={
        <>
          {canPickContact() && (
            <button class="btn sm" onClick={addFromContacts} aria-label={t('Pick from phone contacts')}>
              <Icon name="contact" size="sm" />
            </button>
          )}
          <button class="btn sm primary" onClick={() => setEditing(blankCustomer())}>
            <Icon name="plus" size="sm" /> {t('Add')}
          </button>
        </>
      }
    >
      <div class="stack">
        <input class="input" type="search" placeholder={t('Search name, phone or remark')} value={q} onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)} />
        {customers.value.length === 0 ? (
          <Empty icon="users" title={t('No customers yet')}>
            {settings.value.loyaltyEnabled ? t('Attach customers to sales to track their purchases and loyalty points.') : t('Attach customers to sales to track their purchases.')}
          </Empty>
        ) : (
          <div class="list">
            {list.map((c) => (
              <button class="list-row" key={c.id} onClick={() => setEditing(c)}>
                <div class="avatar">{(c.name[0] ?? '?').toUpperCase()}</div>
                <div class="grow">
                  <div class="bold">{c.name}</div>
                  <div class="sub">{c.phone || c.email || t('No contact info')}</div>
                  {c.note && <div class="sub ellipsis" style="color:var(--warn)">{c.note}</div>}
                </div>
                {settings.value.loyaltyEnabled && <span class="pill brand">{t('{n} pts', { n: c.points })}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {editing && <CustomerEditor customer={editing} onClose={() => setEditing(null)} />}
    </Sheet>
  );
}

function CustomerEditor({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const isNew = !customers.value.some((c) => c.id === customer.id);
  const [c, setC] = useState(customer);
  const [orders, setOrders] = useState<Order[]>([]);
  const [numbers, setNumbers] = useState<string[]>([]); // extra numbers offered after importing a contact with several
  useEffect(() => {
    if (!isNew) ordersForCustomer(customer.id).then((o) => setOrders(o.filter((x) => x.status !== 'void').sort((a, b) => b.at - a.at)));
  }, []);
  const spent = orders.reduce((a, o) => a + o.total - o.refunds.reduce((s, r) => s + r.amount, 0), 0);
  const set = <K extends keyof Customer>(k: K, v: Customer[K]) => setC((cur) => ({ ...cur, [k]: v }));

  async function importContact() {
    try {
      const p = await pickContact();
      if (!p) return;
      setC((cur) => ({ ...cur, name: p.name || cur.name, phone: p.phones[0] ?? cur.phone, email: p.emails[0] ?? cur.email }));
      setNumbers(p.phones.length > 1 ? p.phones : []);
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }

  return (
    <Sheet
      title={isNew ? t('New customer') : c.name || t('Customer')}
      onClose={onClose}
      footer={
        <>
          {!isNew && can('manageProducts') && (
            <button class="btn danger-ghost fixed" aria-label={t('Delete customer')} onClick={async () => {
              if (await confirmDialog({ title: t('Delete {name}?', { name: c.name }), message: t('Past sales keep the name on their receipts.'), danger: true, confirmLabel: t('Delete') })) {
                await deleteCustomer(c.id);
                onClose();
              }
            }}><Icon name="trash" /></button>
          )}
          <button class="btn primary" disabled={!c.name.trim()} onClick={async () => { await saveCustomer(c); showToast(t('Saved')); onClose(); }}>{t('Save')}</button>
        </>
      }
    >
      <div class="stack">
        {canPickContact() && (
          <button class="btn soft block" onClick={importContact}>
            <Icon name="contact" /> {t('Import from phone contacts')}
          </button>
        )}
        <TextInput label={t('Name')} value={c.name} onInput={(e) => set('name', (e.currentTarget as HTMLInputElement).value)} autofocus={isNew && !c.name} />
        <TextInput label={t('Phone')} type="tel" value={c.phone} onInput={(e) => set('phone', (e.currentTarget as HTMLInputElement).value)} />
        {numbers.length > 1 && (
          <div>
            <div class="small muted" style="margin-bottom:0.375rem">{t('This contact has several numbers — tap the one to use:')}</div>
            <div class="row wrap">
              {numbers.map((n) => (
                <button key={n} class={`chip ${c.phone === n ? 'on' : ''}`} onClick={() => set('phone', n)}>{n}</button>
              ))}
            </div>
          </div>
        )}
        <TextInput label={t('Email')} type="email" value={c.email} onInput={(e) => set('email', (e.currentTarget as HTMLInputElement).value)} />
        <Field label={t('Remark')} hint={t('Shown when this customer is added to a sale — e.g. allergies, preferences, special price.')}>
          <textarea class="textarea" value={c.note} placeholder={t('e.g. allergic to nuts, prefers extra hot, wholesale price')} onInput={(e) => set('note', (e.currentTarget as HTMLTextAreaElement).value)} />
        </Field>
        {settings.value.loyaltyEnabled && <NumberInput label={t('Loyalty points')} value={c.points} onChange={(n) => set('points', Math.floor(n))} hint={t('Adjust manually if needed.')} />}
        {!isNew && (
          <>
            <div class="kpis" style="grid-template-columns:1fr 1fr">
              <div class="kpi"><div class="muted small">{t('Visits')}</div><div class="v">{orders.length}</div></div>
              <div class="kpi"><div class="muted small">{t('Total spent')}</div><div class="v">{money(spent)}</div></div>
            </div>
            {orders.length > 0 && (
              <div class="list">
                {orders.slice(0, 8).map((o) => (
                  <div class="list-row" key={o.id} style="min-height:3rem">
                    <div class="grow"><span class="bold">{o.number}</span> <span class="sub">{formatDate(o.at)}</span></div>
                    <div class="money">{money(o.total)}</div>
                  </div>
                ))}
              </div>
            )}
            {orders.length > 8 && <div class="hint">{tn(orders.length - 8, '+ {n} earlier sale', '+ {n} earlier sales')}</div>}
          </>
        )}
      </div>
    </Sheet>
  );
}
