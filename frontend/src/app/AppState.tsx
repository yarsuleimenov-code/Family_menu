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

type SyncStatusType = 'loading' | 'cached' | 'refreshing' | 'fresh' | 'error' | 'local';

export interface SyncStatus {
  status: SyncStatusType;
  message: string;
  lastUpdated?: string;
  detail?: string;
  cachedRenderMs?: number;
  liveRefreshMs?: number;
}

interface AppStateContextValue {
  data: AppData;
  loading: boolean;
  error?: string;
  syncStatus: SyncStatus;
  refresh: () => Promise<void>;
  saveSelectedDinner: (selection: SelectedDinner) => Promise<void>;
  saveCalendarPlan: (row: CalendarPlanRow) => Promise<void>;
  saveShoppingSession: (session: ShoppingSession) => Promise<void>;
  saveDish: (dish: Dish) => Promise<void>;
  deactivateDish: (dishId: string) => Promise<void>;
  saveBaseProduct: (product: BaseProduct) => Promise<void>;
  deactivateBaseProduct: (productId: string) => Promise<void>;
  updateSettings: (settings: AppSettings) => Promise<void>;
}

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

function nowMs(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
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
      setData(nextData);
      persistCachedData(nextData, liveRefreshMs);
      hasDisplayedDataRef.current = true;
      const updatedAt = new Date().toISOString();
      console.info(`[FamilyMenu] live refresh completed in ${liveRefreshMs}ms`);
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

  const saveSelectedDinner = useCallback(async (selection: SelectedDinner) => {
    updateData((current) => ({
      ...current,
      selectedDinners: [selection, ...current.selectedDinners.filter((item) => item.date !== selection.date)],
    }));
    await api.saveSelectedDinner(selection);
  }, [updateData]);

  const saveCalendarPlan = useCallback(async (row: CalendarPlanRow) => {
    updateData((current) => ({
      ...current,
      calendarPlan: [row, ...current.calendarPlan.filter((item) => item.date !== row.date)],
    }));
    await api.saveCalendarPlan(row);
  }, [updateData]);

  const saveShoppingSession = useCallback(async (session: ShoppingSession) => {
    updateData((current) => ({
      ...current,
      shoppingSessions: [session, ...current.shoppingSessions].slice(0, 20),
    }));
    await api.saveShoppingSession(session);
  }, [updateData]);

  const saveDish = useCallback(async (dish: Dish) => {
    const exists = data.dishes.some((item) => item.dishId === dish.dishId);
    updateData((current) => ({
      ...current,
      dishes: exists
        ? current.dishes.map((item) => item.dishId === dish.dishId ? dish : item)
        : [dish, ...current.dishes],
    }));
    if (exists) await api.updateDish(dish);
    else await api.createDish(dish);
  }, [data.dishes, updateData]);

  const deactivateDish = useCallback(async (dishId: string) => {
    updateData((current) => ({
      ...current,
      dishes: current.dishes.map((dish) => dish.dishId === dishId ? { ...dish, active: false, updatedAt: new Date().toISOString() } : dish),
    }));
    await api.deactivateDish({ dishId });
  }, [updateData]);

  const saveBaseProduct = useCallback(async (product: BaseProduct) => {
    const exists = data.baseProducts.some((item) => item.productId === product.productId);
    updateData((current) => ({
      ...current,
      baseProducts: exists
        ? current.baseProducts.map((item) => item.productId === product.productId ? product : item)
        : [product, ...current.baseProducts],
    }));
    if (exists) await api.updateBaseProduct(product);
    else await api.createBaseProduct(product);
  }, [data.baseProducts, updateData]);

  const deactivateBaseProduct = useCallback(async (productId: string) => {
    updateData((current) => ({
      ...current,
      baseProducts: current.baseProducts.map((product) => product.productId === productId ? { ...product, active: false, updatedAt: new Date().toISOString() } : product),
    }));
    await api.deactivateBaseProduct({ productId });
  }, [updateData]);

  const updateSettings = useCallback(async (settings: AppSettings) => {
    updateData((current) => ({ ...current, settings }));
    await api.updateSettings(settings);
  }, [updateData]);

  const value = useMemo(() => ({
    data,
    loading,
    error,
    syncStatus,
    refresh,
    saveSelectedDinner,
    saveCalendarPlan,
    saveShoppingSession,
    saveDish,
    deactivateDish,
    saveBaseProduct,
    deactivateBaseProduct,
    updateSettings,
  }), [data, loading, error, syncStatus, refresh, saveSelectedDinner, saveCalendarPlan, saveShoppingSession, saveDish, deactivateDish, saveBaseProduct, deactivateBaseProduct, updateSettings]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState must be used inside AppStateProvider');
  return context;
}
