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

## Risks

- Google Apps Script квоты могут ограничить частые записи.
- Frontend token не является секретом.
- При ручном редактировании таблицы возможны невалидные значения.
- Legacy миграцию нужно проверять вручную, особенно `Dish ID` и единицы измерения.
