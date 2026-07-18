import type { SelectedDinner } from '../types/plan';
import type { ShoppingItem, ShoppingItemStatus, ShoppingSession, ShoppingSessionStatus } from '../types/shopping';

export const ACTIVE_SHOPPING_SESSION_KEY = 'shopping-session-active-v1';

type LegacyItem = Partial<ShoppingItem> & { status?: string };
type LegacySession = Partial<ShoppingSession> & { shoppingList?: LegacyItem[] };

export function createShoppingSession(input: {
  sessionId?: string;
  now?: string;
  dateFrom: string;
  dateTo: string;
  selectedDishes: SelectedDinner[];
  includeBaseProducts: boolean;
  items: ShoppingItem[];
}): ShoppingSession {
  const now = input.now || new Date().toISOString();
  const sessionId = input.sessionId || crypto.randomUUID();
  return {
    sessionId,
    createdAt: now,
    updatedAt: now,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    selectedDishes: input.selectedDishes,
    includeBaseProducts: input.includeBaseProducts,
    shoppingList: input.items.map((item, index) => normalizeShoppingItem(item, sessionId, index, true)),
    estimatedTotal: sumEstimated(input.items),
    status: 'active',
  };
}

export function normalizeShoppingSession(value: LegacySession): ShoppingSession {
  const sessionId = value.sessionId || crypto.randomUUID();
  const createdAt = value.createdAt || new Date().toISOString();
  const items = Array.isArray(value.shoppingList) ? value.shoppingList : [];
  return {
    sessionId,
    createdAt,
    updatedAt: value.updatedAt || createdAt,
    dateFrom: value.dateFrom || '',
    dateTo: value.dateTo || value.dateFrom || '',
    selectedDishes: Array.isArray(value.selectedDishes) ? value.selectedDishes : [],
    includeBaseProducts: Boolean(value.includeBaseProducts),
    shoppingList: items.map((item, index) => normalizeShoppingItem(item, sessionId, index)),
    estimatedTotal: Number(value.estimatedTotal) || sumEstimated(items),
    status: normalizeSessionStatus(value.status),
    completedAt: value.completedAt,
    note: value.note,
  };
}

export function copyShoppingSession(source: ShoppingSession, sessionId: string = crypto.randomUUID(), now = new Date().toISOString()): ShoppingSession {
  return createShoppingSession({
    sessionId,
    now,
    dateFrom: source.dateFrom,
    dateTo: source.dateTo,
    selectedDishes: source.selectedDishes,
    includeBaseProducts: source.includeBaseProducts,
    items: source.shoppingList.map((item) => ({ ...item, itemId: '', status: 'to_buy' })),
  });
}

export function updateShoppingItem(session: ShoppingSession, itemId: string, status: ShoppingItemStatus, now = new Date().toISOString()): ShoppingSession {
  return { ...session, updatedAt: now, shoppingList: session.shoppingList.map((item) => item.itemId === itemId ? { ...item, status } : item) };
}

export function completeShoppingSession(session: ShoppingSession, confirmed: boolean, now = new Date().toISOString()): ShoppingSession | undefined {
  if (session.shoppingList.some((item) => item.status === 'to_buy') && !confirmed) return undefined;
  return { ...session, status: 'completed', completedAt: now, updatedAt: now };
}

export function sessionSummary(session: ShoppingSession) {
  const purchased = session.shoppingList.filter((item) => item.status === 'purchased').length;
  const skipped = session.shoppingList.filter((item) => item.status === 'skipped').length;
  const remaining = session.shoppingList.filter((item) => item.status === 'to_buy').length;
  return { total: session.shoppingList.length, purchased, skipped, remaining, estimatedTotal: session.estimatedTotal };
}

export function findActiveSession(sessions: ShoppingSession[]): ShoppingSession | undefined {
  return sessions.map(normalizeShoppingSession).filter((session) => session.status === 'active').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

export function stableItemId(sessionId: string, key: string, index: number): string {
  let hash = 2166136261;
  const value = `${sessionId}:${key}:${index}`;
  for (let cursor = 0; cursor < value.length; cursor += 1) {
    hash ^= value.charCodeAt(cursor);
    hash = Math.imul(hash, 16777619);
  }
  return `item-${(hash >>> 0).toString(16)}`;
}

export function createShoppingSessionDebouncer(save: (session: ShoppingSession) => void | Promise<unknown>, waitMs = 600) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest: ShoppingSession | undefined;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    const value = latest;
    latest = undefined;
    if (value) void save(value);
  };
  return {
    schedule(session: ShoppingSession) {
      latest = session;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, waitMs);
    },
    flush,
    cancel() {
      if (timer) clearTimeout(timer);
      timer = undefined;
      latest = undefined;
    },
  };
}

function normalizeShoppingItem(item: LegacyItem, sessionId: string, index: number, resetStatus = false): ShoppingItem {
  const key = item.key || item.productId || `legacy-${index}`;
  return {
    itemId: item.itemId || stableItemId(sessionId, key, index),
    key,
    productId: item.productId,
    productName: item.productName || 'Товар',
    category: item.category || 'прочее',
    quantityText: item.quantityText || '1 шт',
    unit: item.unit,
    usedForDishes: Array.isArray(item.usedForDishes) ? item.usedForDishes : [],
    replacement: item.replacement,
    comment: item.comment,
    pricePerUnit: item.pricePerUnit,
    estimatedPrice: item.estimatedPrice,
    status: resetStatus ? 'to_buy' : normalizeItemStatus(item.status),
    source: item.source || (key.startsWith('manual:') ? 'manual' : 'generated'),
  };
}

function normalizeItemStatus(status?: string): ShoppingItemStatus {
  if (status === 'purchased' || status === 'in_cart') return 'purchased';
  if (status === 'skipped' || status === 'skip' || status === 'have_at_home') return 'skipped';
  return 'to_buy';
}

function normalizeSessionStatus(status?: ShoppingSessionStatus): ShoppingSessionStatus {
  return status === 'active' || status === 'archived' ? status : 'completed';
}

function sumEstimated(items: Array<Partial<ShoppingItem>>): number {
  return items.reduce((total, item) => total + (Number(item.estimatedPrice) || 0), 0);
}
