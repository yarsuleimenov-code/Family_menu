import type { BaseProduct } from '../types/product';
import type { SelectedDinner } from '../types/plan';
import type { ShoppingItem, ShoppingItemStatus } from '../types/shopping';
import type { Dish } from '../types/dish';
import { normalizeKey } from '../utils/normalize';

const DEFAULT_STATUS: ShoppingItemStatus = 'to_buy';

export function buildShoppingList(
  selectedDinners: SelectedDinner[],
  dishes: Dish[],
  baseProducts: BaseProduct[],
  includeBaseProducts: boolean,
  statusByKey: Record<string, ShoppingItemStatus> = {},
): ShoppingItem[] {
  const dishById = new Map(dishes.map((dish) => [dish.dishId, dish]));
  const priceByProduct = new Map(baseProducts.filter((product) => product.active).map((product) => [normalizeKey(product.productName), product]));
  const merged = new Map<string, ShoppingItem>();

  selectedDinners.forEach((selection) => {
    const dish = dishById.get(selection.dishId);
    if (!dish) return;
    dish.ingredients.forEach((ingredient) => {
      const priceSource = priceByProduct.get(normalizeKey(ingredient.productName));
      addItem(merged, {
        key: normalizeKey(ingredient.productName),
        productId: ingredient.productId,
        productName: ingredient.productName,
        category: ingredient.category || 'прочее',
        quantityText: formatQuantity(ingredient.quantity, ingredient.unit),
        unit: ingredient.unit,
        usedForDishes: [dish.dishName],
        replacement: ingredient.replacement,
        comment: ingredient.comment || priceSource?.storeNote,
        pricePerUnit: priceSource?.pricePerUnit,
        estimatedPrice: estimateIngredientPrice(ingredient.quantity, ingredient.unit, priceSource),
        status: DEFAULT_STATUS,
      });
    });
  });

  if (includeBaseProducts) {
    baseProducts.filter((product) => product.active && product.includeByDefault).forEach((product) => {
      addItem(merged, {
        key: normalizeKey(product.productName),
        productId: product.productId,
        productName: product.productName,
        category: product.category || 'прочее',
        quantityText: formatQuantity(product.defaultQuantity, product.unit),
        unit: product.unit,
        usedForDishes: ['Базовые покупки'],
        comment: product.storeNote,
        pricePerUnit: product.pricePerUnit,
        estimatedPrice: product.estimatedPackagePrice || estimatePrice(product.defaultQuantity, product.pricePerUnit),
        status: DEFAULT_STATUS,
      });
    });
  }

  return Array.from(merged.values()).map((item) => ({
    ...item,
    status: statusByKey[item.key] || item.status,
  })).sort((a, b) => a.category.localeCompare(b.category, 'ru') || a.productName.localeCompare(b.productName, 'ru'));
}

function addItem(merged: Map<string, ShoppingItem>, next: ShoppingItem): void {
  const existing = merged.get(next.key);
  if (!existing) {
    merged.set(next.key, next);
    return;
  }
  existing.quantityText = mergeQuantity(existing.quantityText, next.quantityText);
  existing.usedForDishes = Array.from(new Set([...existing.usedForDishes, ...next.usedForDishes]));
  existing.replacement ||= next.replacement;
  existing.comment ||= next.comment;
  existing.pricePerUnit ||= next.pricePerUnit;
  existing.estimatedPrice = (existing.estimatedPrice || 0) + (next.estimatedPrice || 0) || undefined;
}

function formatQuantity(quantity: number | string, unit?: string): string {
  const normalized = normalizeQuantity(quantity, unit);
  return normalized ? formatNormalizedQuantity(normalized.value, normalized.unit) : [quantity, unit].filter(Boolean).join(' ');
}

function mergeQuantity(current: string, next: string): string {
  if (current === next) return current;
  const currentParsed = parseQuantityText(current);
  const nextParsed = parseQuantityText(next);
  if (currentParsed && nextParsed && currentParsed.unit === nextParsed.unit) {
    return formatNormalizedQuantity(currentParsed.value + nextParsed.value, currentParsed.unit);
  }
  return `${current} + ${next}`;
}

function normalizeQuantity(quantity: number | string, unit?: string): { value: number; unit: string } | null {
  const numeric = Number(quantity);
  const normalizedUnit = normalizeKey(unit);
  if (!Number.isFinite(numeric) || !normalizedUnit) return null;
  if (normalizedUnit === 'г') return { value: numeric / 1000, unit: 'кг' };
  if (normalizedUnit === 'кг') return { value: numeric, unit: 'кг' };
  if (normalizedUnit === 'мл') return { value: numeric / 1000, unit: 'л' };
  if (normalizedUnit === 'л') return { value: numeric, unit: 'л' };
  return { value: numeric, unit: String(unit).trim() };
}

function parseQuantityText(value: string): { value: number; unit: string } | null {
  const match = value.trim().match(/^([\d.,]+)\s+(.+)$/);
  if (!match) return null;
  const numeric = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(numeric)) return null;
  return { value: numeric, unit: match[2].trim() };
}

function formatNormalizedQuantity(value: number, unit: string): string {
  const rounded = Math.round(value * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toString().replace('.', ',')} ${unit}`;
}

function estimatePrice(quantity: number | string, pricePerUnit?: number): number | undefined {
  const numeric = Number(quantity);
  if (!Number.isFinite(numeric) || !pricePerUnit) return undefined;
  return numeric * pricePerUnit;
}

function estimateIngredientPrice(quantity: number | string, unit: string | undefined, product?: BaseProduct): number | undefined {
  if (!product?.pricePerUnit) return undefined;
  const numeric = Number(quantity);
  if (!Number.isFinite(numeric)) return undefined;
  const itemUnit = normalizeKey(unit);
  const priceUnit = normalizeKey(product.unit);
  if (itemUnit === priceUnit) return numeric * product.pricePerUnit;
  if (itemUnit === 'г' && priceUnit === 'кг') return (numeric / 1000) * product.pricePerUnit;
  if (itemUnit === 'мл' && priceUnit === 'л') return (numeric / 1000) * product.pricePerUnit;
  if (product.estimatedPackagePrice && numeric === 1) return product.estimatedPackagePrice;
  return undefined;
}
