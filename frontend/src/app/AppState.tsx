import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AppData } from '../types/app';
import type { Dish } from '../types/dish';
import type { BaseProduct } from '../types/product';
import type { CalendarPlanRow, SelectedDinner } from '../types/plan';
import type { ShoppingSession } from '../types/shopping';
import type { AppSettings } from '../types/settings';
import { api } from '../services/api';
import { mockData } from '../data/mockData';

interface AppStateContextValue {
  data: AppData;
  loading: boolean;
  error?: string;
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

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(mockData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setData(await api.getAppData());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveSelectedDinner = useCallback(async (selection: SelectedDinner) => {
    setData((current) => ({
      ...current,
      selectedDinners: [selection, ...current.selectedDinners.filter((item) => item.date !== selection.date)],
    }));
    await api.saveSelectedDinner(selection);
  }, []);

  const saveCalendarPlan = useCallback(async (row: CalendarPlanRow) => {
    setData((current) => ({
      ...current,
      calendarPlan: [row, ...current.calendarPlan.filter((item) => item.date !== row.date)],
    }));
    await api.saveCalendarPlan(row);
  }, []);

  const saveShoppingSession = useCallback(async (session: ShoppingSession) => {
    setData((current) => ({
      ...current,
      shoppingSessions: [session, ...current.shoppingSessions].slice(0, 20),
    }));
    await api.saveShoppingSession(session);
  }, []);

  const saveDish = useCallback(async (dish: Dish) => {
    const exists = data.dishes.some((item) => item.dishId === dish.dishId);
    setData((current) => ({
      ...current,
      dishes: exists
        ? current.dishes.map((item) => item.dishId === dish.dishId ? dish : item)
        : [dish, ...current.dishes],
    }));
    if (exists) await api.updateDish(dish);
    else await api.createDish(dish);
  }, [data.dishes]);

  const deactivateDish = useCallback(async (dishId: string) => {
    setData((current) => ({
      ...current,
      dishes: current.dishes.map((dish) => dish.dishId === dishId ? { ...dish, active: false, updatedAt: new Date().toISOString() } : dish),
    }));
    await api.deactivateDish({ dishId });
  }, []);

  const saveBaseProduct = useCallback(async (product: BaseProduct) => {
    const exists = data.baseProducts.some((item) => item.productId === product.productId);
    setData((current) => ({
      ...current,
      baseProducts: exists
        ? current.baseProducts.map((item) => item.productId === product.productId ? product : item)
        : [product, ...current.baseProducts],
    }));
    if (exists) await api.updateBaseProduct(product);
    else await api.createBaseProduct(product);
  }, [data.baseProducts]);

  const deactivateBaseProduct = useCallback(async (productId: string) => {
    setData((current) => ({
      ...current,
      baseProducts: current.baseProducts.map((product) => product.productId === productId ? { ...product, active: false, updatedAt: new Date().toISOString() } : product),
    }));
    await api.deactivateBaseProduct({ productId });
  }, []);

  const updateSettings = useCallback(async (settings: AppSettings) => {
    setData((current) => ({ ...current, settings }));
    await api.updateSettings(settings);
  }, []);

  const value = useMemo(() => ({
    data,
    loading,
    error,
    refresh,
    saveSelectedDinner,
    saveCalendarPlan,
    saveShoppingSession,
    saveDish,
    deactivateDish,
    saveBaseProduct,
    deactivateBaseProduct,
    updateSettings,
  }), [data, loading, error, refresh, saveSelectedDinner, saveCalendarPlan, saveShoppingSession, saveDish, deactivateDish, saveBaseProduct, deactivateBaseProduct, updateSettings]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState must be used inside AppStateProvider');
  return context;
}
