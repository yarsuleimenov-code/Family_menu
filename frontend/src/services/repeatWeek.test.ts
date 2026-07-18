import { describe, expect, it } from 'vitest';
import type { SelectedDinner } from '../types/plan';
import { availablePastWeeks, buildRepeatedDayMutations, buildRepeatWeekPreview, localWeekDates, startOfLocalWeek } from './repeatWeek';

function selection(date: string, dishId: string, id = `${date}-${dishId}`): SelectedDinner {
  return { id, date, dayLabel: '', dishId, dishName: dishId, source: 'manual', status: 'cooked', note: 'do not copy', createdAt: 'old', updatedAt: 'old' };
}

describe('repeat past week', () => {
  it('builds Monday-Sunday weeks in local calendar dates', () => {
    expect(startOfLocalWeek('2026-07-19')).toBe('2026-07-13');
    expect(localWeekDates('2026-07-15')).toEqual(['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19']);
  });

  it('crosses month and year boundaries without shifting weekdays', () => {
    expect(localWeekDates('2025-12-29')).toEqual(['2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04']);
  });

  it('offers only non-empty past weeks', () => {
    expect(availablePastWeeks([selection('2026-07-06', 'A'), selection('2026-07-08', 'B'), selection('2026-07-20', 'C')], '2026-07-18'))
      .toEqual([{ weekStart: '2026-07-06', weekEnd: '2026-07-12', plannedCount: 2 }]);
  });

  it('skips conflicts in empty-only mode', () => {
    const data = [selection('2026-07-06', 'source'), selection('2026-07-20', 'current')];
    const preview = buildRepeatWeekPreview('2026-07-06', '2026-07-20', data, 'empty_only');
    expect(preview[0]).toMatchObject({ action: 'skip', source: { dishId: 'source' }, current: { dishId: 'current' } });
    expect(buildRepeatedDayMutations(preview, 'now')).toEqual([]);
  });

  it('replaces only source days and preserves the existing target id', () => {
    const data = [selection('2026-07-06', 'source'), selection('2026-07-20', 'current', 'existing-id'), selection('2026-07-21', 'keep')];
    const preview = buildRepeatWeekPreview('2026-07-06', '2026-07-20', data, 'replace_conflicts');
    const mutations = buildRepeatedDayMutations(preview, 'now');
    expect(mutations).toHaveLength(1);
    expect(mutations[0]).toMatchObject({ date: '2026-07-20', replacesExisting: true, selection: { id: 'existing-id', dishId: 'source', source: 'repeated_week', status: 'planned' } });
    expect(preview[1]).toMatchObject({ action: 'no_source', current: { dishId: 'keep' } });
  });

  it('never creates two mutations for one target date', () => {
    const preview = buildRepeatWeekPreview('2026-07-06', '2026-07-20', [selection('2026-07-06', 'A')], 'replace_conflicts');
    expect(buildRepeatedDayMutations([...preview, preview[0]], 'now')).toHaveLength(1);
  });
});
