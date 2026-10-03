import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs helper without types
import { extractKeys } from '../../scripts/i18n-keys.mjs';
import { ALL_PRESETS } from '../lib/categories';
import { detectLanguage, LANGUAGES, lang, matchLanguage, setLanguage, t, tn, type LangCode } from './index';

const files = import.meta.glob<{ default: Record<string, string> }>('./*.ts');
const keys: Map<string, { plural: 'one' | 'other' | null }> = extractKeys('src');
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('every shipped language is complete and well-formed', () => {
  it('finds the strings to translate', () => {
    expect(keys.size).toBeGreaterThan(600);
  });

  for (const { code } of LANGUAGES.filter((l) => l.code !== 'en')) {
    it(`${code}: translates every string, keeps placeholders, no stray characters`, async () => {
      const dict = (await files[`./${code}.ts`]()).default;
      const missing: string[] = [];
      const broken: string[] = [];
      const invisible: string[] = [];
      for (const key of keys.keys()) {
        const v = dict[key];
        if (!v?.trim()) {
          missing.push(key);
          continue;
        }
        if (placeholders(v).join() !== placeholders(key).join()) broken.push(`${key} → ${v}`);
        if (/[­​‎‏﻿]/.test(v)) invisible.push(key);
      }
      expect(missing, `missing in ${code}`).toEqual([]);
      expect(broken, `placeholder mismatch in ${code}`).toEqual([]);
      expect(invisible, `invisible characters in ${code}`).toEqual([]);
      // no orphans: every entry should still be used by the app
      const unused = Object.keys(dict).filter((k) => !keys.has(k));
      expect(unused, `unused entries in ${code}`).toEqual([]);
    });
  }
});

// A category from the library is recognised by name as well as by id, so two entries must never share a name.
describe('category library names stay distinct in every language', () => {
  const english = ALL_PRESETS.map((p) => p.name());
  for (const { code } of LANGUAGES) {
    it(code, async () => {
      const dict = code === 'en' ? {} : (await files[`./${code}.ts`]()).default;
      const names = english.map((n) => (dict[n] ?? n).trim().toLowerCase());
      const dupes = names.filter((n, i) => names.indexOf(n) !== i);
      expect(dupes).toEqual([]);
    });
  }
});

describe('language detection', () => {
  it('PCs default to English, whatever the browser language', () => {
    expect(detectLanguage(['ja-JP', 'en'], false)).toBe('en');
    expect(detectLanguage(['zh-CN'], false)).toBe('en');
  });

  it('phones follow the system language, trying each preference in order', () => {
    expect(detectLanguage(['ja-JP'], true)).toBe('ja');
    expect(detectLanguage(['xx-YY', 'es-MX', 'en'], true)).toBe('es');
    expect(detectLanguage(['de-AT'], true)).toBe('de');
    expect(detectLanguage(['pt-BR'], true)).toBe('pt');
  });

  it('falls back to English for unsupported languages', () => {
    expect(detectLanguage(['sw-KE'], true)).toBe('en');
    expect(detectLanguage([], true)).toBe('en');
  });

  it('maps Chinese scripts and legacy Android codes correctly', () => {
    expect(matchLanguage('zh-CN')).toBe('zh-CN');
    expect(matchLanguage('zh-Hans-SG')).toBe('zh-CN');
    expect(matchLanguage('zh-TW')).toBe('zh-TW');
    expect(matchLanguage('zh-HK')).toBe('zh-TW');
    expect(matchLanguage('zh-Hant')).toBe('zh-TW');
    expect(matchLanguage('in')).toBe('id'); // Android's old code for Indonesian
    expect(matchLanguage('ms-MY')).toBe('ms');
    expect(matchLanguage('pt_BR')).toBe('pt');
  });
});

describe('t() and tn()', () => {
  it('returns the English text when a language has no entry, and fills placeholders', async () => {
    await setLanguage('en');
    expect(t('Never heard of this key {x}', { x: 5 })).toBe('Never heard of this key 5');
    await setLanguage('de');
    expect(t('Never heard of this key')).toBe('Never heard of this key');
    expect(t('Save')).toBe('Speichern');
  });

  it('uses each language’s own plural rules', async () => {
    await setLanguage('en');
    expect(tn(1, '{n} item', '{n} items')).toBe('1 item');
    expect(tn(3, '{n} item', '{n} items')).toBe('3 items');
    await setLanguage('fr');
    expect(tn(0, '{n} item', '{n} items')).toBe('0 article'); // French treats 0 as singular
    expect(tn(2, '{n} item', '{n} items')).toBe('2 articles');
    await setLanguage('ja'); // no plural forms: always the "other" text
    expect(tn(1, '{n} item', '{n} items')).toBe('商品 1 件');
    expect(tn(5, '{n} item', '{n} items')).toBe('商品 5 件');
  });

  it('switching language updates the active language and falls back safely', async () => {
    await setLanguage('zh-TW');
    expect(lang.value).toBe('zh-TW');
    expect(t('Sell')).toBe('收銀');
    await setLanguage('en' as LangCode);
    expect(t('Sell')).toBe('Sell');
  });
});
