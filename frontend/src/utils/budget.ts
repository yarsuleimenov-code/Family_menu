import type { ShoppingItem } from '../types/shopping';

export function sumShoppingItems(items: ShoppingItem[]): number {
  return items.reduce((sum, item) => sum + (item.estimatedPrice || 0), 0);
}

export function formatTenge(value?: number): string {
  if (!value) return 'нет цены';
  return new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(value) + ' ₸';
}

export function isOverBudget(total: number, weeklyBudget: number): boolean {
  return total > weeklyBudget * 1.05;
}
