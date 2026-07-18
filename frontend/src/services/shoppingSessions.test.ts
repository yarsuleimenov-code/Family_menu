import { describe, expect, it, vi } from 'vitest';
import type { ShoppingItem, ShoppingSession } from '../types/shopping';
import { completeShoppingSession, copyShoppingSession, createShoppingSession, createShoppingSessionDebouncer, normalizeShoppingSession, stableItemId, uniqueShoppingSessions, updateShoppingItem } from './shoppingSessions';

const item = (key: string, status: ShoppingItem['status'] = 'to_buy', source: ShoppingItem['source'] = 'generated'): ShoppingItem => ({
  itemId: '', key, productName: key, category: 'прочее', quantityText: '1 шт', usedForDishes: [], status, source,
});

describe('stable shopping sessions', () => {
  it('creates isolated sessions and never inherits item statuses', () => {
    const first = createShoppingSession({ sessionId: 'one', now: '2026-01-01T00:00:00Z', dateFrom: '2026-01-01', dateTo: '2026-01-07', selectedDishes: [], includeBaseProducts: false, items: [item('milk', 'purchased')] });
    const second = createShoppingSession({ sessionId: 'two', now: '2026-01-08T00:00:00Z', dateFrom: '2026-01-08', dateTo: '2026-01-14', selectedDishes: [], includeBaseProducts: false, items: [item('milk', first.shoppingList[0].status)] });
    expect(second.shoppingList[0].status).toBe('to_buy');
    expect(second.shoppingList[0].itemId).not.toBe(first.shoppingList[0].itemId);
  });

  it('keeps statuses scoped to the session id', () => {
    const base = createShoppingSession({ sessionId: 'one', dateFrom: '2026-01-01', dateTo: '2026-01-07', selectedDishes: [], includeBaseProducts: false, items: [item('milk')] });
    const changed = updateShoppingItem(base, base.shoppingList[0].itemId, 'purchased');
    expect(changed.shoppingList[0].status).toBe('purchased');
    expect(base.shoppingList[0].status).toBe('to_buy');
  });

  it('restores an active session snapshot after a storage round trip', () => {
    const initial = createShoppingSession({ sessionId: 'reload', dateFrom: '2026-01-01', dateTo: '2026-01-07', selectedDishes: [], includeBaseProducts: false, items: [item('milk')] });
    const session = updateShoppingItem(initial, initial.shoppingList[0].itemId, 'purchased');
    const restored = normalizeShoppingSession(JSON.parse(JSON.stringify(session)));
    expect(restored).toMatchObject({ sessionId: 'reload', status: 'active' });
    expect(restored.shoppingList[0].status).toBe('purchased');
  });

  it('normalizes legacy ids and statuses deterministically without rewriting the source', () => {
    const legacy = { sessionId: 'legacy', createdAt: '2026-01-01', dateFrom: '2026-01-01', dateTo: '2026-01-07', selectedDishes: [], includeBaseProducts: false, shoppingList: [{ key: 'milk', productName: 'Milk', category: '', quantityText: '1', usedForDishes: [], status: 'in_cart' }], estimatedTotal: 0 } as unknown as ShoppingSession;
    const normalized = normalizeShoppingSession(legacy);
    expect(normalized).toMatchObject({ status: 'completed' });
    expect(normalized.shoppingList[0]).toMatchObject({ itemId: stableItemId('legacy', 'milk', 0), status: 'purchased' });
    expect((legacy.shoppingList[0] as ShoppingItem).itemId).toBeUndefined();
  });

  it('requires confirmation when completing with remaining items', () => {
    const session = createShoppingSession({ sessionId: 'one', dateFrom: '2026-01-01', dateTo: '2026-01-07', selectedDishes: [], includeBaseProducts: false, items: [item('milk')] });
    expect(completeShoppingSession(session, false)).toBeUndefined();
    expect(completeShoppingSession(session, true)?.status).toBe('completed');
  });

  it('copies a past session with reset statuses and session-owned manual items', () => {
    const source = createShoppingSession({ sessionId: 'one', dateFrom: '2026-01-01', dateTo: '2026-01-07', selectedDishes: [], includeBaseProducts: false, items: [item('water', 'skipped', 'manual')] });
    const copied = copyShoppingSession(source, 'two', '2026-01-08T00:00:00Z');
    expect(copied.shoppingList[0]).toMatchObject({ status: 'to_buy', source: 'manual' });
    expect(copied.shoppingList[0].itemId).not.toBe(source.shoppingList[0].itemId);
  });

  it('debounces rapid changes and persists the latest session snapshot', () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const session = createShoppingSession({ sessionId: 'one', dateFrom: '2026-01-01', dateTo: '2026-01-07', selectedDishes: [], includeBaseProducts: false, items: [item('milk')] });
    const debouncer = createShoppingSessionDebouncer(save, 500);
    debouncer.schedule(updateShoppingItem(session, session.shoppingList[0].itemId, 'purchased'));
    debouncer.schedule(updateShoppingItem(session, session.shoppingList[0].itemId, 'skipped'));
    vi.advanceTimersByTime(500);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].shoppingList[0].status).toBe('skipped');
    vi.useRealTimers();
  });

  it('keeps the latest snapshot for each session id', () => {
    const older = createShoppingSession({ sessionId: 'same', now: '2026-01-01T00:00:00Z', dateFrom: '2026-01-01', dateTo: '2026-01-07', selectedDishes: [], includeBaseProducts: false, items: [item('milk')] });
    const newer = { ...older, updatedAt: '2026-01-02T00:00:00Z', status: 'completed' as const };
    const other = createShoppingSession({ sessionId: 'other', now: '2026-01-01T12:00:00Z', dateFrom: '2026-01-01', dateTo: '2026-01-07', selectedDishes: [], includeBaseProducts: false, items: [item('bread')] });
    expect(uniqueShoppingSessions([older, newer, other])).toEqual([newer, other]);
  });
});
