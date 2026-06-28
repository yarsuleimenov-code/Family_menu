import type { AppData } from '../types/app';
import type { BaseProduct } from '../types/product';
import type { Dish } from '../types/dish';
import type { CalendarPlanRow, SelectedDinner } from '../types/plan';
import type { ShoppingSession } from '../types/shopping';
import type { AppSettings } from '../types/settings';
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
  getAppData: async () => normalizeAppData(await callApi<AppData>('getAppData')),
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

function normalizeAppData(data: AppData): AppData {
  return {
    ...data,
    calendarPlan: data.calendarPlan.map((row) => ({ ...row, date: coerceIsoDate(row.date) })),
    selectedDinners: data.selectedDinners.map(normalizeSelection),
    shoppingSessions: data.shoppingSessions.map((session) => ({
      ...session,
      dateFrom: coerceIsoDate(session.dateFrom),
      dateTo: coerceIsoDate(session.dateTo),
      selectedDishes: session.selectedDishes.map(normalizeSelection),
    })),
  };
}

function normalizeSelection(selection: SelectedDinner): SelectedDinner {
  return { ...selection, date: coerceIsoDate(selection.date) };
}
