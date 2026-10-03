import { LANGUAGES, langPref, setLangPref, t, type LangPref } from '../i18n';
import { highContrast, setHighContrast, setTextScale, TEXT_SCALES, textScale, type TextScale } from '../lib/display';
import { Field, Segmented, Switch } from '../ui/components';

const SIZE_LABEL = (s: TextScale) => (s === 1 ? t('Standard') : s === 1.15 ? t('Large') : s === 1.3 ? t('Extra large') : t('Huge'));

/** Language + display size (+ optional high contrast). Used in Settings and on the first-run screen. */
export function DisplayPrefs({ contrast = true }: { contrast?: boolean }) {
  return (
    <div class="stack">
      <Field label={t('Language')} hint={t('“Automatic” follows your phone’s language. On a computer it starts in English.')}>
        <select class="select" value={langPref.value} onChange={(e) => setLangPref((e.currentTarget as HTMLSelectElement).value as LangPref)}>
          <option value="auto">{t('Automatic')}</option>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
              {l.name !== l.english ? ` (${l.english})` : ''}
            </option>
          ))}
        </select>
      </Field>

      <div>
        <div class="label muted small bold" style="margin-bottom:0.375rem">{t('Display size')}</div>
        <Segmented
          value={String(textScale.value)}
          onChange={(v) => setTextScale(Number(v) as TextScale)}
          options={TEXT_SCALES.map((s) => ({ value: String(s), label: SIZE_LABEL(s) }))}
        />
        <div class="hint">{t('Makes text, buttons and spacing bigger so everything is easier to read and tap.')}</div>
        <div class="card pad" style="margin-top:0.625rem">
          <div class="bold">{t('Sample')}</div>
          <div class="muted">{t('Latte')} · <span class="money">12.50</span></div>
        </div>
      </div>

      {contrast && <Switch label={t('High contrast')} hint={t('Stronger colours and borders for easier reading')} checked={highContrast.value} onChange={setHighContrast} />}
    </div>
  );
}
