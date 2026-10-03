import type { LangCode } from '../i18n';
// All money is stored as integer minor units (cents) to avoid float drift.

export type Role = 'owner' | 'cashier';
export type PayMethod = 'cash' | 'card' | 'ewallet' | 'other' | 'points';
export type OrderStatus = 'paid' | 'partial' | 'refunded' | 'void';

export interface Stamped {
  id: string;
  updatedAt: number;
}

export interface Settings extends Stamped {
  id: 'main';
  setupDone: boolean;
  storeName: string;
  address: string;
  phone: string;
  email: string;
  website: string; // site or social handle, printed as-is
  logo: string; // small image data URL shown at the top of receipts, '' = none
  taxId: string;
  currency: string;
  currencyDecimals: number;
  taxName: string;
  taxRate: number; // percent
  taxInclusive: boolean;
  receiptHeader: string;
  receiptFooter: string;
  receiptPrefix: string;
  receiptNext: number;
  paperWidth: 58 | 80;
  theme: 'system' | 'light' | 'dark';
  loyaltyEnabled: boolean;
  pointsPerUnit: number; // points earned per 1 major currency unit
  pointValue: number; // minor units each point is worth when redeemed
  requireShift: boolean;
  cashierRefunds: boolean; // may cashiers issue refunds and voids
  lockMinutes: number; // 0 = never auto-lock
  lowStockDefault: number;
  autoSnapshot: boolean;
  backupReminderDays: number; // 0 = off
  lastBackupAt: number; // last exported backup file, 0 = never
  /** Language the item names are typed in. Setting it (with `nameLangs`) switches on multi-language item names. */
  nameLang?: LangCode;
  /** Other languages to keep item names in. */
  nameLangs?: LangCode[];
  autoTranslate?: boolean; // translate new and renamed items by themselves (Android app)
  /** Languages item names are printed in on receipts (at most 2): the first is the name, the second goes in small type under it. [] = as typed. */
  receiptNameLangs?: LangCode[];
}

export interface Category extends Stamped {
  name: string;
  emoji: string;
  sort: number;
  /** Turned off = hidden from the Sell screen and item forms; items keep it. Missing means on. */
  enabled?: boolean;
  /** Which entry of the built-in category library this came from (see lib/categories.ts). */
  preset?: string;
}

export interface Variant {
  id: string;
  name: string;
  price: number;
  barcode: string;
}

export type IngredientUnit = 'g' | 'kg' | 'ml' | 'l' | 'pcs';

export interface Ingredient extends Stamped {
  name: string;
  unit: IngredientUnit; // the unit the pack is bought in
  packSize: number; // how many `unit`s one pack holds
  packCost: number; // minor units per pack
  note: string;
  createdAt: number;
}

export interface RecipeLine {
  ingredientId: string;
  qty: number; // amount used per batch, in `unit`
  unit: IngredientUnit; // same family as the ingredient's unit (g/kg, ml/l, pcs)
}

export interface Product extends Stamped {
  name: string;
  categoryId: string;
  price: number;
  cost: number;
  sku: string;
  barcode: string;
  emoji: string;
  color: string;
  taxable: boolean;
  trackStock: boolean;
  stock: number;
  lowStock: number;
  variants: Variant[];
  active: boolean;
  createdAt: number;
  /** Compressed JPEG data URL (≈320px). Falls back to the emoji when absent. */
  image?: string;
  /** 'recipe': `cost` is derived from ingredients below and kept up to date automatically. */
  costMode?: 'manual' | 'recipe';
  recipe?: RecipeLine[];
  recipeYield?: number; // items one batch makes (default 1)
  extraCost?: number; // packaging / labour per item, minor units
  /** Translations of `name` by language (the name itself stays as typed). */
  names?: Partial<Record<LangCode, string>>;
  /** Languages in `names` that were machine-translated and not yet corrected by a person. */
  namesAuto?: LangCode[];
}

export interface Customer extends Stamped {
  name: string;
  phone: string;
  email: string;
  note: string;
  points: number;
  createdAt: number;
}

export interface User extends Stamped {
  name: string;
  role: Role;
  salt: string;
  pinHash: string;
  active: boolean;
}

export interface Adjustment {
  type: 'percent' | 'amount';
  value: number; // percent (0-100) or minor units
}

export interface OrderLine {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  variantName: string;
  sku: string;
  qty: number;
  unitPrice: number;
  unitCost: number;
  taxable: boolean;
  note: string;
  gross: number;
  discount: number; // line discount, minor
  orderDiscountShare: number;
  tax: number;
  total: number; // final amount for the line (after all discounts, with tax)
  refundedQty: number;
  refundedAmount: number;
}

export interface Payment {
  method: PayMethod;
  amount: number; // amount applied to the bill
  tendered: number; // cash handed over (== amount for non-cash)
  /** Taken before the sale was finished (the order was set aside part-paid). Cash deposits went into the drawer when taken, so shift totals leave them out of the final sale. */
  deposit?: boolean;
}

export interface Refund {
  id: string;
  at: number;
  by: string;
  lines: { lineId: string; qty: number; amount: number }[];
  amount: number;
  method: PayMethod;
  reason: string;
  restock: boolean;
}

export interface Order extends Stamped {
  number: string;
  seq: number;
  at: number;
  shiftId: string;
  userId: string;
  userName: string;
  customerId: string;
  customerName: string;
  lines: OrderLine[];
  subtotal: number;
  orderDiscount: number;
  orderDiscountAdj: Adjustment | null;
  tax: number;
  total: number;
  taxName: string;
  taxRate: number;
  taxInclusive: boolean;
  payments: Payment[];
  change: number;
  status: OrderStatus;
  refunds: Refund[];
  note: string;
  pointsEarned: number;
  pointsRedeemed: number;
  /** Number of payment-proof photos (kept here so lists can show a clip icon without loading images). */
  attachmentCount?: number;
}

/** A photo attached to a sale — typically a bank transfer slip or other proof of payment. Stored apart from orders so lists stay light. */
export interface Attachment extends Stamped {
  orderId: string;
  at: number;
  by: string;
  name: string;
  image: string; // JPEG data URL, longest side ≤ 1280px
  bytes: number;
}

export interface Shift extends Stamped {
  openedAt: number;
  closedAt: number; // 0 while open
  openedBy: string;
  closedBy: string;
  openingFloat: number;
  countedCash: number;
  expectedCash: number;
  variance: number;
  note: string;
}

export interface CashMovement extends Stamped {
  shiftId: string;
  at: number;
  type: 'in' | 'out';
  amount: number;
  reason: string;
  by: string;
}

export type StockReason = 'sale' | 'refund' | 'void' | 'receive' | 'adjust' | 'waste';

export interface StockMove extends Stamped {
  productId: string;
  at: number;
  delta: number;
  reason: StockReason;
  ref: string;
  by: string;
  note: string;
}

export interface CartLine {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  variantName: string;
  sku: string;
  unitPrice: number;
  unitCost: number;
  taxable: boolean;
  qty: number;
  discount: Adjustment | null;
  note: string;
  /** Custom item total (qty × price replaced). Lets a sale charge a different price for this customer. */
  lineTotal?: number | null;
}

export interface CartState {
  lines: CartLine[];
  discount: Adjustment | null;
  customerId: string;
  note: string;
  /** Deposits already taken on this order. They count toward the total when it is finished. */
  paid?: Payment[];
  /** Where the deposit's proof photos wait (attachments store, keyed by this) until the sale is finished and they move to the order. */
  proofKey?: string;
}

export interface Parked extends Stamped {
  name: string;
  createdAt: number;
  cart: CartState;
}

export interface Snapshot {
  id: string;
  at: number;
  kind: 'auto' | 'manual';
  reason: string;
  size: number;
  json: string;
}
