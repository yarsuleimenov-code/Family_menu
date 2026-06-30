import { useMemo, useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { DishCard } from '../../components/DishCard/DishCard';
import { useAppState } from '../../app/AppState';
import type { Dish, DishIngredient } from '../../types/dish';
import type { CalendarPlanRow, SelectedDinner } from '../../types/plan';
import { hasForbiddenProducts } from '../../services/randomDish';
import { normalizeKey } from '../../utils/normalize';
import { dayLabel, todayIso } from '../../utils/dates';

const emptyDish = (): Dish => ({
  dishId: `D-${Date.now()}`,
  dishName: '',
  category: 'ужин',
  mainProtein: '',
  cookingTimeMin: 60,
  difficulty: 'easy',
  portions: 4,
  leftovers: true,
  budgetLevel: 'medium',
  bestDayType: 'any',
  tags: [],
  recipeNote: '',
  active: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ingredients: [],
});

export function DishesPage() {
  const { data, saveDish, saveSelectedDinner, saveCalendarPlan } = useAppState();
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [editing, setEditing] = useState<Dish | null>(null);
  const [targetDate, setTargetDate] = useState(todayIso());
  const [message, setMessage] = useState('');

  const dishes = useMemo(() => data.dishes.filter((dish) => {
    if (activeOnly && !dish.active) return false;
    const query = normalizeKey(search);
    return !query || normalizeKey(`${dish.dishName} ${dish.mainProtein} ${dish.tags.join(' ')}`).includes(query);
  }), [data.dishes, activeOnly, search]);
  const activeDishIssues = useMemo(() => data.dishes
    .filter((dish) => dish.active)
    .map((dish) => ({ dish, issues: getDishIssues(dish, data.settings.forbiddenProducts) }))
    .filter((item) => item.issues.length), [data.dishes, data.settings.forbiddenProducts]);

  const save = async (dish: Dish) => {
    await saveDish({ ...dish, updatedAt: new Date().toISOString() });
    setEditing(null);
  };

  const assignDishToDate = async (dish: Dish) => {
    const now = new Date().toISOString();
    const existingPlan = data.calendarPlan.find((row) => row.date === targetDate);
    const selection: SelectedDinner = {
      id: `${targetDate}-${dish.dishId}`,
      date: targetDate,
      dayLabel: dayLabel(targetDate),
      dishId: dish.dishId,
      dishName: dish.dishName,
      source: 'manual',
      status: 'planned',
      createdAt: now,
      updatedAt: now,
    };
    const plan: CalendarPlanRow = {
      date: targetDate,
      dayLabel: dayLabel(targetDate),
      optionADishId: existingPlan?.optionADishId,
      optionBDishId: existingPlan?.optionBDishId,
      quickDishId: existingPlan?.quickDishId,
      selectedDishId: dish.dishId,
      status: 'planned',
      note: existingPlan?.note,
      createdAt: existingPlan?.createdAt || now,
      updatedAt: now,
    };
    await saveSelectedDinner(selection);
    await saveCalendarPlan(plan);
    setMessage(`${dish.dishName} выбрано на ${targetDate}`);
  };

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <h1>Блюда</h1>
          <p>Ассортимент меню и ингредиенты.</p>
        </div>
        <button className="primary" type="button" onClick={() => setEditing(emptyDish())}>Добавить своё блюдо</button>
      </div>

      <div className="control-panel">
        <label>Поиск <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="курица, паста, быстро" /></label>
        <label>Дата для выбора <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></label>
        <label className="switch-row"><input type="checkbox" checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} /> Только активные</label>
      </div>

      {message ? <div className="inline-note">{message}</div> : null}

      <section className="quality-panel">
        <div className="section-title">
          <h2>Качество базы</h2>
          <span>{activeDishIssues.length ? `${activeDishIssues.length} требуют проверки` : 'активные блюда заполнены'}</span>
        </div>
        {activeDishIssues.length ? (
          <div className="issue-list">
            {activeDishIssues.map(({ dish, issues }) => (
              <button type="button" key={dish.dishId} onClick={() => setEditing(dish)}>
                <strong>{dish.dishName || dish.dishId}</strong>
                <span>{issues.join(', ')}</span>
              </button>
            ))}
          </div>
        ) : <div className="inline-note">Проблемных активных блюд нет.</div>}
      </section>

      {editing ? <DishForm dish={editing} forbiddenProducts={data.settings.forbiddenProducts} onCancel={() => setEditing(null)} onSave={(dish) => void save(dish)} /> : null}

      <div className="dish-list">
        {dishes.map((dish) => {
          const warnings = getDishIssues(dish, data.settings.forbiddenProducts).join('. ');
          return (
            <DishCard
              key={dish.dishId}
              dish={dish}
              warning={warnings || undefined}
              actionLabel="Редактировать"
              onAction={() => setEditing(dish)}
              onReplace={dish.active ? () => void assignDishToDate(dish) : undefined}
              secondaryActionLabel={`Выбрать на ${targetDate}`}
              secondaryActionIcon={<CalendarPlus size={18} />}
            />
          );
        })}
      </div>
    </section>
  );
}

function DishForm({ dish, forbiddenProducts, onSave, onCancel }: { dish: Dish; forbiddenProducts: string[]; onSave: (dish: Dish) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(dish);
  const [ingredientText, setIngredientText] = useState(dish.ingredients.map(formatIngredient).join('\n'));
  const forbiddenWarning = hasForbiddenProducts({ ...draft, ingredients: parseIngredients(draft.dishId, ingredientText) }, forbiddenProducts);

  return (
    <form className="edit-form" onSubmit={(event) => {
      event.preventDefault();
      onSave({ ...draft, ingredients: parseIngredients(draft.dishId, ingredientText), tags: draft.tags.filter(Boolean) });
    }}>
      <h2>{dish.dishName ? 'Редактировать блюдо' : 'Новое блюдо'}</h2>
      {forbiddenWarning ? <div className="budget-warning">В блюде найден запрещённый продукт. Сохранение не заблокировано, но active меню требует проверки.</div> : null}
      <label>Название <input required value={draft.dishName} onChange={(event) => setDraft({ ...draft, dishName: event.target.value })} /></label>
      <div className="form-grid">
        <label>Белок <input value={draft.mainProtein} onChange={(event) => setDraft({ ...draft, mainProtein: event.target.value })} /></label>
        <label>Время, мин <input type="number" value={draft.cookingTimeMin || ''} onChange={(event) => setDraft({ ...draft, cookingTimeMin: Number(event.target.value) })} /></label>
        <label>Порции <input type="number" value={draft.portions} onChange={(event) => setDraft({ ...draft, portions: Number(event.target.value) })} /></label>
        <label>Сложность
          <select value={draft.difficulty} onChange={(event) => setDraft({ ...draft, difficulty: event.target.value as Dish['difficulty'] })}>
            <option value="easy">легко</option><option value="medium">средне</option><option value="hard">сложно</option>
          </select>
        </label>
        <label>Бюджет
          <select value={draft.budgetLevel} onChange={(event) => setDraft({ ...draft, budgetLevel: event.target.value as Dish['budgetLevel'] })}>
            <option value="low">низкий</option><option value="medium">средний</option><option value="high">высокий</option>
          </select>
        </label>
        <label>День
          <select value={draft.bestDayType} onChange={(event) => setDraft({ ...draft, bestDayType: event.target.value as Dish['bestDayType'] })}>
            <option value="any">любой</option><option value="weekday">будни</option><option value="weekend">выходной</option>
          </select>
        </label>
      </div>
      <label className="switch-row"><input type="checkbox" checked={draft.leftovers} onChange={(event) => setDraft({ ...draft, leftovers: event.target.checked })} /> Есть остатки на обед</label>
      <label>Теги через запятую <input value={draft.tags.join(', ')} onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(',').map((tag) => tag.trim()) })} /></label>
      <label>Краткая логика приготовления <textarea value={draft.recipeNote} onChange={(event) => setDraft({ ...draft, recipeNote: event.target.value })} /></label>
      <label>Ингредиенты: продукт | категория | количество | единица | замена | комментарий
        <textarea rows={5} value={ingredientText} onChange={(event) => setIngredientText(event.target.value)} />
      </label>
      <div className="toolbar">
        <button className="primary" type="submit">Сохранить</button>
        <button type="button" onClick={onCancel}>Отмена</button>
      </div>
    </form>
  );
}

function formatIngredient(ingredient: DishIngredient): string {
  return [ingredient.productName, ingredient.category, ingredient.quantity, ingredient.unit, ingredient.replacement || '', ingredient.comment || ''].join(' | ');
}

function parseIngredients(dishId: string, text: string): DishIngredient[] {
  return text.split('\n').map((line, index) => {
    const [productName, category, quantity, unit, replacement, comment] = line.split('|').map((item) => item.trim());
    if (!productName) return null;
    return {
      dishId,
      productId: `P-${dishId}-${index + 1}`,
      productName,
      category: category || 'прочее',
      quantity: Number(quantity) || quantity || 1,
      unit: unit || 'шт',
      requiredOptional: 'required',
      replacement,
      comment,
    } satisfies DishIngredient;
  }).filter(Boolean) as DishIngredient[];
}

function getDishIssues(dish: Dish, forbiddenProducts: string[]): string[] {
  if (!dish.active) return [];
  return [
    hasForbiddenProducts(dish, forbiddenProducts) ? 'Есть запрещённый продукт' : '',
    !dish.ingredients.length ? 'Нет ингредиентов' : '',
    !dish.cookingTimeMin ? 'Нет времени готовки' : '',
    !dish.portions ? 'Нет порций' : '',
    !dish.budgetLevel ? 'Нет бюджета' : '',
    !dish.tags.length ? 'Нет тегов' : '',
  ].filter(Boolean);
}
