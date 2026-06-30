import type { ShoppingItem as ShoppingItemType, ShoppingItemStatus } from '../../types/shopping';
import { formatTenge } from '../../utils/budget';

interface ShoppingItemProps {
  item: ShoppingItemType;
  onStatusChange: (status: ShoppingItemStatus) => void;
  onRemove?: () => void;
}

export function ShoppingItem({ item, onStatusChange, onRemove }: ShoppingItemProps) {
  return (
    <article className={`shopping-item shopping-item--${item.status}`}>
      <label className="shopping-item__check">
        <input
          type="checkbox"
          checked={item.status === 'in_cart'}
          onChange={(event) => onStatusChange(event.target.checked ? 'in_cart' : 'to_buy')}
        />
        <span>В корзине</span>
      </label>
      <div className="shopping-item__content">
        <div className="shopping-item__title">
          <strong>{item.productName}</strong>
          <span className="quantity-parts">
            {splitQuantity(item.quantityText).map((part) => <span key={part}>{part}</span>)}
          </span>
        </div>
        <div className="muted">{item.usedForDishes.join(', ')}</div>
        {item.replacement ? <div className="muted">Замена: {item.replacement}</div> : null}
        {item.comment ? <div className="muted">{item.comment}</div> : null}
        <div className="shopping-item__controls">
          <div className="status-actions" aria-label="Статус товара">
            <button type="button" className={item.status === 'to_buy' ? 'selected-filter' : ''} onClick={() => onStatusChange('to_buy')}>Купить</button>
            <button type="button" className={item.status === 'have_at_home' ? 'selected-filter' : ''} onClick={() => onStatusChange('have_at_home')}>Дома</button>
            <button type="button" className={item.status === 'skip' ? 'selected-filter' : ''} onClick={() => onStatusChange('skip')}>Не покупать</button>
            {onRemove ? <button type="button" onClick={onRemove}>Убрать</button> : null}
          </div>
          <span>{formatTenge(item.estimatedPrice)}</span>
        </div>
      </div>
    </article>
  );
}

function splitQuantity(value: string): string[] {
  return value.split(' + ').map((part) => part.trim()).filter(Boolean);
}
