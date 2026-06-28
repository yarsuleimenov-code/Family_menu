# QA Report

Дата проверки: 2026-06-28

Endpoint: `https://script.google.com/macros/s/AKfycbwxBrNP6JNIeafbm7iw0uAFyAC9REAzAHRAcYyrxab43tsfXnKh-0u5AHPMtwv97pps/exec`

## Вывод

Live цепочка проверена:

`React frontend -> Apps Script Web App -> Google Sheets -> чтение и запись данных`

Критичный критерий приёмки выполнен. Merge в `main` не выполнялся.

## Live Smoke-Test

Команда:

```powershell
$env:APPS_SCRIPT_ENDPOINT="https://script.google.com/macros/s/AKfycbwxBrNP6JNIeafbm7iw0uAFyAC9REAzAHRAcYyrxab43tsfXnKh-0u5AHPMtwv97pps/exec"
$env:API_TOKEN=""
node scripts/live_api_smoke.mjs
```

Результат:

```json
{
  "ok": true,
  "runId": "QA-1782649265008",
  "qaDate": "2026-06-29",
  "results": [
    "read:dishes/calendar_plan/base_products",
    "write:selected_dinners",
    "shopping:selected-only/no-alternatives/base-off",
    "shopping:base-on",
    "write:shopping_sessions"
  ]
}
```

## Проверка по пунктам

| # | Проверка | Статус | Факт |
|---|---|---|---|
| 1 | Frontend читает `dishes`, `calendar_plan`, `base_products` из Google Sheets | Passed | `/dishes`, `/base-products`, `/plan` загружают live QA-данные через Apps Script. |
| 2 | Выбранные ужины записываются в `selected_dinners` | Passed | `saveSelectedDinner` проверен smoke-test и отображается в `/history`. |
| 3 | Shopping sessions записываются в `shopping_sessions` | Passed | `saveShoppingSession` проверен smoke-test и отображается в `/history`. |
| 4 | Список покупок строится только по выбранным блюдам | Passed | Smoke-test проверил наличие ингредиента выбранного блюда. |
| 5 | Невыбранные альтернативы не попадают в покупки | Passed | Smoke-test проверил отсутствие ингредиента option B в списке. |
| 6 | Базовые продукты добавляются только при включённом переключателе | Passed | Smoke-test проверил base off/base on. |
| 7 | Чекбоксы покупок по умолчанию пустые | Passed | Проверено в browser на live frontend после `Очистить` и reload. |
| 8 | Отметки `В корзине` сохраняются после обновления страницы | Passed | Проверено в browser: первый shopping item остался checked после reload. |
| 9 | Приложение проверено на мобильной ширине | Passed | Browser viewport `390x844`, live screenshots сохранены. |
| 10 | README содержит запуск, env и настройку Apps Script | Passed | README содержит запуск, `.env`, Apps Script deployment и live smoke-test. |

## Frontend Live QA

- `/plan`: live data загружается; calendar plan отображается на дату `2026-06-29`; выбор блюда работает. Random dinner вернул корректное empty state `Нет подходящих активных блюд`, потому что все QA-блюда уже были выбраны в текущей неделе.
- `/shopping`: список строится по выбранному блюду; base product появляется при включённом флаге; чекбоксы работают и сохраняются после reload.
- `/dishes`: live блюда загружаются. CRUD endpoint-ы `createDish`, `updateDish`, `deactivateDish` проверены напрямую через Apps Script.
- `/base-products`: live продукты загружаются. CRUD endpoint-ы `createBaseProduct`, `updateBaseProduct`, `deactivateBaseProduct` проверены напрямую через Apps Script.
- `/history`: selected dinners и shopping sessions отображаются.
- `/settings`: endpoint из `.env` не раскрывается в UI; поле показывает placeholder `настроен через .env`.

## Backend / Sheet Structure

`setupSheets` выполнен через smoke-test. Backend работает с вкладками:

- `dishes`
- `dish_ingredients`
- `calendar_plan`
- `base_products`
- `shopping_sessions`
- `selected_dinners`
- `settings`

Локальный backend-файл `apps-script/CodeV2.gs` содержит API v2 функции: `doGet`, `doPost`, `getAppData`, read/write CRUD, `buildShoppingList`, `randomDish`, `validateData`, `setupSheets`, `migrateLegacyData`.

## Build Checks

- TypeScript: passed через `tsc`.
- Production build: passed через `vite build`.
- `npm` в текущей среде не доступен в PATH, поэтому проверки выполнены bundled Node-командами. В `frontend/package.json` добавлен `npm run typecheck`.

## Скриншоты

- `screenshots/live/plan-live.png`
- `screenshots/live/shopping-live.png`
- `screenshots/live/dishes-live.png`
- `screenshots/live/base-products-live.png`
- `screenshots/live/history-live.png`
- `screenshots/live/settings-live.png`

## Обнаруженные проблемы и исправления

- Apps Script/Google Sheets возвращает date cells не всегда как ISO `YYYY-MM-DD`. Исправлено defensively во frontend через нормализацию дат; smoke-test тоже нормализует даты. В `apps-script/CodeV2.gs` также добавлена нормализация `Date` в `trim_()`.
- `/history` падал на `Invalid time value` до frontend-нормализации дат. Исправлено.
- Settings UI показывал env endpoint в input value. Исправлено: endpoint не подставляется, показывается placeholder.

## Известные ограничения

- Smoke-test оставляет QA-записи в Google Sheet, потому что delete API в v1 не реализован.
- Random dinner на маленьком QA dataset может вернуть empty state после выбора всех активных QA-блюд в текущей неделе.
- Frontend token не является секретом.
- Multi-user конфликты не решаются в v1.
- Legacy migration не запускалась в этом live QA, потому что проверялась v2-структура.
