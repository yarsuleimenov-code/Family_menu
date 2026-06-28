import { useMemo, useState } from 'react';
import { Shuffle } from 'lucide-react';
import { DishCard } from '../../components/DishCard/DishCard';
import { useAppState } from '../../app/AppState';
import type { DishFilters } from '../../types/dish';
import type { SelectedDinner } from '../../types/plan';
import { addDays, dayLabel, formatRuDate, getDateRange, todayIso } from '../../utils/dates';
import { hasForbiddenProducts, randomDish } from '../../services/randomDish';

export function PlanPage() {
  const { data, saveSelectedDinner, saveCalendarPlan } = useAppState();
  const [date, setDate] = useState(todayIso());
  const [rangeTo, setRangeTo] = useState(addDays(todayIso(), 6));
  const [filters, setFilters] = useState<DishFilters>({});
  const [randomResult, setRandomResult] = useState<string>();

  const currentPlan = data.calendarPlan.find((row) => row.date === date);
  const selected = data.selectedDinners.find((item) => item.date === date);
  const weekDates = getDateRange(date, rangeTo);
  const weekSelections = data.selectedDinners.filter((item) => weekDates.includes(item.date));

  const options = useMemo(() => {
    const ids = [currentPlan?.optionADishId, currentPlan?.optionBDishId, currentPlan?.quickDishId].filter(Boolean);
    return ids.map((id) => data.dishes.find((dish) => dish.dishId === id)).filter(Boolean);
  }, [currentPlan, data.dishes]);

  const selectDish = async (dishId: string, source: SelectedDinner['source']) => {
    const dish = data.dishes.find((item) => item.dishId === dishId);
    if (!dish) return;
    const now = new Date().toISOString();
    const selection: SelectedDinner = {
      id: `${date}-${dish.dishId}`,
      date,
      dayLabel: dayLabel(date),
      dishId: dish.dishId,
      dishName: dish.dishName,
      source,
      status: 'planned',
      createdAt: now,
      updatedAt: now,
    };
    await saveSelectedDinner(selection);
    await saveCalendarPlan({
      date,
      dayLabel: dayLabel(date),
      optionADishId: currentPlan?.optionADishId,
      optionBDishId: currentPlan?.optionBDishId,
      quickDishId: currentPlan?.quickDishId,
      selectedDishId: dish.dishId,
      status: 'planned',
      note: currentPlan?.note,
      createdAt: currentPlan?.createdAt || now,
      updatedAt: now,
    });
  };

  const chooseRandom = async () => {
    const result = randomDish(data.dishes, filters, data.settings.forbiddenProducts, weekSelections);
    if (!result.dish) {
      setRandomResult(result.reasons.join(', '));
      return;
    }
    await selectDish(result.dish.dishId, 'random');
    setRandomResult(`Подобрано: ${result.reasons.join(', ') || 'активное блюдо'}. Исключено вариантов: ${result.rejectedCount}.`);
  };

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <h1>План</h1>
          <p>Выберите ужин на дату или соберите неделю.</p>
        </div>
        <a className="primary compact-link" href="/shopping">Сформировать покупки</a>
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
          <button type="button" onClick={() => setFilters({ ...filters, maxTime: 30 })}>до 30 мин</button>
          <button type="button" onClick={() => setFilters({ ...filters, maxTime: 60 })}>до 60 мин</button>
          <button type="button" onClick={() => setFilters({ ...filters, protein: 'курица' })}>курица</button>
          <button type="button" onClick={() => setFilters({ ...filters, protein: 'рыба' })}>рыба</button>
          <button type="button" onClick={() => setFilters({ ...filters, protein: 'фарш' })}>фарш</button>
          <button type="button" onClick={() => setFilters({ ...filters, dayType: 'weekend' })}>выходной</button>
        </div>
        <button className="primary full-width" type="button" onClick={() => void chooseRandom()}>
          <Shuffle size={18} /> Случайное блюдо
        </button>
        {randomResult ? <div className="inline-note">{randomResult}</div> : null}
      </section>
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" className={checked ? 'selected-filter' : ''} onClick={() => onChange(!checked)}>{label}</button>;
}
