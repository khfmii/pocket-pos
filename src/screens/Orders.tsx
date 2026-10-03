import { useEffect, useState } from 'preact/hooks';
import { t, tn } from '../i18n';
import { refundAmountFor } from '../lib/cart';
import { ordersBetween, recentOrders } from '../lib/db';
import { formatDateTime, formatTime } from '../lib/platform';
import { payLine } from '../lib/receipt';
import { presetRange } from '../lib/report';
import { can, canVoid, lineName, money, refundOrder, session, settings, showToast, voidOrder } from '../lib/store';
import type { Order, PayMethod } from '../lib/types';
import { Chips, confirmDialog, Empty, Icon, Segmented, Sheet, Switch, TextInput } from '../ui/components';
import { ProofSection } from './Proofs';
import { ReceiptActions, ReceiptView } from './Receipt';

type Range = 'today' | 'yesterday' | '7d' | 'recent';

export function Orders() {
  const [range, setRange] = useState<Range>('today');
  const [q, setQ] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const isOwner = session.value?.role === 'owner';

  useEffect(() => {
    let live = true;
    (async () => {
      const r = range === 'recent' ? await recentOrders(200) : await ordersBetween(presetRange(range).from, presetRange(range).to);
      if (live) setOrders(r.sort((a, b) => b.at - a.at));
    })();
    return () => {
      live = false;
    };
  }, [range, tick]);

  const needle = q.trim().toLowerCase();
  // Cashiers only see their own sales so a shared phone doesn't expose everyone's takings.
  const shown = orders.filter(
    (o) => (isOwner || o.userId === session.value?.id) && (!needle || o.number.toLowerCase().includes(needle) || o.customerName.toLowerCase().includes(needle)),
  );
  const selected = orders.find((o) => o.id === open);

  return (
    <div>
      <div class="pad" style="padding-bottom:0">
        <input class="input" type="search" placeholder={t('Search receipt # or customer')} value={q} onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)} />
      </div>
      <div style="margin-top:0.625rem">
        <Chips
          value={range}
          onChange={setRange}
          options={[
            { value: 'today', label: t('Today') },
            { value: 'yesterday', label: t('Yesterday') },
            { value: '7d', label: t('Last 7 days') },
            { value: 'recent', label: t('Recent 200') },
          ]}
        />
      </div>
      <div class="page-pad" style="padding-top:0">
        {shown.length === 0 ? (
          <Empty icon="receipt" title={t('No sales here')}>{t('Completed sales will appear in this list.')}</Empty>
        ) : (
          <div class="list">
            {shown.map((o) => (
              <button class="list-row" key={o.id} onClick={() => setOpen(o.id)}>
                <div class="grow">
                  <div class="bold">
                    {o.number} <StatusPill o={o} />
                    {!!o.attachmentCount && (
                      <span class="muted small" style="margin-inline-start:0.375rem" aria-label={t('Has payment proof')}>
                        <Icon name="paperclip" size="sm" /> {o.attachmentCount}
                      </span>
                    )}
                  </div>
                  <div class="sub">
                    {range === 'today' ? formatTime(o.at) : formatDateTime(o.at)} · {tn(o.lines.reduce((a, l) => a + l.qty, 0), '{n} item', '{n} items')} · {o.payments.map(payLine).join(' + ') || t('Free')}
                    {o.customerName && ` · ${o.customerName}`}
                  </div>
                </div>
                <div class="money bold">{money(o.total)}</div>
              </button>
            ))}
          </div>
        )}
      </div>
      {selected && <OrderDetail order={selected} onClose={() => setOpen(null)} onChanged={() => setTick((x) => x + 1)} />}
    </div>
  );
}

export function StatusPill({ o }: { o: Order }) {
  if (o.status === 'paid') return null;
  const map = { partial: ['warn', t('Part refunded')], refunded: ['bad', t('Refunded')], void: ['bad', t('Void')], paid: ['', ''] } as const;
  const [cls, label] = map[o.status];
  return <span class={`pill ${cls}`}>{label}</span>;
}

function OrderDetail({ order, onClose, onChanged }: { order: Order; onClose: () => void; onChanged: () => void }) {
  const [refunding, setRefunding] = useState(false);
  const refundable = can('refund') && (order.status === 'paid' || order.status === 'partial');
  return (
    <Sheet title={t('Receipt {number}', { number: order.number })} onClose={onClose} full>
      <div class="stack">
        <div class="row between">
          <div class="muted small">{formatDateTime(order.at)}{order.userName && ` · ${order.userName}`}</div>
          <StatusPill o={order} />
        </div>
        <ReceiptActions order={order} />
        <ProofSection orderId={order.id} onChanged={onChanged} />
        <ReceiptView order={order} />
        {refundable && (
          <button class="btn danger-ghost block" onClick={() => setRefunding(true)}>
            {t('Refund items')}
          </button>
        )}
        {can('refund') && canVoid(order) && (
          <button
            class="btn block"
            onClick={async () => {
              if (!(await confirmDialog({ title: t('Void {number}?', { number: order.number }), message: t('The sale is cancelled and stock is returned. Use this for mistakes made just now; use Refund for returns.'), confirmLabel: t('Void sale'), danger: true }))) return;
              try {
                await voidOrder(order.id, '');
                showToast(t('Sale voided'));
                onChanged();
                onClose();
              } catch (e) {
                showToast((e as Error).message, 'error');
              }
            }}
          >
            {t('Void sale')}
          </button>
        )}
        {order.note && <div class="muted small">{t('Note: {note}', { note: order.note })}</div>}
      </div>
      {refunding && (
        <RefundSheet
          order={order}
          onClose={() => setRefunding(false)}
          onDone={() => {
            setRefunding(false);
            onChanged();
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}

function RefundSheet({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: () => void }) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const firstMethod = order.payments.find((p) => p.method !== 'points')?.method ?? 'cash';
  const [method, setMethod] = useState<PayMethod>(firstMethod);
  const [reason, setReason] = useState('');
  const [restock, setRestock] = useState(true);
  const [busy, setBusy] = useState(false);

  const total = order.lines.reduce((sum, l) => sum + (qty[l.id] ? refundAmountFor(l, qty[l.id]) : 0), 0);
  const any = Object.values(qty).some((n) => n > 0);

  return (
    <Sheet
      title={t('Refund items')}
      onClose={onClose}
      footer={
        <button
          class="btn danger lg"
          disabled={!any || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await refundOrder(order.id, Object.entries(qty).map(([lineId, q]) => ({ lineId, qty: q })), { method, reason, restock });
              showToast(t('Refunded {amount}', { amount: money(total) }));
              onDone();
            } catch (e) {
              showToast((e as Error).message, 'error');
              setBusy(false);
            }
          }}
        >
          {t('Refund {amount}', { amount: money(total) })}
        </button>
      }
    >
      <div class="stack">
        <div class="list">
          {order.lines.map((l) => {
            const left = l.qty - l.refundedQty;
            return (
              <div class="list-row" key={l.id} style={left === 0 ? 'opacity:.5' : ''}>
                <div class="grow">
                  <div class="bold">{lineName(l)}{l.variantName && ` · ${l.variantName}`}</div>
                  <div class="sub">{t('{left} of {total} refundable', { left, total: l.qty })} · {money(l.total)}</div>
                </div>
                {left > 0 && (
                  <div class="stepper">
                    <button onClick={() => setQty({ ...qty, [l.id]: Math.max(0, (qty[l.id] ?? 0) - 1) })} aria-label={t('Less')}><Icon name="minus" size="sm" /></button>
                    <span class="num">{qty[l.id] ?? 0}</span>
                    <button onClick={() => setQty({ ...qty, [l.id]: Math.min(left, (qty[l.id] ?? 0) + 1) })} aria-label={t('More')}><Icon name="plus" size="sm" /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div>
          <div class="label muted small bold" style="margin-bottom:0.375rem">{t('Refund to')}</div>
          <Segmented
            value={method as 'cash' | 'card' | 'ewallet' | 'other'}
            onChange={setMethod}
            options={[
              { value: 'cash', label: t('Cash') },
              { value: 'card', label: t('Card') },
              { value: 'ewallet', label: t('E-wallet') },
              { value: 'other', label: t('Other') },
            ]}
          />
        </div>
        <TextInput label={t('Reason (optional)')} value={reason} onInput={(e) => setReason((e.currentTarget as HTMLInputElement).value)} placeholder={t('e.g. damaged, wrong item')} />
        <Switch label={t('Return items to stock')} hint={t('Only affects items that track stock.')} checked={restock} onChange={setRestock} />
        {settings.value.loyaltyEnabled && order.customerId && <div class="hint">{t('Points earned on the refunded amount are taken back from the customer.')}</div>}
      </div>
    </Sheet>
  );
}
