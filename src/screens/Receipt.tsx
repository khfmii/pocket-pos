import { useEffect, useState } from 'preact/hooks';
import { t } from '../i18n';
import { buildReceipt, payLine, receiptText, sampleOrder, type Block } from '../lib/receipt';
import { receiptPdf, receiptPng } from '../lib/receiptImage';
import { canPrint, isNative, shareFile, shareText } from '../lib/platform';
import { canBluetoothPrint, hasPrinter, printer } from '../lib/printer';
import { money, receiptNamer, settings, showToast } from '../lib/store';
import type { Order, Settings } from '../lib/types';
import { Icon, Sheet } from '../ui/components';
import { PrinterPickerSheet, printOrderReceipt } from './Printer';
import { ProofSection } from './Proofs';

const cls = (base: string, b: { size?: string; bold?: boolean; center?: boolean; indent?: boolean }) =>
  `${base}${b.size && b.size !== 'md' ? ` r-${b.size}` : ''}${b.bold ? ' r-b' : ''}${b.center ? ' r-c' : ''}${b.indent ? ' r-i' : ''}`;

/** The receipt as HTML: scales with the display-size setting, selectable, and prints with the logo. */
function Paper({ blocks, logo, mm, id }: { blocks: Block[]; logo: string; mm: number; id?: string }) {
  return (
    <div class={`paper ${mm === 80 ? 'wide' : ''}`} id={id} style={`--paper:${mm}mm`}>
      {blocks.map((b, i) => {
        if (b.k === 'logo') return logo ? <img key={i} class="r-logo" src={logo} alt="" /> : null;
        if (b.k === 'rule') return <hr key={i} class="r-rule" />;
        if (b.k === 'row')
          return (
            <div key={i} class={cls('r-row', b)}>
              <span>{b.left}</span>
              <span>{b.right}</span>
            </div>
          );
        return (
          <div key={i} class={cls('r-t', b)}>
            {b.text}
          </div>
        );
      })}
    </div>
  );
}

export function ReceiptView({ order }: { order: Order }) {
  const s = settings.value;
  return <Paper id="print-receipt" blocks={buildReceipt(order, s, receiptNamer(s))} logo={s.logo} mm={s.paperWidth} />;
}

/** Sample receipt using the (possibly unsaved) shop details being edited. */
export function ReceiptPreviewSheet({ draft, onClose }: { draft: Settings; onClose: () => void }) {
  return (
    <Sheet title={t('Preview receipt')} onClose={onClose}>
      <div class="stack">
        <Paper blocks={buildReceipt(sampleOrder(draft), draft)} logo={draft.logo} mm={draft.paperWidth} />
        <div class="hint">{t('This is how your receipts will look. Add your logo, address and contact details in Store profile.')}</div>
      </div>
    </Sheet>
  );
}

const fileName = (order: Order, ext: string) => `receipt-${order.number.replace(/[^\w-]+/g, '') || 'sale'}.${ext}`;

type Kind = 'png' | 'pdf' | 'text';

function ShareSheet({ order, onClose }: { order: Order; onClose: () => void }) {
  const [busy, setBusy] = useState<Kind | null>(null);

  async function go(kind: Kind) {
    setBusy(kind);
    const s = settings.value;
    const title = t('Receipt {number}', { number: order.number });
    try {
      if (kind === 'text') {
        if (!(await shareText(title, receiptText(order, s)))) showToast(t('Receipt copied to clipboard'));
        onClose();
        return;
      }
      const blocks = buildReceipt(order, s, receiptNamer(s));
      const blob = kind === 'png' ? await receiptPng(blocks, s.logo) : await receiptPdf(blocks, s.logo, { paperMm: s.paperWidth, title });
      const outcome = await shareFile(blob, fileName(order, kind), title);
      if (outcome === 'saved') showToast(t('Saved to your Downloads folder'));
      if (outcome !== 'cancelled') onClose();
    } catch {
      showToast(t('Could not create the receipt.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  const opts: { kind: Kind; icon: string; title: string; sub: string }[] = [
    { kind: 'png', icon: 'image', title: t('Image (PNG)'), sub: t('Best for sending in a chat') },
    { kind: 'pdf', icon: 'file', title: t('PDF document'), sub: t('Best for email, or to keep as a record') },
    { kind: 'text', icon: 'note', title: t('Plain text'), sub: t('Text only, without the logo') },
  ];
  return (
    <Sheet title={t('Share receipt')} onClose={onClose}>
      <div class="list">
        {opts.map((o) => (
          <button key={o.kind} class="list-row" disabled={busy !== null} onClick={() => go(o.kind)}>
            <div class="lead"><Icon name={o.icon} /></div>
            <div class="grow">
              <div class="bold">{o.title}</div>
              <div class="sub">{busy === o.kind ? t('Working…') : o.sub}</div>
            </div>
            <Icon name="right" class="chev" />
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export function ReceiptActions({ order }: { order: Order }) {
  const [sharing, setSharing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [printing, setPrinting] = useState(false);

  async function print() {
    if (!isNative()) return window.print(); // desktop browser: the print dialog
    if (!hasPrinter()) return setPicking(true); // first time: choose a printer, then print
    setPrinting(true);
    const ok = await printOrderReceipt(order);
    setPrinting(false);
    if (ok) showToast(t('Sent to the printer'));
  }

  return (
    <div class="row wrap">
      <button class="btn grow" onClick={() => setSharing(true)}>
        <Icon name="share" /> {t('Share')}
      </button>
      {(canPrint() || canBluetoothPrint()) && (
        <button class="btn grow" disabled={printing} onClick={print}>
          <Icon name="print" /> {printing ? t('Printing…') : t('Print')}
        </button>
      )}
      {sharing && <ShareSheet order={order} onClose={() => setSharing(false)} />}
      {picking && <PrinterPickerSheet onClose={() => setPicking(false)} onPicked={() => void print()} />}
    </div>
  );
}

/** Sales already sent to the printer automatically, so re-opening the screen never prints twice. */
const autoPrinted = new Set<string>();

/** Shown right after a sale completes. */
export function SaleComplete({ order, onClose }: { order: Order; onClose: () => void }) {
  useEffect(() => {
    if (!canBluetoothPrint() || !printer.value.auto || !printer.value.address || autoPrinted.has(order.id)) return;
    autoPrinted.add(order.id);
    void printOrderReceipt(order);
  }, [order.id]);
  const methods = order.payments.map(payLine).join(' + ') || t('No payment');
  return (
    <Sheet
      title={t('Sale complete')}
      onClose={onClose}
      footer={
        <button class="btn primary lg" onClick={onClose}>
          {t('New sale')}
        </button>
      }
    >
      <div class="center">
        <div class="success-mark">
          <Icon name="check" size="lg" />
        </div>
        <div class="muted small">
          {order.number} · {methods}
        </div>
        <div class="money" style="font-size:2.125rem;font-weight:800">
          {money(order.total)}
        </div>
        {order.change > 0 && (
          <div class="banner ok" style="justify-content:center;margin:0.75rem 0;font-size:1.25rem;font-weight:800">
            {t('Change due {amount}', { amount: money(order.change) })}
          </div>
        )}
      </div>
      <div class="stack" style="margin-top:0.875rem">
        <ProofSection orderId={order.id} />
        <ReceiptActions order={order} />
        <ReceiptView order={order} />
      </div>
    </Sheet>
  );
}
