import { describe, expect, it, vi } from 'vitest';
import { mockData } from '../data/mockData';
import { coerceIsoDate, getDateRange } from '../utils/dates';
import { normalizeKey, splitTags } from '../utils/normalize';
import { filterDishes, randomDish } from './randomDish';
import { buildShoppingList } from './shoppingListBuilder';

describe('menu business logic', () => {
  it('merges duplicate shopping ingredients and preserves statuses', () => {
    const dish = mockData.dishes[0];
    const selections = [
      { id: '1', date: '2026-01-01', dayLabel: 'Thu', dishId: dish.dishId, dishName: dish.dishName, source: 'manual' as const, status: 'planned' as const, createdAt: '', updatedAt: '' },
      { id: '2', date: '2026-01-02', dayLabel: 'Fri', dishId: dish.dishId, dishName: dish.dishName, source: 'manual' as const, status: 'planned' as const, createdAt: '', updatedAt: '' },
    ];
    const list = buildShoppingList(selections, [dish], [], false);
    expect(list).toHaveLength(dish.ingredients.length);
    expect(list.find((item) => item.productId === dish.ingredients[0].productId)?.quantityText).not.toContain('+');
  });

  it('filters inactive, repeated and forbidden dishes before random choice', () => {
    const selected = [{ id: 'x', date: '2026-01-01', dayLabel: 'Thu', dishId: mockData.dishes[0].dishId, dishName: '', source: 'manual' as const, status: 'planned' as const, createdAt: '', updatedAt: '' }];
    const eligible = filterDishes(mockData.dishes, { activeOnly: true }, [mockData.dishes[1].ingredients[0].productName], selected);
    expect(eligible.some((dish) => dish.dishId === mockData.dishes[0].dishId)).toBe(false);
    expect(eligible.some((dish) => dish.dishId === mockData.dishes[1].dishId)).toBe(false);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(randomDish(eligible, {}, [], []).dish?.dishId).toBe(eligible[0]?.dishId);
    vi.restoreAllMocks();
  });

  it('normalizes strings, tags and date ranges', () => {
    expect(normalizeKey('  TEST  ')).toBe('test');
    expect(splitTags('one, two')).toEqual(['one', 'two']);
    expect(coerceIsoDate('2026-07-18T10:00:00Z')).toBe('2026-07-18');
    expect(getDateRange('2026-07-18', '2026-07-20')).toEqual(['2026-07-18', '2026-07-19', '2026-07-20']);
  });
});
