import { useEffect, useState } from 'preact/hooks';
import { t } from '../i18n';
import { CURRENCIES, currencyName, decimalsFor } from '../lib/money';
import { pickFile } from '../lib/platform';
import { registerSheet } from '../lib/sheets';
import { completeSetup, showToast } from '../lib/store';
import { digitsOnly, Field, Icon, NumberInput, Segmented, TextInput } from '../ui/components';
import { RestoreFlow } from './DataBackup';
import { DisplayPrefs } from './DisplayPrefs';

export function Setup() {
  const [step, setStep] = useState(0);
  const [storeName, setStoreName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [taxName, setTaxName] = useState(t('Tax'));
  const [taxRate, setTaxRate] = useState(0);
  const [inclusive, setInclusive] = useState(false);
  const [owner, setOwner] = useState('');
  const [pin, setPin] = useState('');
  const [sample, setSample] = useState(false);
  const [busy, setBusy] = useState(false);
  const [restore, setRestore] = useState<{ text: string; source: string } | null>(null);

  // The wizard isn't a sheet, so register it with the back-button stack ourselves: past step 1 the OS back button
  // steps back instead of doing nothing (and, unhandled, leaving the next press to close the app).
  useEffect(() => (step > 0 ? registerSheet(() => setStep((s) => Math.max(0, s - 1))) : undefined), [step > 0]);

  const pinBad = pin !== '' && !/^\d{4,6}$/.test(pin);
  const val = (e: Event) => (e.currentTarget as HTMLInputElement).value;
  const canNext = step === 0 ? !!storeName.trim() : step === 2 ? !!owner.trim() && !pinBad : true;

  async function finish(withSample: boolean) {
    setBusy(true);
    setSample(withSample);
    try {
      await completeSetup(
        { storeName: storeName.trim(), currency, currencyDecimals: decimalsFor(currency), taxName: taxName.trim() || 'Tax', taxRate, taxInclusive: inclusive },
        { name: owner.trim(), pin },
        withSample,
      );
    } catch (e) {
      showToast((e as Error).message, 'error');
      setBusy(false);
    }
  }

  return (
    <div class="main" style="display:flex;flex-direction:column">
      <div class="page-pad" style="flex:1;width:100%;padding-top:calc(1.5rem + var(--safe-top))">
        <div class="row" style="margin-bottom:0.375rem">
          <img src="icon.svg" alt="" width="44" height="44" style="border-radius:0.75rem" />
          <div>
            <div class="bold" style="font-size:1.25rem">Pocket POS</div>
            <div class="muted small">{t('Set up your shop · step {n} of 4', { n: step + 1 })}</div>
          </div>
        </div>
        <div class="row" style="gap:0.375rem;margin:0.875rem 0 1.375rem">
          {[0, 1, 2, 3].map((i) => <div key={i} style={`flex:1;height:0.25rem;border-radius:2px;background:${i <= step ? 'var(--primary)' : 'var(--line)'}`} />)}
        </div>

        {step === 0 && (
          <div class="stack">
            <div class="card pad"><DisplayPrefs contrast={false} /></div>
            <h2 style="margin:0">{t('Your shop')}</h2>
            <TextInput label={t('Shop name')} value={storeName} autofocus placeholder={t('e.g. Corner Café')} onInput={(e) => setStoreName(val(e))} />
            <Field label={t('Currency')}>
              <select class="select" value={currency} onChange={(e) => setCurrency((e.currentTarget as HTMLSelectElement).value)}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {currencyName(c.code, c.name)}</option>)}
              </select>
            </Field>
            <div class="card pad" style="margin-top:1.125rem">
              <div class="bold">{t('Already using Pocket POS?')}</div>
              <div class="small muted" style="margin:0.25rem 0 0.625rem">{t('Moving to a new phone or reinstalled the app? Restore everything from a backup file.')}</div>
              <button class="btn block" onClick={async () => {
                const f = await pickFile('.json,application/json,text/plain,*/*');
                if (f) setRestore({ text: await f.text(), source: f.name });
              }}><Icon name="restore" /> {t('Restore from backup')}</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div class="stack">
            <h2 style="margin:0">{t('Sales tax')}</h2>
            <div class="muted">{t('Skip this if you don’t charge tax. You can change it later.')}</div>
            <div class="grid2">
              <TextInput label={t('Tax name')} value={taxName} onInput={(e) => setTaxName(val(e))} placeholder={t('VAT, GST, SST…')} />
              <NumberInput label={t('Rate %')} value={taxRate} decimals max={100} onChange={setTaxRate} />
            </div>
            <Segmented value={inclusive ? 'in' : 'ex'} onChange={(v) => setInclusive(v === 'in')} options={[{ value: 'ex', label: t('Added on top') }, { value: 'in', label: t('Included in price') }]} />
          </div>
        )}

        {step === 2 && (
          <div class="stack">
            <h2 style="margin:0">{t('Owner account')}</h2>
            <TextInput label={t('Your name')} value={owner} autofocus onInput={(e) => setOwner(val(e))} />
            <TextInput label={t('PIN (optional, 4–6 digits)')} type="password" inputMode="numeric" maxLength={6} value={pin} onInput={(e) => setPin(digitsOnly(e))}
              hint={pinBad ? t('Use 4 to 6 digits') : t('With a PIN the app locks and cashiers can be added with limited access. If you forget it, you can recover by restoring a backup.')} />
          </div>
        )}

        {step === 3 && (
          <div class="stack">
            <h2 style="margin:0">{t('Ready to start')}</h2>
            <div class="muted">{t('Everything is stored on this phone and works offline. Remember to save a backup file now and then (Settings → Data & backup).')}</div>
            <button class="btn primary lg block" disabled={busy} onClick={() => finish(false)}>{t('Start with an empty shop')}</button>
            <button class="btn lg block" disabled={busy} onClick={() => finish(true)}>{busy && sample ? t('Loading…') : t('Try it with sample items & sales')}</button>
            <button class="btn block" disabled={busy} onClick={() => setStep(2)}>{t('Back')}</button>
          </div>
        )}
      </div>

      {step < 3 && (
        <div class="sheet-foot" style="max-width:47.5rem;width:100%;margin:0 auto;background:transparent;border:0">
          {step > 0 && <button class="btn" onClick={() => setStep(step - 1)}>{t('Back')}</button>}
          <button class="btn primary" disabled={!canNext} onClick={() => setStep(step + 1)}>{step === 1 && taxRate === 0 ? t('Skip') : t('Continue')}</button>
        </div>
      )}
      {restore && <RestoreFlow text={restore.text} source={restore.source} onClose={() => setRestore(null)} onRestored={() => {}} />}
    </div>
  );
}
