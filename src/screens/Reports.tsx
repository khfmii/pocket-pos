import { useEffect, useState } from 'preact/hooks';
import { t, tn } from '../i18n';
import { ordersBetween } from '../lib/db';
import { toCsv } from '../lib/csv';
import { toInput } from '../lib/money';
import { saveTextFile } from '../lib/platform';
import { payLabel } from '../lib/receipt';
import { buildReport, presetRange, startOfDay, type Report } from '../lib/report';
import { categories, lowStock, money, products, settings, showToast } from '../lib/store';
import type { Order } from '../lib/types';
import { Chips, Empty, Icon } from '../ui/components';

type Preset = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'custom';

export function Reports() {
  const [preset, setPreset] = useState<Preset>('today');
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [orders, setOrders] = useState<Order[]>([]);
  const [report, setReport] = useState<Report | null>(null);

  const range = preset === 'custom'
    ? { from: startOfDay(new Date(from + 'T00:00').getTime()), to: startOfDay(new Date(to + 'T00:00').getTime()) + 86_400_000 - 1 }
    : presetRange(preset);

  useEffect(() => {
    let live = true;
    ordersBetween(range.from, range.to).then((o) => {
      if (!live) return;
      setOrders(o);
      setReport(buildReport(o, products.value, categories.value, range));
    });
    return () => { live = false; };
  }, [preset, from, to, products.value, categories.value]);

  async function exportCsv() {
    const dec = settings.value.currencyDecimals;
    const m = (n: number) => toInput(n, dec) || '0';
    const rows = orders.filter((o) => o.at >= range.from && o.at <= range.to).sort((a, b) => a.at - b.at).map((o) => [
      o.number, new Date(o.at).toISOString().slice(0, 10), new Date(o.at).toTimeString().slice(0, 5), o.status, o.userName, o.customerName,
      o.lines.reduce((a, l) => a + l.qty, 0), m(o.subtotal), m(o.orderDiscount), m(o.tax), m(o.total),
      m(o.refunds.reduce((a, r) => a + r.amount, 0)), o.payments.map((p) => payLabel(p.method)).join('+'),
    ]);
    await saveTextFile(`pocketpos-sales-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([
      ['receipt', 'date', 'time', 'status', 'staff', 'customer', 'items', 'subtotal', 'discount', 'tax', 'total', 'refunded', 'payments'], ...rows,
    ]), 'text/csv');
    showToast(tn(rows.length, 'Exported {n} sale', 'Exported {n} sales'));
  }

  const r = report;
  const maxBucket = Math.max(1, ...(r?.byBucket.map((b) => b.net) ?? [1]));
  const maxProd = Math.max(1, ...(r?.topProducts.map((p) => p.net) ?? [1]));
  const maxCat = Math.max(1, ...(r?.byCategory.map((p) => p.net) ?? [1]));
  const maxPay = Math.max(1, ...(r?.byMethod.map((p) => p.amount) ?? [1]));

  return (
    <div>
      <div style="padding-top:0.625rem">
        <Chips value={preset} onChange={setPreset} options={[
          { value: 'today', label: t('Today') }, { value: 'yesterday', label: t('Yesterday') }, { value: '7d', label: t('7 days') },
          { value: '30d', label: t('30 days') }, { value: 'month', label: t('This month') }, { value: 'custom', label: t('Custom') },
        ]} />
      </div>
      <div class="page-pad" style="padding-top:0">
        {preset === 'custom' && (
          <div class="grid2" style="margin-bottom:0.75rem">
            <label class="field"><span class="label">{t('From')}</span><input class="input" type="date" value={from} max={to} onInput={(e) => setFrom((e.currentTarget as HTMLInputElement).value)} /></label>
            <label class="field"><span class="label">{t('To')}</span><input class="input" type="date" value={to} min={from} onInput={(e) => setTo((e.currentTarget as HTMLInputElement).value)} /></label>
          </div>
        )}
        {!r || r.orders === 0 ? (
          <Empty icon="chart" title={t('No sales in this period')}>{t('Pick another date range, or make a sale.')}</Empty>
        ) : (
          <div class="stack">
            <div class="kpis">
              <div class="kpi hero"><div class="muted small">{t('Net sales')}</div><div class="v">{money(r.net)}</div></div>
              <div class="kpi"><div class="muted small">{t('Orders')}</div><div class="v">{r.orders}</div></div>
              <div class="kpi"><div class="muted small">{t('Avg. order')}</div><div class="v">{money(r.avgOrder)}</div></div>
              <div class="kpi"><div class="muted small">{t('Gross profit')}</div><div class="v">{money(r.profit)}</div></div>
              <div class="kpi"><div class="muted small">{t('Items sold')}</div><div class="v">{r.items}</div></div>
              <div class="kpi"><div class="muted small">{t('Tax collected')}</div><div class="v">{money(r.tax)}</div></div>
              <div class="kpi"><div class="muted small">{t('Discounts')}</div><div class="v">{money(r.discounts)}</div></div>
              <div class="kpi"><div class="muted small">{t('Refunds')}</div><div class="v">{money(r.refunds)}</div></div>
            </div>

            <div class="card pad">
              <div class="bold" style="margin-bottom:0.625rem">{range.to - range.from <= 86_400_000 ? t('Sales by hour') : t('Sales by day')}</div>
              <div class="spark" role="img" aria-label={t('Sales chart')}>
                {r.byBucket.map((b) => (
                  <div class="b" key={b.key} title={`${b.label}: ${money(b.net)}`}><i style={`height:${Math.round((b.net / maxBucket) * 100)}%`} /></div>
                ))}
              </div>
              <div class="spark-labels"><span>{r.byBucket[0]?.label}</span><span>{r.byBucket[r.byBucket.length - 1]?.label}</span></div>
            </div>

            <Breakdown title={t('Top items')} rows={r.topProducts.map((p) => ({ label: p.name, sub: t('{n} sold', { n: p.qty }), value: p.net }))} max={maxProd} />
            <Breakdown title={t('By category')} rows={r.byCategory.map((c) => ({ label: c.name === 'Uncategorised' ? t('Uncategorised') : c.name, value: c.net }))} max={maxCat} />
            <Breakdown title={t('By payment method')} rows={r.byMethod.map((m) => ({ label: payLabel(m.method), value: m.amount }))} max={maxPay} />
            <button class="btn block" onClick={exportCsv}><Icon name="download" /> {t('Export these sales (CSV)')}</button>
          </div>
        )}

        {lowStock.value.length > 0 && (
          <div class="card pad" style="margin-top:0.875rem">
            <div class="bold" style="margin-bottom:0.375rem">{t('Low stock')}</div>
            {lowStock.value.slice(0, 10).map((p) => (
              <div class="row between" key={p.id} style="padding:0.375rem 0">
                <span>{p.emoji} {p.name}</span>
                <span class={`pill ${p.stock <= 0 ? 'bad' : 'warn'}`}>{t('{n} left', { n: p.stock })}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Breakdown({ title, rows, max }: { title: string; rows: { label: string; sub?: string; value: number }[]; max: number }) {
  if (!rows.length) return null;
  return (
    <div class="card pad">
      <div class="bold">{title}</div>
      {rows.map((r) => (
        <div class="bar-row" key={r.label}>
          <div class="ellipsis">{r.label} {r.sub && <span class="muted small">· {r.sub}</span>}</div>
          <div class="money bold">{money(r.value)}</div>
          <div class="bar"><i style={`width:${Math.max(2, Math.round((r.value / max) * 100))}%`} /></div>
        </div>
      ))}
    </div>
  );
}
