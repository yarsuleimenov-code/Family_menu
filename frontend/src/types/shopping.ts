import type { SelectedDinner } from './plan';

export type ShoppingItemStatus = 'to_buy' | 'purchased' | 'skipped';
export type ShoppingSessionStatus = 'active' | 'completed' | 'archived';

export interface ShoppingItem {
  itemId: string;
  key: string;
  productId?: string;
  productName: string;
  category: string;
  quantityText: string;
  unit?: string;
  usedForDishes: string[];
  replacement?: string;
  comment?: string;
  pricePerUnit?: number;
  estimatedPrice?: number;
  status: ShoppingItemStatus;
  source?: 'generated' | 'manual';
}

export interface ShoppingSession {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  dateFrom: string;
  dateTo: string;
  selectedDishes: SelectedDinner[];
  includeBaseProducts: boolean;
  shoppingList: ShoppingItem[];
  estimatedTotal: number;
  status: ShoppingSessionStatus;
  completedAt?: string;
  note?: string;
}
