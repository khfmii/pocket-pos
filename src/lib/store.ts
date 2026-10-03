import { computed, signal } from '@preact/signals';
import { adjustmentAmount, computeCart, lineGross, pendingLabel, refundAmountFor, settleDeposits, toOrderLines, type CartTotals } from './cart';
import { hashPin, newSalt, uid } from './crypto';
import { autoSnapshotIfDue, createSnapshot, restoreBackup, type BackupFile, type RestoreMode, type RestoreResult } from './backup';
import { closeDb, db, getAll, put, remove, BACKUP_STORES } from './db';
import { lang, t } from '../i18n';
import { loadSampleData } from './demo';
import { localName, receiptItemName, type ItemName } from './names';
import { depositSlip } from './receipt';
import { decimalsFor, formatMoney } from './money';
import { recipeCost } from './recipe';
import type {
  Adjustment,
  Attachment,
  CartLine,
  CartState,
  CashMovement,
  Category,
  Customer,
  Ingredient,
  Order,
  Parked,
  PayMethod,
  Payment,
  Product,
  Refund,
  Role,
  Settings,
  Shift,
  StockMove,
  StockReason,
  User,
  Variant,
} from './types';

// ---------- reactive state ----------

export function defaultSettings(): Settings {
  return {
    id: 'main',
    updatedAt: 0,
    setupDone: false,
    storeName: 'My Shop',
    address: '',
    phone: '',
    email: '',
    website: '',
    logo: '',
    taxId: '',
    currency: 'USD',
    currencyDecimals: 2,
    taxName: 'Tax',
    taxRate: 0,
    taxInclusive: false,
    receiptHeader: '',
    receiptFooter: 'Thank you!',
    receiptPrefix: '#',
    receiptNext: 1,
    paperWidth: 58,
    theme: 'system',
    loyaltyEnabled: false,
    pointsPerUnit: 1,
    pointValue: 1,
    requireShift: false,
    cashierRefunds: false,
    lockMinutes: 0,
    lowStockDefault: 5,
    autoSnapshot: true,
    backupReminderDays: 7,
    lastBackupAt: 0,
  };
}

export const ready = signal(false);
export const settings = signal<Settings>(defaultSettings());
export const categories = signal<Category[]>([]);
export const products = signal<Product[]>([]);
export const ingredients = signal<Ingredient[]>([]);
export const productById = computed(() => new Map(products.value.map((p) => [p.id, p])));

/** An item's name in the app's language (its translation if the shop keeps them), otherwise as typed. */
export const productName = (p: Product) => localName(p, lang.value, settings.value.nameLang);
/** The same for a line in the cart or an old sale: looks the item up, falling back to the name it was sold under. */
export const lineName = (l: { productId: string; name: string }) => {
  const p = productById.value.get(l.productId);
  return p ? productName(p) : l.name;
};
/** Names for a receipt's lines, per the shop's receipt-language setting (the sold name when nothing applies). */
export const receiptNamer = (s: Settings) => (l: { name: string; productId: string }): ItemName =>
  receiptItemName(l, productById.value.get(l.productId), { original: s.nameLang, langs: s.receiptNameLangs });
export const customers = signal<Customer[]>([]);
export const users = signal<User[]>([]);
export const parkedList = signal<Parked[]>([]);
export const shift = signal<Shift | null>(null);
export const session = signal<User | null>(null);
export const toast = signal<{ id: number; msg: string; kind: 'ok' | 'error' } | null>(null);

export const emptyCart = (): CartState => ({ lines: [], discount: null, customerId: '', note: '' });
const CART_KEY = 'pocketpos.cart';

function loadCart(): CartState {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (raw) return { ...emptyCart(), ...JSON.parse(raw) };
  } catch {
    /* storage unavailable */
  }
  return emptyCart();
}

export const cart = signal<CartState>(loadCart());
export const totals = computed<CartTotals>(() =>
  computeCart(cart.value, { rate: settings.value.taxRate, inclusive: settings.value.taxInclusive }),
);

cart.subscribe((c) => {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
});

export const money = (minor: number) => formatMoney(minor, settings.value);

let toastSeq = 0;
export function showToast(msg: string, kind: 'ok' | 'error' = 'ok') {
  const id = ++toastSeq;
  toast.value = { id, msg, kind };
  setTimeout(() => {
    if (toast.value?.id === id) toast.value = null;
  }, 2800);
}

// ---------- permissions ----------

export type Permission = 'sell' | 'manageProducts' | 'reports' | 'settings' | 'refund' | 'customers' | 'shift';

export function can(p: Permission): boolean {
  const u = session.value;
  if (!u) return false;
  if (u.role === 'owner') return true;
  if (p === 'refund') return settings.value.cashierRefunds;
  return p === 'sell' || p === 'customers' || p === 'shift';
}

// ---------- loading ----------

export async function loadAll() {
  const d = await db();
  let s = (await d.get('settings', 'main')) as Settings | undefined;
  if (!s) s = await put('settings', defaultSettings());
  const [cats, prods, ings, custs, usrs, parked, shifts] = await Promise.all([
    getAll('categories'),
    getAll('products'),
    getAll('ingredients'),
    getAll('customers'),
    getAll('users'),
    getAll('parked'),
    getAll('shifts'),
  ]);
  settings.value = { ...defaultSettings(), ...s };
  categories.value = cats.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  products.value = prods.sort((a, b) => a.name.localeCompare(b.name));
  ingredients.value = ings.sort((a, b) => a.name.localeCompare(b.name));
  customers.value = custs.sort((a, b) => a.name.localeCompare(b.name));
  users.value = usrs;
  parkedList.value = parked.sort((a, b) => b.createdAt - a.createdAt);
  shift.value = shifts.find((x) => !x.closedAt) ?? null;
  applyTheme();
  // Drop a session whose user no longer exists (e.g. after a restore).
  if (session.value && !usrs.some((u) => u.id === session.value!.id && u.active)) session.value = null;
  autoSignIn();
}

/** With no PINs configured the app opens straight into the owner account. */
export function autoSignIn() {
  if (session.value) return;
  const active = users.value.filter((u) => u.active);
  if (!active.some((u) => u.pinHash)) session.value = active.find((u) => u.role === 'owner') ?? active[0] ?? null;
}

export async function boot() {
  await loadAll();
  ready.value = true;
  try {
    // Ask the browser not to evict our data when storage is tight.
    await navigator.storage?.persist?.();
  } catch {
    /* not supported */
  }
  if (settings.value.setupDone && settings.value.autoSnapshot) autoSnapshotIfDue().catch(() => {});
}

export function applyTheme() {
  if (typeof document === 'undefined') return;
  const theme = settings.value.theme;
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}

// ---------- settings & setup ----------

export async function saveSettings(patch: Partial<Settings>) {
  const next: Settings = { ...settings.value, ...patch };
  if (patch.currency && patch.currency !== settings.value.currency && patch.currencyDecimals === undefined)
    next.currencyDecimals = decimalsFor(patch.currency);
  settings.value = await put('settings', next);
  if (patch.theme) applyTheme();
}

export async function completeSetup(
  s: Partial<Settings>,
  owner: { name: string; pin: string },
  sample: boolean,
) {
  await saveSettings({ ...s, setupDone: true });
  const u = await saveUser({ name: owner.name || 'Owner', role: 'owner', pin: owner.pin });
  if (sample) {
    await loadSampleData();
  }
  await loadAll();
  session.value = u;
}

// ---------- users & sign in ----------

export async function saveUser(input: { id?: string; name: string; role: Role; pin?: string; active?: boolean }): Promise<User> {
  const existing = input.id ? users.value.find((u) => u.id === input.id) : undefined;
  let { salt, pinHash } = existing ?? { salt: newSalt(), pinHash: '' };
  if (input.pin !== undefined && input.pin !== '') {
    salt = newSalt();
    pinHash = await hashPin(input.pin, salt);
  }
  const rec: User = {
    id: existing?.id ?? uid(),
    updatedAt: 0,
    name: input.name.trim(),
    role: input.role,
    salt,
    pinHash,
    active: input.active ?? existing?.active ?? true,
  };
  const saved = await put('users', rec);
  users.value = [...users.value.filter((u) => u.id !== saved.id), saved];
  return saved;
}

export async function clearUserPin(id: string) {
  const u = users.value.find((x) => x.id === id);
  if (!u) return;
  const saved = await put('users', { ...u, pinHash: '' });
  users.value = users.value.map((x) => (x.id === id ? saved : x));
}

export async function signIn(userId: string, pin: string): Promise<boolean> {
  const u = users.value.find((x) => x.id === userId && x.active);
  if (!u) return false;
  if (u.pinHash && (await hashPin(pin, u.salt)) !== u.pinHash) return false;
  session.value = u;
  return true;
}

export const signOut = () => (session.value = null);

export const needsSignIn = computed(() => !session.value && users.value.some((u) => u.active && u.pinHash));

// ---------- catalog ----------

const byOrder = (a: Category, b: Category) => a.sort - b.sort || a.name.localeCompare(b.name);

export const isEnabled = (c: Category) => c.enabled !== false;
/** The categories shown on the Sell screen and offered in item forms. */
export const enabledCategories = computed(() => categories.value.filter(isEnabled));

export async function saveCategory(c: Partial<Category> & { name: string }) {
  const rec: Category = {
    id: c.id ?? uid(),
    updatedAt: 0,
    name: c.name.trim(),
    emoji: c.emoji ?? '',
    sort: c.sort ?? categories.value.length,
  };
  if (c.enabled === false) rec.enabled = false; // only store the unusual state
  if (c.preset) rec.preset = c.preset;
  const saved = await put('categories', rec);
  categories.value = [...categories.value.filter((x) => x.id !== saved.id), saved].sort(byOrder);
}

/** Turns several categories on or off at once (hidden ones keep their items). */
export async function setCategoriesEnabled(ids: string[], on: boolean) {
  const wanted = new Set(ids);
  const changed: Category[] = [];
  for (const c of categories.value) {
    if (!wanted.has(c.id) || isEnabled(c) === on) continue;
    const { enabled: _old, ...rest } = c;
    changed.push(await put('categories', on ? rest : { ...rest, enabled: false }));
  }
  if (changed.length) categories.value = [...categories.value.filter((c) => !changed.some((x) => x.id === c.id)), ...changed].sort(byOrder);
  return changed.length;
}

/**
 * Library switch: turn the given ready-made categories on (creating the ones the shop doesn't have yet) or off
 * (hiding them; nothing is deleted). An existing category counts as the same one when it carries the preset id or
 * has the same name, so a shop that already has "Coffee" simply sees it switched on.
 */
export async function setPresetsOn(presets: { id: string; emoji: string; name: string }[], on: boolean) {
  const list = [...categories.value];
  const touched = new Map<string, Category>();
  let sort = list.reduce((m, c) => Math.max(m, c.sort + 1), 0);
  for (const pr of presets) {
    const have = list.find((c) => c.preset === pr.id) ?? list.find((c) => c.name.trim().toLowerCase() === pr.name.trim().toLowerCase());
    if (have) {
      if (isEnabled(have) === on) continue;
      const { enabled: _old, ...rest } = have;
      touched.set(have.id, await put('categories', on ? rest : { ...rest, enabled: false }));
    } else if (on) {
      const made = await put('categories', { id: uid(), updatedAt: 0, name: pr.name, emoji: pr.emoji, sort: sort++, preset: pr.id });
      touched.set(made.id, made);
    }
  }
  if (touched.size) categories.value = [...categories.value.filter((c) => !touched.has(c.id)), ...touched.values()].sort(byOrder);
  return touched.size;
}

/** Moves many items to one category (or '' for none) in a single step. */
export async function moveProducts(ids: string[], categoryId: string) {
  const wanted = new Set(ids);
  const moved: Product[] = [];
  for (const p of products.value) {
    if (wanted.has(p.id) && p.categoryId !== categoryId) moved.push(await put('products', { ...p, categoryId }));
  }
  if (moved.length) {
    const byId = new Map(moved.map((p) => [p.id, p]));
    products.value = products.value.map((p) => byId.get(p.id) ?? p);
  }
  return moved.length;
}

export async function deleteCategory(id: string) {
  await remove('categories', id);
  categories.value = categories.value.filter((c) => c.id !== id);
  // Items keep working; they just become uncategorised.
  const affected = products.value.filter((p) => p.categoryId === id);
  for (const p of affected) await saveProduct({ ...p, categoryId: '' });
}

export function blankProduct(): Product {
  return {
    id: uid(), updatedAt: 0, name: '', categoryId: '', price: 0, cost: 0, sku: '', barcode: '', emoji: '🛍️',
    color: '', taxable: true, trackStock: false, stock: 0, lowStock: settings.value.lowStockDefault, variants: [],
    active: true, createdAt: Date.now(),
  };
}

export async function saveProduct(p: Product): Promise<Product> {
  // A recipe-costed item's `cost` is always derived, so reports and sale-time cost snapshots stay consistent.
  const cost = p.costMode === 'recipe' ? recipeCost(p, ingredients.value).perItem : p.cost;
  const saved = await put('products', { ...p, name: p.name.trim(), cost });
  products.value = [...products.value.filter((x) => x.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name));
  return saved;
}

export async function deleteProduct(id: string) {
  await remove('products', id);
  products.value = products.value.filter((p) => p.id !== id);
}

// ---------- ingredients (recipe costing) ----------

export function blankIngredient(): Ingredient {
  return { id: uid(), updatedAt: 0, name: '', unit: 'g', packSize: 1000, packCost: 0, note: '', createdAt: Date.now() };
}

/** Items whose recipe uses this ingredient. */
export const productsUsing = (ingredientId: string) =>
  products.value.filter((p) => p.costMode === 'recipe' && p.recipe?.some((l) => l.ingredientId === ingredientId));

/** Re-derives cost for every recipe-costed item (call after any ingredient price change). Returns how many changed. */
export async function recomputeRecipeCosts(): Promise<number> {
  let changed = 0;
  for (const p of products.value) {
    if (p.costMode !== 'recipe') continue;
    if (recipeCost(p, ingredients.value).perItem !== p.cost) {
      await saveProduct(p);
      changed++;
    }
  }
  return changed;
}

export async function saveIngredient(i: Ingredient): Promise<{ ingredient: Ingredient; itemsUpdated: number }> {
  const saved = await put('ingredients', { ...i, name: i.name.trim() });
  ingredients.value = [...ingredients.value.filter((x) => x.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name));
  return { ingredient: saved, itemsUpdated: await recomputeRecipeCosts() };
}

/** Refuses while recipes still use it, so no item silently loses part of its cost. */
export async function deleteIngredient(id: string): Promise<{ ok: boolean; usedBy: string[] }> {
  const used = productsUsing(id);
  if (used.length) return { ok: false, usedBy: used.map((p) => p.name) };
  await remove('ingredients', id);
  ingredients.value = ingredients.value.filter((i) => i.id !== id);
  return { ok: true, usedBy: [] };
}

export function findByCode(code: string): { product: Product; variant?: Variant } | undefined {
  const c = code.trim().toLowerCase();
  if (!c) return undefined;
  for (const product of products.value) {
    if (!product.active) continue;
    if (product.barcode.toLowerCase() === c || (product.sku && product.sku.toLowerCase() === c)) return { product };
    const variant = product.variants.find((v) => v.barcode && v.barcode.toLowerCase() === c);
    if (variant) return { product, variant };
  }
  return undefined;
}

export async function adjustStock(productId: string, delta: number, reason: StockReason, note = '') {
  const p = products.value.find((x) => x.id === productId);
  if (!p || !delta) return;
  const move: StockMove = {
    id: uid(), updatedAt: 0, productId, at: Date.now(), delta, reason, ref: '', by: session.value?.name ?? '', note,
  };
  await saveProduct({ ...p, stock: p.stock + delta });
  await put('stockMoves', move);
}

export const lowStock = computed(() =>
  products.value.filter((p) => p.active && p.trackStock && p.stock <= p.lowStock),
);

// ---------- customers ----------

export function blankCustomer(): Customer {
  return { id: uid(), updatedAt: 0, name: '', phone: '', email: '', note: '', points: 0, createdAt: Date.now() };
}

export async function saveCustomer(c: Customer): Promise<Customer> {
  const saved = await put('customers', { ...c, name: c.name.trim() });
  customers.value = [...customers.value.filter((x) => x.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name));
  return saved;
}

export async function deleteCustomer(id: string) {
  await remove('customers', id);
  customers.value = customers.value.filter((c) => c.id !== id);
  if (cart.value.customerId === id) cart.value = { ...cart.value, customerId: '' };
}

// ---------- cart ----------

export function addToCart(product: Product, variant?: Variant, qty = 1) {
  const variantId = variant?.id ?? '';
  const c = cart.value;
  const i = c.lines.findIndex((l) => l.productId === product.id && l.variantId === variantId && !l.discount && !l.note && l.lineTotal == null);
  if (i >= 0) {
    setQty(c.lines[i].id, c.lines[i].qty + qty);
    return;
  }
  const line: CartLine = {
    id: uid(),
    productId: product.id,
    variantId,
    name: product.name,
    variantName: variant?.name ?? '',
    sku: product.sku,
    unitPrice: variant?.price ?? product.price,
    unitCost: product.cost,
    taxable: product.taxable,
    qty,
    discount: null,
    note: '',
  };
  cart.value = { ...c, lines: [...c.lines, line] };
}

/** Changing quantity keeps the per-unit price: a custom item total scales with it. */
const withQty = (l: CartLine, qty: number): CartLine => ({
  ...l,
  qty,
  lineTotal: l.lineTotal != null && l.qty > 0 ? Math.round((l.lineTotal * qty) / l.qty) : l.lineTotal,
});

export function setQty(lineId: string, qty: number) {
  const c = cart.value;
  cart.value = {
    ...c,
    lines: qty <= 0 ? c.lines.filter((l) => l.id !== lineId) : c.lines.map((l) => (l.id === lineId ? withQty(l, qty) : l)),
  };
}

/**
 * Takes one unit off an item straight from the Sell grid. Returns false when the item sits on several lines (variants,
 * or one with its own price or note) so the caller can ask which one.
 */
export function removeOne(productId: string): boolean {
  const lines = cart.value.lines.filter((l) => l.productId === productId);
  if (lines.length !== 1) return false;
  setQty(lines[0].id, lines[0].qty - 1);
  return true;
}

export function patchLine(lineId: string, patch: Partial<CartLine>) {
  cart.value = {
    ...cart.value,
    lines: cart.value.lines.map((l) => {
      if (l.id !== lineId) return l;
      const next = patch.qty !== undefined && patch.qty !== l.qty ? withQty(l, patch.qty) : l;
      const { qty: _q, ...rest } = patch;
      return { ...next, ...rest };
    }),
  };
}

/** Sets a custom item total (null restores qty × list price). Used to charge a customer a different price. */
export const setLineTotal = (lineId: string, total: number | null) => patchLine(lineId, { lineTotal: total });

export const setOrderDiscount = (discount: Adjustment | null) => (cart.value = { ...cart.value, discount });
export const setCartCustomer = (customerId: string) => (cart.value = { ...cart.value, customerId });
export const setCartNote = (note: string) => (cart.value = { ...cart.value, note });
export const clearCart = () => (cart.value = emptyCart());

/** Units of a tracked product already in the cart (across variants), for oversell warnings. */
export function inCart(productId: string): number {
  return cart.value.lines.filter((l) => l.productId === productId).reduce((a, l) => a + l.qty, 0);
}

const cashMovement = (type: 'in' | 'out', amount: number, reason: string, now: number): CashMovement => ({
  id: uid(), updatedAt: now, shiftId: shift.value!.id, at: now, type, amount, reason, by: session.value?.name ?? '',
});

/**
 * Sets the order on screen aside as a pending order. `payments` are deposits taken just now (with `proofs`, photos of
 * a transfer slip): cash goes into the open shift's drawer right away, and the money stays with the order until it is
 * finished. With none, it is simply put on hold unpaid.
 */
export async function parkCart(o: { payments?: Payment[]; proofs?: string[] } = {}): Promise<Parked | null> {
  const c = cart.value;
  if (!c.lines.length) return null;
  const now = Date.now();
  const fresh = (o.payments ?? []).filter((p) => p.amount > 0).map((p): Payment => ({ ...p, tendered: p.amount, deposit: true, at: now }));
  if (fresh.some((p) => p.method === 'points')) throw new Error(t('Points can only be used when the order is finished.'));
  if (fresh.length && settings.value.requireShift && !shift.value) throw new Error(t('Open a shift before selling.'));
  const proofs = o.proofs ?? [];
  const paid = [...(c.paid ?? []), ...fresh];
  const proofKey = c.proofKey ?? (proofs.length ? uid() : undefined);
  const customer = customers.value.find((x) => x.id === c.customerId);
  const name = pendingLabel(c, customer?.name ?? '');
  const rec: Parked = {
    id: uid(), updatedAt: now, name, createdAt: now,
    cart: { ...c, ...(paid.length ? { paid } : {}), ...(proofKey ? { proofKey } : {}) },
  };
  const cashIn = fresh.filter((p) => p.method === 'cash').reduce((a, p) => a + p.amount, 0);
  const d = await db();
  const tx = d.transaction(['parked', 'attachments', 'cashMovements'], 'readwrite');
  await tx.objectStore('parked').put(rec);
  for (const image of proofs) await tx.objectStore('attachments').put(newAttachment(proofKey!, image, session.value?.name ?? '', now));
  if (cashIn && shift.value) await tx.objectStore('cashMovements').put(cashMovement('in', cashIn, t('Deposit: {name}', { name }), now));
  await tx.done;
  parkedList.value = [rec, ...parkedList.value];
  clearCart();
  return rec;
}

/** The deposit slip for a pending order, with the customer and cashier names filled in. */
export const depositSlipFor = (p: Parked) =>
  depositSlip(p, settings.value, { customerName: customers.value.find((x) => x.id === p.cart.customerId)?.name ?? '', userName: session.value?.name ?? '' });

/** Brings a pending order back to the screen (whatever was on screen is set aside first, so nothing is lost). */
export async function recallParked(id: string) {
  const p = parkedList.value.find((x) => x.id === id);
  if (!p) return;
  await parkCart();
  cart.value = p.cart;
  await remove('parked', id);
  parkedList.value = parkedList.value.filter((x) => x.id !== id);
}

/** Throws a pending order away. Deposits on it must go back to the customer: cash leaves the drawer, and the list says what to return. */
async function discard(c: CartState, label: string, parkedId?: string): Promise<Payment[]> {
  const paid = c.paid ?? [];
  const cashOut = paid.filter((p) => p.method === 'cash').reduce((a, p) => a + p.amount, 0);
  const now = Date.now();
  const d = await db();
  const tx = d.transaction(['parked', 'attachments', 'cashMovements'], 'readwrite');
  if (parkedId) await tx.objectStore('parked').delete(parkedId);
  if (c.proofKey) for (const key of await tx.objectStore('attachments').index('orderId').getAllKeys(c.proofKey)) await tx.objectStore('attachments').delete(key);
  if (cashOut && shift.value) await tx.objectStore('cashMovements').put(cashMovement('out', cashOut, t('Deposit returned: {name}', { name: label }), now));
  await tx.done;
  return paid;
}

/** Deletes a pending order; returns the deposits that have to be given back. */
export async function cancelPending(id: string): Promise<Payment[]> {
  const p = parkedList.value.find((x) => x.id === id);
  if (!p) return [];
  const returned = await discard(p.cart, p.name, id);
  parkedList.value = parkedList.value.filter((x) => x.id !== id);
  return returned;
}

/** Clears the order on screen; returns any deposits that have to be given back. */
export async function cancelCart(): Promise<Payment[]> {
  const c = cart.value;
  const customer = customers.value.find((x) => x.id === c.customerId);
  const returned = c.paid?.length || c.proofKey ? await discard(c, pendingLabel(c, customer?.name ?? '')) : [];
  clearCart();
  return returned;
}

// ---------- checkout ----------

export function pointsFor(amountMinor: number): number {
  const s = settings.value;
  if (!s.loyaltyEnabled) return 0;
  return Math.floor((amountMinor / 10 ** s.currencyDecimals) * s.pointsPerUnit);
}

export async function checkout(payments: Payment[], proofs: string[] = []): Promise<Order> {
  const c = cart.value;
  const s = settings.value;
  const tot = totals.value;
  if (!c.lines.length) throw new Error(t('The cart is empty.'));
  if (s.requireShift && !shift.value) throw new Error(t('Open a shift before selling.'));
  // Deposits taken earlier count toward the total; if items were removed since, the excess goes back to the customer.
  const { kept, returned } = settleDeposits(c.paid ?? [], tot.total);
  const all = [...kept, ...payments];
  const paid = all.reduce((a, p) => a + p.amount, 0);
  if (paid !== tot.total) throw new Error(t('Payments do not match the total.'));
  const cashTendered = all.filter((p) => p.method === 'cash').reduce((a, p) => a + p.tendered, 0);
  const cashApplied = all.filter((p) => p.method === 'cash').reduce((a, p) => a + p.amount, 0);
  const change = Math.max(0, cashTendered - cashApplied);

  const customer = c.customerId ? customers.value.find((x) => x.id === c.customerId) : undefined;
  const redeemed = s.pointValue > 0 ? Math.round(all.filter((p) => p.method === 'points').reduce((a, p) => a + p.amount, 0) / s.pointValue) : 0;
  const earned = customer ? pointsFor(tot.total - all.filter((p) => p.method === 'points').reduce((a, p) => a + p.amount, 0)) : 0;

  const d = await db();
  const tx = d.transaction(['orders', 'products', 'customers', 'settings', 'stockMoves', 'attachments', 'cashMovements'], 'readwrite');
  const st = ((await tx.objectStore('settings').get('main')) as Settings | undefined) ?? s;
  const seq = st.receiptNext;
  const now = Date.now();
  const held = c.proofKey ? ((await tx.objectStore('attachments').index('orderId').getAll(c.proofKey)) as Attachment[]) : [];
  const order: Order = {
    id: uid(),
    updatedAt: now,
    number: `${st.receiptPrefix}${String(seq).padStart(4, '0')}`,
    seq,
    at: now,
    shiftId: shift.value?.id ?? '',
    userId: session.value?.id ?? '',
    userName: session.value?.name ?? '',
    customerId: customer?.id ?? '',
    customerName: customer?.name ?? '',
    lines: toOrderLines(c.lines, tot),
    subtotal: tot.subtotal,
    orderDiscount: tot.orderDiscount,
    orderDiscountAdj: c.discount,
    tax: tot.tax,
    total: tot.total,
    taxName: s.taxName,
    taxRate: s.taxRate,
    taxInclusive: s.taxInclusive,
    payments: all,
    change,
    status: 'paid',
    refunds: [],
    note: c.note,
    pointsEarned: earned,
    pointsRedeemed: redeemed,
    attachmentCount: proofs.length + held.length,
  };
  await tx.objectStore('orders').put(order);
  for (const image of proofs) await tx.objectStore('attachments').put(newAttachment(order.id, image, order.userName, now));
  // Photos kept with the deposit now belong to the sale.
  for (const a of held) await tx.objectStore('attachments').put({ ...a, orderId: order.id, updatedAt: now });
  const giveBack = returned.filter((p) => p.method === 'cash').reduce((a, p) => a + p.amount, 0);
  if (giveBack && shift.value) await tx.objectStore('cashMovements').put(cashMovement('out', giveBack, t('Deposit returned: {name}', { name: order.number }), now));
  await tx.objectStore('settings').put({ ...st, receiptNext: seq + 1, updatedAt: now });

  const changedProducts = new Map<string, Product>();
  for (const l of order.lines) {
    // Reads inside the transaction see earlier writes, so two lines of one product compound correctly.
    const p = (await tx.objectStore('products').get(l.productId)) as Product | undefined;
    if (!p || !p.trackStock) continue;
    const next = { ...p, stock: p.stock - l.qty, updatedAt: now };
    await tx.objectStore('products').put(next);
    await tx.objectStore('stockMoves').put({
      id: uid(), updatedAt: now, productId: p.id, at: now, delta: -l.qty, reason: 'sale', ref: order.id,
      by: order.userName, note: order.number,
    } satisfies StockMove);
    changedProducts.set(p.id, next);
  }
  let updatedCustomer: Customer | undefined;
  if (customer && (earned || redeemed)) {
    const fresh = ((await tx.objectStore('customers').get(customer.id)) as Customer | undefined) ?? customer;
    updatedCustomer = { ...fresh, points: Math.max(0, fresh.points + earned - redeemed), updatedAt: now };
    await tx.objectStore('customers').put(updatedCustomer);
  }
  await tx.done;

  settings.value = { ...st, receiptNext: seq + 1, updatedAt: now };
  if (changedProducts.size) products.value = products.value.map((p) => changedProducts.get(p.id) ?? p);
  if (updatedCustomer) customers.value = customers.value.map((x) => (x.id === updatedCustomer!.id ? updatedCustomer! : x));
  clearCart();
  return order;
}

// ---------- payment proofs (bank slips etc.) ----------

const newAttachment = (orderId: string, image: string, by: string, at: number): Attachment => ({
  id: uid(), updatedAt: at, orderId, at, by, name: '', image, bytes: Math.round(image.length * 0.75),
});

export async function attachmentsFor(orderId: string): Promise<Attachment[]> {
  const list = (await (await db()).getAllFromIndex('attachments', 'orderId', orderId)) as Attachment[];
  return list.sort((a, b) => a.at - b.at);
}

export async function addAttachment(orderId: string, image: string): Promise<Attachment> {
  const d = await db();
  const tx = d.transaction(['orders', 'attachments'], 'readwrite');
  const order = (await tx.objectStore('orders').get(orderId)) as Order | undefined;
  if (!order) throw new Error(t('Order not found.'));
  const now = Date.now();
  const att = newAttachment(orderId, image, session.value?.name ?? '', now);
  await tx.objectStore('attachments').put(att);
  await tx.objectStore('orders').put({ ...order, attachmentCount: (order.attachmentCount ?? 0) + 1, updatedAt: now });
  await tx.done;
  return att;
}

export async function removeAttachment(id: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(['orders', 'attachments'], 'readwrite');
  const att = (await tx.objectStore('attachments').get(id)) as Attachment | undefined;
  if (att) {
    await tx.objectStore('attachments').delete(id);
    const order = (await tx.objectStore('orders').get(att.orderId)) as Order | undefined;
    if (order) await tx.objectStore('orders').put({ ...order, attachmentCount: Math.max(0, (order.attachmentCount ?? 1) - 1), updatedAt: Date.now() });
  }
  await tx.done;
}

/** Frees space by deleting proof photos older than `days`. Sales themselves are untouched. Returns how many were removed. */
export async function deleteAttachmentsOlderThan(days: number): Promise<number> {
  const cutoff = Date.now() - days * 86_400_000;
  const d = await db();
  const tx = d.transaction(['orders', 'attachments'], 'readwrite');
  const counts = new Map<string, number>();
  let removed = 0;
  for (const a of (await tx.objectStore('attachments').getAll()) as Attachment[]) {
    if (a.at >= cutoff) continue;
    await tx.objectStore('attachments').delete(a.id);
    counts.set(a.orderId, (counts.get(a.orderId) ?? 0) + 1);
    removed++;
  }
  for (const [orderId, n] of counts) {
    const o = (await tx.objectStore('orders').get(orderId)) as Order | undefined;
    if (o) await tx.objectStore('orders').put({ ...o, attachmentCount: Math.max(0, (o.attachmentCount ?? n) - n), updatedAt: Date.now() });
  }
  await tx.done;
  return removed;
}

// ---------- refunds & voids ----------

export async function getOrder(id: string): Promise<Order | undefined> {
  return (await db()).get('orders', id) as Promise<Order | undefined>;
}

export async function refundOrder(
  orderId: string,
  items: { lineId: string; qty: number }[],
  opts: { method: PayMethod; reason: string; restock: boolean },
): Promise<Order> {
  const d = await db();
  const tx = d.transaction(['orders', 'products', 'stockMoves', 'customers', 'cashMovements'], 'readwrite');
  const order = (await tx.objectStore('orders').get(orderId)) as Order | undefined;
  if (!order) throw new Error(t('Order not found.'));
  if (order.status === 'void' || order.status === 'refunded') throw new Error(t('Nothing left to refund on this order.'));
  const now = Date.now();
  const lines = order.lines.map((l) => ({ ...l }));
  const refundLines: Refund['lines'] = [];
  for (const it of items) {
    const l = lines.find((x) => x.id === it.lineId);
    if (!l || it.qty <= 0) continue;
    const qty = Math.min(it.qty, l.qty - l.refundedQty);
    if (qty <= 0) continue;
    const amount = refundAmountFor(l, qty);
    l.refundedQty += qty;
    l.refundedAmount += amount;
    refundLines.push({ lineId: l.id, qty, amount });
  }
  if (!refundLines.length) throw new Error(t('Choose at least one item to refund.'));
  const amount = refundLines.reduce((a, r) => a + r.amount, 0);
  const refund: Refund = {
    id: uid(), at: now, by: session.value?.name ?? '', lines: refundLines, amount, method: opts.method,
    reason: opts.reason.trim(), restock: opts.restock,
  };
  const allBack = lines.every((l) => l.refundedQty >= l.qty);
  const next: Order = { ...order, lines, refunds: [...order.refunds, refund], status: allBack ? 'refunded' : 'partial', updatedAt: now };
  await tx.objectStore('orders').put(next);

  if (opts.restock) {
    for (const r of refundLines) {
      const line = lines.find((l) => l.id === r.lineId)!;
      const p = (await tx.objectStore('products').get(line.productId)) as Product | undefined;
      if (!p?.trackStock) continue;
      await tx.objectStore('products').put({ ...p, stock: p.stock + r.qty, updatedAt: now });
      await tx.objectStore('stockMoves').put({
        id: uid(), updatedAt: now, productId: p.id, at: now, delta: r.qty, reason: 'refund', ref: order.id,
        by: refund.by, note: order.number,
      } satisfies StockMove);
    }
  }
  if (order.customerId && settings.value.loyaltyEnabled) {
    const c = (await tx.objectStore('customers').get(order.customerId)) as Customer | undefined;
    if (c) await tx.objectStore('customers').put({ ...c, points: Math.max(0, c.points - pointsFor(amount)), updatedAt: now });
  }
  if (opts.method === 'cash' && shift.value) {
    await tx.objectStore('cashMovements').put({
      id: uid(), updatedAt: now, shiftId: shift.value.id, at: now, type: 'out', amount,
      reason: `Refund ${order.number}`, by: refund.by,
    } satisfies CashMovement);
  }
  await tx.done;
  await loadAll();
  return next;
}

export function canVoid(o: Order): boolean {
  if (o.status !== 'paid' || o.refunds.length) return false;
  if (o.shiftId) return shift.value?.id === o.shiftId;
  return new Date(o.at).toDateString() === new Date().toDateString();
}

export async function voidOrder(orderId: string, reason: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(['orders', 'products', 'stockMoves', 'customers'], 'readwrite');
  const order = (await tx.objectStore('orders').get(orderId)) as Order | undefined;
  if (!order || !canVoid(order)) throw new Error(t('This sale can no longer be voided. Use a refund instead.'));
  const now = Date.now();
  await tx.objectStore('orders').put({ ...order, status: 'void', note: [order.note, reason && `VOID: ${reason}`].filter(Boolean).join(' — '), updatedAt: now });
  for (const l of order.lines) {
    const p = (await tx.objectStore('products').get(l.productId)) as Product | undefined;
    if (!p?.trackStock) continue;
    await tx.objectStore('products').put({ ...p, stock: p.stock + l.qty, updatedAt: now });
    await tx.objectStore('stockMoves').put({
      id: uid(), updatedAt: now, productId: p.id, at: now, delta: l.qty, reason: 'void', ref: order.id,
      by: session.value?.name ?? '', note: order.number,
    } satisfies StockMove);
  }
  if (order.customerId) {
    const c = (await tx.objectStore('customers').get(order.customerId)) as Customer | undefined;
    if (c) await tx.objectStore('customers').put({ ...c, points: Math.max(0, c.points - order.pointsEarned + order.pointsRedeemed), updatedAt: now });
  }
  await tx.done;
  await loadAll();
}

// ---------- shifts & cash drawer ----------

export async function openShift(openingFloat: number) {
  if (shift.value) return;
  const rec = await put('shifts', {
    id: uid(), updatedAt: 0, openedAt: Date.now(), closedAt: 0, openedBy: session.value?.name ?? '', closedBy: '',
    openingFloat, countedCash: 0, expectedCash: 0, variance: 0, note: '',
  });
  shift.value = rec;
}

export async function addCashMovement(type: 'in' | 'out', amount: number, reason: string) {
  if (!shift.value) throw new Error(t('Open a shift first.'));
  await put('cashMovements', {
    id: uid(), updatedAt: 0, shiftId: shift.value.id, at: Date.now(), type, amount, reason: reason.trim(),
    by: session.value?.name ?? '',
  });
}

export interface ShiftSummary {
  orders: number;
  sales: number;
  byMethod: Record<PayMethod, number>;
  cashIn: number;
  cashOut: number;
  expectedCash: number;
  movements: CashMovement[];
}

export async function shiftSummary(sh: Shift): Promise<ShiftSummary> {
  const d = await db();
  const [orders, movements] = await Promise.all([
    d.getAllFromIndex('orders', 'shiftId', sh.id) as Promise<Order[]>,
    d.getAllFromIndex('cashMovements', 'shiftId', sh.id) as Promise<CashMovement[]>,
  ]);
  const live = orders.filter((o) => o.status !== 'void');
  const byMethod: Record<PayMethod, number> = { cash: 0, card: 0, ewallet: 0, other: 0, points: 0 };
  // A cash deposit went into the drawer (as a cash-in entry) when it was taken, so the finished sale doesn't count it again.
  for (const o of live) for (const p of o.payments) if (!(p.deposit && p.method === 'cash')) byMethod[p.method] += p.amount;
  const cashIn = movements.filter((m) => m.type === 'in').reduce((a, m) => a + m.amount, 0);
  const cashOut = movements.filter((m) => m.type === 'out').reduce((a, m) => a + m.amount, 0);
  return {
    orders: live.length,
    sales: live.reduce((a, o) => a + o.total, 0),
    byMethod,
    cashIn,
    cashOut,
    expectedCash: sh.openingFloat + byMethod.cash + cashIn - cashOut,
    movements: movements.sort((a, b) => a.at - b.at),
  };
}

export async function closeShift(countedCash: number, note: string): Promise<Shift> {
  const sh = shift.value;
  if (!sh) throw new Error(t('No open shift.'));
  const sum = await shiftSummary(sh);
  const saved = await put('shifts', {
    ...sh, closedAt: Date.now(), closedBy: session.value?.name ?? '', countedCash, expectedCash: sum.expectedCash,
    variance: countedCash - sum.expectedCash, note: note.trim(),
  });
  shift.value = null;
  if (settings.value.autoSnapshot) createSnapshot('End of shift', 'auto').catch(() => {});
  return saved;
}

// ---------- data management ----------

/** Restores a decoded backup and brings the app's in-memory state in line with it. */
export async function applyRestore(
  backup: BackupFile,
  mode: RestoreMode,
  opts: { fromFile: boolean; clearPins?: boolean },
): Promise<RestoreResult> {
  const data = opts.clearPins
    ? { ...backup, data: { ...backup.data, users: backup.data.users.map((u) => ({ ...u, pinHash: '' })) } }
    : backup;
  // A part-paid order on screen goes to the pending list first, so it is in the "before restore" safety copy (and survives a merge).
  if (cart.value.paid?.length) await parkCart();
  const result = await restoreBackup(data, mode);
  clearCart();
  // Reload first: saveSettings merges onto the in-memory settings, which must be the restored ones.
  await loadAll();
  // The file was written before "last backup" was stamped into it, so a replace would otherwise
  // make a freshly restored shop look like it was never backed up. Safety copies don't count.
  if (opts.fromFile) await saveSettings({ lastBackupAt: Math.max(backup.createdAt, settings.value.lastBackupAt) });
  return result;
}

export async function resetAllData() {
  await createSnapshot('Before reset', 'manual', { attachments: true }).catch(() => {});
  const d = await db();
  const tx = d.transaction([...BACKUP_STORES], 'readwrite');
  await Promise.all(BACKUP_STORES.map((s) => tx.objectStore(s).clear()));
  await tx.done;
  clearCart();
  session.value = null;
  await loadAll();
}

export async function hardDeleteEverything() {
  await closeDb();
  await new Promise<void>((res) => {
    const r = indexedDB.deleteDatabase('pocket-pos');
    r.onsuccess = r.onerror = r.onblocked = () => res();
  });
}

/** Cost of one cart line for display, e.g. in the cart sheet. */
export const lineDiscountAmount = (l: CartLine) => adjustmentAmount(l.discount, lineGross(l));
