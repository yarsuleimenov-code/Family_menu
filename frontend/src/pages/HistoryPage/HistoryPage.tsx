import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppState } from '../../app/AppState';
import { RepeatWeekDialog } from '../../components/RepeatWeekDialog/RepeatWeekDialog';
import { availablePastWeeks } from '../../services/repeatWeek';
import { formatRuDate } from '../../utils/dates';
import { todayIso } from '../../utils/dates';
import { formatTenge } from '../../utils/budget';
import { normalizeShoppingSession, sessionSummary } from '../../services/shoppingSessions';

export function HistoryPage() {
  const { data, refresh, saveRepeatedDay } = useAppState();
  const navigate = useNavigate();
  const [repeatSourceWeek, setRepeatSourceWeek] = useState<string>();
  const pastWeeks = useMemo(() => availablePastWeeks(data.selectedDinners, todayIso()), [data.selectedDinners]);
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
        <div className="section-title"><h2>Прошлые недели</h2><span>{pastWeeks.length}</span></div>
        {pastWeeks.length ? (
          <div className="history-list">
            {pastWeeks.map((week) => (
              <article key={week.weekStart} className="history-row history-week-row">
                <div>
                  <strong>{formatRuDate(week.weekStart)}–{formatRuDate(week.weekEnd)}</strong>
                  <span>{week.plannedCount} запланированных блюд</span>
                </div>
                <button type="button" className="primary" onClick={() => setRepeatSourceWeek(week.weekStart)}>Повторить неделю</button>
              </article>
            ))}
          </div>
        ) : <div className="empty-state">Нет завершённых недель с блюдами. Сначала составьте план хотя бы на один день.</div>}
      </section>

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
          {data.shoppingSessions.slice(0, 10).map((rawSession) => {
            const session = normalizeShoppingSession(rawSession);
            const summary = sessionSummary(session);
            return <article key={session.sessionId} className="history-row history-shopping-row">
              <div><strong>{formatRuDate(session.createdAt)} · {session.status}</strong><span>{formatRuDate(session.dateFrom)}–{formatRuDate(session.dateTo)} · {summary.total} поз. · куплено {summary.purchased} · {formatTenge(summary.estimatedTotal)}</span></div>
              <div className="history-row__actions"><Link to={`/shopping?session=${session.sessionId}`}>Открыть</Link><Link to={`/shopping?copy=${session.sessionId}`}>Повторить без статусов</Link></div>
            </article>;
          })}
          {!data.shoppingSessions.length ? <div className="empty-state">Завершённые и архивные закупки появятся здесь.</div> : null}
        </div>
      </section>

      {repeatSourceWeek ? (
        <RepeatWeekDialog
          initialSourceWeek={repeatSourceWeek}
          pastWeeks={pastWeeks}
          selections={data.selectedDinners}
          refresh={refresh}
          saveRepeatedDay={saveRepeatedDay}
          onClose={() => setRepeatSourceWeek(undefined)}
          onOpenPlan={(targetWeek) => navigate(`/plan?date=${targetWeek}`)}
        />
      ) : null}
    </section>
  );
}
