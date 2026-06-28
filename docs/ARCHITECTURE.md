# Architecture

## Цель

Дать семье быстрый рабочий сценарий: открыть приложение, выбрать ужин, сформировать покупки.

## Scope v1

- Mobile-first React App.
- Локальный mock/localStorage режим.
- Google Sheets через Apps Script API как основной бесплатный backend.
- CRUD блюд и базовых продуктов.
- Список покупок только по выбранным ужинам.

## Data source decision

Рекомендуемый вариант: Google Sheets + Apps Script.

Причина: для семейного меню важнее простота редактирования и бесплатный запуск, чем масштабируемая backend-архитектура. Supabase/Firebase удобнее для multi-user и авторизации, но добавляют настройку проекта, правила доступа и администрирование. Для v1 это избыточно.

## Frontend boundaries

- `pages/*` отвечают за сценарии.
- `components/*` отвечают за повторяемый UI.
- `services/api.ts` скрывает источник данных.
- `services/googleSheetsApi.ts` знает только транспорт Apps Script.
- `services/shoppingListBuilder.ts` содержит бизнес-логику покупок.
- `services/randomDish.ts` содержит подбор блюд и ограничения.

## Stabilization decisions

- GitHub Pages использует `docs/index.html` и `docs/404.html`; оба файла должны ссылаться на один актуальный bundle. Скрипт `scripts/sync_pages_404.mjs` синхронизирует fallback после `build:pages`.
- Во время initial loading основной роут не рендерится, чтобы пользователь не видел mock-данные как реальные live данные.
- `LoadingState` показывает дополнительную подсказку после 8 секунд, потому что Apps Script cold start может быть долгим.
- `/shopping` строит список автоматически при изменении диапазона и переключателя базовых продуктов, но также имеет явную кнопку `Сформировать список` для пользовательского подтверждения сценария.
- QA/seed записи чистятся через API action `cleanupSeedRows`; скрипты smoke не должны оставлять мусор в рабочем Google Sheet.

## Risks

- Google Apps Script квоты могут ограничить частые записи.
- Frontend token не является секретом.
- При ручном редактировании таблицы возможны невалидные значения.
- Legacy миграцию нужно проверять вручную, особенно `Dish ID` и единицы измерения.
