import type { SelectedDinner } from './plan';

export type ShoppingItemStatus = 'to_buy' | 'in_cart' | 'have_at_home' | 'skip';

export interface ShoppingItem {
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
}

export interface ShoppingSession {
  sessionId: string;
  createdAt: string;
  dateFrom: string;
  dateTo: string;
  selectedDishes: SelectedDinner[];
  includeBaseProducts: boolean;
  shoppingList: ShoppingItem[];
  estimatedTotal: number;
  note?: string;
}
