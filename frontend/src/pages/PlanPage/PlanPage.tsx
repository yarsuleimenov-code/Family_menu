import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shuffle } from 'lucide-react';
import { DishCard } from '../../components/DishCard/DishCard';
import { calendarPlanWriteKey, selectedDinnerWriteKey, useAppState } from '../../app/AppState';
import type { Dish, DishFilters } from '../../types/dish';
import type { CalendarPlanRow, PlanStatus, SelectedDinner } from '../../types/plan';
import { addDays, dayLabel, formatRuDate, getDateRange, todayIso } from '../../utils/dates';
import { hasForbiddenProducts, randomDish } from '../../services/randomDish';

export function PlanPage() {
  const { data, saveSelectedDinner, saveCalendarPlan, saveStatuses, pendingWrites, retryPendingWrites } = useAppState();
  const [date, setDate] = useState(todayIso());
  const [rangeTo, setRangeTo] = useState(addDays(todayIso(), 6));
  const [filters, setFilters] = useState<DishFilters>({});
  const [randomResult, setRandomResult] = useState<string>();
  const [weekFillMessage, setWeekFillMessage] = useState<string>();
  const [weekFillBusy, setWeekFillBusy] = useState(false);

  const currentPlan = data.calendarPlan.find((row) => row.date === date);
  const selected = data.selectedDinners.find((item) => item.date === date);
  const weekDates = getDateRange(date, rangeTo);
  const weekSelections = data.selectedDinners.filter((item) => weekDates.includes(item.date));
  const recentSelections = data.selectedDinners.filter((item) => item.date >= addDays(date, -14) && item.date < date);
  const randomExclusions = [...weekSelections, ...recentSelections];
  const weekOverview = weekDates.map((weekDate) => ({
    date: weekDate,
    selected: data.selectedDinners.find((item) => item.date === weekDate),
  }));
  const selectedStatusKey = selectedDinnerWriteKey(date);
  const planStatusKey = calendarPlanWriteKey(date);
  const dateSaveStatuses = [saveStatuses[selectedStatusKey], saveStatuses[planStatusKey]].filter(Boolean);
  const datePendingWrites = pendingWrites.filter((write) => write.statusKey === selectedStatusKey || write.statusKey === planStatusKey);
  const saveNotice = getSaveNotice(dateSaveStatuses, datePendingWrites.length);

  const options = useMemo(() => {
    const ids = [currentPlan?.optionADishId, currentPlan?.optionBDishId, currentPlan?.quickDishId].filter(Boolean);
    return ids.map((id) => data.dishes.find((dish) => dish.dishId === id)).filter(Boolean);
  }, [currentPlan, data.dishes]);

  const buildSelectedDinner = (targetDate: string, dish: Dish, source: SelectedDinner['source'], status: PlanStatus): SelectedDinner => {
    const now = new Date().toISOString();
    return {
      id: `${targetDate}-${dish.dishId}`,
      date: targetDate,
      dayLabel: dayLabel(targetDate),
      dishId: dish.dishId,
      dishName: dish.dishName,
      source,
      status,
      createdAt: now,
      updatedAt: now,
    };
  };

  const buildCalendarPlan = (targetDate: string, dishId: string, status: PlanStatus): CalendarPlanRow => {
    const now = new Date().toISOString();
    const plan = data.calendarPlan.find((row) => row.date === targetDate);
    return {
      date: targetDate,
      dayLabel: dayLabel(targetDate),
      optionADishId: plan?.optionADishId,
      optionBDishId: plan?.optionBDishId,
      quickDishId: plan?.quickDishId,
      selectedDishId: dishId,
      status,
      note: plan?.note,
      createdAt: plan?.createdAt || now,
      updatedAt: now,
    };
  };

  const selectDishForDate = async (targetDate: string, dishId: string, source: SelectedDinner['source'], status: PlanStatus = 'planned') => {
    const dish = data.dishes.find((item) => item.dishId === dishId);
    if (!dish) return false;
    const selection = buildSelectedDinner(targetDate, dish, source, status);
    await saveSelectedDinner(selection);
    await saveCalendarPlan(buildCalendarPlan(targetDate, dish.dishId, status));
    return true;
  };

  const selectDish = async (dishId: string, source: SelectedDinner['source']) => {
    await selectDishForDate(date, dishId, source);
  };

  const chooseRandom = async () => {
    const result = randomDish(data.dishes, filters, data.settings.forbiddenProducts, randomExclusions);
    if (!result.dish) {
      setRandomResult(result.reasons.join(', '));
      return;
    }
    await selectDish(result.dish.dishId, 'random');
    setRandomResult(`Подобрано: ${result.reasons.join(', ') || 'активное блюдо'}. Исключено вариантов: ${result.rejectedCount}.`);
  };

  const fillWeekRandomly = async () => {
    const emptyDaysCount = weekDates.filter((targetDate) => !data.selectedDinners.some((item) => item.date === targetDate)).length;
    if (!emptyDaysCount) {
      setWeekFillMessage('В диапазоне нет пустых дней.');
      return;
    }
    const confirmed = window.confirm(`Заполнить пустые дни недели случайными блюдами?\n\nБудет заполнено дней: ${emptyDaysCount}. Уже выбранные ужины не изменятся.`);
    if (!confirmed) return;

    setWeekFillBusy(true);
    setWeekFillMessage(undefined);
    let filledCount = 0;
    const skippedDates: string[] = [];
    const exclusions = [...randomExclusions];

    try {
      for (const targetDate of weekDates) {
        if (data.selectedDinners.some((item) => item.date === targetDate)) continue;
        const recentForDate = data.selectedDinners.filter((item) => item.date >= addDays(targetDate, -14) && item.date < targetDate);
        const result = randomDish(data.dishes, filters, data.settings.forbiddenProducts, [...exclusions, ...recentForDate]);
        if (!result.dish) {
          skippedDates.push(formatRuDate(targetDate));
          continue;
        }
        await selectDishForDate(targetDate, result.dish.dishId, 'random');
        exclusions.push(buildSelectedDinner(targetDate, result.dish, 'random', 'planned'));
        filledCount += 1;
      }

      setWeekFillMessage(
        filledCount
          ? `Заполнено дней: ${filledCount}${skippedDates.length ? `. Не хватило вариантов: ${skippedDates.join(', ')}` : ''}.`
          : 'В диапазоне нет пустых дней или не найдено подходящих блюд.',
      );
    } finally {
      setWeekFillBusy(false);
    }
  };

  const updateDayStatus = async (targetDate: string, status: PlanStatus) => {
    const selection = data.selectedDinners.find((item) => item.date === targetDate);
    if (!selection) return;
    const updatedAt = new Date().toISOString();
    await saveSelectedDinner({ ...selection, status, updatedAt });
    await saveCalendarPlan(buildCalendarPlan(targetDate, selection.dishId, status));
  };

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <h1>План</h1>
          <p>Выберите ужин на дату или соберите неделю.</p>
        </div>
        <Link className="primary compact-link" to="/shopping">Сформировать покупки</Link>
      </div>

      <div className="control-panel">
        <label>
          Дата
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label>
          Диапазон до
          <input type="date" value={rangeTo} onChange={(event) => setRangeTo(event.target.value)} />
        </label>
        <div className="quick-actions">
          <button type="button" onClick={() => setDate(todayIso())}>Сегодня</button>
          <button type="button" onClick={() => setDate(addDays(todayIso(), 1))}>Завтра</button>
          <button type="button" onClick={() => setRangeTo(addDays(date, 6))}>Неделя</button>
        </div>
      </div>

      <section className="summary-strip">
        <div><strong>{formatRuDate(date)}</strong><span>{dayLabel(date)}</span></div>
        <div><strong>{selected?.dishName || 'Ужин не выбран'}</strong><span>{weekSelections.length} выбрано в диапазоне</span></div>
      </section>

      {saveNotice ? (
        <div className={`save-status save-status--${saveNotice.kind}`}>
          <span>{saveNotice.message}</span>
          {datePendingWrites.length ? <button type="button" onClick={() => void retryPendingWrites()}>Повторить</button> : null}
        </div>
      ) : null}

      <section className="section-block week-planner">
        <div className="section-title">
          <h2>Неделя</h2>
          <span>{weekSelections.length} из {weekDates.length} выбрано</span>
        </div>
        <div className="week-planner__actions">
          <button className="primary" type="button" onClick={() => void fillWeekRandomly()} disabled={weekFillBusy}>
            <Shuffle size={18} /> {weekFillBusy ? 'Заполняем...' : 'Заполнить неделю случайно'}
          </button>
          <span>Повторы за последние 14 дней исключаются при наличии вариантов.</span>
        </div>
        {weekFillMessage ? <div className="inline-note">{weekFillMessage}</div> : null}
        <div className="week-overview">
          {weekOverview.map((item) => (
            <article className={`week-day week-day--${statusKind(item.selected?.status)}`} key={item.date}>
              <button type="button" className="week-day__main" onClick={() => setDate(item.date)}>
                <span>{formatRuDate(item.date)}</span>
                <strong>{item.selected?.dishName || 'Ужин не выбран'}</strong>
                <em>{statusLabel(item.selected?.status)}</em>
              </button>
              {item.selected && item.date === date ? (
                <div className="week-day__actions">
                  <button type="button" className={item.selected.status === 'planned' ? 'selected-filter' : ''} onClick={() => void updateDayStatus(item.date, 'planned')}>План</button>
                  <button type="button" className={item.selected.status === 'cooked' ? 'selected-filter' : ''} onClick={() => void updateDayStatus(item.date, 'cooked')}>Готовили</button>
                  <button type="button" className={item.selected.status === 'skipped' ? 'selected-filter' : ''} onClick={() => void updateDayStatus(item.date, 'skipped')}>Пропущено</button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-title">
          <h2>Варианты на день</h2>
          <span>{options.length ? 'из календарного плана' : 'план пока пустой'}</span>
        </div>
        <div className="dish-list">
          {options.map((dish, index) => dish ? (
            <DishCard
              key={`${dish.dishId}-${index}`}
              dish={dish}
              selected={selected?.dishId === dish.dishId}
              warning={hasForbiddenProducts(dish, data.settings.forbiddenProducts) ? 'Есть запрещённый продукт. Не активируйте без проверки.' : undefined}
              actionLabel={index === 0 ? 'Вариант A' : index === 1 ? 'Вариант B' : 'Быстрый вариант'}
              onAction={() => void selectDish(dish.dishId, index === 0 ? 'option_a' : index === 1 ? 'option_b' : 'quick')}
            />
          ) : null)}
        </div>
      </section>

      <section className="section-block">
        <div className="section-title">
          <h2>Случайное блюдо</h2>
          <span>без запрещённых продуктов</span>
        </div>
        <div className="filter-grid">
          <Toggle label="быстро" checked={!!filters.quick} onChange={(quick) => setFilters({ ...filters, quick })} />
          <Toggle label="бюджетно" checked={!!filters.budget} onChange={(budget) => setFilters({ ...filters, budget })} />
          <Toggle label="с остатками" checked={!!filters.leftovers} onChange={(leftovers) => setFilters({ ...filters, leftovers })} />
          <Toggle label="без духовки" checked={!!filters.noOven} onChange={(noOven) => setFilters({ ...filters, noOven })} />
          <button type="button" className={filters.maxTime === 30 ? 'selected-filter' : ''} onClick={() => setFilters({ ...filters, maxTime: filters.maxTime === 30 ? undefined : 30 })}>до 30 мин</button>
          <button type="button" className={filters.maxTime === 60 ? 'selected-filter' : ''} onClick={() => setFilters({ ...filters, maxTime: filters.maxTime === 60 ? undefined : 60 })}>до 60 мин</button>
          <button type="button" className={filters.protein === 'курица' ? 'selected-filter' : ''} onClick={() => setFilters({ ...filters, protein: filters.protein === 'курица' ? undefined : 'курица' })}>курица</button>
          <button type="button" className={filters.protein === 'рыба' ? 'selected-filter' : ''} onClick={() => setFilters({ ...filters, protein: filters.protein === 'рыба' ? undefined : 'рыба' })}>рыба</button>
          <button type="button" className={filters.protein === 'фарш' ? 'selected-filter' : ''} onClick={() => setFilters({ ...filters, protein: filters.protein === 'фарш' ? undefined : 'фарш' })}>фарш</button>
          <button type="button" className={filters.dayType === 'weekend' ? 'selected-filter' : ''} onClick={() => setFilters({ ...filters, dayType: filters.dayType === 'weekend' ? undefined : 'weekend' })}>выходной</button>
        </div>
        <button className="primary full-width" type="button" onClick={() => void chooseRandom()}>
          <Shuffle size={18} /> Случайное блюдо
        </button>
        {randomResult ? <div className="inline-note">{randomResult}</div> : null}
      </section>
    </section>
  );
}

function statusKind(status?: PlanStatus): string {
  if (!status) return 'empty';
  return status;
}

function statusLabel(status?: PlanStatus): string {
  if (status === 'cooked') return 'готовили';
  if (status === 'skipped') return 'пропущено';
  if (status === 'replaced') return 'заменено';
  if (status === 'planned') return 'выбрано';
  return 'не выбрано';
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" className={checked ? 'selected-filter' : ''} onClick={() => onChange(!checked)}>{label}</button>;
}

function getSaveNotice(
  statuses: Array<{ status: string; message: string; error?: string }>,
  pendingCount: number,
): { kind: 'saving' | 'saved' | 'error' | 'local'; message: string } | null {
  if (statuses.some((status) => status.status === 'saving')) {
    return { kind: 'saving', message: 'Сохраняем...' };
  }
  if (pendingCount || statuses.some((status) => status.status === 'error' || status.status === 'local')) {
    return { kind: 'error', message: 'Ошибка сохранения. Выбор остался локально.' };
  }
  if (statuses.some((status) => status.status === 'saved')) {
    return { kind: 'saved', message: 'Сохранено' };
  }
  return null;
}
