import { computed, signal } from '@preact/signals';
import { isMobileDevice } from '../lib/device';

/**
 * Tiny i18n. The English text IS the key: `t('Add customer')`. A language file maps English → translation and
 * anything missing falls back to the English, so a gap can never show a blank or a key name.
 *   t('Hello {name}', { name })        — interpolation
 *   tn(n, '{n} item', '{n} items')     — plural (language's own rules via Intl.PluralRules)
 */
export type LangCode = 'en' | 'zh-CN' | 'zh-TW' | 'ms' | 'id' | 'es' | 'ja' | 'ko' | 'th' | 'vi' | 'fr' | 'de' | 'pt';

export const LANGUAGES: { code: LangCode; name: string; english: string }[] = [
  { code: 'en', name: 'English', english: 'English' },
  { code: 'zh-CN', name: '简体中文', english: 'Chinese (Simplified)' },
  { code: 'zh-TW', name: '繁體中文', english: 'Chinese (Traditional)' },
  { code: 'ms', name: 'Bahasa Melayu', english: 'Malay' },
  { code: 'id', name: 'Bahasa Indonesia', english: 'Indonesian' },
  { code: 'es', name: 'Español', english: 'Spanish' },
  { code: 'ja', name: '日本語', english: 'Japanese' },
  { code: 'ko', name: '한국어', english: 'Korean' },
  { code: 'th', name: 'ไทย', english: 'Thai' },
  { code: 'vi', name: 'Tiếng Việt', english: 'Vietnamese' },
  { code: 'fr', name: 'Français', english: 'French' },
  { code: 'de', name: 'Deutsch', english: 'German' },
  { code: 'pt', name: 'Português', english: 'Portuguese' },
];

export type LangPref = 'auto' | LangCode;

const KEY = 'pocketpos.lang';

const loaders: Record<Exclude<LangCode, 'en'>, () => Promise<{ default: Record<string, string> }>> = {
  'zh-CN': () => import('./zh-CN'),
  'zh-TW': () => import('./zh-TW'),
  ms: () => import('./ms'),
  id: () => import('./id'),
  es: () => import('./es'),
  ja: () => import('./ja'),
  ko: () => import('./ko'),
  th: () => import('./th'),
  vi: () => import('./vi'),
  fr: () => import('./fr'),
  de: () => import('./de'),
  pt: () => import('./pt'),
};

/** Maps a BCP-47 tag from the OS/browser to a language we ship, or null. */
export function matchLanguage(tag: string): LangCode | null {
  const t = tag.toLowerCase().replace('_', '-');
  const base = t.split('-')[0];
  if (base === 'zh') {
    if (/hant|-tw|-hk|-mo/.test(t)) return 'zh-TW';
    return 'zh-CN';
  }
  if (base === 'in') return 'id'; // legacy Android code for Indonesian
  if (base === 'zsm') return 'ms';
  return LANGUAGES.some((l) => l.code === base) ? (base as LangCode) : null;
}

/**
 * Phones and tablets follow the system language; PCs default to English (the user can still choose another).
 * Pass `mobile`/`languages` for tests.
 */
export function detectLanguage(
  languages: readonly string[] = typeof navigator !== 'undefined' ? navigator.languages?.length ? navigator.languages : [navigator.language] : [],
  mobile: boolean = isMobileDevice(),
): LangCode {
  if (!mobile) return 'en';
  for (const l of languages) {
    const m = l && matchLanguage(l);
    if (m) return m;
  }
  return 'en';
}

function readPref(): LangPref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'auto' || LANGUAGES.some((l) => l.code === v)) return (v as LangPref) ?? 'auto';
  } catch {
    /* storage unavailable */
  }
  return 'auto';
}

export const langPref = signal<LangPref>(readPref());
export const lang = signal<LangCode>('en');
const dict = signal<Record<string, string>>({});
export const locale = computed(() => lang.value);

let plural = new Intl.PluralRules('en');

export function t(key: string, vars?: Record<string, string | number>): string {
  const s = dict.value[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`)) : s;
}

/** Plural-aware: picks `one` or `other` per the active language's rules ({n} is filled in). */
export function tn(n: number, one: string, other: string, vars?: Record<string, string | number>): string {
  lang.value; // subscribe so components re-render on language change
  return t(plural.select(n) === 'one' ? one : other, { n, ...vars });
}

/** Loads the language file (code-split, so only the chosen language is downloaded) and switches. */
export async function setLanguage(code: LangCode): Promise<void> {
  let d: Record<string, string> = {};
  if (code !== 'en') {
    try {
      d = (await loaders[code]()).default;
    } catch {
      code = 'en'; // chunk missing/offline: stay usable in English
    }
  }
  plural = new Intl.PluralRules(code);
  dict.value = d;
  lang.value = code;
  if (typeof document !== 'undefined') document.documentElement.lang = code;
}

export async function applyLangPref(pref: LangPref = langPref.value): Promise<void> {
  await setLanguage(pref === 'auto' ? detectLanguage() : pref);
}

export async function setLangPref(pref: LangPref): Promise<void> {
  langPref.value = pref;
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* ignore */
  }
  await applyLangPref(pref);
}
