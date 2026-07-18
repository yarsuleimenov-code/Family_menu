import { useMemo, useState } from 'react';
import { Copy, Plus, Printer, Save, Trash2 } from 'lucide-react';
import { ShoppingItem } from '../../components/ShoppingItem/ShoppingItem';
import { shoppingSessionWriteKey, useAppState } from '../../app/AppState';
import { buildShoppingList } from '../../services/shoppingListBuilder';
import { readStorage, writeStorage } from '../../services/storage';
import type { ShoppingItem as ShoppingItemType, ShoppingItemStatus, ShoppingSession } from '../../types/shopping';
import { addDays, getDateRange, todayIso } from '../../utils/dates';
import { formatTenge, isOverBudget, sumShoppingItems } from '../../utils/budget';

const STATUS_KEY = 'shopping-status';
const MANUAL_ITEMS_KEY = 'shopping-manual-items';
const DEFAULT_MANUAL_CATEGORY = 'прочее';

interface ManualShoppingItem {
  id: string;
  productName: string;
  quantity: string;
  unit: string;
  category: string;
  estimatedPrice?: number;
}

export function ShoppingPage() {
  const { data, saveShoppingSession, saveStatuses, pendingWrites, retryPendingWrite, discardPendingWrite } = useAppState();
  const [dateFrom, setDateFrom] = useState(todayIso());
  const [dateTo, setDateTo] = useState(addDays(todayIso(), 6));
  const [includeBase, setIncludeBase] = useState(true);
  const [hideBought, setHideBought] = useState(false);
  const [statusByKey, setStatusByKey] = useState<Record<string, ShoppingItemStatus>>(() => readStorage(STATUS_KEY, {}));
  const [message, setMessage] = useState('');
  const [generatedAt, setGeneratedAt] = useState<string>();
  const [lastSessionId, setLastSessionId] = useState<string>();
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [manualItems, setManualItems] = useState<ManualShoppingItem[]>(() => readStorage(MANUAL_ITEMS_KEY, []));
  const [manualDraft, setManualDraft] = useState<ManualShoppingItem>({
    id: '',
    productName: '',
    quantity: '1',
    unit: 'шт',
    category: DEFAULT_MANUAL_CATEGORY,
  });

  const selectedDinners = useMemo(() => {
    const dates = getDateRange(dateFrom, dateTo);
    return data.selectedDinners.filter((selection) => dates.includes(selection.date));
  }, [data.selectedDinners, dateFrom, dateTo]);

  const generatedItems = useMemo(() => buildShoppingList(selectedDinners, data.dishes, data.baseProducts, includeBase, statusByKey), [selectedDinners, data.dishes, data.baseProducts, includeBase, statusByKey]);
  const shoppingItems = useMemo(() => [
    ...generatedItems,
    ...manualItems.map((item) => manualToShoppingItem(item, statusByKey)),
  ], [generatedItems, manualItems, statusByKey]);
  const visibleItems = hideBought ? shoppingItems.filter((item) => item.status !== 'in_cart') : shoppingItems;
  const total = sumShoppingItems(shoppingItems);
  const withoutPrice = shoppingItems.filter((item) => !item.estimatedPrice);
  const inCartCount = shoppingItems.filter((item) => item.status === 'in_cart').length;
  const sessionStatusKey = lastSessionId ? shoppingSessionWriteKey(lastSessionId) : undefined;
  const sessionSaveStatus = sessionStatusKey ? saveStatuses[sessionStatusKey] : undefined;
  const sessionPendingWrites = sessionStatusKey ? pendingWrites.filter((write) => write.statusKey === sessionStatusKey) : [];

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
    const sessionId = `S-${Date.now()}`;
    const session: ShoppingSession = {
      sessionId,
      createdAt: new Date().toISOString(),
      dateFrom,
      dateTo,
      selectedDishes: selectedDinners,
      includeBaseProducts: includeBase,
      shoppingList: shoppingItems,
      estimatedTotal: total,
    };
    setLastSessionId(sessionId);
    const saved = await saveShoppingSession(session);
    setMessage(saved ? 'Список сохранён' : 'Список сохранён локально. Google Sheets не ответил.');
  };

  const clearMarks = () => {
    setStatusByKey({});
    writeStorage(STATUS_KEY, {});
  };

  const addManualItem = () => {
    if (!manualDraft.productName.trim()) return;
    const item = {
      ...manualDraft,
      id: `manual-${Date.now()}`,
      productName: manualDraft.productName.trim(),
      quantity: manualDraft.quantity.trim() || '1',
      unit: manualDraft.unit.trim() || 'шт',
      category: manualDraft.category.trim() || DEFAULT_MANUAL_CATEGORY,
      estimatedPrice: manualDraft.estimatedPrice,
    };
    const next = [item, ...manualItems];
    setManualItems(next);
    writeStorage(MANUAL_ITEMS_KEY, next);
    setManualDraft({ id: '', productName: '', quantity: '1', unit: 'шт', category: DEFAULT_MANUAL_CATEGORY });
    setManualFormOpen(false);
    setMessage('Товар добавлен вручную');
  };

  const removeManualItem = (key: string) => {
    const id = key.replace(/^manual:/, '');
    const nextManualItems = manualItems.filter((item) => item.id !== id);
    const nextStatus = { ...statusByKey };
    delete nextStatus[key];
    setManualItems(nextManualItems);
    setStatusByKey(nextStatus);
    writeStorage(MANUAL_ITEMS_KEY, nextManualItems);
    writeStorage(STATUS_KEY, nextStatus);
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
      </div>

      <section className="shopping-store-panel" aria-label="Сводка покупок">
        <div className="shopping-summary">
          <div><span>Сумма</span><strong>{formatTenge(total)}</strong></div>
          <div><span>Товаров</span><strong>{shoppingItems.length}</strong></div>
          <div><span>В корзине</span><strong>{inCartCount}</strong></div>
          <div><span>Без цены</span><strong>{withoutPrice.length}</strong></div>
        </div>
        <div className="store-actions">
          <button type="button" className={hideBought ? 'selected-filter' : ''} onClick={() => setHideBought(!hideBought)}>Скрыть купленное</button>
          <button type="button" onClick={() => void copyList()}><Copy size={18} /> Скопировать</button>
          <button type="button" onClick={clearMarks}><Trash2 size={18} /> Очистить</button>
        </div>
      </section>

      <section className="manual-item-panel">
        <div className="section-title">
          <h2>Добавить товар</h2>
          <button type="button" onClick={() => setManualFormOpen(!manualFormOpen)}>{manualFormOpen ? 'Свернуть' : 'Открыть'}</button>
        </div>
        {manualFormOpen ? (
          <div className="manual-item-grid">
            <label>Товар <input value={manualDraft.productName} onChange={(event) => setManualDraft({ ...manualDraft, productName: event.target.value })} placeholder="например, вода" /></label>
            <label>Кол-во <input value={manualDraft.quantity} onChange={(event) => setManualDraft({ ...manualDraft, quantity: event.target.value })} /></label>
            <label>Ед. <input value={manualDraft.unit} onChange={(event) => setManualDraft({ ...manualDraft, unit: event.target.value })} /></label>
            <label>Категория
              <select value={manualDraft.category} onChange={(event) => setManualDraft({ ...manualDraft, category: event.target.value })}>
                {shoppingCategories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label>Цена <input type="number" value={manualDraft.estimatedPrice || ''} onChange={(event) => setManualDraft({ ...manualDraft, estimatedPrice: Number(event.target.value) || undefined })} /></label>
            <button type="button" className="primary" onClick={addManualItem}><Plus size={18} /> Добавить</button>
          </div>
        ) : <div className="muted">Быстро добавить товар, которого нет в плане.</div>}
      </section>

      {isOverBudget(total, data.settings.weeklyBudget) ? <div className="budget-warning">Ориентировочная сумма выше недельного бюджета.</div> : null}
      {withoutPrice.length ? <div className="inline-note">Без цены: {withoutPrice.map((item) => item.productName).join(', ')}</div> : null}
      {generatedAt ? <div className="inline-note">Последнее формирование: {generatedAt}</div> : null}
      {message ? <div className="inline-note">{message}</div> : null}
      {sessionSaveStatus ? (
        <div className={`save-status save-status--${sessionSaveStatus.status}`}>
          <span>{sessionSaveStatus.message}</span>
          {sessionPendingWrites.map((write) => (
            <span className="pending-write-actions" key={write.id}>
              <span>{write.status === 'expired' ? 'Срок ожидания истёк.' : write.status === 'outcome_unknown' ? 'Результат неизвестен.' : null}</span>
              {write.status !== 'in_flight' && write.status !== 'expired' ? <button type="button" onClick={() => void retryPendingWrite(write.id)}>Повторить</button> : null}
              {write.status !== 'in_flight' ? <button type="button" onClick={() => discardPendingWrite(write.id)}>Удалить</button> : null}
            </span>
          ))}
        </div>
      ) : null}

      <div className="toolbar">
        <button className="primary" type="button" onClick={generateList}>Обновить список</button>
        <button type="button" onClick={() => window.print()}><Printer size={18} /> Печать</button>
        <button type="button" onClick={() => void saveSession()}><Save size={18} /> Сохранить</button>
        <button type="button" onClick={markAll}>Отметить всё</button>
      </div>

      {!shoppingItems.length ? <div className="empty-state">Выберите ужины в разделе План.</div> : null}
      {Object.entries(grouped).map(([category, items]) => (
        <section className="section-block shopping-category" key={category}>
          <div className="section-title shopping-category__title"><h2>{category}</h2><span>{items.length}</span></div>
          <div className="shopping-list">
            {items.map((item) => (
              <ShoppingItem
                key={item.key}
                item={item}
                onStatusChange={(status) => setStatus(item.key, status)}
                onRemove={item.key.startsWith('manual:') ? () => removeManualItem(item.key) : undefined}
              />
            ))}
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

function manualToShoppingItem(item: ManualShoppingItem, statusByKey: Record<string, ShoppingItemStatus>): ShoppingItemType {
  const key = `manual:${item.id}`;
  return {
    key,
    productId: item.id,
    productName: item.productName,
    category: item.category,
    quantityText: [item.quantity, item.unit].filter(Boolean).join(' '),
    unit: item.unit,
    usedForDishes: ['Добавлено вручную'],
    estimatedPrice: item.estimatedPrice,
    status: statusByKey[key] || 'to_buy',
  };
}

const shoppingCategories = [
  'мясо / птица / рыба',
  'молочные продукты',
  'яйца',
  'крупы / макароны / хлеб',
  'овощи',
  'фрукты',
  'специи / бакалея',
  'заморозка',
  DEFAULT_MANUAL_CATEGORY,
];

function statusLabel(status: ShoppingItemStatus): string {
  return status === 'in_cart' ? '[в корзине]' : status === 'have_at_home' ? '[есть дома]' : status === 'skip' ? '[не покупать]' : '[купить]';
}
