import type { LangCode } from '../i18n';

/**
 * Item names in several languages. `name` is always the name as the owner typed it (the "original"); `names` holds the
 * translations, and `namesAuto` lists the languages whose text was machine-made and not yet touched by a person.
 * A name someone typed or corrected is never overwritten by auto-translate.
 */
export type Names = Partial<Record<LangCode, string>>;

export interface Named {
  name: string;
  names?: Names;
}

export interface NameState {
  names: Names;
  auto: LangCode[];
}

export const stateOf = (p: { names?: Names; namesAuto?: LangCode[] }): NameState => ({ names: { ...(p.names ?? {}) }, auto: [...(p.namesAuto ?? [])] });

/** The name to show in `lang`: its translation if there is one, otherwise the name as typed. */
export function localName(p: Named, lang: LangCode, original: LangCode | undefined): string {
  if (!original || lang === original) return p.name;
  return p.names?.[lang]?.trim() || p.name;
}

/** Does the needle (already lower-cased) match the name or any translation? Staff and customers may search in either. */
export function nameMatches(p: Named, needle: string): boolean {
  if (!needle) return true;
  if (p.name.toLowerCase().includes(needle)) return true;
  return Object.values(p.names ?? {}).some((n) => !!n && n.toLowerCase().includes(needle));
}

export interface ItemName {
  main: string;
  sub?: string;
}

/** Most languages an item name can be printed in on one receipt line. */
export const MAX_RECEIPT_LANGS = 2;

/**
 * The name(s) printed for a sale line, in the languages the shop chose for receipts (at most two): the first available
 * one is the name, the second goes underneath in small type. The original language means the name as sold. A language
 * the item has no translation for is skipped, and a line with nothing to show prints as sold. Translations are looked up
 * on the *current* item, so a receipt printed later picks up a corrected translation.
 */
export function receiptItemName(
  line: { name: string },
  product: Named | undefined,
  o: { original?: LangCode; langs?: LangCode[] },
): ItemName {
  const texts: string[] = [];
  for (const lang of (o.langs ?? []).slice(0, MAX_RECEIPT_LANGS)) {
    const text = lang === o.original ? line.name : product?.names?.[lang]?.trim() || '';
    if (text && !texts.includes(text)) texts.push(text);
  }
  if (!texts.length) return { main: line.name };
  return { main: texts[0], sub: texts[1] };
}

/** The user typed or corrected this language: keep it, and stop treating it as machine-made. */
export function setManual(s: NameState, lang: LangCode, text: string): NameState {
  const names = { ...s.names };
  const value = text.trim();
  if (value) names[lang] = value;
  else delete names[lang];
  return { names, auto: s.auto.filter((l) => l !== lang) };
}

export function setAuto(s: NameState, lang: LangCode, text: string): NameState {
  return { names: { ...s.names, [lang]: text.trim() }, auto: s.auto.includes(lang) ? s.auto : [...s.auto, lang] };
}

/**
 * Languages auto-translate should fill: the empty ones, plus machine-made ones when the original name changed (they
 * are stale). Anything a person typed is left alone unless it is listed in `force` (the per-language refresh button).
 */
export function pendingLanguages(s: NameState, targets: LangCode[], original: LangCode | undefined, o: { nameChanged?: boolean; force?: LangCode[] } = {}): LangCode[] {
  return targets.filter((l) => {
    if (l === original) return false;
    if (o.force?.includes(l)) return true;
    const has = !!s.names[l]?.trim();
    if (!has) return true;
    return s.auto.includes(l) && !!o.nameChanged;
  });
}

export type Translator = (text: string, from: LangCode, to: LangCode) => Promise<string>;

/** Translates `name` into each pending language. Failures are collected per language so one bad pack doesn't lose the rest. */
export async function translateInto(
  s: NameState,
  name: string,
  original: LangCode,
  targets: LangCode[],
  translate: Translator,
  o: { nameChanged?: boolean; force?: LangCode[]; onProgress?: (lang: LangCode) => void } = {},
): Promise<{ state: NameState; failed: { lang: LangCode; error: unknown }[]; done: LangCode[] }> {
  let state = s;
  const failed: { lang: LangCode; error: unknown }[] = [];
  const done: LangCode[] = [];
  if (!name.trim()) return { state, failed, done };
  for (const lang of pendingLanguages(s, targets, original, o)) {
    o.onProgress?.(lang);
    try {
      const text = (await translate(name.trim(), original, lang)).trim();
      if (text) {
        state = setAuto(state, lang, text);
        done.push(lang);
      }
    } catch (error) {
      failed.push({ lang, error });
    }
  }
  return { state, failed, done };
}
