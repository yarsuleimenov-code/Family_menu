import type { Dish, DishFilters } from '../types/dish';
import type { SelectedDinner } from '../types/plan';
import { normalizeKey } from '../utils/normalize';

export interface RandomDishResult {
  dish?: Dish;
  reasons: string[];
  rejectedCount: number;
}

export function hasForbiddenProducts(dish: Dish, forbiddenProducts: string[]): boolean {
  const text = productSearchText([
    dish.dishName,
    dish.tags.join(' '),
    ...dish.ingredients.map((ingredient) => ingredient.productName),
  ].join(' '));
  return forbiddenProducts.some((item) => {
    const token = productSearchToken(item);
    return token && text.includes(` ${token} `);
  });
}

function productSearchText(value: unknown): string {
  return ` ${normalizeKey(value).replace(/[^a-zа-я0-9]+/g, ' ')} `;
}

function productSearchToken(value: unknown): string {
  return normalizeKey(value).replace(/[^a-zа-я0-9]+/g, ' ').trim();
}

export function filterDishes(
  dishes: Dish[],
  filters: DishFilters,
  forbiddenProducts: string[],
  weekSelections: SelectedDinner[],
): Dish[] {
  const selectedThisWeek = new Set(weekSelections.map((selection) => selection.dishId));
  const search = normalizeKey(filters.search);

  return dishes.filter((dish) => {
    if (filters.activeOnly !== false && !dish.active) return false;
    if (hasForbiddenProducts(dish, forbiddenProducts)) return false;
    if (selectedThisWeek.has(dish.dishId)) return false;
    if (search && !normalizeKey(`${dish.dishName} ${dish.tags.join(' ')}`).includes(search)) return false;
    if (filters.quick && (dish.cookingTimeMin || 999) > 45) return false;
    if (filters.budget && dish.budgetLevel !== 'low') return false;
    if (filters.leftovers && !dish.leftovers) return false;
    if (filters.protein && normalizeKey(dish.mainProtein) !== normalizeKey(filters.protein)) return false;
    if (filters.noOven && dish.tags.some((tag) => normalizeKey(tag).includes('духовк'))) return false;
    if (filters.maxTime && (dish.cookingTimeMin || 999) > filters.maxTime) return false;
    if (filters.dayType && dish.bestDayType !== 'any' && dish.bestDayType !== filters.dayType) return false;
    return true;
  });
}

export function randomDish(
  dishes: Dish[],
  filters: DishFilters,
  forbiddenProducts: string[],
  weekSelections: SelectedDinner[],
): RandomDishResult {
  const eligible = filterDishes(dishes, filters, forbiddenProducts, weekSelections);
  const rejectedCount = dishes.length - eligible.length;
  if (!eligible.length) return { reasons: ['Нет подходящих активных блюд'], rejectedCount };

  const dish = eligible[Math.floor(Math.random() * eligible.length)];
  const reasons = [
    dish.cookingTimeMin && dish.cookingTimeMin <= 45 ? 'быстрое' : '',
    dish.budgetLevel === 'low' ? 'бюджетное' : '',
    dish.leftovers ? 'есть остатки' : '',
    dish.bestDayType === 'weekday' ? 'подходит для буднего дня' : '',
  ].filter(Boolean);

  return { dish, reasons, rejectedCount };
}
