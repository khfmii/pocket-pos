import { useEffect, useState } from 'preact/hooks';
import { t } from '../i18n';
import { getAll } from '../lib/db';
import { formatDateTime, formatTime, shareText } from '../lib/platform';
import { payLabel } from '../lib/receipt';
import { runAutoBackup } from '../lib/autobackup';
import { addCashMovement, closeShift, money, openShift, shift, shiftSummary, showToast, type ShiftSummary } from '../lib/store';
import type { PayMethod, Shift as ShiftRec } from '../lib/types';
import { Empty, Icon, MoneyInput, Sheet, SectionTitle, TextInput } from '../ui/components';

export function ShiftScreen({ onClose }: { onClose: () => void }) {
  const sh = shift.value;
  const [sum, setSum] = useState<ShiftSummary | null>(null);
  const [past, setPast] = useState<ShiftRec[]>([]);
  const [mode, setMode] = useState<'none' | 'open' | 'in' | 'out' | 'close'>('none');
  const [closed, setClosed] = useState<{ shift: ShiftRec; sum: ShiftSummary } | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((x) => x + 1);

  useEffect(() => {
    if (sh) shiftSummary(sh).then(setSum);
    else setSum(null);
    getAll('shifts').then((all) => setPast(all.filter((s) => s.closedAt).sort((a, b) => b.closedAt - a.closedAt).slice(0, 8)));
  }, [sh?.id, tick]);

  return (
    <Sheet title={t('Shift & cash drawer')} onClose={onClose} full>
      {!sh ? (
        <div class="stack">
          <Empty icon="clock" title={t('No shift open')}>
            {t('Open a shift to count your cash drawer. Sales made while a shift is open are grouped into one end-of-day report.')}
          </Empty>
          <button class="btn primary lg block" onClick={() => setMode('open')}>{t('Open shift')}</button>
        </div>
      ) : (
        <div class="stack">
          <div class="card pad">
            <div class="row between"><span class="pill ok">{t('Open')}</span><span class="muted small">{t('since {time}', { time: formatDateTime(sh.openedAt) })}</span></div>
            <div class="muted small" style="margin-top:0.5rem">{t('Expected cash in drawer')}</div>
            <div class="money" style="font-size:2.125rem;font-weight:800">{money(sum?.expectedCash ?? sh.openingFloat)}</div>
          </div>
          {sum && (
            <div class="card pad">
              <dl class="dl">
                <dt>{t('Opening float')}</dt><dd>{money(sh.openingFloat)}</dd>
                <dt>{t('Sales ({n})', { n: sum.orders })}</dt><dd>{money(sum.sales)}</dd>
                {(Object.keys(sum.byMethod) as PayMethod[]).filter((m) => sum.byMethod[m]).map((m) => (<><dt>· {payLabel(m)}</dt><dd>{money(sum.byMethod[m])}</dd></>))}
                <dt>{t('Cash in')}</dt><dd>{money(sum.cashIn)}</dd>
                <dt>{t('Cash out (incl. cash refunds)')}</dt><dd>−{money(sum.cashOut)}</dd>
              </dl>
            </div>
          )}
          <div class="grid2">
            <button class="btn" onClick={() => setMode('in')}><Icon name="plus" /> {t('Cash in')}</button>
            <button class="btn" onClick={() => setMode('out')}><Icon name="minus" /> {t('Cash out')}</button>
          </div>
          {sum && sum.movements.length > 0 && (
            <>
              <SectionTitle>{t('Cash movements')}</SectionTitle>
              <div class="list">
                {sum.movements.map((m) => (
                  <div class="list-row" key={m.id} style="min-height:3rem">
                    <div class="grow"><div class="bold">{m.reason || (m.type === 'in' ? t('Cash in') : t('Cash out'))}</div><div class="sub">{formatTime(m.at)} · {m.by}</div></div>
                    <div class="money bold" style={m.type === 'out' ? 'color:var(--danger)' : ''}>{m.type === 'out' ? '−' : '+'}{money(m.amount)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          <button class="btn danger block" onClick={() => setMode('close')}>{t('Close shift')}</button>
        </div>
      )}

      {past.length > 0 && (
        <>
          <SectionTitle>{t('Previous shifts')}</SectionTitle>
          <div class="list">
            {past.map((p) => (
              <div class="list-row" key={p.id}>
                <div class="grow"><div class="bold">{formatDateTime(p.openedAt)}</div><div class="sub">{p.closedBy && `${t('Closed by {name}', { name: p.closedBy })} · `}{t('expected {amount}', { amount: money(p.expectedCash) })}</div></div>
                <span class={`pill ${p.variance === 0 ? 'ok' : p.variance < 0 ? 'bad' : 'warn'}`}>{p.variance === 0 ? t('Balanced') : `${p.variance > 0 ? '+' : '−'}${money(Math.abs(p.variance))}`}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {mode === 'open' && <FloatSheet onClose={() => setMode('none')} onDone={async (n) => { await openShift(n); setMode('none'); refresh(); showToast(t('Shift opened')); }} />}
      {(mode === 'in' || mode === 'out') && <MovementSheet type={mode} onClose={() => setMode('none')} onDone={() => { setMode('none'); refresh(); }} />}
      {mode === 'close' && sum && sh && (
        <CloseSheet sum={sum} onClose={() => setMode('none')} onDone={(s) => { setMode('none'); setClosed({ shift: s, sum }); refresh(); }} />
      )}
      {closed && <ZReport data={closed} onClose={() => setClosed(null)} />}
    </Sheet>
  );
}

function FloatSheet({ onClose, onDone }: { onClose: () => void; onDone: (n: number) => void }) {
  const [n, setN] = useState(0);
  return (
    <Sheet title={t('Open shift')} onClose={onClose} footer={<button class="btn primary" onClick={() => onDone(n)}>{t('Open shift')}</button>}>
      <MoneyInput big label={t('Cash in drawer at start')} value={n} onChange={setN} autofocus hint={t('Count the starting float (change money) and enter it here.')} />
    </Sheet>
  );
}

function MovementSheet({ type, onClose, onDone }: { type: 'in' | 'out'; onClose: () => void; onDone: () => void }) {
  const [n, setN] = useState(0);
  const [reason, setReason] = useState('');
  return (
    <Sheet title={type === 'in' ? t('Cash in') : t('Cash out')} onClose={onClose} footer={
      <button class="btn primary" disabled={n <= 0} onClick={async () => { await addCashMovement(type, n, reason); showToast(t('Recorded')); onDone(); }}>{t('Record')}</button>
    }>
      <div class="stack">
        <MoneyInput big label={t('Amount')} value={n} onChange={setN} autofocus />
        <TextInput label={t('Reason')} value={reason} onInput={(e) => setReason((e.currentTarget as HTMLInputElement).value)} placeholder={type === 'in' ? t('e.g. extra change from bank') : t('e.g. supplier payment, bank drop')} />
      </div>
    </Sheet>
  );
}

function CloseSheet({ sum, onClose, onDone }: { sum: ShiftSummary; onClose: () => void; onDone: (s: ShiftRec) => void }) {
  const [counted, setCounted] = useState(0);
  const [touched, setTouched] = useState(false);
  const [note, setNote] = useState('');
  const diff = counted - sum.expectedCash;
  return (
    <Sheet title={t('Close shift')} onClose={onClose} footer={
      <button class="btn danger" disabled={!touched} onClick={async () => { const closed = await closeShift(counted, note); void runAutoBackup('shift'); onDone(closed); }}>{t('Close shift')}</button>
    }>
      <div class="stack">
        <div class="card pad center"><div class="muted small">{t('Expected in drawer')}</div><div class="money" style="font-size:1.875rem;font-weight:800">{money(sum.expectedCash)}</div></div>
        <MoneyInput big label={t('Cash counted')} value={counted} onChange={(n) => { setCounted(n); setTouched(true); }} autofocus />
        {touched && (
          <div class={`banner ${diff === 0 ? 'ok' : diff < 0 ? 'bad' : ''}`}>
            {diff === 0 ? t('Drawer balances.') : diff < 0 ? t('Short by {amount}', { amount: money(-diff) }) : t('Over by {amount}', { amount: money(diff) })}
          </div>
        )}
        <TextInput label={t('Note (optional)')} value={note} onInput={(e) => setNote((e.currentTarget as HTMLInputElement).value)} />
      </div>
    </Sheet>
  );
}

function ZReport({ data, onClose }: { data: { shift: ShiftRec; sum: ShiftSummary }; onClose: () => void }) {
  const { shift: s, sum } = data;
  const diff = s.variance === 0 ? t('none') : (s.variance > 0 ? '+' : '−') + money(Math.abs(s.variance));
  const text = [
    t('END OF SHIFT'), `${formatDateTime(s.openedAt)} → ${formatDateTime(s.closedAt)}`, t('Closed by {name}', { name: s.closedBy }), '',
    `${t('Sales ({n})', { n: sum.orders })}: ${money(sum.sales)}`,
    ...(Object.keys(sum.byMethod) as PayMethod[]).filter((m) => sum.byMethod[m]).map((m) => `  ${payLabel(m)}: ${money(sum.byMethod[m])}`),
    `${t('Opening float')}: ${money(s.openingFloat)}`, `${t('Cash in')}: ${money(sum.cashIn)}`, `${t('Cash out')}: ${money(sum.cashOut)}`,
    `${t('Expected cash')}: ${money(s.expectedCash)}`, `${t('Counted cash')}: ${money(s.countedCash)}`,
    `${t('Difference')}: ${diff}`,
  ].join('\n');
  return (
    <Sheet title={t('Shift closed')} onClose={onClose} footer={<><button class="btn" onClick={() => shareText(t('End of shift'), text)}><Icon name="share" /> {t('Share')}</button><button class="btn primary" onClick={onClose}>{t('Done')}</button></>}>
      <pre class="receipt" style="white-space:pre-wrap">{text}</pre>
    </Sheet>
  );
}
