import type { AppData } from '../types/app';
import type { BaseProduct } from '../types/product';
import type { Dish } from '../types/dish';
import type { CalendarPlanRow, SelectedDinner } from '../types/plan';
import type { ShoppingSession } from '../types/shopping';
import type { AppSettings } from '../types/settings';
import { mockData } from '../data/mockData';
import { readStorage, writeStorage } from './storage';
import { googleSheetsApi } from './googleSheetsApi';
import type { MutationOptions } from './googleSheetsApi';

const APP_DATA_KEY = 'app-data';
const dataSource = import.meta.env.VITE_DATA_SOURCE as string | undefined;
export const isGoogleSheetsDataSource = dataSource === 'googleSheets';

export interface DataApi {
  getAppData(): Promise<AppData>;
  saveSelectedDinner(payload: SelectedDinner, options: MutationOptions): Promise<SelectedDinner>;
  saveCalendarPlan(payload: CalendarPlanRow, options: MutationOptions): Promise<CalendarPlanRow>;
  saveShoppingSession(payload: ShoppingSession, options: MutationOptions): Promise<ShoppingSession>;
  createDish(payload: Dish, options: MutationOptions): Promise<Dish>;
  updateDish(payload: Dish, options: MutationOptions): Promise<Dish>;
  deactivateDish(payload: { dishId: string }, options: MutationOptions): Promise<{ dishId: string }>;
  createBaseProduct(payload: BaseProduct, options: MutationOptions): Promise<BaseProduct>;
  updateBaseProduct(payload: BaseProduct, options: MutationOptions): Promise<BaseProduct>;
  deactivateBaseProduct(payload: { productId: string }, options: MutationOptions): Promise<{ productId: string }>;
  updateSettings(payload: AppSettings, options: MutationOptions): Promise<AppSettings>;
}

function readLocalData(): AppData {
  return readStorage(APP_DATA_KEY, mockData);
}

function writeLocalData(data: AppData): void {
  writeStorage(APP_DATA_KEY, { ...data, loadedAt: new Date().toISOString() });
}

const localApi: DataApi = {
  async getAppData() {
    const data = readLocalData();
    writeLocalData(data);
    return data;
  },
  async saveSelectedDinner(payload) {
    const data = readLocalData();
    data.selectedDinners = [payload, ...data.selectedDinners.filter((item) => item.date !== payload.date)];
    writeLocalData(data);
    return payload;
  },
  async saveCalendarPlan(payload) {
    const data = readLocalData();
    data.calendarPlan = [payload, ...data.calendarPlan.filter((item) => item.date !== payload.date)];
    writeLocalData(data);
    return payload;
  },
  async saveShoppingSession(payload) {
    const data = readLocalData();
    data.shoppingSessions = [payload, ...data.shoppingSessions.filter((item) => item.sessionId !== payload.sessionId)].slice(0, 20);
    writeLocalData(data);
    return payload;
  },
  async createDish(payload) {
    const data = readLocalData();
    data.dishes = [payload, ...data.dishes];
    writeLocalData(data);
    return payload;
  },
  async updateDish(payload) {
    const data = readLocalData();
    data.dishes = data.dishes.map((dish) => dish.dishId === payload.dishId ? payload : dish);
    writeLocalData(data);
    return payload;
  },
  async deactivateDish(payload) {
    const data = readLocalData();
    data.dishes = data.dishes.map((dish) => dish.dishId === payload.dishId ? { ...dish, active: false, updatedAt: new Date().toISOString() } : dish);
    writeLocalData(data);
    return payload;
  },
  async createBaseProduct(payload) {
    const data = readLocalData();
    data.baseProducts = [payload, ...data.baseProducts];
    writeLocalData(data);
    return payload;
  },
  async updateBaseProduct(payload) {
    const data = readLocalData();
    data.baseProducts = data.baseProducts.map((product) => product.productId === payload.productId ? payload : product);
    writeLocalData(data);
    return payload;
  },
  async deactivateBaseProduct(payload) {
    const data = readLocalData();
    data.baseProducts = data.baseProducts.map((product) => product.productId === payload.productId ? { ...product, active: false, updatedAt: new Date().toISOString() } : product);
    writeLocalData(data);
    return payload;
  },
  async updateSettings(payload) {
    const data = readLocalData();
    data.settings = payload;
    writeLocalData(data);
    return payload;
  },
};

export const api: DataApi = isGoogleSheetsDataSource ? googleSheetsApi : localApi;
