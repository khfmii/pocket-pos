import { openDB, type IDBPDatabase } from 'idb';
import type {
  Attachment,
  CashMovement,
  Category,
  Customer,
  Expense,
  Ingredient,
  Order,
  Parked,
  Product,
  Settings,
  Shift,
  Snapshot,
  StockMove,
  User,
} from './types';

export interface StoreMap {
  settings: Settings;
  categories: Category;
  products: Product;
  ingredients: Ingredient;
  customers: Customer;
  users: User;
  orders: Order;
  attachments: Attachment;
  shifts: Shift;
  cashMovements: CashMovement;
  stockMoves: StockMove;
  parked: Parked;
  expenses: Expense;
  snapshots: Snapshot;
}
export type StoreName = keyof StoreMap;

/** Stores included in a backup file. Snapshots are local safety copies and are never exported. */
export const BACKUP_STORES = [
  'settings',
  'categories',
  'products',
  'ingredients',
  'customers',
  'users',
  'orders',
  'attachments',
  'shifts',
  'cashMovements',
  'stockMoves',
  'parked',
  'expenses',
] as const satisfies readonly StoreName[];
export type BackupStoreName = (typeof BACKUP_STORES)[number];

export const DB_NAME = 'pocket-pos';
const DB_VERSION = 3;

let dbp: Promise<IDBPDatabase> | null = null;

export function db(): Promise<IDBPDatabase> {
  dbp ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(d, oldVersion) {
      const mk = (name: StoreName) => d.createObjectStore(name, { keyPath: 'id' });
      if (oldVersion < 1) {
        mk('settings');
        mk('categories');
        const products = mk('products');
        products.createIndex('barcode', 'barcode');
        products.createIndex('sku', 'sku');
        mk('customers').createIndex('phone', 'phone');
        mk('users');
        const orders = mk('orders');
        orders.createIndex('at', 'at');
        orders.createIndex('customerId', 'customerId');
        orders.createIndex('shiftId', 'shiftId');
        mk('shifts').createIndex('openedAt', 'openedAt');
        mk('cashMovements').createIndex('shiftId', 'shiftId');
        const moves = mk('stockMoves');
        moves.createIndex('productId', 'productId');
        moves.createIndex('at', 'at');
        mk('parked');
        mk('snapshots').createIndex('at', 'at');
      }
      // v2: ingredients (recipe costing) and payment-proof photos. Existing installs keep their data and just gain the stores.
      if (oldVersion < 2) {
        mk('ingredients');
        mk('attachments').createIndex('orderId', 'orderId');
      }
      // v3: costs (ingredient purchases and other expenses) for net-profit reports.
      if (oldVersion < 3) mk('expenses').createIndex('at', 'at');
    },
  });
  return dbp;
}

/** Drops the cached connection (used by tests and after destructive resets). */
export async function closeDb() {
  if (!dbp) return;
  (await dbp).close();
  dbp = null;
}

export async function getAll<S extends StoreName>(store: S): Promise<StoreMap[S][]> {
  return (await db()).getAll(store) as Promise<StoreMap[S][]>;
}

export async function getOne<S extends StoreName>(store: S, id: string): Promise<StoreMap[S] | undefined> {
  return (await db()).get(store, id) as Promise<StoreMap[S] | undefined>;
}

export async function put<S extends 'settings' | 'categories' | 'products' | 'ingredients' | 'customers' | 'users' | 'orders' | 'attachments' | 'shifts' | 'cashMovements' | 'stockMoves' | 'parked' | 'expenses'>(
  store: S,
  rec: StoreMap[S],
): Promise<StoreMap[S]> {
  const stamped = { ...rec, updatedAt: Date.now() };
  await (await db()).put(store, stamped);
  return stamped;
}

export async function remove(store: StoreName, id: string) {
  await (await db()).delete(store, id);
}

export async function ordersBetween(from: number, to: number): Promise<Order[]> {
  return (await db()).getAllFromIndex('orders', 'at', IDBKeyRange.bound(from, to)) as Promise<Order[]>;
}

export async function expensesBetween(from: number, to: number): Promise<Expense[]> {
  return (await db()).getAllFromIndex('expenses', 'at', IDBKeyRange.bound(from, to)) as Promise<Expense[]>;
}

export async function ordersForCustomer(customerId: string): Promise<Order[]> {
  return (await db()).getAllFromIndex('orders', 'customerId', customerId) as Promise<Order[]>;
}

export async function recentOrders(limit: number): Promise<Order[]> {
  const d = await db();
  const out: Order[] = [];
  let cur = await d.transaction('orders').store.index('at').openCursor(null, 'prev');
  while (cur && out.length < limit) {
    out.push(cur.value as Order);
    cur = await cur.continue();
  }
  return out;
}
