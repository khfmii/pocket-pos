import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb } from './db';
import { autoTranslateProduct, retranslate, translateAllProducts } from './nameTranslate';
import { blankProduct, completeSetup, defaultSettings, loadAll, products, saveProduct, saveSettings, session, settings } from './store';
import { deps, type TranslateApi } from './translate';

class FakeTranslator implements TranslateApi {
  calls: { text: string; source: string; target: string }[] = [];
  failFor = new Set<string>();
  onCall: (() => Promise<void> | void) | null = null;
  async translate(o: { text: string; source: string; target: string }) {
    this.calls.push(o);
    await this.onCall?.();
    if (this.failFor.has(o.target)) throw new Error('model-download-failed');
    return { text: `${o.text}›${o.target}` };
  }
}

const real = { ...deps };
let fake: FakeTranslator;

async function wipe() {
  await closeDb();
  await new Promise<void>((res) => {
    const r = indexedDB.deleteDatabase('pocket-pos');
    r.onsuccess = r.onerror = r.onblocked = () => res();
  });
  session.value = null;
  settings.value = defaultSettings();
}

const add = (name: string, extra: Partial<ReturnType<typeof blankProduct>> = {}) => saveProduct({ ...blankProduct(), name, price: 100, ...extra });
const get = (id: string) => products.value.find((p) => p.id === id)!;

beforeEach(async () => {
  await wipe();
  await loadAll();
  await completeSetup({ storeName: 'Shop' }, { name: 'Owner', pin: '' }, false);
  await saveSettings({ nameLang: 'en', nameLangs: ['zh-CN', 'ms', 'zh-TW', 'fr'], autoTranslate: true });
  fake = new FakeTranslator();
  deps.native = fake;
  deps.isNative = () => true;
});
afterEach(() => Object.assign(deps, real));

describe('auto-translate on save', () => {
  it('fills every chosen language, marks them machine-made, and never asks for Traditional Chinese', async () => {
    const p = await add('Iced Latte');
    const r = await autoTranslateProduct(p.id, true);
    expect(r).toMatchObject({ translated: 3, failed: 0 });
    expect(get(p.id).names).toEqual({ 'zh-CN': 'Iced Latte›zh', ms: 'Iced Latte›ms', fr: 'Iced Latte›fr' });
    expect(get(p.id).namesAuto).toEqual(['zh-CN', 'ms', 'fr']);
    expect(fake.calls.map((c) => c.target).sort()).toEqual(['fr', 'ms', 'zh']);
    expect(fake.calls.every((c) => c.source === 'en')).toBe(true);
  });

  it('does nothing when off, in a browser, or before languages are chosen', async () => {
    const p = await add('Tea');
    await saveSettings({ autoTranslate: false });
    expect((await autoTranslateProduct(p.id, true)).translated).toBe(0);
    await saveSettings({ autoTranslate: true });
    deps.isNative = () => false;
    expect((await autoTranslateProduct(p.id, true)).translated).toBe(0);
    deps.isNative = () => true;
    await saveSettings({ nameLangs: [] });
    expect((await autoTranslateProduct(p.id, true)).translated).toBe(0);
    expect(fake.calls).toHaveLength(0);
  });

  it('a name someone typed is kept when the item is renamed; machine-made ones are refreshed', async () => {
    const p = await add('Latte', { names: { ms: 'Kopi Latte (mine)', fr: 'Latte›fr' }, namesAuto: ['fr'] });
    const renamed = await saveProduct({ ...get(p.id), name: 'Iced Latte' });
    await autoTranslateProduct(renamed.id, true);
    expect(get(p.id).names).toMatchObject({ ms: 'Kopi Latte (mine)', fr: 'Iced Latte›fr', 'zh-CN': 'Iced Latte›zh' });
    expect(get(p.id).namesAuto).toEqual(expect.arrayContaining(['fr', 'zh-CN']));
    expect(get(p.id).namesAuto).not.toContain('ms');
  });

  it('keeps what the owner already filled in and only adds the gaps', async () => {
    const p = await add('Bagel', { names: { fr: 'Bagel maison' } });
    await autoTranslateProduct(p.id, false);
    expect(get(p.id).names!.fr).toBe('Bagel maison');
    expect(fake.calls.map((c) => c.target)).not.toContain('fr');
  });

  it('a correction typed while translation is running is not overwritten', async () => {
    const p = await add('Muffin');
    fake.onCall = async () => {
      // the owner saves a hand-written Malay name while the phone is still translating
      if (!get(p.id).names?.ms) await saveProduct({ ...get(p.id), names: { ...get(p.id).names, ms: 'Muffin saya' } });
    };
    await autoTranslateProduct(p.id, true);
    expect(get(p.id).names!.ms).toBe('Muffin saya');
    expect(get(p.id).namesAuto ?? []).not.toContain('ms');
    expect(get(p.id).names!['zh-CN']).toBe('Muffin›zh'); // the rest still filled
  });

  it('a failing language (no pack / no internet) is reported without losing the others', async () => {
    fake.failFor.add('ms');
    const p = await add('Cookie');
    const r = await autoTranslateProduct(p.id, true);
    expect(r).toMatchObject({ translated: 2, failed: 1 });
    expect(String((r.error as Error).message)).toMatch(/model-download-failed/);
    expect(Object.keys(get(p.id).names!).sort()).toEqual(['fr', 'zh-CN']);
  });
});

describe('re-translating one language', () => {
  it('replaces even a hand-typed name, because the owner asked for it', async () => {
    const p = await add('Scone', { names: { fr: 'Mon scone' } });
    const r = await retranslate(p.id, 'fr');
    expect(r.translated).toBe(1);
    expect(get(p.id).names!.fr).toBe('Scone›fr');
    expect(get(p.id).namesAuto).toContain('fr');
  });
});

describe('translating the whole catalogue', () => {
  it('reports progress and fills gaps in every item', async () => {
    await add('A'); await add('B'); await add('C');
    const steps: string[] = [];
    const r = await translateAllProducts((done, total) => steps.push(`${done}/${total}`));
    expect(r.translated).toBe(9);
    expect(steps[0]).toBe('0/3');
    expect(steps.at(-1)).toBe('3/3');
    expect(products.value.every((p) => Object.keys(p.names ?? {}).length === 3)).toBe(true);
  });

  it('gives up early when nothing works, instead of retrying every item', async () => {
    for (const l of ['zh', 'ms', 'fr']) fake.failFor.add(l);
    for (let i = 0; i < 10; i++) await add(`Item ${i}`);
    const r = await translateAllProducts(() => {});
    expect(r.translated).toBe(0);
    expect(r.failed).toBeGreaterThan(0);
    expect(fake.calls.length).toBeLessThan(10 * 3); // stopped after a few items
  });
});
