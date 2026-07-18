import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = fs.readFileSync(path.resolve(process.cwd(), '../apps-script/CodeV2.gs'), 'utf8');

function load(overrides = {}) {
  const context = vm.createContext({ console, Date, JSON, Math, Object, Array, Error, ...overrides });
  vm.runInContext(source, context);
  return context;
}

function createSheet(headers, rows) {
  let values = [headers, ...rows];
  return {
    getLastColumn: () => headers.length,
    getDataRange: () => ({ getValues: () => values.map((row) => [...row]) }),
    getRange: (row, column, rowCount, columnCount) => ({
      getValues: () => values.slice(row - 1, row - 1 + rowCount).map((item) => item.slice(column - 1, column - 1 + columnCount)),
      setValues: (next) => {
        next.forEach((nextRow, rowOffset) => {
          const targetRow = row - 1 + rowOffset;
          if (!values[targetRow]) values[targetRow] = [];
          nextRow.forEach((cell, columnOffset) => { values[targetRow][column - 1 + columnOffset] = cell; });
        });
      },
    }),
    clearContents: () => { values = []; },
    values: () => values,
  };
}

describe('Apps Script mutation safety', () => {
  it('releases the lock on success and exception', () => {
    const lock = { tryLock: vi.fn(() => true), releaseLock: vi.fn() };
    const ctx = load({ LockService: { getScriptLock: () => lock } });
    expect(ctx.withMutationLock_(() => 7)).toBe(7);
    expect(() => ctx.withMutationLock_(() => { throw new Error('boom'); })).toThrow('boom');
    expect(lock.tryLock).toHaveBeenCalledWith(5000);
    expect(lock.releaseLock).toHaveBeenCalledTimes(2);
  });

  it('returns structured LOCK_TIMEOUT', () => {
    const ctx = load({ LockService: { getScriptLock: () => ({ tryLock: () => false }) } });
    expect(ctx.safeRun_(() => ctx.withMutationLock_(() => 1))).toMatchObject({ ok: false, error: { code: 'LOCK_TIMEOUT', retryable: true } });
  });

  it('validates mutation payloads before a lock is requested', () => {
    const getScriptLock = vi.fn();
    const ctx = load({ LockService: { getScriptLock } });
    const result = ctx.safeRun_(() => {
      ctx.validateMutationPayload_('createDish', { dishName: 'Dish', ingredients: [{}] }, 'id');
      return ctx.withMutationLock_(() => 1);
    });
    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    expect(getScriptLock).not.toHaveBeenCalled();
  });

  it('invalidates cache only after mutation success', () => {
    const lock = { tryLock: () => true, releaseLock: vi.fn() };
    const ctx = load({ LockService: { getScriptLock: () => lock } });
    ctx.clearAppDataCache_ = vi.fn();
    expect(ctx.runMutation_(() => 'ok')).toBe('ok');
    expect(ctx.clearAppDataCache_).toHaveBeenCalledTimes(1);
    expect(() => ctx.runMutation_(() => { throw new Error('failed'); })).toThrow();
    expect(ctx.clearAppDataCache_).toHaveBeenCalledTimes(1);
  });

  it('does not fail a successful mutation when cache cleanup fails', () => {
    const ctx = load({ CacheService: { getScriptCache: () => ({ remove: () => { throw new Error('cache unavailable'); } }) } });
    expect(() => ctx.clearAppDataCache_()).not.toThrow();
  });

  it('keeps read endpoints free from sheet creation and writes', () => {
    const insertSheet = vi.fn();
    const spreadsheet = { getSheetByName: vi.fn(() => null), insertSheet };
    const ctx = load({
      SpreadsheetApp: { getActive: () => spreadsheet },
      CacheService: { getScriptCache: () => ({ get: () => null, put: vi.fn() }) },
    });
    expect(ctx.getDishes()).toEqual([]);
    expect(ctx.getCalendarPlan()).toEqual([]);
    expect(ctx.getBaseProducts()).toEqual([]);
    expect(ctx.getRecentSelections(10)).toEqual([]);
    expect(ctx.getSettings()).toMatchObject({ dataSource: 'googleSheets' });
    expect(ctx.getAppData()).toMatchObject({ dishes: [], baseProducts: [] });
    expect(insertSheet).not.toHaveBeenCalled();
  });

  it('replays the stored result and rejects a UUID reused with another payload', () => {
    const ctx = load();
    const ledger = [];
    ctx.hashPayload_ = (payload) => JSON.stringify(payload);
    ctx.readRows_ = () => ledger;
    ctx.appendByHeaders_ = (_sheet, row) => ledger.push(row);
    const handler = vi.fn(() => ({ id: 'logical-result' }));
    expect(ctx.executeIdempotentMutation_('createDish', 'uuid', { name: 'A' }, handler)).toEqual({ id: 'logical-result' });
    expect(ctx.executeIdempotentMutation_('createDish', 'uuid', { name: 'A' }, handler)).toEqual({ id: 'logical-result' });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(ctx.safeRun_(() => ctx.executeIdempotentMutation_('createDish', 'uuid', { name: 'B' }, handler)))
      .toMatchObject({ ok: false, error: { code: 'IDEMPOTENCY_CONFLICT' } });
  });

  it('preserves neighboring rows and the original insertion position during replacement', () => {
    const sheet = createSheet(['dish_id', 'product_id', 'product_name', 'future_column'], [
      ['neighbor-a', 'a', 'A', 'keep-a'],
      ['dish', 'p1', 'old-1', 'future-1'],
      ['dish', 'p2', 'old-2', 'future-2'],
      ['neighbor-b', 'b', 'B', 'keep-b'],
    ]);
    const ctx = load();
    ctx.ensureSheet_ = () => sheet;
    ctx.replaceRowsByKey_('dish_ingredients', 'dish_id', 'dish', [
      { dish_id: 'dish', product_id: 'p1', product_name: 'new-1' },
      { dish_id: 'dish', product_id: 'p2', product_name: 'new-2' },
    ]);
    expect(sheet.values()).toEqual([
      ['dish_id', 'product_id', 'product_name', 'future_column'],
      ['neighbor-a', 'a', 'A', 'keep-a'],
      ['dish', 'p1', 'new-1', 'future-1'],
      ['dish', 'p2', 'new-2', 'future-2'],
      ['neighbor-b', 'b', 'B', 'keep-b'],
    ]);
  });

  it('preserves later-added columns when updating an existing keyed row', () => {
    const sheet = createSheet(['dish_id', 'dish_name', 'future_column'], [['dish', 'Old', 'keep-me']]);
    const ctx = load();
    ctx.ensureSheet_ = () => sheet;
    ctx.upsertByKey_('dishes', 'dish_id', 'dish', { dish_id: 'dish', dish_name: 'New' });
    expect(sheet.values()[1]).toEqual(['dish', 'New', 'keep-me']);
  });

  it('uses stable idempotency keys for selected dinner and shopping session', () => {
    const ctx = load();
    ctx.setupSheets = vi.fn();
    ctx.upsertByKey_ = vi.fn();
    const dinner = { date: '2026-01-01', dishId: 'dish', dishName: 'Dish' };
    ctx.saveSelectedDinner(dinner, 'stable-request');
    ctx.saveSelectedDinner(dinner, 'stable-request');
    expect(ctx.upsertByKey_.mock.calls[0][2]).toBe('stable-request');
    expect(ctx.upsertByKey_.mock.calls[1][2]).toBe('stable-request');
    ctx.saveShoppingSession({ dateFrom: '2026-01-01', dateTo: '2026-01-02', selectedDishes: [], shoppingList: [] }, 'shopping-request');
    expect(ctx.upsertByKey_.mock.calls[2][2]).toBe('shopping-request');
  });

  it('uses the request UUID as a stable fallback id for dishes and products', () => {
    const ctx = load();
    ctx.setupSheets = vi.fn();
    ctx.upsertDish_ = vi.fn();
    ctx.upsertBaseProduct_ = vi.fn();
    const dish = { dishName: 'Dish', ingredients: [] };
    const product = { productName: 'Product' };
    ctx.createDish(dish, 'dish-request');
    ctx.updateDish({ dishName: 'Dish', ingredients: [] }, 'dish-request');
    ctx.createBaseProduct(product, 'product-request');
    ctx.updateBaseProduct({ productName: 'Product' }, 'product-request');
    expect(ctx.upsertDish_.mock.calls.map(([value]) => value.dishId)).toEqual(['dish-request', 'dish-request']);
    expect(ctx.upsertBaseProduct_.mock.calls.map(([value]) => value.productId)).toEqual(['product-request', 'product-request']);
  });

  it('restores a dish snapshot and reports PARTIAL_WRITE_RISK if restoration fails', () => {
    const ctx = load();
    ctx.setupSheets = vi.fn();
    ctx.prepareDishRows_ = () => ({ dishId: 'dish', dishRow: [], ingredientRows: [] });
    ctx.snapshotDish_ = () => ({ dishRows: [], ingredientRows: [] });
    ctx.writePreparedDish_ = () => { throw new Error('write failed'); };
    ctx.restoreDishSnapshot_ = vi.fn();
    expect(() => ctx.upsertDish_({ dishName: 'Dish', ingredients: [] })).toThrow('write failed');
    expect(ctx.restoreDishSnapshot_).toHaveBeenCalledTimes(1);
    ctx.restoreDishSnapshot_ = () => { throw new Error('restore failed'); };
    expect(ctx.safeRun_(() => ctx.upsertDish_({ dishName: 'Dish', ingredients: [] }))).toMatchObject({ ok: false, error: { code: 'PARTIAL_WRITE_RISK' } });
  });
});
