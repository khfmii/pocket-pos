import { useEffect, useState } from 'preact/hooks';
import { t } from '../i18n';
import { depositSum } from '../lib/cart';
import { quickCash } from '../lib/money';
import { payLabel, payLine } from '../lib/receipt';
import { cart, checkout, customers, money, parkCart, settings, showToast, totals } from '../lib/store';
import type { Order, Parked, PayMethod, Payment } from '../lib/types';
import { Icon, MoneyInput, Sheet } from '../ui/components';
import { ProofPicker } from './Proofs';

type Method = Exclude<PayMethod, 'points'>;
const METHODS: { id: Method; icon: string }[] = [
  { id: 'cash', icon: 'cash' },
  { id: 'card', icon: 'card' },
  { id: 'ewallet', icon: 'phone' },
  { id: 'other', icon: 'wallet' },
];

/** `onPending` gets the saved order when money was taken on it (so its deposit slip can be shown), else null. */
export function CheckoutSheet({ onClose, onDone, onPending }: { onClose: () => void; onDone: (o: Order) => void; onPending: (p: Parked | null) => void }) {
  const tot = totals.value;
  const s = settings.value;
  const customer = customers.value.find((c) => c.id === cart.value.customerId);
  const deposits = cart.value.paid ?? [];
  const taken = depositSum(deposits); // deposits already paid on this order
  const [payments, setPayments] = useState<Payment[]>([]);
  const [method, setMethod] = useState<Method>('cash');
  const [proofs, setProofs] = useState<string[]>([]);
  const paid = payments.reduce((a, p) => a + p.amount, 0);
  const remaining = tot.total - taken - paid;
  const [amount, setAmount] = useState(remaining);
  const [busy, setBusy] = useState(false);
  useEffect(() => setAmount(remaining), [remaining, method]);

  const pointsAvailable = s.loyaltyEnabled && customer ? customer.points - payments.filter((p) => p.method === 'points').reduce((a, p) => a + p.amount / s.pointValue, 0) : 0;
  const redeemable = Math.min(Math.floor(remaining / Math.max(1, s.pointValue)), Math.floor(pointsAvailable));

  async function finish(list: Payment[]) {
    setBusy(true);
    try {
      onDone(await checkout(list, proofs));
    } catch (e) {
      showToast((e as Error).message, 'error');
      setBusy(false);
    }
  }

  // An amount typed but not yet added can be taken as a deposit while the order is set aside.
  const typed = amount > 0 && amount < remaining ? amount : 0;
  const hasPoints = payments.some((p) => p.method === 'points');

  async function setAside() {
    setBusy(true);
    try {
      const taking = typed ? [...payments, { method, amount: typed, tendered: typed }] : payments;
      const rec = await parkCart({ payments: taking, proofs });
      showToast(t('Order saved as pending — open it from the pause button'));
      onPending(taking.length ? rec : null);
    } catch (e) {
      showToast((e as Error).message, 'error');
      setBusy(false);
    }
  }

  function add(p: Payment) {
    const next = [...payments, p];
    if (remaining - p.amount <= 0) finish(next);
    else setPayments(next);
  }

  function pay(tendered: number) {
    if (tendered <= 0) return;
    const applied = Math.min(tendered, remaining);
    add({ method, amount: applied, tendered: method === 'cash' ? tendered : applied });
  }

  const change = method === 'cash' ? Math.max(0, amount - remaining) : 0;

  return (
    <Sheet title={t('Payment')} onClose={onClose}>
      <div class="center" style="margin-bottom:0.875rem">
        <div class="muted small">{paid ? t('Remaining') : taken ? t('Balance due') : t('Total due')}</div>
        <div class="money" style="font-size:2.5rem;font-weight:800;line-height:1.1">{money(Math.max(0, remaining))}</div>
        {customer && <div class="small muted">{customer.name}</div>}
      </div>

      {(deposits.length > 0 || payments.length > 0) && (
        <div class="list" style="margin-bottom:0.75rem">
          {deposits.map((p, i) => (
            <div class="list-row" key={`d${i}`} style="min-height:3rem">
              <div class="grow">{payLine(p)}</div>
              <div class="money bold">{money(p.amount)}</div>
            </div>
          ))}
          {payments.map((p, i) => (
            <div class="list-row" key={i} style="min-height:3rem">
              <div class="grow">{payLabel(p.method)}</div>
              <div class="money bold">{money(p.amount)}</div>
              <button class="iconbtn" aria-label={t('Remove payment')} onClick={() => setPayments(payments.filter((_, j) => j !== i))}>
                <Icon name="close" size="sm" />
              </button>
            </div>
          ))}
        </div>
      )}

      {remaining <= 0 ? (
        <>
          {remaining < 0 && <div class="banner" style="margin-bottom:0.75rem">{t('The deposit is more than the total now. Give {amount} back to the customer.', { amount: money(-remaining) })}</div>}
          <button class="btn primary lg block" disabled={busy} onClick={() => finish([])}>
            {t('Complete sale')}
          </button>
        </>
      ) : (
        <>
          <div class="grid2" style="grid-template-columns:repeat(4,1fr);gap:0.5rem;margin-bottom:0.875rem">
            {METHODS.map((m) => (
              <button
                key={m.id}
                class={`btn ${method === m.id ? 'primary' : ''}`}
                style="flex-direction:column;gap:2px;min-height:4rem;padding:0 0.25rem;font-size:0.8125rem"
                onClick={() => setMethod(m.id)}
              >
                <Icon name={m.icon} />
                {payLabel(m.id)}
              </button>
            ))}
          </div>

          {method === 'cash' && (
            <div class="row wrap" style="margin-bottom:0.75rem;gap:0.5rem">
              {quickCash(remaining, s.currencyDecimals).map((v, i) => (
                <button key={v} class="chip" disabled={busy} onClick={() => pay(v)}>
                  {i === 0 ? t('Exact') : money(v)}
                </button>
              ))}
            </div>
          )}

          <MoneyInput big label={method === 'cash' ? t('Cash received') : t('Amount')} value={amount} onChange={setAmount} />
          {method === 'cash' && change > 0 && (
            <div class="banner ok" style="margin-top:0.625rem;justify-content:space-between">
              <span>{t('Change')}</span>
              <strong class="money" style="font-size:1.25rem">{money(change)}</strong>
            </div>
          )}
          {method !== 'cash' && amount < remaining && amount > 0 && (
            <div class="hint">{t('Split payment: {amount} will remain after this.', { amount: money(remaining - amount) })}</div>
          )}
          {method !== 'cash' && amount > remaining && <div class="hint">{t('Card and wallet payments can’t exceed the amount due.')}</div>}

          {(method !== 'cash' || proofs.length > 0) && (
            <div style="margin-top:0.875rem">
              <ProofPicker images={proofs} onChange={setProofs} />
            </div>
          )}

          <button
            class="btn primary lg block"
            style="margin-top:0.875rem"
            disabled={busy || amount <= 0 || (method !== 'cash' && amount > remaining)}
            onClick={() => pay(amount)}
          >
            {amount >= remaining ? (method === 'cash' ? t('Take cash & finish') : t('Charge {amount}', { amount: money(remaining) })) : t('Add {amount} payment', { amount: money(amount) })}
          </button>

          <button class="btn block" style="margin-top:0.625rem" disabled={busy || hasPoints} onClick={setAside}>
            <Icon name="pause" /> {typed ? t('Take {amount} & save as pending', { amount: money(typed) }) : t('Save as pending')}
          </button>
          {hasPoints && <div class="hint">{t('Points can only be used when the order is finished.')}</div>}

          {redeemable > 0 && (
            <button
              class="btn soft block"
              style="margin-top:0.625rem"
              disabled={busy}
              onClick={() => add({ method: 'points', amount: redeemable * s.pointValue, tendered: redeemable * s.pointValue })}
            >
              <Icon name="star" size="sm" /> {t('Redeem {n} points (−{amount})', { n: redeemable, amount: money(redeemable * s.pointValue) })}
            </button>
          )}
        </>
      )}
    </Sheet>
  );
}
