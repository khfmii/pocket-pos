import { useState } from 'preact/hooks';
import { LANGUAGES, lang, t, type LangCode } from '../i18n';
import { MAX_RECEIPT_LANGS, setManual, stateOf, translateInto } from '../lib/names';
import { translateAllProducts } from '../lib/nameTranslate';
import { canAutoTranslate, canTranslateTo, describeTranslateError, translate } from '../lib/translate';
import { products, saveSettings, settings, showToast } from '../lib/store';
import type { Product } from '../lib/types';
import { Icon, SectionTitle, Sheet, Switch } from '../ui/components';

const langName = (code: LangCode) => LANGUAGES.find((l) => l.code === code)?.name ?? code;

/**
 * "Names in other languages" inside the item form. Each language is an ordinary text box: whatever is typed there is
 * kept, and a name that was machine-translated is labelled "Automatic" until someone edits it.
 */
export function NamesSection({ p, setP }: { p: Product; setP: (f: (cur: Product) => Product) => void }) {
  const s = settings.value;
  const [busy, setBusy] = useState<'all' | LangCode | null>(null);
  const [setup, setSetup] = useState(false);
  const auto = canAutoTranslate();
  const original = s.nameLang;
  const langs = (s.nameLangs ?? []).filter((l) => l !== original);

  if (!original || langs.length === 0)
    return (
      <>
        <button class="btn block" onClick={() => setSetup(true)}>
          <Icon name="globe" /> {t('Item names in other languages…')}
        </button>
        {setup && <NameLanguagesSheet onClose={() => setSetup(false)} />}
      </>
    );

  const state = stateOf(p);
  const apply = (next: { names: typeof state.names; auto: typeof state.auto }) => setP((cur) => ({ ...cur, names: next.names, namesAuto: next.auto }));

  async function run(force?: LangCode) {
    if (!p.name.trim()) return showToast(t('Give the item a name'), 'error');
    setBusy(force ?? 'all');
    try {
      const r = await translateInto(state, p.name, original!, langs, translate, { nameChanged: true, force: force ? [force] : undefined });
      apply(r.state);
      if (r.failed.length) showToast(describeTranslateError(r.failed[0].error), 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div class="card pad stack">
      <div class="row between" style="gap:0.75rem">
        <div class="bold">{t('Names in other languages')}</div>
        {auto && (
          <button class="btn sm" disabled={busy !== null || !p.name.trim()} onClick={() => run()}>
            <Icon name="globe" size="sm" /> {busy === 'all' ? t('Translating…') : t('Translate')}
          </button>
        )}
      </div>
      {langs.map((l) => {
        const isAuto = state.auto.includes(l);
        const canRedo = auto && canTranslateTo(l);
        return (
          <label class="field" key={l}>
            <span class="label">
              {langName(l)}
              {isAuto && <span class="pill brand" style="margin-inline-start:0.5rem">{t('Automatic')}</span>}
            </span>
            <div class="row" style="gap:0.5rem">
              <input
                class="input grow"
                value={state.names[l] ?? ''}
                placeholder={p.name}
                onInput={(e) => apply(setManual(state, l, (e.currentTarget as HTMLInputElement).value))}
              />
              {canRedo && (
                <button class="iconbtn" style="border:1px solid var(--line);background:var(--surface)" disabled={busy !== null || !p.name.trim()} onClick={() => run(l)} aria-label={t('Translate again')}>
                  <Icon name="rotate" />
                </button>
              )}
            </div>
            {auto && !canTranslateTo(l) && <div class="hint">{t('Automatic translation is not available for this language. Type the name in.')}</div>}
          </label>
        );
      })}
      <div class="hint">
        {auto ? t('Automatic translations can be wrong. Correct any name and your version is kept.') : t('Type the names in. Automatic translation is available in the Android app.')}
      </div>
      <button class="btn sm" onClick={() => setSetup(true)}>{t('Choose languages')}</button>
      {setup && <NameLanguagesSheet onClose={() => setSetup(false)} />}
    </div>
  );
}

/** Settings → Item name languages: which languages to keep, automatic translation, and what receipts print. */
export function NameLanguagesSheet({ onClose }: { onClose: () => void }) {
  const s = settings.value;
  const [original, setOriginal] = useState<LangCode>(s.nameLang ?? lang.value);
  const [langs, setLangs] = useState<LangCode[]>(s.nameLangs ?? []);
  const [auto, setAuto] = useState(s.autoTranslate ?? canAutoTranslate());
  const [recLangs, setRecLangs] = useState<LangCode[]>(s.receiptNameLangs ?? []);
  const [progress, setProgress] = useState<string | null>(null);
  const native = canAutoTranslate();
  const chosen = langs.filter((l) => l !== original);

  const patch = () => ({
    nameLang: original,
    nameLangs: chosen,
    autoTranslate: native ? auto : false,
    // Only languages the shop actually keeps (or the original) can go on a receipt; at most two.
    receiptNameLangs: recLangs.filter((l) => l === original || chosen.includes(l)).slice(0, MAX_RECEIPT_LANGS),
  });

  async function save() {
    await saveSettings(patch());
    showToast(t('Saved'));
    onClose();
  }

  async function translateAll() {
    await saveSettings(patch());
    setProgress(t('Translating…'));
    const r = await translateAllProducts((done, total) => setProgress(t('Translating {done} of {total}…', { done, total })));
    setProgress(null);
    if (r.error && !r.translated) showToast(describeTranslateError(r.error), 'error');
    else showToast(r.failed ? t('{n} names translated, {failed} could not be', { n: r.translated, failed: r.failed }) : t('{n} names translated', { n: r.translated }));
  }

  return (
    <Sheet title={t('Item name languages')} onClose={onClose} full footer={<button class="btn primary" disabled={progress !== null} onClick={save}>{t('Save')}</button>}>
      <div class="stack">
        <div class="hint">{t('Keep each item’s name in the languages your customers read. The name you type stays the original; the others can be translated for you and corrected any time.')}</div>

        <label class="field">
          <span class="label">{t('Item names are written in')}</span>
          <select class="select" value={original} onChange={(e) => setOriginal((e.currentTarget as HTMLSelectElement).value as LangCode)}>
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </label>

        <div>
          <div class="label muted small bold" style="margin-bottom:0.375rem">{t('Also keep names in')}</div>
          <div class="chips" style="flex-wrap:wrap;padding:0">
            {LANGUAGES.filter((l) => l.code !== original).map((l) => (
              <button
                key={l.code}
                class={`chip ${langs.includes(l.code) ? 'on' : ''}`}
                aria-pressed={langs.includes(l.code)}
                onClick={() => setLangs((cur) => (cur.includes(l.code) ? cur.filter((x) => x !== l.code) : [...cur, l.code]))}
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>

        {native ? (
          <div class="card pad stack">
            <Switch label={t('Translate new and renamed items automatically')} hint={t('Done on your phone. The first time for each language it downloads a small language pack (about 30 MB), then it works offline.')} checked={auto} onChange={setAuto} />
            {chosen.includes('zh-TW') && <div class="hint">{t('Automatic translation is not available for this language. Type the name in.')} ({langName('zh-TW')})</div>}
            <button class="btn block" disabled={chosen.length === 0 || progress !== null || products.value.length === 0} onClick={translateAll}>
              <Icon name="globe" /> {progress ?? t('Translate all items now')}
            </button>
          </div>
        ) : (
          <div class="banner info"><div>{t('Type the names in. Automatic translation is available in the Android app.')}</div></div>
        )}

        {chosen.length > 0 && (
          <>
            <SectionTitle>{t('On receipts')}</SectionTitle>
            <div class="card pad stack">
              <div>
                <div class="label muted small bold" style="margin-bottom:0.375rem">{t('Item languages on receipts')}</div>
                <div class="chips" style="flex-wrap:wrap;padding:0">
                  {[original, ...chosen].map((l) => {
                    const at = recLangs.indexOf(l);
                    const full = at < 0 && recLangs.length >= MAX_RECEIPT_LANGS;
                    return (
                      <button
                        key={l}
                        class={`chip ${at >= 0 ? 'on' : ''}`}
                        style={full ? 'opacity:.45' : ''}
                        aria-pressed={at >= 0}
                        disabled={full}
                        onClick={() => setRecLangs((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]))}
                      >
                        {at >= 0 && <b>{at + 1}</b>} {langName(l)}{l === original && ` · ${t('As typed')}`}
                      </button>
                    );
                  })}
                </div>
                <div class="hint">{t('Choose up to 2. The first is printed as the item name; the second in small type underneath. Choose none to print names as typed.')}</div>
              </div>
              {recLangs.length === MAX_RECEIPT_LANGS && (
                <button class="btn sm" onClick={() => setRecLangs((cur) => [cur[1], cur[0]])}>{t('Swap order')}</button>
              )}
              <div class="hint">{t('Items with no translation in that language print as typed.')}</div>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
