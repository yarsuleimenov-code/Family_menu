import { Clock, RefreshCcw, Utensils } from 'lucide-react';
import type { Dish } from '../../types/dish';
import { formatTenge } from '../../utils/budget';

interface DishCardProps {
  dish: Dish;
  selected?: boolean;
  warning?: string;
  actionLabel?: string;
  onAction?: () => void;
  onReplace?: () => void;
}

export function DishCard({ dish, selected, warning, actionLabel = 'Выбрать блюдо', onAction, onReplace }: DishCardProps) {
  return (
    <article className={`dish-card ${selected ? 'dish-card--selected' : ''}`}>
      <div className="dish-card__media" aria-hidden="true">
        <Utensils size={24} />
      </div>
      <div className="dish-card__body">
        <div className="dish-card__title-row">
          <h3>{dish.dishName}</h3>
          <span className={`status-dot ${dish.active ? 'status-dot--ok' : 'status-dot--muted'}`}>{dish.active ? 'active' : 'inactive'}</span>
        </div>
        <div className="meta-row">
          <span><Clock size={15} /> {dish.cookingTimeMin || '?'} мин</span>
          <span>{difficultyLabel(dish.difficulty)}</span>
          <span>{dish.portions} порц.</span>
          <span>{budgetLabel(dish.budgetLevel)}</span>
        </div>
        <p>{dish.recipeNote || 'Краткая логика приготовления не заполнена.'}</p>
        <div className="chips">
          {dish.leftovers ? <span>остатки на обед</span> : null}
          {dish.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}
        </div>
        <div className="ingredient-preview">
          {dish.ingredients.slice(0, 4).map((ingredient) => ingredient.productName).join(', ')}
        </div>
        {warning ? <div className="inline-warning">{warning}</div> : null}
        <div className="card-actions">
          {onAction ? <button className={selected ? 'secondary' : 'primary'} type="button" onClick={onAction}>{selected ? 'Выбрано' : actionLabel}</button> : null}
          {onReplace ? <button className="icon-button" type="button" onClick={onReplace} aria-label="Заменить"><RefreshCcw size={18} /></button> : null}
        </div>
      </div>
    </article>
  );
}

function difficultyLabel(value: Dish['difficulty']): string {
  return value === 'easy' ? 'легко' : value === 'medium' ? 'средне' : 'сложно';
}

function budgetLabel(value: Dish['budgetLevel']): string {
  const labels = { low: 'бюджетно', medium: 'средне', high: formatTenge(0).replace('нет цены', 'дороже') };
  return labels[value];
}
