import type { ShoppingItem as ShoppingItemType, ShoppingItemStatus } from '../../types/shopping';
import { formatTenge } from '../../utils/budget';

interface ShoppingItemProps {
  item: ShoppingItemType;
  onStatusChange: (status: ShoppingItemStatus) => void;
}

export function ShoppingItem({ item, onStatusChange }: ShoppingItemProps) {
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
          <span>{item.quantityText}</span>
        </div>
        <div className="muted">{item.usedForDishes.join(', ')}</div>
        {item.replacement ? <div className="muted">Замена: {item.replacement}</div> : null}
        {item.comment ? <div className="muted">{item.comment}</div> : null}
        <div className="shopping-item__controls">
          <select value={item.status} onChange={(event) => onStatusChange(event.target.value as ShoppingItemStatus)}>
            <option value="to_buy">Купить</option>
            <option value="in_cart">В корзине</option>
            <option value="have_at_home">Уже есть дома</option>
            <option value="skip">Не покупать</option>
          </select>
          <span>{formatTenge(item.estimatedPrice)}</span>
        </div>
      </div>
    </article>
  );
}
