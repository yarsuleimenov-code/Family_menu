import type { Dish } from './dish';
import type { BaseProduct } from './product';
import type { CalendarPlanRow, SelectedDinner } from './plan';
import type { ShoppingSession } from './shopping';
import type { AppSettings } from './settings';

export interface AppData {
  dishes: Dish[];
  baseProducts: BaseProduct[];
  calendarPlan: CalendarPlanRow[];
  selectedDinners: SelectedDinner[];
  shoppingSessions: ShoppingSession[];
  settings: AppSettings;
  loadedAt: string;
}
