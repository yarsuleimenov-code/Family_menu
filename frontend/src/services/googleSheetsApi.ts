import type { AppData } from '../types/app';
import type { BaseProduct } from '../types/product';
import type { Dish } from '../types/dish';
import type { CalendarPlanRow, SelectedDinner } from '../types/plan';
import type { ShoppingSession } from '../types/shopping';
import { normalizeShoppingSession } from './shoppingSessions';
import type { AppSettings } from '../types/settings';
import { mockData } from '../data/mockData';
import { coerceIsoDate } from '../utils/dates';
import { ApiLockTimeoutError, ApiNetworkError, ApiProtocolError, ApiResponseError, ApiTimeoutError } from './apiErrors';

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
  error?: string | { code?: string; message?: string; retryable?: boolean };
}

type PartialAppData = Partial<Omit<AppData, 'settings'>> & {
  settings?: Partial<AppSettings>;
};

const endpoint = import.meta.env.VITE_APPS_SCRIPT_ENDPOINT as string | undefined;
const apiToken = import.meta.env.VITE_API_TOKEN as string | undefined;
const configuredTimeout = Number(import.meta.env.VITE_API_TIMEOUT_MS);
export const API_TIMEOUT_MS = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 15_000;

interface ApiCallOptions {
  requestId?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const mutationActions = new Set<ApiAction>([
  'saveSelectedDinner', 'saveCalendarPlan', 'saveShoppingSession', 'createDish', 'updateDish',
  'deactivateDish', 'createBaseProduct', 'updateBaseProduct', 'deactivateBaseProduct', 'updateSettings',
]);

export async function callApi<T>(action: ApiAction, payload?: unknown, options: ApiCallOptions = {}): Promise<T> {
  if (!endpoint) throw new Error('Apps Script endpoint не настроен');
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? API_TIMEOUT_MS;
  let abortSource: 'timeout' | 'caller' | undefined;
  const timer = globalThis.setTimeout(() => {
    if (abortSource) return;
    abortSource = 'timeout';
    controller.abort();
  }, timeoutMs);
  const abortFromCaller = () => {
    if (abortSource) return;
    abortSource = 'caller';
    globalThis.clearTimeout(timer);
    controller.abort();
  };
  options.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const isMutation = mutationActions.has(action);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: apiToken, requestId: options.requestId, payload }),
      signal: controller.signal,
    });
    if (!response.ok) throw new ApiResponseError(`HTTP_${response.status}`, `Ошибка HTTP ${response.status}`);
    let envelope: ApiEnvelope<T>;
    try {
      envelope = await response.json() as ApiEnvelope<T>;
    } catch {
      throw new ApiProtocolError();
    }
    if (!envelope || typeof envelope.ok !== 'boolean') throw new ApiProtocolError();
    if (!envelope.ok) {
      const apiError = typeof envelope.error === 'string'
        ? { code: 'API_ERROR', message: envelope.error, retryable: false }
        : envelope.error ?? {};
      if (apiError.code === 'LOCK_TIMEOUT') throw new ApiLockTimeoutError(apiError.message);
      throw new ApiResponseError(apiError.code || 'API_ERROR', apiError.message || 'Ошибка API', Boolean(apiError.retryable));
    }
    if (!('data' in envelope)) throw new ApiProtocolError();
    return envelope.data as T;
  } catch (error) {
    if (error instanceof ApiResponseError || error instanceof ApiProtocolError) throw error;
    if (abortSource === 'caller') throw error;
    if (abortSource === 'timeout') throw new ApiTimeoutError('Сервер не ответил вовремя', isMutation);
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiNetworkError('Нет связи с сервером', isMutation);
  } finally {
    globalThis.clearTimeout(timer);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}

export interface MutationOptions { requestId: string }

export const googleSheetsApi = {
  getAppData: async () => normalizeAppData(await callApi<PartialAppData>('getAppData')),
  saveSelectedDinner: (payload: SelectedDinner, options: MutationOptions) => callApi<SelectedDinner>('saveSelectedDinner', payload, options),
  saveCalendarPlan: (payload: CalendarPlanRow, options: MutationOptions) => callApi<CalendarPlanRow>('saveCalendarPlan', payload, options),
  saveShoppingSession: (payload: ShoppingSession, options: MutationOptions) => callApi<ShoppingSession>('saveShoppingSession', payload, options),
  createDish: (payload: Dish, options: MutationOptions) => callApi<Dish>('createDish', payload, options),
  updateDish: (payload: Dish, options: MutationOptions) => callApi<Dish>('updateDish', payload, options),
  deactivateDish: (payload: { dishId: string }, options: MutationOptions) => callApi<{ dishId: string }>('deactivateDish', payload, options),
  createBaseProduct: (payload: BaseProduct, options: MutationOptions) => callApi<BaseProduct>('createBaseProduct', payload, options),
  updateBaseProduct: (payload: BaseProduct, options: MutationOptions) => callApi<BaseProduct>('updateBaseProduct', payload, options),
  deactivateBaseProduct: (payload: { productId: string }, options: MutationOptions) => callApi<{ productId: string }>('deactivateBaseProduct', payload, options),
  updateSettings: (payload: AppSettings, options: MutationOptions) => callApi<AppSettings>('updateSettings', payload, options),
};

function normalizeAppData(data: PartialAppData | undefined): AppData {
  const safeData = data ?? {};
  return {
    dishes: asArray(safeData.dishes),
    baseProducts: asArray(safeData.baseProducts),
    calendarPlan: asArray(safeData.calendarPlan).map((row) => ({ ...row, date: coerceIsoDate(row.date) })),
    selectedDinners: asArray(safeData.selectedDinners).map(normalizeSelection),
    shoppingSessions: asArray(safeData.shoppingSessions).map((session) => normalizeShoppingSession({
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
