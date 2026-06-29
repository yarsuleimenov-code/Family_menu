import type { AppData } from '../types/app';

export const APP_DATA_CACHE_KEY = 'familyMenu.appData.v1';
export const APP_DATA_META_KEY = 'familyMenu.appDataMeta.v1';

export interface AppDataCacheMeta {
  version: 1;
  updatedAt: string;
  source: 'googleSheets' | 'local';
  refreshMs?: number;
  cachedRenderMs?: number;
}

export interface CachedAppData {
  data: AppData;
  meta?: AppDataCacheMeta;
}

export function readAppDataCache(): CachedAppData | null {
  try {
    const rawData = localStorage.getItem(APP_DATA_CACHE_KEY);
    if (!rawData) return null;
    const rawMeta = localStorage.getItem(APP_DATA_META_KEY);
    return {
      data: JSON.parse(rawData) as AppData,
      meta: rawMeta ? (JSON.parse(rawMeta) as AppDataCacheMeta) : undefined,
    };
  } catch {
    return null;
  }
}

export function writeAppDataCache(data: AppData, meta: Omit<AppDataCacheMeta, 'version' | 'updatedAt'>): void {
  try {
    const nextMeta: AppDataCacheMeta = {
      version: 1,
      updatedAt: new Date().toISOString(),
      ...meta,
    };
    localStorage.setItem(APP_DATA_CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(APP_DATA_META_KEY, JSON.stringify(nextMeta));
  } catch {
    // Cache is an optimization; storage quota or private mode must not break the app.
  }
}
