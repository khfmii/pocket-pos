/**
 * Icons for categories and items. Everything here is Unicode 12 or older (2019), so it also draws on older Android
 * phones instead of showing empty boxes. The first entry of each group is its tab.
 */
export const QUICK_EMOJIS = [
  '🍎', '🍌', '🥕', '🥖', '🥐', '🧁', '🍰', '🍪', '🍫', '🍿', '☕', '🍵', '🧋', '🥤', '💧', '🍺',
  '🍷', '🥛', '🍕', '🍔', '🌭', '🥪', '🌮', '🍜', '🍣', '🍚', '🥗', '🍳', '🧀', '🥩', '🐟', '🛒',
  '👕', '👖', '👟', '🧢', '👜', '💄', '🧴', '🧼', '📱', '🔌', '🎧', '📦', '📚', '✏️', '🎁', '🛍️',
];

export interface EmojiGroup {
  id: string;
  list: string[];
}

export const EMOJI_GROUPS: EmojiGroup[] = [
  { id: 'food', list: ['🍽️', '☕', '🍵', '🧋', '🥤', '🧃', '🥛', '🍺', '🍷', '🍹', '🍸', '🍾', '💧', '🍳', '🥞', '🧇', '🥓', '🍞', '🥐', '🥖', '🥨', '🧀', '🍔', '🍟', '🌭', '🥪', '🌮', '🌯', '🍕', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🍙', '🍚', '🍤', '🥟', '🍢', '🍗', '🍖', '🥩', '🥗', '🍿', '🧆'] },
  { id: 'sweets', list: ['🍰', '🎂', '🧁', '🍩', '🍪', '🍫', '🍬', '🍭', '🍮', '🍦', '🍧', '🍨', '🥧', '🍯', '🥜', '🌰'] },
  { id: 'fresh', list: ['🍎', '🍏', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🍆', '🥔', '🥕', '🌽', '🌶️', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄', '🌾', '🥚', '🧂', '🥫', '🧊'] },
  { id: 'fashion', list: ['👕', '👖', '👗', '🧥', '🥼', '👔', '🩳', '🧦', '🧣', '🧤', '🧢', '🎩', '👒', '👟', '👞', '👠', '👡', '🥾', '👜', '👛', '🎒', '💍', '⌚', '🕶️', '👓', '👑', '💎', '🧵', '🧶'] },
  { id: 'beauty', list: ['💄', '💅', '🧴', '🧼', '🧽', '🪒', '💇', '💆', '🌸', '🌺', '💊', '💉', '🩹', '🩺', '🧬', '🧪'] },
  { id: 'tech', list: ['📱', '💻', '🖥️', '⌨️', '🖱️', '🖨️', '📷', '📸', '🎧', '🎤', '🎮', '🕹️', '🔌', '🔋', '💡', '📺', '📻', '🎬', '💾'] },
  { id: 'home', list: ['🏠', '🛋️', '🛏️', '🚿', '🧹', '🧺', '🔧', '🔨', '🧰', '✏️', '🖊️', '📚', '📖', '📒', '📎', '✂️', '📦', '🗂️', '🕯️', '🖼️', '🔑'] },
  { id: 'fun', list: ['🎁', '🎈', '🎉', '🎀', '💐', '🌹', '🧸', '🎲', '🧩', '🎨', '🎸', '🎹', '🎻', '🥁', '🎯', '⚽', '🏀', '🏈', '🎾', '🏐', '🏓', '🏸', '🥊', '🎣', '⛺', '🚲'] },
  { id: 'nature', list: ['🐾', '🐶', '🐱', '🐟', '🐦', '🐠', '🐰', '🐹', '🦴', '🌱', '🌿', '🍀', '🌳', '🌻', '🌵'] },
  { id: 'misc', list: ['🛠️', '🚗', '🚕', '🛵', '🏍️', '🚚', '✈️', '⛽', '🧾', '🎓', '💼', '💈', '⚙️', '📞', '🏷️', '🛒', '🛍️', '💰', '💳', '⭐', '❤️', '✨', '🔥', '🆕', '✅'] },
];

type Seg = new (l?: string, o?: { granularity: 'grapheme' }) => { segment(s: string): Iterable<{ segment: string }> };
const SegCtor = (Intl as unknown as { Segmenter?: Seg }).Segmenter;

/** The first user-perceived character of pasted/typed text, so a multi-part emoji (flag, skin tone, ZWJ) stays whole. */
export function firstGrapheme(s: string): string {
  const text = s.trim();
  if (!text) return '';
  if (SegCtor) {
    for (const g of new SegCtor(undefined, { granularity: 'grapheme' }).segment(text)) return g.segment;
  }
  return Array.from(text)[0] ?? '';
}
