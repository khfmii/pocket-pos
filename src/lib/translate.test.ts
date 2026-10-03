import { afterEach, describe, expect, it } from 'vitest';
import { AUTO_UNSUPPORTED, canTranslateTo, deps, describeTranslateError, translate, type TranslateApi } from './translate';

const real = { ...deps };
afterEach(() => Object.assign(deps, real));

describe('translate', () => {
  it('maps both Chinese variants to the one ML Kit knows, and passes the rest through', async () => {
    const calls: { source: string; target: string }[] = [];
    deps.native = { translate: async (o) => (calls.push(o), { text: `${o.text}!` }) } satisfies TranslateApi;
    expect(await translate('Tea', 'en', 'zh-CN')).toBe('Tea!');
    expect(await translate('茶', 'zh-TW', 'en')).toBe('茶!'); // reading Traditional is fine
    expect(await translate('Tea', 'en', 'th')).toBe('Tea!');
    expect(calls).toEqual([{ source: 'en', target: 'zh', text: 'Tea' }, { source: 'zh', target: 'en', text: '茶' }, { source: 'en', target: 'th', text: 'Tea' }].map(({ source, target }) => ({ source, target, text: expect.any(String) })).map((c) => expect.objectContaining(c)) as never);
  });

  it('refuses Traditional Chinese as an output instead of returning Simplified text', async () => {
    let called = false;
    deps.native = { translate: async () => ((called = true), { text: 'x' }) };
    expect(canTranslateTo('zh-TW')).toBe(false);
    expect(AUTO_UNSUPPORTED).toContain('zh-TW');
    await expect(translate('Tea', 'en', 'zh-TW')).rejects.toThrow(/unsupported-language/);
    expect(called).toBe(false);
  });

  it('explains failures', () => {
    expect(describeTranslateError(new Error('model-download-failed'))).toMatch(/language pack.*internet/);
    expect(describeTranslateError(new Error('unsupported-language'))).toMatch(/not available/);
    expect(describeTranslateError(new Error('translate-failed'))).toMatch(/Could not translate/);
  });
});
