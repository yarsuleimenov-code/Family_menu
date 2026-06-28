import { Link } from 'react-router-dom';
import { useAppState } from '../../app/AppState';
import { formatRuDate } from '../../utils/dates';
import { formatTenge } from '../../utils/budget';

export function HistoryPage() {
  const { data } = useAppState();
  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <h1>Ещё</h1>
          <p>История и настройки.</p>
        </div>
        <Link className="primary compact-link" to="/settings">Настройки</Link>
      </div>

      <section className="section-block">
        <div className="section-title"><h2>Последние ужины</h2><span>{data.selectedDinners.length}</span></div>
        <div className="history-list">
          {data.selectedDinners.slice(0, 10).map((selection) => (
            <article key={selection.id} className="history-row">
              <strong>{selection.dishName}</strong>
              <span>{formatRuDate(selection.date)} · {selection.status}</span>
            </article>
          ))}
          {!data.selectedDinners.length ? <div className="empty-state">История появится после выбора блюда.</div> : null}
        </div>
      </section>

      <section className="section-block">
        <div className="section-title"><h2>Shopping sessions</h2><span>{data.shoppingSessions.length}</span></div>
        <div className="history-list">
          {data.shoppingSessions.slice(0, 10).map((session) => (
            <article key={session.sessionId} className="history-row">
              <strong>{formatTenge(session.estimatedTotal)}</strong>
              <span>{formatRuDate(session.dateFrom)} - {formatRuDate(session.dateTo)} · {session.shoppingList.length} поз.</span>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
