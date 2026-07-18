import { useMemo, useRef, useState } from 'react';
import type { AppData } from '../../types/app';
import type { CalendarPlanRow, SelectedDinner } from '../../types/plan';
import { formatRuDate, todayIso } from '../../utils/dates';
import {
  buildRepeatedDayMutations,
  buildRepeatWeekPreview,
  nextLocalWeek,
  startOfLocalWeek,
} from '../../services/repeatWeek';
import type { PastWeekOption, RepeatDaySaveStatus, RepeatWeekMode } from '../../services/repeatWeek';

interface RepeatWeekDialogProps {
  initialSourceWeek: string;
  pastWeeks: PastWeekOption[];
  selections: SelectedDinner[];
  refresh: () => Promise<AppData | undefined>;
  saveRepeatedDay: (selection: SelectedDinner, plan: CalendarPlanRow) => Promise<{ status: RepeatDaySaveStatus; detail?: string }>;
  onClose: () => void;
  onOpenPlan: (targetWeekStart: string) => void;
}

export function RepeatWeekDialog({
  initialSourceWeek,
  pastWeeks,
  selections,
  refresh,
  saveRepeatedDay,
  onClose,
  onOpenPlan,
}: RepeatWeekDialogProps) {
  const currentWeek = startOfLocalWeek(todayIso());
  const [sourceWeek, setSourceWeek] = useState(initialSourceWeek);
  const [targetWeek, setTargetWeek] = useState(nextLocalWeek(currentWeek));
  const [mode, setMode] = useState<RepeatWeekMode>('empty_only');
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [latestSelections, setLatestSelections] = useState(selections);
  const [dayResults, setDayResults] = useState<Record<string, { status: RepeatDaySaveStatus; detail?: string }>>({});
  const [phase, setPhase] = useState<'preview' | 'checking' | 'saving' | 'complete'>('preview');
  const [error, setError] = useState<string>();
  const runningRef = useRef(false);

  const preview = useMemo(
    () => buildRepeatWeekPreview(sourceWeek, targetWeek, latestSelections, mode),
    [latestSelections, mode, sourceWeek, targetWeek],
  );
  const conflictCount = preview.filter((day) => day.source && day.current).length;
  const actionableCount = preview.filter((day) => day.action === 'add' || day.action === 'replace').length;
  const problemCount = Object.values(dayResults).filter((result) => result.status === 'failed' || result.status === 'outcome_unknown').length;
  const savedCount = Object.values(dayResults).filter((result) => result.status === 'saved' || result.status === 'replaced').length;
  const skippedCount = Object.values(dayResults).filter((result) => result.status === 'skipped').length;

  const execute = async () => {
    if (runningRef.current) return;
    if (targetWeek < currentWeek) {
      setError('Целевая неделя не может быть в прошлом.');
      return;
    }
    if (sourceWeek >= currentWeek) {
      setError('Исходная неделя должна быть прошедшей.');
      return;
    }
    if (mode === 'replace_conflicts' && conflictCount && !replaceConfirmed) {
      setError('Подтвердите замену существующих блюд.');
      return;
    }

    runningRef.current = true;
    setError(undefined);
    setDayResults({});
    setPhase('checking');
    try {
      const latestData = await refresh();
      if (!latestData) {
        setError('Не удалось загрузить актуальный целевой план. Повторите проверку позже.');
        setPhase('preview');
        return;
      }
      setLatestSelections(latestData.selectedDinners);
      const currentPreview = buildRepeatWeekPreview(sourceWeek, targetWeek, latestData.selectedDinners, mode);
      const latestConflictCount = currentPreview.filter((day) => day.source && day.current).length;
      if (mode === 'replace_conflicts' && latestConflictCount && !replaceConfirmed) {
        setError(`Целевой план изменился: подтвердите замену в ${latestConflictCount} заполненных днях.`);
        setPhase('preview');
        return;
      }
      const mutations = buildRepeatedDayMutations(currentPreview, new Date().toISOString());
      const initialResults: Record<string, { status: RepeatDaySaveStatus; detail?: string }> = Object.fromEntries(currentPreview
        .filter((day) => day.action === 'skip')
        .map((day) => [day.targetDate, { status: 'skipped' as const }]));
      mutations.forEach((mutation) => { initialResults[mutation.date] = { status: 'pending' }; });
      setDayResults(initialResults);
      setPhase('saving');

      for (const mutation of mutations) {
        const result = await saveRepeatedDay(mutation.selection, mutation.plan);
        setDayResults((current) => ({
          ...current,
          [mutation.date]: {
            ...result,
            status: result.status === 'saved' && mutation.replacesExisting ? 'replaced' : result.status,
          },
        }));
      }
      setPhase('complete');
    } finally {
      runningRef.current = false;
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="repeat-week-dialog" role="dialog" aria-modal="true" aria-labelledby="repeat-week-title">
        <header className="repeat-week-dialog__header">
          <div>
            <h2 id="repeat-week-title">Повторить прошлую неделю</h2>
            <p>Проверьте каждый день до сохранения.</p>
          </div>
          <button type="button" disabled={phase === 'checking' || phase === 'saving'} onClick={onClose}>Закрыть</button>
        </header>

        <div className="repeat-week-dialog__controls">
          <label>Исходная неделя
            <select value={sourceWeek} onChange={(event) => { setSourceWeek(event.target.value); setDayResults({}); setPhase('preview'); }}>
              {pastWeeks.map((week) => (
                <option key={week.weekStart} value={week.weekStart}>{formatRuDate(week.weekStart)}–{formatRuDate(week.weekEnd)} · {week.plannedCount} блюд</option>
              ))}
            </select>
          </label>
          <label>Целевая неделя
            <input
              type="date"
              min={currentWeek}
              value={targetWeek}
              onChange={(event) => { setTargetWeek(startOfLocalWeek(event.target.value)); setDayResults({}); setPhase('preview'); }}
            />
          </label>
        </div>

        <fieldset className="repeat-week-modes">
          <legend>Режим копирования</legend>
          <label><input type="radio" checked={mode === 'empty_only'} onChange={() => { setMode('empty_only'); setReplaceConfirmed(false); }} /> Только пустые дни</label>
          <label className="repeat-week-mode-danger"><input type="radio" checked={mode === 'replace_conflicts'} onChange={() => setMode('replace_conflicts')} /> Заменить конфликты</label>
        </fieldset>
        {mode === 'replace_conflicts' && conflictCount ? (
          <label className="repeat-week-warning">
            <input type="checkbox" checked={replaceConfirmed} onChange={(event) => setReplaceConfirmed(event.target.checked)} />
            Подтверждаю замену в {conflictCount} заполненных днях. Пустые исходные дни ничего не очищают.
          </label>
        ) : null}

        {phase === 'checking' ? <div className="inline-note">Загружаем актуальный целевой план...</div> : null}
        {error ? <div className="error-panel">{error}</div> : null}

        <div className="repeat-week-preview">
          {preview.map((day) => {
            const result = dayResults[day.targetDate];
            return (
              <article className={`repeat-week-day repeat-week-day--${result?.status || day.action}`} key={day.targetDate}>
                <div><strong>{dayLabelShort(day.targetDate)}</strong><span>{formatRuDate(day.targetDate)}</span></div>
                <div><small>Было</small><span>{day.current?.dishName || 'Пусто'}</span></div>
                <div><small>Станет</small><strong>{day.source?.dishName || 'Нет блюда'}</strong></div>
                <em>{result ? resultLabel(result.status) : actionLabel(day.action)}</em>
                {result?.detail ? <p>{result.detail}</p> : null}
              </article>
            );
          })}
        </div>

        {phase === 'complete' ? (
          <div className={problemCount ? 'budget-warning' : 'inline-note'}>
            Сохранено: {savedCount}. Пропущено: {skippedCount}. Проблемных дней: {problemCount}.
          </div>
        ) : null}

        <footer className="repeat-week-dialog__footer">
          <span>{actionableCount} дней будут изменены</span>
          {phase === 'complete' ? <button type="button" className="primary" onClick={() => onOpenPlan(targetWeek)}>Открыть целевую неделю</button> : (
            <button type="button" className={mode === 'replace_conflicts' ? 'danger-action' : 'primary'} disabled={!actionableCount || phase === 'checking' || phase === 'saving' || (mode === 'replace_conflicts' && conflictCount > 0 && !replaceConfirmed)} onClick={() => void execute()}>
              {phase === 'checking' ? 'Проверяем...' : phase === 'saving' ? 'Сохраняем по дням...' : mode === 'replace_conflicts' ? 'Заменить выбранные дни' : 'Добавить в пустые дни'}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}

function actionLabel(action: string): string {
  if (action === 'add') return 'Добавить';
  if (action === 'replace') return 'Заменить';
  if (action === 'skip') return 'Пропустить';
  return 'Нет блюда';
}

function resultLabel(status: RepeatDaySaveStatus): string {
  if (status === 'saved') return 'Сохранено';
  if (status === 'replaced') return 'Заменено';
  if (status === 'skipped') return 'Пропущено';
  if (status === 'outcome_unknown') return 'Результат неизвестен';
  if (status === 'failed') return 'Ошибка';
  return 'Сохраняется';
}

function dayLabelShort(date: string): string {
  return new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(new Date(`${date}T00:00:00`));
}
