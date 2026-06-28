import { useMemo, useState } from 'react';
import { Copy, Printer, Save, Trash2 } from 'lucide-react';
import { ShoppingItem } from '../../components/ShoppingItem/ShoppingItem';
import { useAppState } from '../../app/AppState';
import { buildShoppingList } from '../../services/shoppingListBuilder';
import { readStorage, writeStorage } from '../../services/storage';
import type { ShoppingItemStatus, ShoppingSession } from '../../types/shopping';
import { addDays, getDateRange, todayIso } from '../../utils/dates';
import { formatTenge, isOverBudget, sumShoppingItems } from '../../utils/budget';

const STATUS_KEY = 'shopping-status';

export function ShoppingPage() {
  const { data, saveShoppingSession } = useAppState();
  const [dateFrom, setDateFrom] = useState(todayIso());
  const [dateTo, setDateTo] = useState(addDays(todayIso(), 6));
  const [includeBase, setIncludeBase] = useState(true);
  const [hideBought, setHideBought] = useState(false);
  const [statusByKey, setStatusByKey] = useState<Record<string, ShoppingItemStatus>>(() => readStorage(STATUS_KEY, {}));
  const [message, setMessage] = useState('');
  const [generatedAt, setGeneratedAt] = useState<string>();

  const selectedDinners = useMemo(() => {
    const dates = getDateRange(dateFrom, dateTo);
    return data.selectedDinners.filter((selection) => dates.includes(selection.date));
  }, [data.selectedDinners, dateFrom, dateTo]);

  const shoppingItems = useMemo(() => buildShoppingList(selectedDinners, data.dishes, data.baseProducts, includeBase, statusByKey), [selectedDinners, data.dishes, data.baseProducts, includeBase, statusByKey]);
  const visibleItems = hideBought ? shoppingItems.filter((item) => item.status !== 'in_cart') : shoppingItems;
  const total = sumShoppingItems(shoppingItems);
  const withoutPrice = shoppingItems.filter((item) => !item.estimatedPrice);

  const setStatus = (key: string, status: ShoppingItemStatus) => {
    const next = { ...statusByKey, [key]: status };
    setStatusByKey(next);
    writeStorage(STATUS_KEY, next);
  };

  const copyList = async () => {
    const text = shoppingItems.map((item) => `${statusLabel(item.status)} ${item.productName} - ${item.quantityText}`).join('\n');
    await navigator.clipboard.writeText(`Список покупок\n${text}`);
    setMessage('Список скопирован');
  };

  const saveSession = async () => {
    const session: ShoppingSession = {
      sessionId: `S-${Date.now()}`,
      createdAt: new Date().toISOString(),
      dateFrom,
      dateTo,
      selectedDishes: selectedDinners,
      includeBaseProducts: includeBase,
      shoppingList: shoppingItems,
      estimatedTotal: total,
    };
    await saveShoppingSession(session);
    setMessage('Список сохранён');
  };

  const clearMarks = () => {
    setStatusByKey({});
    writeStorage(STATUS_KEY, {});
  };

  const markAll = () => {
    const next = Object.fromEntries(shoppingItems.map((item) => [item.key, 'in_cart' as ShoppingItemStatus]));
    setStatusByKey(next);
    writeStorage(STATUS_KEY, next);
  };

  const generateList = () => {
    setGeneratedAt(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
    setMessage(shoppingItems.length ? `Список сформирован: ${shoppingItems.length} поз.` : 'Нет выбранных блюд в диапазоне');
  };

  const grouped = groupByCategory(visibleItems);

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <h1>Покупки</h1>
          <p>Только выбранные блюда попадают в список.</p>
        </div>
        <div className="budget-pill">{formatTenge(total)}</div>
      </div>

      <div className="control-panel">
        <label>С <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label>По <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        <label className="switch-row"><input type="checkbox" checked={includeBase} onChange={(event) => setIncludeBase(event.target.checked)} /> Добавить базовые покупки</label>
        <label className="switch-row"><input type="checkbox" checked={hideBought} onChange={(event) => setHideBought(event.target.checked)} /> Скрыть купленное</label>
      </div>

      {isOverBudget(total, data.settings.weeklyBudget) ? <div className="budget-warning">Ориентировочная сумма выше недельного бюджета.</div> : null}
      {withoutPrice.length ? <div className="inline-note">Без цены: {withoutPrice.map((item) => item.productName).join(', ')}</div> : null}
      {generatedAt ? <div className="inline-note">Последнее формирование: {generatedAt}</div> : null}
      {message ? <div className="inline-note">{message}</div> : null}

      <div className="toolbar">
        <button className="primary" type="button" onClick={generateList}>Сформировать список</button>
        <button type="button" onClick={() => void copyList()}><Copy size={18} /> Скопировать</button>
        <button type="button" onClick={() => window.print()}><Printer size={18} /> Печать</button>
        <button type="button" onClick={() => void saveSession()}><Save size={18} /> Сохранить</button>
        <button type="button" onClick={clearMarks}><Trash2 size={18} /> Очистить</button>
        <button type="button" onClick={markAll}>Отметить всё</button>
      </div>

      {!shoppingItems.length ? <div className="empty-state">Выберите ужины в разделе План.</div> : null}
      {Object.entries(grouped).map(([category, items]) => (
        <section className="section-block" key={category}>
          <div className="section-title"><h2>{category}</h2><span>{items.length}</span></div>
          <div className="shopping-list">
            {items.map((item) => <ShoppingItem key={item.key} item={item} onStatusChange={(status) => setStatus(item.key, status)} />)}
          </div>
        </section>
      ))}
    </section>
  );
}

function groupByCategory(items: ReturnType<typeof buildShoppingList>): Record<string, ReturnType<typeof buildShoppingList>> {
  return items.reduce<Record<string, ReturnType<typeof buildShoppingList>>>((acc, item) => {
    acc[item.category] ||= [];
    acc[item.category].push(item);
    return acc;
  }, {});
}

function statusLabel(status: ShoppingItemStatus): string {
  return status === 'in_cart' ? '[в корзине]' : status === 'have_at_home' ? '[есть дома]' : status === 'skip' ? '[не покупать]' : '[купить]';
}
