// The three demo shops. Items: [artKey, name, category, price, cost, stock, translations?]
import { ART, logoSvg } from './art.mjs';
import { CAFE, FASHION, LOGO_CAFE, LOGO_FASHION } from './art2.mjs';

const base = { currency: 'USD', currencyDecimals: 2, taxName: 'Sales tax', taxRate: 6, taxInclusive: false, setupDone: true, autoSnapshot: false, backupReminderDays: 0, theme: 'light', loyaltyEnabled: true };

export const SHOPS = {
  acg: {
    history: true, art: ART, logo: logoSvg(),
    settings: { ...base, storeName: 'Pixel Panda ACG', address: 'Stall B7, Fan Street Market', phone: '555-0142', email: 'hello@pixelpanda.shop', website: '@pixelpanda.acg', receiptHeader: 'Anime · Comics · Games', receiptFooter: 'See you at the next drop!', nameLang: 'en', nameLangs: ['zh-CN', 'ja', 'es'], receiptNameLangs: ['zh-CN', 'en'], autoTranslate: true },
    cats: [['Figures', '🤖'], ['Manga', '📚'], ['Cards', '🃏'], ['Pins & Gacha', '📌'], ['Games', '🎮'], ['Plush', '🧸']],
    weights: [3, 2, 4, 9, 7, 6, 8, 3, 3],
    customers: [['Mika Tan', '555-0101', 'Collector. Wants pre-order alerts for foil cards.'], ['Aiko Sato', '555-0102', 'Prefers Japanese editions.'], ['Leo Wong', '555-0103', '']],
    items: [
      ['mecha', 'Mecha Guardian Figure', 'Figures', 3990, 2200, 14, { 'zh-CN': '机甲守护者手办', ja: 'メカガーディアン フィギュア', es: 'Figura Mecha Guardián' }],
      ['standee', 'Acrylic Standee', 'Figures', 1890, 780, 22, { 'zh-CN': '亚克力立牌', ja: 'アクリルスタンド', es: 'Figura acrílica' }],
      ['manga', 'Starlight Blade Vol. 3', 'Manga', 1290, 650, 31, { 'zh-CN': '星光之刃 第3卷', ja: 'スターライトブレード 第3巻', es: 'Starlight Blade Vol. 3' }],
      ['cards', 'Booster Pack', 'Cards', 590, 300, 6, { 'zh-CN': '卡牌补充包', ja: 'ブースターパック', es: 'Sobre de cartas' }],
      ['pin', 'Star Enamel Pin', 'Pins & Gacha', 890, 280, 40, { 'zh-CN': '星星徽章', ja: 'スターピンバッジ', es: 'Pin esmaltado de estrella' }],
      ['keychain', 'Pixel Heart Keychain', 'Pins & Gacha', 650, 180, 35, { 'zh-CN': '像素爱心钥匙扣', ja: 'ピクセルハート キーホルダー', es: 'Llavero corazón pixel' }],
      ['gacha', 'Gacha Capsule', 'Pins & Gacha', 450, 150, 60, { 'zh-CN': '扭蛋', ja: 'ガチャカプセル', es: 'Cápsula gacha' }],
      ['pad', 'Retro Game Pad', 'Games', 2790, 1500, 9, { 'zh-CN': '复古游戏手柄', ja: 'レトロゲームパッド', es: 'Mando retro' }],
      ['panda', 'Panda Plush', 'Plush', 2490, 1100, 17, { 'zh-CN': '熊猫公仔', ja: 'パンダのぬいぐるみ', es: 'Peluche de panda' }],
    ],
  },
  cafe: {
    history: false, art: CAFE, logo: LOGO_CAFE,
    settings: { ...base, storeName: 'Corner Brew Café', address: '88 Maple Lane', phone: '555-0188', email: 'hi@cornerbrew.cafe', website: '@cornerbrew.cafe', receiptHeader: 'Coffee · Bakes · Boba', receiptFooter: 'Thank you — see you tomorrow!' },
    cats: [['Coffee', '☕'], ['Drinks', '🧋'], ['Bakery', '🥐'], ['Treats', '🍰']],
    weights: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    customers: [['Sam Okoro', '555-0111', '']],
    items: [
      ['latte', 'Latte', 'Coffee', 450, 90, 0], ['iced', 'Iced Americano', 'Coffee', 380, 50, 0], ['croissant', 'Croissant', 'Bakery', 320, 100, 18],
      ['cheesecake', 'Cheesecake Slice', 'Treats', 590, 190, 8], ['boba', 'Brown Sugar Boba', 'Drinks', 550, 130, 0], ['matcha', 'Matcha Latte', 'Drinks', 520, 110, 0],
      ['muffin', 'Blueberry Muffin', 'Bakery', 360, 110, 12], ['sandwich', 'Club Sandwich', 'Bakery', 790, 280, 9], ['cookie', 'Choc Chip Cookie', 'Treats', 240, 60, 30],
    ],
  },
  fashion: {
    history: false, art: FASHION, logo: LOGO_FASHION,
    settings: { ...base, storeName: 'Maple Thread Boutique', address: 'Unit 3, Riverside Arcade', phone: '555-0166', email: 'shop@maplethread.co', website: '@maplethread', receiptHeader: 'Everyday style, small batches', receiptFooter: 'Exchanges within 14 days' },
    cats: [['Tops', '👕'], ['Bottoms', '👖'], ['Shoes', '👟'], ['Accessories', '🧢']],
    weights: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    customers: [['Maya Lopez', '555-0122', '']],
    items: [
      ['tee', 'Classic Tee', 'Tops', 1990, 700, 25], ['jeans', 'Denim Jeans', 'Bottoms', 4990, 1900, 14], ['dress', 'Summer Dress', 'Tops', 5900, 2100, 9],
      ['cap', 'Baseball Cap', 'Accessories', 1590, 500, 30], ['sneaker', 'Canvas Sneakers', 'Shoes', 4490, 1800, 12], ['tote', 'Tote Bag', 'Accessories', 2200, 800, 20],
      ['scarf', 'Wool Scarf', 'Accessories', 2450, 900, 16], ['shades', 'Sunglasses', 'Accessories', 1800, 600, 22], ['socks', 'Sock 3-Pack', 'Accessories', 990, 300, 40],
    ],
  },
};
