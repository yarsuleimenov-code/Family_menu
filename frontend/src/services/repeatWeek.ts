import type { CalendarPlanRow, SelectedDinner } from '../types/plan';
import { addDays, dayLabel } from '../utils/dates';

export type RepeatWeekMode = 'empty_only' | 'replace_conflicts';
export type RepeatWeekAction = 'add' | 'replace' | 'skip' | 'no_source';
export type RepeatDaySaveStatus = 'pending' | 'saved' | 'replaced' | 'skipped' | 'failed' | 'outcome_unknown';

export interface PastWeekOption {
  weekStart: string;
  weekEnd: string;
  plannedCount: number;
}

export interface RepeatWeekPreviewDay {
  sourceDate: string;
  targetDate: string;
  source?: SelectedDinner;
  current?: SelectedDinner;
  action: RepeatWeekAction;
}

export interface RepeatedDayMutation {
  date: string;
  selection: SelectedDinner;
  plan: CalendarPlanRow;
  replacesExisting: boolean;
}

export function startOfLocalWeek(isoDate: string): string {
  const date = localDate(isoDate);
  const mondayOffset = date.getDay() === 0 ? -6 : 1 - date.getDay();
  date.setDate(date.getDate() + mondayOffset);
  return localIsoDate(date);
}

export function localWeekDates(weekStart: string): string[] {
  const monday = startOfLocalWeek(weekStart);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function nextLocalWeek(isoDate: string): string {
  return addDays(startOfLocalWeek(isoDate), 7);
}

export function availablePastWeeks(selections: SelectedDinner[], today: string): PastWeekOption[] {
  const currentWeek = startOfLocalWeek(today);
  const datesByWeek = new Map<string, Set<string>>();
  selections.forEach((selection) => {
    const weekStart = startOfLocalWeek(selection.date);
    if (weekStart >= currentWeek) return;
    const dates = datesByWeek.get(weekStart) ?? new Set<string>();
    dates.add(selection.date);
    datesByWeek.set(weekStart, dates);
  });
  return Array.from(datesByWeek, ([weekStart, dates]) => ({
    weekStart,
    weekEnd: addDays(weekStart, 6),
    plannedCount: dates.size,
  })).sort((left, right) => right.weekStart.localeCompare(left.weekStart));
}

export function buildRepeatWeekPreview(
  sourceWeekStart: string,
  targetWeekStart: string,
  selections: SelectedDinner[],
  mode: RepeatWeekMode,
): RepeatWeekPreviewDay[] {
  const sourceByDate = new Map(selections.map((selection) => [selection.date, selection]));
  return localWeekDates(sourceWeekStart).map((sourceDate, index) => {
    const targetDate = addDays(startOfLocalWeek(targetWeekStart), index);
    const source = sourceByDate.get(sourceDate);
    const current = sourceByDate.get(targetDate);
    const action: RepeatWeekAction = !source
      ? 'no_source'
      : current && mode === 'empty_only'
        ? 'skip'
        : current
          ? 'replace'
          : 'add';
    return { sourceDate, targetDate, source, current, action };
  });
}

export function buildRepeatedDayMutations(preview: RepeatWeekPreviewDay[], nowIso: string): RepeatedDayMutation[] {
  const seenDates = new Set<string>();
  return preview.flatMap((day) => {
    if (!day.source || (day.action !== 'add' && day.action !== 'replace') || seenDates.has(day.targetDate)) return [];
    seenDates.add(day.targetDate);
    const selection: SelectedDinner = {
      id: day.current?.id || `${day.targetDate}-${day.source.dishId}`,
      date: day.targetDate,
      dayLabel: dayLabel(day.targetDate),
      dishId: day.source.dishId,
      dishName: day.source.dishName,
      source: 'repeated_week',
      status: 'planned',
      createdAt: day.current?.createdAt || nowIso,
      updatedAt: nowIso,
    };
    const plan: CalendarPlanRow = {
      date: day.targetDate,
      dayLabel: dayLabel(day.targetDate),
      selectedDishId: day.source.dishId,
      status: 'planned',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    return [{ date: day.targetDate, selection, plan, replacesExisting: day.action === 'replace' }];
  });
}

function localDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
