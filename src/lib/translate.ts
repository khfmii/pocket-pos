import { registerPlugin } from '@capacitor/core';
import { t, type LangCode } from '../i18n';
import { isNative } from './device';

/**
 * Machine translation of item names, done on the phone by Google's on-device ML Kit (Android app). Nothing is sent to a
 * translation website: the first use of each language downloads a small language pack, after which it works offline.
 */
export interface TranslateApi {
  translate(o: { text: string; source: string; target: string }): Promise<{ text: string }>;
}

// Local Android plugin (android/app/src/main/java/com/pocketpos/app/TranslatePlugin.java). Replaceable in tests.
export const deps: { native: TranslateApi; isNative: () => boolean } = {
  native: registerPlugin<TranslateApi>('Translate'),
  isNative,
};

/** The on-device translator only produces Simplified Chinese, so Traditional can't be filled in automatically. */
export const AUTO_UNSUPPORTED: readonly LangCode[] = ['zh-TW'];
export const canAutoTranslate = () => deps.isNative();
export const canTranslateTo = (l: LangCode) => !AUTO_UNSUPPORTED.includes(l);

// ML Kit knows one "zh"; reading Traditional text as the source is fine, writing it is not (see above).
const tag = (l: LangCode) => (l === 'zh-CN' || l === 'zh-TW' ? 'zh' : l);

export async function translate(text: string, from: LangCode, to: LangCode): Promise<string> {
  if (!canTranslateTo(to)) throw new Error('unsupported-language');
  const r = await deps.native.translate({ text, source: tag(from), target: tag(to) });
  return r.text;
}

/** Turns a native error code into something a shop owner can act on. */
export function describeTranslateError(e: unknown): string {
  const m = String((e as Error)?.message ?? e);
  if (/model-download-failed/.test(m)) return t('Could not download the language pack. Check your internet connection and try again.');
  if (/unsupported-language/.test(m)) return t('Automatic translation is not available for this language. Type the name in.');
  return t('Could not translate this name.');
}
