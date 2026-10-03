import { describe, expect, it } from 'vitest';
import { localName, nameMatches, pendingLanguages, receiptItemName, setAuto, setManual, stateOf, translateInto, type NameState } from './names';

const latte = { name: 'Iced Latte', names: { 'zh-CN': '冰拿铁', ms: 'Latte Ais', ja: '  ' } };

describe('which name to show', () => {
  it('uses the translation for the language, else the name as typed', () => {
    expect(localName(latte, 'zh-CN', 'en')).toBe('冰拿铁');
    expect(localName(latte, 'ms', 'en')).toBe('Latte Ais');
    expect(localName(latte, 'fr', 'en')).toBe('Iced Latte'); // no French yet
    expect(localName(latte, 'ja', 'en')).toBe('Iced Latte'); // blank entry counts as none
  });

  it('never translates the original language, and does nothing until a language is chosen', () => {
    expect(localName(latte, 'en', 'en')).toBe('Iced Latte');
    expect(localName(latte, 'zh-CN', undefined)).toBe('Iced Latte');
    expect(localName({ name: 'Plain' }, 'de', 'en')).toBe('Plain');
  });
});

describe('searching', () => {
  it('matches the typed name or any translation, case-insensitively', () => {
    expect(nameMatches(latte, 'iced')).toBe(true);
    expect(nameMatches(latte, '冰')).toBe(true);
    expect(nameMatches(latte, 'latte ais')).toBe(true);
    expect(nameMatches(latte, 'espresso')).toBe(false);
    expect(nameMatches(latte, '')).toBe(true);
    expect(nameMatches({ name: 'Tea' }, 'tea')).toBe(true);
  });
});

describe('receipt names', () => {
  const line = { name: 'Iced Latte' };
  const o = (langs: ('en' | 'zh-CN' | 'ms' | 'fr' | 'ja')[]) => ({ original: 'en' as const, langs });

  it('is the sold name when no receipt language is chosen', () => {
    expect(receiptItemName(line, latte, {})).toEqual({ main: 'Iced Latte' });
    expect(receiptItemName(line, latte, o([]))).toEqual({ main: 'Iced Latte' });
    expect(receiptItemName(line, undefined, o(['zh-CN']))).toEqual({ main: 'Iced Latte' }); // item deleted since
  });

  it('prints one chosen language, falling back to the sold name when the item has no translation', () => {
    expect(receiptItemName(line, latte, o(['zh-CN']))).toEqual({ main: '冰拿铁' });
    expect(receiptItemName(line, latte, o(['fr']))).toEqual({ main: 'Iced Latte' });
    expect(receiptItemName(line, latte, o(['en']))).toEqual({ main: 'Iced Latte' });
  });

  it('prints two languages: the first is the name, the second sits underneath', () => {
    expect(receiptItemName(line, latte, o(['zh-CN', 'en']))).toEqual({ main: '冰拿铁', sub: 'Iced Latte' }); // translation + original
    expect(receiptItemName(line, latte, o(['en', 'zh-CN']))).toEqual({ main: 'Iced Latte', sub: '冰拿铁' }); // order is the shop's choice
    expect(receiptItemName(line, latte, o(['zh-CN', 'ms']))).toEqual({ main: '冰拿铁', sub: 'Latte Ais' }); // two translations
  });

  it('skips a language the item has no name for, instead of leaving a gap', () => {
    expect(receiptItemName(line, latte, o(['fr', 'zh-CN']))).toEqual({ main: '冰拿铁' }); // French missing → Chinese is the name
    expect(receiptItemName(line, latte, o(['fr', 'ja']))).toEqual({ main: 'Iced Latte' }); // neither → as sold
  });

  it('never prints the same text twice, and never more than two languages', () => {
    const same = { name: 'Latte', names: { fr: 'Latte', ms: 'Kopi Latte', ja: 'ラテ' } };
    expect(receiptItemName({ name: 'Latte' }, same, o(['en', 'fr']))).toEqual({ main: 'Latte' }); // French is identical
    expect(receiptItemName({ name: 'Latte' }, same, o(['ms', 'fr', 'ja']))).toEqual({ main: 'Kopi Latte', sub: 'Latte' }); // 3rd ignored
  });
});

describe('manual edits beat auto-translate', () => {
  const base: NameState = { names: { 'zh-CN': '冰拿铁', ms: 'Latte Ais' }, auto: ['zh-CN'] };

  it('editing a translation marks it as the user’s own; clearing it removes it', () => {
    const edited = setManual(base, 'zh-CN', ' 冰拿铁（大）');
    expect(edited.names['zh-CN']).toBe('冰拿铁（大）');
    expect(edited.auto).toEqual([]);
    expect(setManual(edited, 'zh-CN', '   ').names['zh-CN']).toBeUndefined();
  });

  it('fills empty languages, but only refreshes machine-made ones when the name changed', () => {
    const targets = ['zh-CN', 'ms', 'fr', 'th'] as const;
    expect(pendingLanguages(base, [...targets], 'en')).toEqual(['fr', 'th']); // zh auto but name unchanged; ms is manual
    expect(pendingLanguages(base, [...targets], 'en', { nameChanged: true })).toEqual(['zh-CN', 'fr', 'th']); // manual ms is safe
    expect(pendingLanguages(base, [...targets], 'en', { force: ['ms'] })).toEqual(['ms', 'fr', 'th']); // explicit refresh
    expect(pendingLanguages(base, ['en', 'fr'], 'en')).toEqual(['fr']); // never into the original language
  });

  it('stateOf copies, so editing a draft never mutates the saved item', () => {
    const p = { names: { fr: 'Café' }, namesAuto: ['fr' as const] };
    const s = stateOf(p);
    s.names.fr = 'changed';
    s.auto.pop();
    expect(p).toEqual({ names: { fr: 'Café' }, namesAuto: ['fr'] });
  });
});

describe('translateInto', () => {
  const fake = async (text: string, _from: string, to: string) => `${text}→${to}`;

  it('translates what is pending and records it as auto', async () => {
    const r = await translateInto({ names: { ms: 'Manual' }, auto: [] }, ' Latte ', 'en', ['ms', 'fr', 'de', 'en'], fake);
    expect(r.state.names).toEqual({ ms: 'Manual', fr: 'Latte→fr', de: 'Latte→de' });
    expect(r.state.auto).toEqual(['fr', 'de']);
    expect(r.done).toEqual(['fr', 'de']);
    expect(r.failed).toEqual([]);
  });

  it('one failing language does not lose the others', async () => {
    const flaky = async (text: string, _f: string, to: string) => {
      if (to === 'th') throw new Error('model-download-failed');
      return `${text}-${to}`;
    };
    const progress: string[] = [];
    const r = await translateInto(stateOf({}), 'Tea', 'en', ['fr', 'th', 'ja'], flaky, { onProgress: (l) => progress.push(l) });
    expect(Object.keys(r.state.names)).toEqual(['fr', 'ja']);
    expect(r.failed.map((f) => f.lang)).toEqual(['th']);
    expect(progress).toEqual(['fr', 'th', 'ja']);
  });

  it('does nothing for an empty name, and skips blank results', async () => {
    expect((await translateInto(stateOf({}), '  ', 'en', ['fr'], fake)).state.names).toEqual({});
    const r = await translateInto(stateOf({}), 'Tea', 'en', ['fr'], async () => '   ');
    expect(r.state.names).toEqual({});
    expect(r.done).toEqual([]);
  });

  it('setAuto keeps the language in the machine-made list only once', () => {
    const s = setAuto(setAuto(stateOf({}), 'fr', 'a'), 'fr', 'b');
    expect(s).toEqual({ names: { fr: 'b' }, auto: ['fr'] });
  });
});
