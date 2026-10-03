import type { LangCode } from '../i18n';
import { setAuto, stateOf, translateInto } from './names';
import { canAutoTranslate, canTranslateTo, translate } from './translate';
import { products, saveProduct, settings } from './store';

/**
 * Fills an item's missing translations in the background (Android app). Work is queued one item at a time, because the
 * first run for a language downloads its pack, and the item is re-read afterwards so a name someone typed or corrected
 * while we were busy is never overwritten.
 */
let queue: Promise<unknown> = Promise.resolve();
const enqueue = <T>(job: () => Promise<T>): Promise<T> => {
  const next = queue.then(job, job);
  queue = next.catch(() => {});
  return next;
};

/** Languages the shop keeps names in that can be machine-translated (the original language is not one of them). */
function targetLanguages(): { original: LangCode; targets: LangCode[] } | null {
  const { nameLang, nameLangs } = settings.value;
  if (!nameLang || !nameLangs?.length) return null;
  return { original: nameLang, targets: nameLangs.filter((l) => l !== nameLang && canTranslateTo(l)) };
}

export interface TranslateResult {
  translated: number;
  failed: number;
  error?: unknown;
}

async function fillOne(id: string, nameChanged: boolean, force?: LangCode[], onProgress?: (lang: LangCode) => void): Promise<TranslateResult> {
  const cfg = targetLanguages();
  const start = products.value.find((p) => p.id === id);
  if (!cfg || !start) return { translated: 0, failed: 0 };
  // An explicit refresh of one language (`force`) touches only that language.
  const targets = force ? cfg.targets.filter((l) => force.includes(l)) : cfg.targets;
  const r = await translateInto(stateOf(start), start.name, cfg.original, targets, translate, { nameChanged, force, onProgress });
  if (r.done.length) {
    // Re-read: only fill languages that are still empty or machine-made, so a correction made meanwhile survives.
    const latest = products.value.find((p) => p.id === id);
    if (latest) {
      let s = stateOf(latest);
      let changed = false;
      for (const lang of r.done) {
        const manual = !!s.names[lang]?.trim() && !s.auto.includes(lang) && !force?.includes(lang);
        if (!manual) {
          s = setAuto(s, lang, r.state.names[lang]!);
          changed = true;
        }
      }
      if (changed) await saveProduct({ ...latest, names: s.names, namesAuto: s.auto });
    }
  }
  return { translated: r.done.length, failed: r.failed.length, error: r.failed[0]?.error };
}

/** Called after an item is saved: translates new or renamed items by themselves when the shop turned that on. */
export function autoTranslateProduct(id: string, nameChanged: boolean): Promise<TranslateResult> {
  if (!canAutoTranslate() || !settings.value.autoTranslate) return Promise.resolve({ translated: 0, failed: 0 });
  return enqueue(() => fillOne(id, nameChanged));
}

/** "Translate all items now": fills every item's gaps, reporting progress (items done, total). */
export function translateAllProducts(onProgress: (done: number, total: number) => void): Promise<TranslateResult> {
  return enqueue(async () => {
    const ids = products.value.map((p) => p.id);
    let translated = 0;
    let failed = 0;
    let error: unknown;
    let streak = 0; // items in a row where nothing worked
    for (let i = 0; i < ids.length; i++) {
      onProgress(i, ids.length);
      const r = await fillOne(ids[i], false);
      translated += r.translated;
      failed += r.failed;
      error ??= r.error;
      // A missing language pack or no internet fails every item the same way: stop early instead of retrying hundreds of times.
      streak = r.failed && !r.translated ? streak + 1 : 0;
      if (streak >= 3) break;
    }
    onProgress(ids.length, ids.length);
    return { translated, failed, error };
  });
}

/** Re-translates one item into one language (the ↻ button), even when that language was typed by hand. */
export function retranslate(id: string, lang: LangCode): Promise<TranslateResult> {
  return enqueue(() => fillOne(id, true, [lang]));
}
