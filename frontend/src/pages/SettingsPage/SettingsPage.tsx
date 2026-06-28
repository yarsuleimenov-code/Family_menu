import { useState } from 'react';
import { useAppState } from '../../app/AppState';
import type { AppSettings } from '../../types/settings';

export function SettingsPage() {
  const { data, updateSettings } = useAppState();
  const [draft, setDraft] = useState<AppSettings>(data.settings);
  const [message, setMessage] = useState('');

  const save = async () => {
    await updateSettings({
      ...draft,
      forbiddenProducts: draft.forbiddenProducts.map((item) => item.trim()).filter(Boolean),
    });
    setMessage('Настройки сохранены');
  };

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <h1>Настройки</h1>
          <p>Источник данных, бюджет и ограничения.</p>
        </div>
      </div>

      {message ? <div className="inline-note">{message}</div> : null}
      <form className="edit-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <div className="form-grid">
          <label>Недельный бюджет, ₸ <input type="number" value={draft.weeklyBudget} onChange={(event) => setDraft({ ...draft, weeklyBudget: Number(event.target.value) })} /></label>
          <label>Количество человек <input type="number" value={draft.peopleCount} onChange={(event) => setDraft({ ...draft, peopleCount: Number(event.target.value) })} /></label>
          <label>Источник данных
            <select value={draft.dataSource} onChange={(event) => setDraft({ ...draft, dataSource: event.target.value as AppSettings['dataSource'] })}>
              <option value="mock">localStorage / mock</option>
              <option value="googleSheets">Google Sheets API</option>
            </select>
          </label>
        </div>
        <label>Apps Script endpoint <input value={draft.appsScriptEndpoint || ''} placeholder="настроен через .env" onChange={(event) => setDraft({ ...draft, appsScriptEndpoint: event.target.value })} /></label>
        <label>Запрещённые продукты через запятую
          <textarea value={draft.forbiddenProducts.join(', ')} onChange={(event) => setDraft({ ...draft, forbiddenProducts: event.target.value.split(',') })} />
        </label>
        <div className="toolbar">
          <button className="primary" type="submit">Сохранить</button>
        </div>
      </form>

      <section className="section-block">
        <div className="section-title"><h2>Экспорт / импорт</h2></div>
        <p className="muted">В v1 данные кэшируются в localStorage. Для бэкапа используйте Google Sheet или экспорт localStorage через DevTools.</p>
      </section>
    </section>
  );
}
