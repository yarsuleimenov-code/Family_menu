export type PlanStatus = 'planned' | 'cooked' | 'skipped' | 'replaced';

export interface CalendarPlanRow {
  date: string;
  dayLabel: string;
  optionADishId?: string;
  optionBDishId?: string;
  quickDishId?: string;
  selectedDishId?: string;
  status: PlanStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SelectedDinner {
  id: string;
  date: string;
  dayLabel: string;
  dishId: string;
  dishName: string;
  source: 'option_a' | 'option_b' | 'quick' | 'random' | 'manual';
  status: PlanStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
}
