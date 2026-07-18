import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Plus, Printer, Trash2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShoppingItem } from '../../components/ShoppingItem/ShoppingItem';
import { shoppingSessionWriteKey, useAppState } from '../../app/AppState';
import { buildShoppingList } from '../../services/shoppingListBuilder';
import {
  ACTIVE_SHOPPING_SESSION_KEY,
  completeShoppingSession,
  copyShoppingSession,
  createShoppingSessionDebouncer,
  createShoppingSession,
  findActiveSession,
  normalizeShoppingSession,
  sessionSummary,
  updateShoppingItem,
} from '../../services/shoppingSessions';
import { readStorage, removeStorage, writeStorage } from '../../services/storage';
import type { ShoppingItem as ShoppingItemType, ShoppingItemStatus, ShoppingSession } from '../../types/shopping';
import { addDays, getDateRange, todayIso } from '../../utils/dates';
import { formatTenge, isOverBudget } from '../../utils/budget';

const DEFAULT_MANUAL_CATEGORY = 'прочее';

export function ShoppingPage() {
  const { data, saveShoppingSession, saveStatuses, pendingWrites, retryPendingWrite, discardPendingWrite } = useAppState();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const viewedId = searchParams.get('session');
  const copiedId = searchParams.get('copy');
  const [dateFrom, setDateFrom] = useState(todayIso());
  const [dateTo, setDateTo] = useState(addDays(todayIso(), 6));
  const [includeBase, setIncludeBase] = useState(true);
  const [hidePurchased, setHidePurchased] = useState(false);
  const [message, setMessage] = useState('');
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [activeSession, setActiveSession] = useState<ShoppingSession | undefined>(() => {
    const draft = readStorage<ShoppingSession | undefined>(ACTIVE_SHOPPING_SESSION_KEY, undefined);
    return draft ? normalizeShoppingSession(draft) : undefined;
  });
  const [newCandidate, setNewCandidate] = useState<ShoppingSession>();
  const [finishOpen, setFinishOpen] = useState(false);
  const [remainingConfirmed, setRemainingConfirmed] = useState(false);
  const saveDebouncer = useRef<ReturnType<typeof createShoppingSessionDebouncer>>();
  if (!saveDebouncer.current) saveDebouncer.current = createShoppingSessionDebouncer(saveShoppingSession);

  useEffect(() => () => saveDebouncer.current?.flush(), []);

  useEffect(() => {
    if (!activeSession) {
      const stored = findActiveSession(data.shoppingSessions);
      if (stored) {
        setActiveSession(stored);
        writeStorage(ACTIVE_SHOPPING_SESSION_KEY, stored);
      }
    }
  }, [activeSession, data.shoppingSessions]);

  const selectedDinners = useMemo(() => {
    const dates = getDateRange(dateFrom, dateTo);
    return data.selectedDinners.filter((selection) => dates.includes(selection.date));
  }, [data.selectedDinners, dateFrom, dateTo]);
  const generatedItems = useMemo(() => buildShoppingList(selectedDinners, data.dishes, data.baseProducts, includeBase), [selectedDinners, data.dishes, data.baseProducts, includeBase]);
  const viewedSession = useMemo(() => viewedId ? data.shoppingSessions.find((item) => item.sessionId === viewedId) : undefined, [data.shoppingSessions, viewedId]);
  const copiedSession = useMemo(() => copiedId ? data.shoppingSessions.find((item) => item.sessionId === copiedId) : undefined, [copiedId, data.shoppingSessions]);
  const session = viewedSession ? normalizeShoppingSession(viewedSession) : activeSession;
  const readOnly = Boolean(viewedSession);
  const items = session?.shoppingList || generatedItems;
  const visibleItems = hidePurchased ? items.filter((item) => item.status !== 'purchased') : items;
  const summary = session ? sessionSummary(session) : { total: items.length, purchased: 0, skipped: 0, remaining: items.length, estimatedTotal: generatedItems.reduce((sum, item) => sum + (item.estimatedPrice || 0), 0) };
  const grouped = groupByCategory(visibleItems);
  const saveStatusKey = activeSession ? shoppingSessionWriteKey(activeSession.sessionId) : undefined;
  const saveStatus = saveStatusKey ? saveStatuses[saveStatusKey] : undefined;
  const sessionPending = saveStatusKey ? pendingWrites.filter((write) => write.statusKey === saveStatusKey) : [];

  const queueSave = (next: ShoppingSession) => {
    setActiveSession(next);
    writeStorage(ACTIVE_SHOPPING_SESSION_KEY, next);
    saveDebouncer.current?.schedule(next);
  };

  const buildCandidate = (source?: ShoppingSession) => source
    ? copyShoppingSession(normalizeShoppingSession(source))
    : createShoppingSession({ dateFrom, dateTo, selectedDishes: selectedDinners, includeBaseProducts: includeBase, items: generatedItems });

  const requestNewSession = (source?: ShoppingSession) => {
    const candidate = buildCandidate(source);
    if (activeSession) setNewCandidate(candidate);
    else startSession(candidate);
  };

  const startSession = (candidate: ShoppingSession) => {
    setActiveSession(candidate);
    writeStorage(ACTIVE_SHOPPING_SESSION_KEY, candidate);
    setNewCandidate(undefined);
    void saveShoppingSession(candidate);
    setMessage('Новая закупка создана');
    if (viewedId || copiedId) navigate('/shopping');
  };

  const replaceActive = async (status: 'completed' | 'archived') => {
    if (!activeSession || !newCandidate) return;
    saveDebouncer.current?.cancel();
    const now = new Date().toISOString();
    const previous = { ...activeSession, status, updatedAt: now, completedAt: status === 'completed' ? now : activeSession.completedAt };
    await saveShoppingSession(previous);
    startSession(newCandidate);
  };

  const changeStatus = (itemId: string, status: ShoppingItemStatus) => {
    if (!activeSession || readOnly) return;
    queueSave(updateShoppingItem(activeSession, itemId, status));
  };

  const addManualItem = () => {
    if (!activeSession || !manualName.trim()) return;
    const now = new Date().toISOString();
    const item: ShoppingItemType = {
      itemId: crypto.randomUUID(), key: `manual:${crypto.randomUUID()}`, productName: manualName.trim(), category: DEFAULT_MANUAL_CATEGORY,
      quantityText: '1 шт', usedForDishes: ['Добавлено вручную'], status: 'to_buy', source: 'manual',
    };
    queueSave({ ...activeSession, updatedAt: now, shoppingList: [item, ...activeSession.shoppingList] });
    setManualName('');
    setManualFormOpen(false);
  };

  const removeManualItem = (itemId: string) => {
    if (!activeSession) return;
    queueSave({ ...activeSession, updatedAt: new Date().toISOString(), shoppingList: activeSession.shoppingList.filter((item) => item.itemId !== itemId) });
  };

  const finishSession = async () => {
    if (!activeSession) return;
    const completed = completeShoppingSession(activeSession, remainingConfirmed);
    if (!completed) return;
    saveDebouncer.current?.cancel();
    await saveShoppingSession(completed);
    removeStorage(ACTIVE_SHOPPING_SESSION_KEY);
    setActiveSession(undefined);
    setFinishOpen(false);
    setRemainingConfirmed(false);
    setMessage('Закупка завершена и сохранена в Истории');
  };

  const copyList = async () => {
    await navigator.clipboard.writeText(items.map((item) => `${statusLabel(item.status)} ${item.productName} — ${item.quantityText}`).join('\n'));
    setMessage('Список скопирован');
  };

  return (
    <section className="page shopping-page">
      <div className="page-heading">
        <div><h1>{readOnly ? 'Завершённая закупка' : 'Покупки'}</h1><p>{session ? `${session.dateFrom} — ${session.dateTo}` : 'Создайте отдельную закупку из выбранного плана.'}</p></div>
        <div className="budget-pill">{formatTenge(summary.estimatedTotal)}</div>
      </div>

      {copiedSession && session ? <button type="button" className="primary shopping-primary-action" onClick={() => requestNewSession(copiedSession)}>Создать новую на основе прошлой закупки</button> : null}

      {!session ? <>
        <div className="control-panel">
          <label>С <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
          <label>По <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
          <label className="switch-row"><input type="checkbox" checked={includeBase} onChange={(event) => setIncludeBase(event.target.checked)} /> Добавить базовые покупки</label>
        </div>
        <button type="button" className="primary shopping-primary-action" onClick={() => requestNewSession(copiedSession)}> {copiedSession ? 'Создать на основе прошлой закупки' : 'Начать новую закупку'} </button>
      </> : null}

      <section className="shopping-store-panel" aria-label="Сводка покупок">
        <div className="shopping-summary">
          <div><span>Куплено</span><strong>{summary.purchased}/{summary.total}</strong></div>
          <div><span>Осталось</span><strong>{summary.remaining}</strong></div>
          <div><span>Пропущено</span><strong>{summary.skipped}</strong></div>
          <div><span>Сумма</span><strong>{formatTenge(summary.estimatedTotal)}</strong></div>
        </div>
        <div className="store-actions">
          <button type="button" className={hidePurchased ? 'selected-filter' : ''} onClick={() => setHidePurchased(!hidePurchased)}>Скрыть купленные</button>
          <button type="button" onClick={() => void copyList()}><Copy size={18} /> Скопировать</button>
          <button type="button" onClick={() => window.print()}><Printer size={18} /> Печать</button>
        </div>
      </section>

      {session && !readOnly ? <section className="manual-item-panel">
        <div className="section-title"><h2>Добавить товар</h2><button type="button" onClick={() => setManualFormOpen(!manualFormOpen)}>{manualFormOpen ? 'Свернуть' : 'Открыть'}</button></div>
        {manualFormOpen ? <div className="manual-item-quick"><input value={manualName} onChange={(event) => setManualName(event.target.value)} placeholder="например, вода" /><button type="button" className="primary" onClick={addManualItem}><Plus size={18} /> Добавить</button></div> : null}
      </section> : null}

      {message ? <div className="inline-note">{message}</div> : null}
      {saveStatus ? <div className={`save-status save-status--${saveStatus.status}`}><span>{saveStatus.message}</span>{sessionPending.map((write) => <span className="pending-write-actions" key={write.id}><span>{write.status === 'outcome_unknown' ? 'Результат синхронизации неизвестен.' : null}</span>{write.status !== 'in_flight' && write.status !== 'expired' ? <button type="button" onClick={() => void retryPendingWrite(write.id)}>Повторить</button> : null}{write.status !== 'in_flight' ? <button type="button" onClick={() => discardPendingWrite(write.id)}>Удалить</button> : null}</span>)}</div> : null}
      {isOverBudget(summary.estimatedTotal, data.settings.weeklyBudget) ? <div className="budget-warning">Ориентировочная сумма выше недельного бюджета.</div> : null}

      <div className="shopping-session-list">
        {Object.entries(grouped).map(([category, categoryItems]) => <section className="section-block shopping-category" key={category}>
          <div className="section-title shopping-category__title"><h2>{category}</h2><span>{categoryItems.length}</span></div>
          <div className="shopping-list">{categoryItems.map((item) => <ShoppingItem key={item.itemId || item.key} item={item} readOnly={readOnly || !activeSession} onStatusChange={(status) => changeStatus(item.itemId, status)} onRemove={!readOnly && item.source === 'manual' ? () => removeManualItem(item.itemId) : undefined} />)}</div>
        </section>)}
      </div>

      {session && !readOnly ? <div className="shopping-sticky-action"><strong>Куплено {summary.purchased} из {summary.total}</strong><button type="button" className="primary" onClick={() => setFinishOpen(true)}>Завершить закупку</button></div> : null}
      {readOnly ? <button type="button" className="primary shopping-primary-action" onClick={() => requestNewSession(session)}>Создать новую на основе этой</button> : null}

      {newCandidate ? <div className="dialog-backdrop" role="presentation"><section className="choice-dialog" role="dialog" aria-modal="true" aria-label="Активная закупка уже существует"><h2>Есть активная закупка</h2><p>Она не будет заменена без вашего решения.</p><button type="button" className="primary" onClick={() => setNewCandidate(undefined)}>Продолжить текущую</button><button type="button" onClick={() => void replaceActive('completed')}>Завершить и создать новую</button><button type="button" onClick={() => void replaceActive('archived')}>Архивировать и создать новую</button><button type="button" onClick={() => setNewCandidate(undefined)}>Отменить</button></section></div> : null}
      {finishOpen && activeSession ? <div className="dialog-backdrop" role="presentation"><section className="choice-dialog" role="dialog" aria-modal="true" aria-label="Завершить закупку"><h2>Итоги закупки</h2><p>Всего {summary.total}; куплено {summary.purchased}; пропущено {summary.skipped}; осталось {summary.remaining}; сумма {formatTenge(summary.estimatedTotal)}.</p>{summary.remaining ? <label className="repeat-week-warning"><input type="checkbox" checked={remainingConfirmed} onChange={(event) => setRemainingConfirmed(event.target.checked)} /> Подтверждаю завершение с оставшимися товарами.</label> : null}<button type="button" className="primary" disabled={summary.remaining > 0 && !remainingConfirmed} onClick={() => void finishSession()}>Завершить и сохранить</button><button type="button" onClick={() => setFinishOpen(false)}>Продолжить закупку</button></section></div> : null}
    </section>
  );
}

function groupByCategory(items: ShoppingItemType[]): Record<string, ShoppingItemType[]> {
  return items.reduce<Record<string, ShoppingItemType[]>>((result, item) => { (result[item.category] ||= []).push(item); return result; }, {});
}

function statusLabel(status: ShoppingItemStatus): string {
  return status === 'purchased' ? '[куплено]' : status === 'skipped' ? '[пропущено]' : '[купить]';
}
