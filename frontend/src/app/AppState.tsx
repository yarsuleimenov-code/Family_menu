import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AppData } from '../types/app';
import type { Dish } from '../types/dish';
import type { BaseProduct } from '../types/product';
import type { CalendarPlanRow, SelectedDinner } from '../types/plan';
import type { ShoppingSession } from '../types/shopping';
import type { AppSettings } from '../types/settings';
import { api, isGoogleSheetsDataSource } from '../services/api';
import { readAppDataCache, writeAppDataCache } from '../services/appDataCache';
import { mockData } from '../data/mockData';
import { ApiLockTimeoutError, ApiNetworkError, ApiResponseError, ApiTimeoutError } from '../services/apiErrors';
import { createPendingWrite, markWriteAttempt, markWriteFailure, normalizePendingWrites, PendingWriteGuard, runWithSingleLockRetry } from '../services/pendingWrites';
import type { PendingWrite, WriteAction } from '../services/pendingWrites';

type SyncStatusType = 'loading' | 'cached' | 'refreshing' | 'fresh' | 'error' | 'local';
type SaveStatusType = 'saving' | 'saved' | 'error' | 'local';
export interface SyncStatus {
  status: SyncStatusType;
  message: string;
  lastUpdated?: string;
  detail?: string;
  cachedRenderMs?: number;
  liveRefreshMs?: number;
}

export interface SaveStatus {
  status: SaveStatusType;
  message: string;
  updatedAt: string;
  error?: string;
}

interface AppStateContextValue {
  data: AppData;
  loading: boolean;
  error?: string;
  syncStatus: SyncStatus;
  saveStatuses: Record<string, SaveStatus>;
  pendingWrites: PendingWrite[];
  refresh: () => Promise<void>;
  retryPendingWrite: (id: string) => Promise<boolean>;
  retryPendingWrites: () => Promise<void>;
  discardPendingWrite: (id: string) => void;
  saveSelectedDinner: (selection: SelectedDinner) => Promise<boolean>;
  saveCalendarPlan: (row: CalendarPlanRow) => Promise<boolean>;
  saveShoppingSession: (session: ShoppingSession) => Promise<boolean>;
  saveDish: (dish: Dish) => Promise<boolean>;
  deactivateDish: (dishId: string) => Promise<boolean>;
  saveBaseProduct: (product: BaseProduct) => Promise<boolean>;
  deactivateBaseProduct: (productId: string) => Promise<boolean>;
  updateSettings: (settings: AppSettings) => Promise<boolean>;
}

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);
const PENDING_WRITES_KEY = 'familyMenu.pendingWrites.v1';

export function selectedDinnerWriteKey(date: string): string {
  return `selectedDinner:${date}`;
}

export function calendarPlanWriteKey(date: string): string {
  return `calendarPlan:${date}`;
}

export function shoppingSessionWriteKey(sessionId: string): string {
  return `shoppingSession:${sessionId}`;
}

function nowMs(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function readPendingWrites(): PendingWrite[] {
  try {
    const raw = localStorage.getItem(PENDING_WRITES_KEY);
    return raw ? normalizePendingWrites(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function writePendingWrites(writes: PendingWrite[]): void {
  try {
    localStorage.setItem(PENDING_WRITES_KEY, JSON.stringify(writes));
  } catch {
    // Pending writes are a reliability layer; storage failures must not break the app.
  }
}

function statusKeyFor(action: WriteAction, payload: unknown): string {
  if (action === 'saveSelectedDinner') return selectedDinnerWriteKey((payload as SelectedDinner).date);
  if (action === 'saveCalendarPlan') return calendarPlanWriteKey((payload as CalendarPlanRow).date);
  if (action === 'saveShoppingSession') return shoppingSessionWriteKey((payload as ShoppingSession).sessionId);
  return `${action}:${JSON.stringify(payload)}`;
}

function applyPendingWritesToData(data: AppData, writes: PendingWrite[]): AppData {
  return writes.reduce<AppData>((current, write) => {
    switch (write.action) {
      case 'saveSelectedDinner': {
        const selection = write.payload as SelectedDinner;
        return {
          ...current,
          selectedDinners: [selection, ...current.selectedDinners.filter((item) => item.date !== selection.date)],
        };
      }
      case 'saveCalendarPlan': {
        const row = write.payload as CalendarPlanRow;
        return {
          ...current,
          calendarPlan: [row, ...current.calendarPlan.filter((item) => item.date !== row.date)],
        };
      }
      case 'saveShoppingSession': {
        const session = write.payload as ShoppingSession;
        return {
          ...current,
          shoppingSessions: [session, ...current.shoppingSessions.filter((item) => item.sessionId !== session.sessionId)].slice(0, 20),
        };
      }
      case 'createDish':
      case 'updateDish': {
        const dish = write.payload as Dish;
        return {
          ...current,
          dishes: [dish, ...current.dishes.filter((item) => item.dishId !== dish.dishId)],
        };
      }
      case 'deactivateDish': {
        const { dishId } = write.payload as { dishId: string };
        return {
          ...current,
          dishes: current.dishes.map((dish) => dish.dishId === dishId ? { ...dish, active: false } : dish),
        };
      }
      case 'createBaseProduct':
      case 'updateBaseProduct': {
        const product = write.payload as BaseProduct;
        return {
          ...current,
          baseProducts: [product, ...current.baseProducts.filter((item) => item.productId !== product.productId)],
        };
      }
      case 'deactivateBaseProduct': {
        const { productId } = write.payload as { productId: string };
        return {
          ...current,
          baseProducts: current.baseProducts.map((product) => product.productId === productId ? { ...product, active: false } : product),
        };
      }
      case 'updateSettings':
        return { ...current, settings: write.payload as AppSettings };
      default:
        return current;
    }
  }, data);
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [initialCache] = useState(() => {
    const startedAt = nowMs();
    const cached = readAppDataCache();
    const cachedRenderMs = Math.round(nowMs() - startedAt);
    if (cached) console.info(`[FamilyMenu] cached render data read in ${cachedRenderMs}ms`);
    return { cached, cachedRenderMs };
  });
  const [data, setData] = useState<AppData>(() => initialCache.cached?.data ?? mockData);
  const [loading, setLoading] = useState(() => isGoogleSheetsDataSource && !initialCache.cached);
  const [error, setError] = useState<string>();
  const [pendingWrites, setPendingWrites] = useState<PendingWrite[]>(readPendingWrites);
  const pendingWritesRef = useRef<PendingWrite[]>(pendingWrites);
  const writeGuardRef = useRef(new PendingWriteGuard());
  const [saveStatuses, setSaveStatuses] = useState<Record<string, SaveStatus>>(() => {
    const now = new Date().toISOString();
    return Object.fromEntries(readPendingWrites().map((write) => [
      write.statusKey,
      {
        status: write.status === 'in_flight' ? 'saving' as const : 'local' as const,
        message: pendingWriteMessage(write),
        updatedAt: write.updatedAt || now,
        error: write.error,
      },
    ]));
  });
  const hasDisplayedDataRef = useRef(Boolean(initialCache.cached) || !isGoogleSheetsDataSource);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => {
    if (!isGoogleSheetsDataSource) return { status: 'local', message: 'Работаем с локальными данными' };
    if (initialCache.cached) {
      return {
        status: 'cached',
        message: 'Показаны сохранённые данные',
        lastUpdated: initialCache.cached.meta?.updatedAt,
        cachedRenderMs: initialCache.cachedRenderMs,
      };
    }
    return { status: 'loading', message: 'Данные обновляются...' };
  });

  const persistCachedData = useCallback((nextData: AppData, refreshMs?: number) => {
    writeAppDataCache(nextData, {
      source: isGoogleSheetsDataSource ? 'googleSheets' : 'local',
      refreshMs,
    });
  }, []);

  const updateData = useCallback((updater: (current: AppData) => AppData) => {
    setData((current) => {
      const next = updater(current);
      persistCachedData(next);
      return next;
    });
  }, [persistCachedData]);

  useEffect(() => {
    pendingWritesRef.current = pendingWrites;
  }, [pendingWrites]);

  const updatePendingWrites = useCallback((updater: (current: PendingWrite[]) => PendingWrite[]) => {
    setPendingWrites((current) => {
      const next = updater(current);
      pendingWritesRef.current = next;
      writePendingWrites(next);
      return next;
    });
  }, []);

  const performApiWrite = useCallback((action: WriteAction, payload: unknown, requestId: string): Promise<unknown> => {
    const options = { requestId };
    switch (action) {
      case 'saveSelectedDinner':
        return api.saveSelectedDinner(payload as SelectedDinner, options);
      case 'saveCalendarPlan':
        return api.saveCalendarPlan(payload as CalendarPlanRow, options);
      case 'saveShoppingSession':
        return api.saveShoppingSession(payload as ShoppingSession, options);
      case 'createDish':
        return api.createDish(payload as Dish, options);
      case 'updateDish':
        return api.updateDish(payload as Dish, options);
      case 'deactivateDish':
        return api.deactivateDish(payload as { dishId: string }, options);
      case 'createBaseProduct':
        return api.createBaseProduct(payload as BaseProduct, options);
      case 'updateBaseProduct':
        return api.updateBaseProduct(payload as BaseProduct, options);
      case 'deactivateBaseProduct':
        return api.deactivateBaseProduct(payload as { productId: string }, options);
      case 'updateSettings':
        return api.updateSettings(payload as AppSettings, options);
    }
  }, []);

  const executeWrite = useCallback(async (action: WriteAction, payload: unknown, existing?: PendingWrite): Promise<boolean> => {
    const pending = existing ?? createPendingWrite(action, payload, statusKeyFor(action, payload));
    if (pending.status === 'expired' || !writeGuardRef.current.begin(pending.id)) return false;
    let currentWrite = pending;
    updatePendingWrites((current) => [currentWrite, ...current.filter((write) => write.id !== currentWrite.id)]);
    try {
      const sendAttempt = async () => {
        currentWrite = markWriteAttempt(currentWrite);
        updatePendingWrites((current) => [currentWrite, ...current.filter((write) => write.id !== currentWrite.id)]);
        setSaveStatuses((current) => ({
          ...current,
          [currentWrite.statusKey]: { status: 'saving', message: 'Сохраняем...', updatedAt: currentWrite.updatedAt },
        }));
        return performApiWrite(action, payload, currentWrite.id);
      };
      try {
        await runWithSingleLockRetry(sendAttempt, (error) => {
          const failedWrite = markWriteFailure(currentWrite, error);
          currentWrite = { ...failedWrite, lockRetryCount: currentWrite.lockRetryCount + 1 };
          updatePendingWrites((current) => [currentWrite, ...current.filter((write) => write.id !== currentWrite.id)]);
        });
      } catch (error) {
        currentWrite = markWriteFailure(currentWrite, error);
        updatePendingWrites((current) => [currentWrite, ...current.filter((write) => write.id !== currentWrite.id)]);
        const status = saveStatusForError(error, currentWrite.updatedAt);
        setSaveStatuses((current) => ({ ...current, [currentWrite.statusKey]: status }));
        setSyncStatus({
          status: 'error',
          message: currentWrite.status === 'outcome_unknown' ? 'Результат сохранения неизвестен' : 'Есть локальные изменения',
          detail: status.message,
          lastUpdated: currentWrite.updatedAt,
        });
        return false;
      }

      const updatedAt = new Date().toISOString();
      const remainingWrites = pendingWritesRef.current.filter((write) => write.id !== currentWrite.id);
      updatePendingWrites(() => remainingWrites);
      setSaveStatuses((current) => ({
        ...current,
        [currentWrite.statusKey]: { status: 'saved', message: 'Сохранено на сервере', updatedAt },
      }));
      setSyncStatus(remainingWrites.length ? {
        status: 'error', message: 'Есть локальные изменения', detail: 'Часть записей ещё не синхронизирована.', lastUpdated: updatedAt,
      } : {
        status: isGoogleSheetsDataSource ? 'fresh' : 'local',
        message: isGoogleSheetsDataSource ? `Сохранено ${formatTime(updatedAt)}` : 'Работаем с локальными данными',
        lastUpdated: updatedAt,
      });
      return true;
    } finally {
      writeGuardRef.current.end(pending.id);
    }
  }, [performApiWrite, updatePendingWrites]);

  const refresh = useCallback(async () => {
    const startedAt = nowMs();
    setLoading((current) => current && !hasDisplayedDataRef.current);
    setSyncStatus(isGoogleSheetsDataSource
      ? { status: 'refreshing', message: 'Данные обновляются...' }
      : { status: 'local', message: 'Работаем с локальными данными' });
    setError(undefined);
    try {
      const nextData = await api.getAppData();
      const liveRefreshMs = Math.round(nowMs() - startedAt);
      const writes = pendingWritesRef.current;
      const visibleData = applyPendingWritesToData(nextData, writes);
      setData(visibleData);
      persistCachedData(visibleData, liveRefreshMs);
      hasDisplayedDataRef.current = true;
      const updatedAt = new Date().toISOString();
      console.info(`[FamilyMenu] live refresh completed in ${liveRefreshMs}ms`);
      if (writes.length) {
        setSyncStatus({
          status: 'error',
          message: 'Есть локальные изменения',
          detail: 'Часть записей ещё не сохранена в Google Sheets. Данные показаны из локального кэша.',
          lastUpdated: updatedAt,
          liveRefreshMs,
        });
        return;
      }
      setSyncStatus(isGoogleSheetsDataSource
        ? {
          status: 'fresh',
          message: `Обновлено ${formatTime(updatedAt)}`,
          lastUpdated: updatedAt,
          liveRefreshMs,
        }
        : { status: 'local', message: 'Работаем с локальными данными', liveRefreshMs });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось загрузить данные';
      console.warn('[FamilyMenu] live refresh failed', err);
      setSyncStatus({
        status: 'error',
        message: initialCache.cached ? 'Ошибка обновления' : 'Не удалось загрузить данные',
        detail: initialCache.cached ? 'Показаны сохранённые данные' : message,
        lastUpdated: initialCache.cached?.meta?.updatedAt,
      });
      if (!hasDisplayedDataRef.current) setError(message);
    } finally {
      setLoading(false);
    }
  }, [initialCache.cached, persistCachedData]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const retryPendingWrite = useCallback(async (id: string): Promise<boolean> => {
    const pending = pendingWritesRef.current.find((write) => write.id === id);
    if (!pending) return true;
    return executeWrite(pending.action, pending.payload, pending);
  }, [executeWrite]);

  const retryPendingWrites = useCallback(async () => {
    const writes = [...pendingWritesRef.current];
    for (const write of writes) {
      if (write.status !== 'expired') await executeWrite(write.action, write.payload, write);
    }
  }, [executeWrite]);

  const discardPendingWrite = useCallback((id: string) => {
    if (writeGuardRef.current.isActive(id)) return;
    updatePendingWrites((current) => current.filter((write) => write.id !== id));
  }, [updatePendingWrites]);

  const saveSelectedDinner = useCallback(async (selection: SelectedDinner) => {
    updateData((current) => ({
      ...current,
      selectedDinners: [selection, ...current.selectedDinners.filter((item) => item.date !== selection.date)],
    }));
    return executeWrite('saveSelectedDinner', selection);
  }, [executeWrite, updateData]);

  const saveCalendarPlan = useCallback(async (row: CalendarPlanRow) => {
    updateData((current) => ({
      ...current,
      calendarPlan: [row, ...current.calendarPlan.filter((item) => item.date !== row.date)],
    }));
    return executeWrite('saveCalendarPlan', row);
  }, [executeWrite, updateData]);

  const saveShoppingSession = useCallback(async (session: ShoppingSession) => {
    updateData((current) => ({
      ...current,
      shoppingSessions: [session, ...current.shoppingSessions].slice(0, 20),
    }));
    return executeWrite('saveShoppingSession', session);
  }, [executeWrite, updateData]);

  const saveDish = useCallback(async (dish: Dish) => {
    const exists = data.dishes.some((item) => item.dishId === dish.dishId);
    updateData((current) => ({
      ...current,
      dishes: exists
        ? current.dishes.map((item) => item.dishId === dish.dishId ? dish : item)
        : [dish, ...current.dishes],
    }));
    return executeWrite(exists ? 'updateDish' : 'createDish', dish);
  }, [data.dishes, executeWrite, updateData]);

  const deactivateDish = useCallback(async (dishId: string) => {
    updateData((current) => ({
      ...current,
      dishes: current.dishes.map((dish) => dish.dishId === dishId ? { ...dish, active: false, updatedAt: new Date().toISOString() } : dish),
    }));
    return executeWrite('deactivateDish', { dishId });
  }, [executeWrite, updateData]);

  const saveBaseProduct = useCallback(async (product: BaseProduct) => {
    const exists = data.baseProducts.some((item) => item.productId === product.productId);
    updateData((current) => ({
      ...current,
      baseProducts: exists
        ? current.baseProducts.map((item) => item.productId === product.productId ? product : item)
        : [product, ...current.baseProducts],
    }));
    return executeWrite(exists ? 'updateBaseProduct' : 'createBaseProduct', product);
  }, [data.baseProducts, executeWrite, updateData]);

  const deactivateBaseProduct = useCallback(async (productId: string) => {
    updateData((current) => ({
      ...current,
      baseProducts: current.baseProducts.map((product) => product.productId === productId ? { ...product, active: false, updatedAt: new Date().toISOString() } : product),
    }));
    return executeWrite('deactivateBaseProduct', { productId });
  }, [executeWrite, updateData]);

  const updateSettings = useCallback(async (settings: AppSettings) => {
    updateData((current) => ({ ...current, settings }));
    return executeWrite('updateSettings', settings);
  }, [executeWrite, updateData]);

  const value = useMemo(() => ({
    data,
    loading,
    error,
    syncStatus,
    saveStatuses,
    pendingWrites,
    refresh,
    retryPendingWrite,
    retryPendingWrites,
    discardPendingWrite,
    saveSelectedDinner,
    saveCalendarPlan,
    saveShoppingSession,
    saveDish,
    deactivateDish,
    saveBaseProduct,
    deactivateBaseProduct,
    updateSettings,
  }), [data, loading, error, syncStatus, saveStatuses, pendingWrites, refresh, retryPendingWrite, retryPendingWrites, discardPendingWrite, saveSelectedDinner, saveCalendarPlan, saveShoppingSession, saveDish, deactivateDish, saveBaseProduct, deactivateBaseProduct, updateSettings]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState must be used inside AppStateProvider');
  return context;
}

function pendingWriteMessage(write: PendingWrite): string {
  if (write.status === 'expired') return 'Локальное изменение старше 30 дней. Повторите или удалите его вручную.';
  if (write.status === 'outcome_unknown') return 'Ответ сервера не получен. Результат сохранения неизвестен.';
  if (write.status === 'retryable_lock') return 'Данные обновляются другим пользователем. Можно повторить.';
  if (write.status === 'failed') return write.error || 'Изменение не синхронизировано.';
  return 'Сохраняем...';
}

function saveStatusForError(error: unknown, updatedAt: string): SaveStatus {
  if (error instanceof ApiTimeoutError) {
    return { status: 'error', message: 'Сервер не ответил. Результат сохранения неизвестен.', updatedAt, error: error.message };
  }
  if (error instanceof ApiNetworkError) {
    return { status: 'error', message: 'Связь прервана. Результат сохранения неизвестен.', updatedAt, error: error.message };
  }
  if (error instanceof ApiLockTimeoutError) {
    return { status: 'error', message: 'Данные обновляются другим пользователем. Повторите позже.', updatedAt, error: error.message };
  }
  if (error instanceof ApiResponseError) {
    return { status: 'error', message: `Сервер отклонил изменение: ${error.message}`, updatedAt, error: error.message };
  }
  return { status: 'error', message: 'Не удалось сохранить изменение.', updatedAt, error: error instanceof Error ? error.message : undefined };
}
