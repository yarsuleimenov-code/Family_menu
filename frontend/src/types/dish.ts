export type Difficulty = 'easy' | 'medium' | 'hard';
export type BudgetLevel = 'low' | 'medium' | 'high';
export type DishStatus = 'active' | 'inactive';

export interface DishIngredient {
  dishId: string;
  productId: string;
  productName: string;
  category: string;
  quantity: number | string;
  unit: string;
  requiredOptional: 'required' | 'optional';
  replacement?: string;
  comment?: string;
}

export interface Dish {
  dishId: string;
  dishName: string;
  category: string;
  mainProtein: string;
  cookingTimeMin?: number;
  difficulty: Difficulty;
  portions: number;
  leftovers: boolean;
  budgetLevel: BudgetLevel;
  bestDayType: 'weekday' | 'weekend' | 'any';
  tags: string[];
  recipeNote?: string;
  active: boolean;
  photoUrl?: string;
  createdAt: string;
  updatedAt: string;
  ingredients: DishIngredient[];
}

export interface DishFilters {
  search?: string;
  quick?: boolean;
  budget?: boolean;
  leftovers?: boolean;
  protein?: string;
  noOven?: boolean;
  maxTime?: 30 | 60 | 90;
  dayType?: 'weekday' | 'weekend';
  activeOnly?: boolean;
}
