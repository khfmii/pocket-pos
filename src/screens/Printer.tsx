import { useEffect, useState } from 'preact/hooks';
import { t } from '../i18n';
import { buildReceipt, sampleOrder } from '../lib/receipt';
import { canBluetoothPrint, deps, describePrintError, hasPrinter, printBlocks, printer, updatePrinter, type PairedDevice } from '../lib/printer';
import { receiptNamer, settings, showToast } from '../lib/store';
import type { Order } from '../lib/types';
import { Icon, SectionTitle, Sheet, Switch } from '../ui/components';

/** Prints a receipt on the chosen Bluetooth printer, reporting problems as a toast. Resolves true when it was sent. */
export async function printOrderReceipt(order: Order): Promise<boolean> {
  try {
    const s = settings.value;
    await printBlocks(buildReceipt(order, s, receiptNamer(s)), s.logo, s.paperWidth);
    return true;
  } catch (e) {
    showToast(describePrintError(e), 'error');
    return false;
  }
}

/** Lists the phone's already-paired Bluetooth devices; the user taps their printer. */
export function PrinterPickerSheet({ onClose, onPicked }: { onClose: () => void; onPicked?: () => void }) {
  const [devices, setDevices] = useState<PairedDevice[] | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      const { devices: list } = await deps.native.listPaired();
      setDevices([...list].sort((a, b) => Number(b.isPrinter) - Number(a.isPrinter) || a.name.localeCompare(b.name)));
    } catch (e) {
      setDevices([]);
      setError(describePrintError(e));
    }
  }

  useEffect(() => {
    void load();
    // After pairing in Android's settings the user comes back here: refresh the list.
    const onShow = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, []);

  return (
    <Sheet title={t('Choose printer')} onClose={onClose}>
      <div class="stack">
        <div class="hint">{t('Turn the printer on and pair it in Android Settings → Bluetooth first, then pick it here.')}</div>
        {error && <div class="banner bad"><div>{error}</div></div>}
        {devices === null ? (
          <div class="muted">{t('Loading…')}</div>
        ) : devices.length === 0 ? (
          !error && <div class="card pad muted small">{t('No paired Bluetooth devices yet.')}</div>
        ) : (
          <div class="list">
            {devices.map((d) => (
              <button
                key={d.address}
                class="list-row"
                onClick={() => {
                  updatePrinter({ address: d.address, name: d.name });
                  onClose();
                  onPicked?.();
                }}
              >
                <div class="lead"><Icon name="print" /></div>
                <div class="grow">
                  <div class="bold ellipsis">{d.name}</div>
                  <div class="sub">{d.address}</div>
                </div>
                {d.isPrinter && <span class="pill brand">{t('Printer')}</span>}
                {printer.value.address === d.address && <Icon name="check" />}
              </button>
            ))}
          </div>
        )}
        <button class="btn block" onClick={() => void deps.native.openSettings()}>
          <Icon name="phone" /> {t('Open Bluetooth settings')}
        </button>
      </div>
    </Sheet>
  );
}

/** Settings → Receipts: which printer, cutting, automatic printing, and a test page. Android app only. */
export function PrinterSection() {
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!canBluetoothPrint()) return null;
  const c = printer.value;

  async function test() {
    if (!hasPrinter()) return setPicking(true);
    setBusy(true);
    const ok = await printOrderReceipt(sampleOrder(settings.value));
    setBusy(false);
    if (ok) showToast(t('Sent to the printer'));
  }

  return (
    <>
      <SectionTitle>{t('Bluetooth printer')}</SectionTitle>
      <div class="card pad stack">
        <div class="row between" style="gap:0.75rem">
          <div style="min-width:0">
            <div class="small muted">{t('Printer')}</div>
            <div class="bold ellipsis">{c.name || t('No printer chosen')}</div>
          </div>
          <button class="btn sm" onClick={() => setPicking(true)}>{c.address ? t('Change printer') : t('Choose printer')}</button>
        </div>
        <Switch label={t('Cut paper after printing')} hint={t('Only for printers with a cutter; others ignore it.')} checked={c.cut} onChange={(cut) => updatePrinter({ cut })} />
        <Switch label={t('Print automatically after each sale')} checked={c.auto} onChange={(auto) => updatePrinter({ auto })} />
        <button class="btn block" disabled={busy} onClick={test}>
          <Icon name="print" /> {busy ? t('Printing…') : t('Print test page')}
        </button>
        <div class="hint">{t('Prints at the paper width chosen above (58 or 80 mm), with your logo and shop details.')}</div>
      </div>
      {picking && <PrinterPickerSheet onClose={() => setPicking(false)} />}
    </>
  );
}
