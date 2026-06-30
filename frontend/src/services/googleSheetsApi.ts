import type { AppData } from '../types/app';
import type { BaseProduct } from '../types/product';
import type { Dish } from '../types/dish';
import type { CalendarPlanRow, SelectedDinner } from '../types/plan';
import type { ShoppingSession } from '../types/shopping';
import type { AppSettings } from '../types/settings';
import { mockData } from '../data/mockData';
import { coerceIsoDate } from '../utils/dates';

type ApiAction =
  | 'getAppData'
  | 'saveSelectedDinner'
  | 'saveCalendarPlan'
  | 'saveShoppingSession'
  | 'createDish'
  | 'updateDish'
  | 'deactivateDish'
  | 'createBaseProduct'
  | 'updateBaseProduct'
  | 'deactivateBaseProduct'
  | 'updateSettings';

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

type PartialAppData = Partial<Omit<AppData, 'settings'>> & {
  settings?: Partial<AppSettings>;
};

const endpoint = import.meta.env.VITE_APPS_SCRIPT_ENDPOINT as string | undefined;
const apiToken = import.meta.env.VITE_API_TOKEN as string | undefined;

async function callApi<T>(action: ApiAction, payload?: unknown): Promise<T> {
  if (!endpoint) throw new Error('Apps Script endpoint не настроен');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token: apiToken, payload }),
  });
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!envelope.ok) throw new Error(envelope.error || 'Ошибка API');
  return envelope.data as T;
}

export const googleSheetsApi = {
  getAppData: async () => normalizeAppData(await callApi<PartialAppData>('getAppData')),
  saveSelectedDinner: (payload: SelectedDinner) => callApi<SelectedDinner>('saveSelectedDinner', payload),
  saveCalendarPlan: (payload: CalendarPlanRow) => callApi<CalendarPlanRow>('saveCalendarPlan', payload),
  saveShoppingSession: (payload: ShoppingSession) => callApi<ShoppingSession>('saveShoppingSession', payload),
  createDish: (payload: Dish) => callApi<Dish>('createDish', payload),
  updateDish: (payload: Dish) => callApi<Dish>('updateDish', payload),
  deactivateDish: (payload: { dishId: string }) => callApi<{ dishId: string }>('deactivateDish', payload),
  createBaseProduct: (payload: BaseProduct) => callApi<BaseProduct>('createBaseProduct', payload),
  updateBaseProduct: (payload: BaseProduct) => callApi<BaseProduct>('updateBaseProduct', payload),
  deactivateBaseProduct: (payload: { productId: string }) => callApi<{ productId: string }>('deactivateBaseProduct', payload),
  updateSettings: (payload: AppSettings) => callApi<AppSettings>('updateSettings', payload),
};

function normalizeAppData(data: PartialAppData | undefined): AppData {
  const safeData = data ?? {};
  return {
    dishes: asArray(safeData.dishes),
    baseProducts: asArray(safeData.baseProducts),
    calendarPlan: asArray(safeData.calendarPlan).map((row) => ({ ...row, date: coerceIsoDate(row.date) })),
    selectedDinners: asArray(safeData.selectedDinners).map(normalizeSelection),
    shoppingSessions: asArray(safeData.shoppingSessions).map((session) => ({
      ...session,
      dateFrom: coerceIsoDate(session.dateFrom),
      dateTo: coerceIsoDate(session.dateTo),
      selectedDishes: asArray(session.selectedDishes).map(normalizeSelection),
    })),
    settings: {
      ...mockData.settings,
      ...safeData.settings,
      dataSource: 'googleSheets',
      forbiddenProducts: asArray(safeData.settings?.forbiddenProducts ?? mockData.settings.forbiddenProducts),
    },
    loadedAt: safeData.loadedAt || new Date().toISOString(),
  };
}

function asArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeSelection(selection: SelectedDinner): SelectedDinner {
  return { ...selection, date: coerceIsoDate(selection.date) };
}
