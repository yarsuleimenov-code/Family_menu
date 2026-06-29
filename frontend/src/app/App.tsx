import { Outlet } from 'react-router-dom';
import { BottomNav } from '../components/BottomNav/BottomNav';
import { ErrorPanel } from '../components/ErrorPanel/ErrorPanel';
import { LoadingState } from '../components/LoadingState/LoadingState';
import { useAppState } from './AppState';

export function App() {
  const { loading, error, data, syncStatus } = useAppState();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <strong>Family menu</strong>
          <span>Планировщик семейных ужинов</span>
        </div>
        <div className="topbar__meta">
          <span
            className={`sync-status sync-status--${syncStatus.status}`}
            title={syncStatus.detail}
          >
            {syncStatus.message}
          </span>
          <span>{data.settings.peopleCount} чел.</span>
          <span>{new Intl.NumberFormat('ru-KZ').format(data.settings.weeklyBudget)} ₸/нед.</span>
        </div>
      </header>
      <main className="app-main">
        {loading ? (
          <LoadingState />
        ) : (
          <>
            {error ? <ErrorPanel message={error} details="Проверьте endpoint Apps Script или переключитесь на mock-режим в .env." /> : null}
            <Outlet />
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
