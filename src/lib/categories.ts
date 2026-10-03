import { t } from '../i18n';

/**
 * The built-in category library: ready-made categories a shop can switch on or off. Names are translated, so each is a
 * function that calls `t()` when shown (not at load) and the i18n key scanner can see every literal. `id` is stable and
 * stored on the category it creates, so it keeps matching if the shop later changes language or renames it.
 */
export interface Preset {
  id: string;
  emoji: string;
  name: () => string;
}
export interface PresetGroup {
  id: string;
  emoji: string;
  name: () => string;
  presets: Preset[];
}

const p = (id: string, emoji: string, name: () => string): Preset => ({ id, emoji, name });

export const PRESET_GROUPS: PresetGroup[] = [
  {
    id: 'drinks', emoji: '☕', name: () => t('Cafe & drinks'),
    presets: [
      p('coffee', '☕', () => t('Coffee')),
      p('tea', '🍵', () => t('Tea')),
      p('bubble-tea', '🧋', () => t('Bubble tea')),
      p('juice', '🧃', () => t('Juice & smoothies')),
      p('soft-drinks', '🥤', () => t('Soft drinks')),
      p('water', '💧', () => t('Water')),
      p('beer-wine', '🍺', () => t('Beer & wine')),
    ],
  },
  {
    id: 'meals', emoji: '🍽️', name: () => t('Food & meals'),
    presets: [
      p('breakfast', '🍳', () => t('Breakfast')),
      p('rice-dishes', '🍚', () => t('Rice dishes')),
      p('noodles', '🍜', () => t('Noodles')),
      p('burgers', '🍔', () => t('Burgers & sandwiches')),
      p('pizza-pasta', '🍕', () => t('Pizza & pasta')),
      p('grill', '🍖', () => t('Grill & BBQ')),
      p('soups', '🍲', () => t('Soups')),
      p('salads', '🥗', () => t('Salads')),
      p('set-meals', '🍱', () => t('Set meals')),
    ],
  },
  {
    id: 'sweets', emoji: '🥐', name: () => t('Bakery & sweets'),
    presets: [
      p('bakery', '🥐', () => t('Bakery')),
      p('bread', '🥖', () => t('Bread')),
      p('cakes', '🎂', () => t('Cakes')),
      p('cookies', '🍪', () => t('Cookies')),
      p('donuts', '🍩', () => t('Donuts')),
      p('desserts', '🍰', () => t('Desserts')),
      p('ice-cream', '🍦', () => t('Ice cream')),
      p('candy', '🍫', () => t('Chocolate & candy')),
      p('snacks', '🍿', () => t('Snacks')),
    ],
  },
  {
    id: 'grocery', emoji: '🛒', name: () => t('Groceries & fresh'),
    presets: [
      p('fruit', '🍎', () => t('Fruit')),
      p('vegetables', '🥕', () => t('Vegetables')),
      p('meat', '🥩', () => t('Meat')),
      p('seafood', '🐟', () => t('Seafood')),
      p('dairy-eggs', '🥚', () => t('Dairy & eggs')),
      p('frozen', '🧊', () => t('Frozen food')),
      p('canned', '🥫', () => t('Canned & packaged')),
      p('grains', '🌾', () => t('Rice & grains')),
      p('spices', '🧂', () => t('Sauces & spices')),
    ],
  },
  {
    id: 'fashion', emoji: '👕', name: () => t('Fashion & accessories'),
    presets: [
      p('tops', '👕', () => t('Tops')),
      p('bottoms', '👖', () => t('Bottoms')),
      p('dresses', '👗', () => t('Dresses')),
      p('outerwear', '🧥', () => t('Outerwear')),
      p('shoes', '👟', () => t('Shoes')),
      p('bags', '👜', () => t('Bags')),
      p('hats', '🧢', () => t('Hats & caps')),
      p('jewellery', '💍', () => t('Jewellery')),
      p('watches', '⌚', () => t('Watches')),
      p('sunglasses', '🕶️', () => t('Sunglasses')),
    ],
  },
  {
    id: 'beauty', emoji: '💄', name: () => t('Beauty & health'),
    presets: [
      p('skincare', '🧴', () => t('Skincare')),
      p('makeup', '💄', () => t('Makeup')),
      p('hair-care', '💇', () => t('Hair care')),
      p('fragrance', '🌸', () => t('Fragrance')),
      p('personal-care', '🧼', () => t('Personal care')),
      p('vitamins', '💊', () => t('Vitamins & supplements')),
      p('medical', '🩹', () => t('Medical supplies')),
    ],
  },
  {
    id: 'electronics', emoji: '📱', name: () => t('Electronics & mobile'),
    presets: [
      p('phones', '📱', () => t('Phones & tablets')),
      p('phone-accessories', '🔌', () => t('Phone accessories')),
      p('audio', '🎧', () => t('Audio')),
      p('computers', '💻', () => t('Computers & laptops')),
      p('gaming', '🎮', () => t('Gaming')),
      p('batteries', '🔋', () => t('Batteries & chargers')),
    ],
  },
  {
    id: 'home', emoji: '🏠', name: () => t('Home, office & gifts'),
    presets: [
      p('home-kitchen', '🏠', () => t('Home & kitchen')),
      p('furniture', '🛋️', () => t('Furniture')),
      p('stationery', '✏️', () => t('Stationery')),
      p('books', '📚', () => t('Books')),
      p('tools', '🔧', () => t('Tools & hardware')),
      p('garden', '🌱', () => t('Garden & plants')),
      p('cleaning', '🧹', () => t('Cleaning supplies')),
      p('toys', '🧸', () => t('Toys & games')),
      p('gifts', '🎁', () => t('Gifts')),
      p('flowers', '💐', () => t('Flowers')),
      p('pets', '🐾', () => t('Pet supplies')),
      p('sports', '⚽', () => t('Sports & outdoors')),
      p('car', '🚗', () => t('Car accessories')),
    ],
  },
  {
    id: 'services', emoji: '🛠️', name: () => t('Services'),
    presets: [
      p('salon', '💈', () => t('Haircut & salon')),
      p('repairs', '🛠️', () => t('Repairs')),
      p('laundry', '🧺', () => t('Laundry')),
      p('delivery', '🛵', () => t('Delivery')),
      p('printing', '🖨️', () => t('Printing & copying')),
      p('classes', '🎓', () => t('Classes & lessons')),
      p('rentals', '🔑', () => t('Rentals')),
      p('other-services', '⚙️', () => t('Other services')),
    ],
  },
];

export const ALL_PRESETS: Preset[] = PRESET_GROUPS.flatMap((g) => g.presets);

/** The category (if any) that stands for a library entry — by preset id, else by the same name. */
export function categoryFor<C extends { preset?: string; name: string }>(cats: C[], preset: Preset): C | undefined {
  const name = preset.name().trim().toLowerCase();
  return cats.find((c) => c.preset === preset.id) ?? cats.find((c) => c.name.trim().toLowerCase() === name);
}

/**
 * Splits items into one section per category, in the shop's category order, each keeping the items' own order.
 * Empty categories are left out. Items whose category is missing (deleted, or never set) come last under `category: null`.
 */
export function groupByCategory<P extends { categoryId: string }, C extends { id: string }>(items: P[], cats: C[]): { category: C | null; items: P[] }[] {
  const byId = new Map<string, P[]>();
  for (const p of items) byId.set(p.categoryId, [...(byId.get(p.categoryId) ?? []), p]);
  const out = cats.flatMap((c) => (byId.get(c.id)?.length ? [{ category: c as C | null, items: byId.get(c.id)! }] : []));
  const known = new Set(cats.map((c) => c.id));
  const loose = items.filter((p) => !known.has(p.categoryId));
  return loose.length ? [...out, { category: null, items: loose }] : out;
}
