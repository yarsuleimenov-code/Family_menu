# QA Report

Дата проверки: 2026-06-28

Endpoint: `https://script.google.com/macros/s/AKfycbwxBrNP6JNIeafbm7iw0uAFyAC9REAzAHRAcYyrxab43tsfXnKh-0u5AHPMtwv97pps/exec`

## Вывод

Статус: Passed for v1 review + performance fast-start branch checks.

Проверена цепочка:

`React frontend -> Apps Script Web App -> Google Sheets -> чтение и запись данных`

`main` не изменялся в рамках performance-этапа. Рабочая ветка: `feature/performance-fast-start`.

## Production-like Dataset

Google Sheet заполнен рабочими данными:

- `dishes`: 20
- `base_products`: 24
- `calendar_plan`: 14
- `selected_dinners`: 9
- `shopping_sessions`: 0 после очистки QA/seed мусора

`validateData.warnings`: `[]`.

## Live API Checks

Проверено через Apps Script deployment v6:

| Проверка | Статус | Факт |
|---|---|---|
| `getAppData` читает `dishes`, `calendar_plan`, `base_products` | Passed | Live API возвращает production-like dataset. |
| `selected_dinners` очищен от старых битых seed rows | Passed | После v7 smoke cleanup осталось 9 рабочих строк selected dinners. |
| `buildShoppingList` строит список только по выбранным блюдам | Passed | Для `D-001` список содержит ингредиенты выбранного блюда. |
| Невыбранные альтернативы не попадают в покупки | Passed | Уникальные ингредиенты option B / quick отсутствуют при выключенных базовых продуктах. |
| Базовые продукты добавляются только при включённом переключателе | Passed | Base-only товары появляются только при `includeBaseProducts=true`. |
| `randomDish` исключает запрещённые продукты без false positive по `минут` / `нут` | Passed | `validateData.warnings=[]`, quick random возвращает валидное блюдо. |
| CRUD блюд и базовых продуктов | Passed | `scripts/live_crud_smoke.mjs`: create/update/deactivate для блюд и базовых продуктов, затем `cleanupSeedRows`. |
| Smoke cleanup не повреждает production calendar | Passed | `live_api_smoke` использует безопасную QA-дату `2099-12-31`; после cleanup dataset вернулся к 20/24/14/7/0. |

## Frontend Mobile QA

Среда:

- URL: `https://yarsuleimenov-code.github.io/Family_menu/`
- Viewport: `390x844`
- Browser plugin: in-app Browser
- Data source: Google Sheets через Apps Script

| Экран | Статус | Факт |
|---|---|---|
| `/plan` | Passed | Direct deep link монтирует React, после загрузки видны live данные. |
| `/shopping` | Passed | Список строится, чекбоксы товаров по умолчанию пустые после `Очистить`, `В корзине` сохраняется после reload. |
| `/dishes` | Passed | Список live блюд отображается, форма добавления открывается и отменяется без горизонтального скролла. |
| `/base-products` | Passed | Live продукты отображаются, форма добавления открывается и отменяется без горизонтального скролла. |
| `/history` | Passed | Показывает 7 последних выбранных ужинов. |
| `/settings` | Passed | Endpoint не раскрывается как значение, отображается placeholder `настроен через .env`. |

Console errors/warnings: none during mobile QA.

## P0 Fixes Closed

- GitHub Pages deep links: fixed. `docs/404.html` синхронизируется с `docs/index.html`.
- Loading state: fixed. Во время initial load больше не показываются mock-карточки под индикатором загрузки.
- Long Apps Script response: fixed. После 8 секунд показывается понятная подсказка.
- Shopping explicit action: fixed. На `/shopping` добавлена кнопка `Сформировать список`; список по-прежнему обновляется автоматически при изменении диапазона и переключателя базовых продуктов.
- Stale Pages bundles: cleaned.

## Build Checks

- `tsc`: Passed
- `vite build`: Passed
- `build:pages`: Passed

Команды:

```bash
cd frontend
npm run typecheck
npm run build
npm run build:pages
```

В текущей Codex-среде `npm` может отсутствовать в `PATH`; проверки выполнялись через bundled Node и локальные `node_modules/.bin`.

## Live CRUD Smoke

Live API smoke:

```json
{
  "ok": true,
  "runId": "QA-1782732107223",
  "qaDate": "2099-12-31",
  "results": [
    "read:dishes/calendar_plan/base_products",
    "write:selected_dinners",
    "shopping:selected-only/no-alternatives/base-off",
    "shopping:base-on",
    "write:shopping_sessions"
  ]
}
```

После smoke-test выполнен `cleanup_family_menu_live.mjs` с `CLEANUP_DRY_RUN=false`.
Удалено 8 QA rows; финальные счётчики после cleanup на Apps Script deployment v7: `dishes=20`, `baseProducts=24`, `calendarPlan=14`, `selectedDinners=9`, `shoppingSessions=0`.

Результат:

```json
{
  "ok": true,
  "runId": "QA-CRUD-1782706195874",
  "results": [
    "createDish",
    "updateDish",
    "deactivateDish",
    "createBaseProduct",
    "updateBaseProduct",
    "deactivateBaseProduct",
    "cleanupSeedRows"
  ]
}
```

## Performance Fast Start

Дата проверки: 2026-06-29

Ветка: `feature/performance-fast-start`

Изменения:

- Frontend читает последний успешный `getAppData` из `localStorage` по ключу `familyMenu.appData.v1`.
- Метаданные кэша сохраняются по ключу `familyMenu.appDataMeta.v1`.
- Если кэш есть, интерфейс рендерится сразу, а live refresh из Apps Script идёт в фоне.
- Если live refresh падает, cached данные остаются доступны, а UI показывает мягкий статус `Ошибка обновления`.
- Отметки списка покупок не перетираются, потому что shopping statuses остаются в отдельном ключе `family-menu:shopping-status`.
- В topbar добавлен компактный sync status: `Показаны сохранённые данные`, `Данные обновляются...`, `Обновлено HH:mm`, `Ошибка обновления`, `Работаем с локальными данными`.
- Apps Script `getAppData` использует `CacheService` с key `familyMenu:getAppData:v1` и TTL `180` секунд.
- Backend cache сбрасывается после успешных write-операций и QA cleanup/migration actions.
- `getAppData` читает вкладки через internal read functions без повторных `setupSheets()` внутри одного read-flow.

Performance logging:

- Frontend: `console.info('[FamilyMenu] cached render data read in ...ms')`.
- Frontend: `console.info('[FamilyMenu] live refresh completed in ...ms')`.
- Backend: `console.log('[FamilyMenu] getAppData cache hit')`.
- Backend: `console.log('[FamilyMenu] getAppData cache miss')`.

QA observations:

- Первый запуск без cache ожидаемо ждёт live Apps Script API.
- Повторный запуск после успешного live refresh должен показывать интерфейс сразу из cache.
- Backend CacheService проверен после деплоя `apps-script/CodeV2.gs` в Apps Script Web App v7.
- Local production preview QA: первый live refresh занял `19886ms`; после reload интерфейс `/plan` был виден через `~1270ms` без loading screen.
- Console подтвердил cache-first path: `[FamilyMenu] cached render data read in 0ms`.
- Background refresh после cached render завершился за `17808ms` и обновил статус на `Обновлено HH:mm`.
- `/shopping`: representative checkbox `В корзине` сохранился после reload; отдельный shopping status key не перетёрся live refresh.
- Backend `getAppData` timing после v7 deployment: первый read `2461ms`, повторный cached read `1430ms`, counts совпали `20/24/14/9/0`.

## Save Reliability

Дата проверки: 2026-06-29

Ветка: `feature/save-reliability`

Цель: пользователь должен видеть, сохраняется ли выбранный ужин, и не терять локальный выбор при ошибке Apps Script / Google Sheets.

Реализовано:

- Все write-операции в `AppState` переведены на единый optimistic write path с результатом `Promise<boolean>`.
- Добавлены статусы сохранения: `Сохраняем...`, `Сохранено`, `Ошибка сохранения`, `Работаем с локальными данными`.
- Failed write сохраняется в localStorage по ключу `familyMenu.pendingWrites.v1`.
- Для pending writes добавлен retry: `retryPendingWrite` / `retryPendingWrites`.
- Локальный выбор не теряется после background refresh: pending writes накладываются поверх свежего `getAppData` перед render/cache.
- После optimistic update обновляется frontend cache, поэтому reload не сбрасывает локальный выбор.
- На `/plan` показан компактный save-status для выбранной даты и кнопка `Повторить`, если запись не ушла.
- На `/shopping` показан save-status для последней shopping session и кнопка `Повторить`, если запись не ушла.

Проверки:

| Проверка | Статус | Факт |
|---|---|---|
| `tsc` | Passed | Выполнен через локальный `node_modules/.bin/tsc.cmd`. |
| `vite build` | Passed | Production build завершился успешно. |
| `build:pages` | Passed | `/docs` обновлён для GitHub Pages. |
| Live API smoke | Passed | `scripts/live_api_smoke.mjs`, runId `QA-1782734116786`. |
| Smoke cleanup | Passed | Удалено 8 QA rows; финальные counts `20/24/14/9/0`. |
| Mobile preview `/plan` | Passed | Viewport `390x844`, экран `План` отображается, bottom nav видна, console errors/warnings отсутствуют. |
| Mobile nav `/plan -> /shopping` | Passed | Переход через нижнюю навигацию работает, `/shopping` отображается без горизонтального переполнения. |

Live smoke result:

```json
{
  "ok": true,
  "runId": "QA-1782734116786",
  "qaDate": "2099-12-31",
  "results": [
    "read:dishes/calendar_plan/base_products",
    "write:selected_dinners",
    "shopping:selected-only/no-alternatives/base-off",
    "shopping:base-on",
    "write:shopping_sessions"
  ]
}
```

Ограничение проверки: принудительный failed-write сценарий в браузере не выполнялся на production endpoint, чтобы не искажать рабочие данные. Поведение покрыто общей write-логикой: при ошибке API запись остаётся в cache + `familyMenu.pendingWrites.v1`, а UI показывает локальный статус и retry.

## Known Limitations

- Apps Script cold start может занимать 20-45 секунд.
- Frontend token не является секретом.
- Сложные multi-user конфликты не решаются в v1.
- Цены ориентировочные, без нормализации упаковок.
- Legacy migration есть в backend, но текущий QA фокусировался на v2 production-like dataset.

## Next Recommended Step

Запустить:

```powershell
$env:APPS_SCRIPT_ENDPOINT="https://script.google.com/macros/s/.../exec"
$env:API_TOKEN=""
node scripts/live_crud_smoke.mjs
```

Smoke пройден на текущем endpoint. Перед merge рекомендуется повторить команды после последнего backend/frontend изменения.
