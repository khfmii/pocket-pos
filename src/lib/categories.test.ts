import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createBackup, decodeBackup, encodeBackup } from './backup';
import { ALL_PRESETS, categoryFor, groupByCategory, PRESET_GROUPS } from './categories';
import { closeDb, getAll } from './db';
import { EMOJI_GROUPS, firstGrapheme, QUICK_EMOJIS } from './emoji';
import {
  blankProduct, categories, completeSetup, defaultSettings, deleteCategory, enabledCategories, loadAll, moveProducts, products, saveCategory,
  saveProduct, session, setCategoriesEnabled, setPresetsOn, settings,
} from './store';

async function wipe() {
  await closeDb();
  await new Promise<void>((res) => {
    const r = indexedDB.deleteDatabase('pocket-pos');
    r.onsuccess = r.onerror = r.onblocked = () => res();
  });
  session.value = null;
  settings.value = defaultSettings();
}

const asPreset = (id: string) => {
  const p = ALL_PRESETS.find((x) => x.id === id)!;
  return { id: p.id, emoji: p.emoji, name: p.name() };
};

describe('category library', () => {
  it('has unique ids, an icon and a name for every entry', () => {
    const ids = ALL_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(60);
    for (const g of PRESET_GROUPS) {
      expect(g.presets.length).toBeGreaterThan(0);
      expect(g.name().trim()).not.toBe('');
    }
    for (const p of ALL_PRESETS) {
      expect(p.emoji).not.toBe('');
      expect(p.name().trim()).not.toBe('');
    }
    const names = ALL_PRESETS.map((p) => p.name().toLowerCase());
    expect(new Set(names).size).toBe(names.length); // two entries with one name would fight over a category
  });

  it('matches an existing category by preset id or by (case-insensitive) name only', () => {
    const coffee = ALL_PRESETS.find((p) => p.id === 'coffee')!;
    expect(categoryFor([{ name: 'Hot drinks', preset: 'coffee' }], coffee)?.name).toBe('Hot drinks');
    expect(categoryFor([{ name: ' COFFEE ' }], coffee)?.name).toBe(' COFFEE ');
    expect(categoryFor([{ name: 'Coffee beans' }], coffee)).toBeUndefined();
  });
});

describe('emoji picker data', () => {
  it('has no empty or duplicated entries inside a group, and a decent amount to choose from', () => {
    for (const g of EMOJI_GROUPS) {
      expect(g.list.length).toBeGreaterThan(0);
      expect(new Set(g.list).size).toBe(g.list.length);
      expect(g.list.every((e) => e.trim() !== '')).toBe(true);
    }
    expect(EMOJI_GROUPS.flatMap((g) => g.list).length).toBeGreaterThan(200);
    expect(new Set(QUICK_EMOJIS).size).toBe(QUICK_EMOJIS.length);
  });

  it('keeps a pasted multi-part emoji whole', () => {
    expect(firstGrapheme('')).toBe('');
    expect(firstGrapheme('  ☕ and more')).toBe('☕');
    expect(firstGrapheme('👍🏽x')).toBe('👍🏽'); // skin tone
    expect(firstGrapheme('🇲🇾')).toBe('🇲🇾'); // flag = two code points
    expect(firstGrapheme('👨‍👩‍👧 family')).toBe('👨‍👩‍👧'); // joined emoji
  });
});

describe('turning categories on and off', () => {
  beforeEach(async () => {
    await wipe();
    await loadAll();
    await completeSetup({ storeName: 'Shop' }, { name: 'Owner', pin: '' }, false);
  });

  it('switching a library entry on creates it once; switching off hides it without deleting', async () => {
    expect(await setPresetsOn([asPreset('coffee'), asPreset('tea')], true)).toBe(2);
    expect(categories.value.map((c) => c.name).sort()).toEqual(['Coffee', 'Tea']);
    expect(categories.value.every((c) => c.preset && c.emoji && c.enabled === undefined)).toBe(true);
    expect(await setPresetsOn([asPreset('coffee')], true)).toBe(0); // already on: nothing to do

    expect(await setPresetsOn([asPreset('coffee')], false)).toBe(1);
    expect(categories.value).toHaveLength(2); // still there
    expect(enabledCategories.value.map((c) => c.name)).toEqual(['Tea']);
    expect(await setPresetsOn([asPreset('bread')], false)).toBe(0); // switching off something never created creates nothing
    expect(categories.value).toHaveLength(2);

    expect(await setPresetsOn([asPreset('coffee')], true)).toBe(1); // back on: the same record, not a duplicate
    expect(categories.value).toHaveLength(2);
    expect(enabledCategories.value).toHaveLength(2);
    expect((await getAll('categories')).every((c) => c.enabled === undefined || c.enabled === false)).toBe(true);
  });

  it('adopts a category the shop already made with the same name instead of duplicating it', async () => {
    await saveCategory({ name: 'coffee', emoji: '🥤' });
    await setPresetsOn([asPreset('coffee')], false);
    expect(categories.value).toHaveLength(1);
    expect(categories.value[0]).toMatchObject({ name: 'coffee', emoji: '🥤', enabled: false });
    await setPresetsOn([asPreset('coffee')], true);
    expect(categories.value).toHaveLength(1);
    expect(enabledCategories.value).toHaveLength(1);
  });

  it('a whole group can be switched on and off in one go', async () => {
    const group = PRESET_GROUPS.find((g) => g.id === 'drinks')!;
    const presets = group.presets.map((p) => ({ id: p.id, emoji: p.emoji, name: p.name() }));
    expect(await setPresetsOn(presets, true)).toBe(group.presets.length);
    expect(enabledCategories.value).toHaveLength(group.presets.length);
    expect(await setPresetsOn(presets, false)).toBe(group.presets.length);
    expect(enabledCategories.value).toHaveLength(0);
    expect(categories.value).toHaveLength(group.presets.length);
  });

  it('bulk on/off for any categories, including ones the shop made itself', async () => {
    await saveCategory({ name: 'House special', emoji: '⭐' });
    await setPresetsOn([asPreset('tea')], true);
    const ids = categories.value.map((c) => c.id);
    expect(await setCategoriesEnabled(ids, false)).toBe(2);
    expect(enabledCategories.value).toHaveLength(0);
    expect(await setCategoriesEnabled(ids, false)).toBe(0);
    expect(await setCategoriesEnabled([ids[0]], true)).toBe(1);
    expect(enabledCategories.value).toHaveLength(1);
  });

  it('editing a hidden category keeps it hidden, and the state survives a backup and restore', async () => {
    await setPresetsOn([asPreset('tea')], true);
    const tea = categories.value[0];
    await setCategoriesEnabled([tea.id], false);
    await saveCategory({ ...categories.value[0], name: 'Tea & more' });
    expect(categories.value[0]).toMatchObject({ name: 'Tea & more', enabled: false, preset: 'tea' });

    const b = await decodeBackup(await encodeBackup(await createBackup()));
    expect(b.data.categories[0]).toMatchObject({ name: 'Tea & more', enabled: false, preset: 'tea' });
  });
});

describe('moving many items to a category', () => {
  beforeEach(async () => {
    await wipe();
    await loadAll();
    await completeSetup({ storeName: 'Shop' }, { name: 'Owner', pin: '' }, false);
  });

  const add = async (name: string, categoryId = '') => saveProduct({ ...blankProduct(), name, price: 100, categoryId });

  it('moves only the chosen items, reports how many changed, and saves them', async () => {
    await saveCategory({ name: 'Drinks' });
    const drinks = categories.value[0].id;
    await add('A'); await add('B'); await add('C', drinks);
    const [a, b, c] = ['A', 'B', 'C'].map((n) => products.value.find((p) => p.name === n)!);

    expect(await moveProducts([a.id, b.id, c.id], drinks)).toBe(2); // C was already there
    expect(products.value.filter((p) => p.categoryId === drinks).map((p) => p.name).sort()).toEqual(['A', 'B', 'C']);
    expect((await getAll('products')).filter((p) => p.categoryId === drinks)).toHaveLength(3);

    expect(await moveProducts([a.id], '')).toBe(1); // back to "uncategorised"
    expect(products.value.find((p) => p.id === a.id)!.categoryId).toBe('');
    expect(products.value.find((p) => p.id === b.id)!.categoryId).toBe(drinks);
  });

  it('ignores unknown ids, and deleting a category still uncategorises its items', async () => {
    await saveCategory({ name: 'Drinks' });
    const drinks = categories.value[0].id;
    await add('A', drinks);
    expect(await moveProducts(['nope'], drinks)).toBe(0);
    await deleteCategory(drinks);
    expect(products.value[0].categoryId).toBe('');
  });
});

describe('grouping items by category', () => {
  const cats = [{ id: 'a', name: 'Coffee' }, { id: 'b', name: 'Bakery' }, { id: 'c', name: 'Empty' }];
  const item = (name: string, categoryId: string) => ({ name, categoryId });

  it('makes one section per category in the shop’s order, keeping each section’s item order', () => {
    const g = groupByCategory([item('Bagel', 'b'), item('Latte', 'a'), item('Cake', 'b'), item('Mocha', 'a')], cats);
    expect(g.map((x) => x.category?.name)).toEqual(['Coffee', 'Bakery']); // not the order the items arrive in
    expect(g[0].items.map((i) => i.name)).toEqual(['Latte', 'Mocha']);
    expect(g[1].items.map((i) => i.name)).toEqual(['Bagel', 'Cake']);
  });

  it('leaves out categories with no items', () => {
    expect(groupByCategory([item('Latte', 'a')], cats).map((x) => x.category?.id)).toEqual(['a']);
    expect(groupByCategory([], cats)).toEqual([]);
  });

  it('puts items with no (or a deleted) category last, in one section', () => {
    const g = groupByCategory([item('Mystery', ''), item('Latte', 'a'), item('Orphan', 'gone')], cats);
    expect(g.map((x) => x.category?.id ?? null)).toEqual(['a', null]);
    expect(g[1].items.map((i) => i.name)).toEqual(['Mystery', 'Orphan']);
  });
});
