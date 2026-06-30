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

## Menu Data Quality

Дата проверки: 2026-06-29

Ветка: `feature/menu-data-quality`

Цель: сделать random dinner и список покупок полезными на реальных данных, а не на демонстрационном наборе.

Live data update:

- Перед записью создан локальный JSON backup: `outputs/family-menu-before-priority2-1782747351198.json`.
- Добавлены блюда `D-021..D-045`.
- Добавлены базовые продукты с ценами `BP-025..BP-048`.
- Добавлены строки `calendar_plan` на `2026-07-12..2026-07-18`.

Финальный live-срез после resume:

```json
{
  "activeDishes": 45,
  "dishes": 45,
  "activeBaseProducts": 48,
  "pricedActiveBaseProducts": 48,
  "calendarPlan": 21,
  "validation": {
    "warnings": []
  }
}
```

Проверки качества:

| Проверка | Статус | Факт |
|---|---|---|
| Минимум 40 активных блюд | Passed | В Google Sheets 45 активных блюд. |
| У активных блюд есть ингредиенты, время, порции, бюджет, теги | Passed | Локальная проверка expansion script: неполных активных блюд нет. |
| Запрещённые продукты не попали в активное меню | Passed | `validateData.warnings=[]`; новые блюда не используют брокколи, цветную капусту, фасоль, бобовые, нут. |
| Цены для 80% часто покупаемых продуктов | Passed | 48/48 активных `base_products` имеют `price_per_unit` или `estimated_package_price`. |
| Проблемные блюда видны на экране `Блюда` | Passed | Добавлен блок `Качество базы` со списком активных блюд, требующих проверки. |
| Цены ингредиентов учитываются во frontend shopping list | Passed | `shoppingListBuilder` подтягивает цены по совпадению названия ингредиента с `base_products`. |
| Mobile UI `/dishes` | Passed | Viewport `390x844`: после live refresh 45 карточек, `Качество базы` показывает `Проблемных активных блюд нет`, поиск `индейка` оставляет 3 карточки, console errors/warnings отсутствуют. |

Live smoke after expansion:

```json
{
  "ok": true,
  "runId": "QA-1782748105001",
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

После smoke выполнен cleanup: удалено 8 QA rows; финальные counts `dishes=45`, `baseProducts=48`, `calendarPlan=21`, `selectedDinners=9`, `shoppingSessions=0`.

Ограничение: `apps-script/CodeV2.gs` обновлён в репозитории для усиленного `validateData` и backend price lookup, но production Apps Script endpoint начнёт использовать эти изменения только после ручного обновления/deploy в Apps Script.

## Shopping Store Flow

Дата проверки: 2026-06-30

Ветка: `feature/shopping-store-flow`

Цель: сделать список покупок удобным одной рукой в магазине.

Реализовано:

- На `/shopping` добавлена закреплённая сводка: сумма, товаров, в корзине, без цены.
- Действия `Скрыть купленное`, `Скопировать`, `Очистить` вынесены в постоянно доступную панель.
- Категории списка получили более заметные заголовки.
- Количество для смешанных единиц отображается отдельными короткими частями, а не одной длинной строкой.
- Добавлено ручное добавление товара в текущий список.
- Для товара добавлены быстрые кнопки статусов `Купить`, `Дома`, `Не покупать`; выпадающий список убран.
- Ручные товары сохраняются локально и могут быть удалены из текущего списка.
- Deep link `/Family_menu/shopping` стабилизирован через нормализацию router basename.

Проверки:

| Проверка | Статус | Факт |
|---|---|---|
| `tsc --noEmit` | Passed | TypeScript проверка прошла. |
| `vite build --base=/Family_menu/ --outDir ../docs` | Passed | GitHub Pages build обновлён. |
| `scripts/sync_pages_404.mjs` | Passed | `docs/404.html` синхронизирован с `docs/index.html`. |
| Mobile `/shopping`, viewport `390x844` | Passed | Sticky summary отображается, действий достаточно без скролла вверх, горизонтального overflow нет. |
| Ручное добавление товара | Passed | Добавлен товар `Вода 2 л`, счётчик вырос с 27 до 28, сумма выросла на 600 ₸. |
| Быстрый статус `Дома` | Passed | Товар получил класс `shopping-item--have_at_home` без dropdown. |
| `В корзине` + `Скрыть купленное` | Passed | После отметки товар скрывается, summary остаётся доступной. |
| Console | Partial | Ошибок приложения нет; есть только стандартный React Router future flag warning в dev-сборке. |

Ограничения:

- Ручные товары пока локальные для устройства и не записываются в Google Sheets.
- Summary считает все товары текущего списка, включая скрытые купленные, чтобы бюджет и общее количество не прыгали во время похода в магазин.
- Локальный preview не эмулирует GitHub Pages project path для `/Family_menu/assets`; функциональная browser QA выполнена на dev-server `/shopping`, Pages build проверен отдельно.

## Week Planning

Дата проверки: 2026-06-30

Ветка: `feature/week-planning`

Цель: собрать недельное меню за 5-10 минут.

Реализовано:

- На `/plan` добавлен быстрый недельный обзор выбранных ужинов.
- Добавлена кнопка `Заполнить неделю случайно`.
- Массовый random заполняет только пустые дни выбранного диапазона и не перезаписывает уже выбранные ужины.
- Random исключает блюда из текущего диапазона и выбранные за последние 14 дней до даты подбора.
- Фильтры random доступны для одиночного и недельного подбора: быстро, бюджетно, с остатками, без духовки, время, белок, выходной.
- День явно показывает состояние: `выбрано`, `не выбрано`, `готовили`, `пропущено`.
- Для выбранного дня доступны быстрые статусы `План`, `Готовили`, `Пропущено`.
- Ссылка `Сформировать покупки` переведена на React Router `Link`, чтобы не зависеть от абсолютного пути.

Проверки:

| Проверка | Статус | Факт |
|---|---|---|
| `tsc --noEmit` | Passed | TypeScript проверка прошла. |
| `vite build` | Passed | Production build прошёл. |
| `vite build --base=/Family_menu/ --outDir ../docs` | Passed | GitHub Pages build обновлён. |
| `scripts/sync_pages_404.mjs` | Passed | `docs/404.html` синхронизирован с `docs/index.html`. |
| Mobile `/plan`, viewport `390x844` | Passed | Недельный блок отображается, 7 дней видны, горизонтального overflow нет. |
| Состояния дней | Passed | В QA dataset показаны 5 дней `выбрано` и 2 дня `не выбрано`. |
| Фильтры random | Passed | `быстро` и `бюджетно` включаются и получают selected state. |
| Router Link в покупки | Passed | `Сформировать покупки` переводит на `/shopping` без reload абсолютного GitHub Pages пути. |
| Console | Partial | Ошибок приложения нет; есть только стандартный React Router future flag warning в dev-сборке. |

Ограничения:

- В browser QA кнопка `Заполнить неделю случайно` не нажималась, чтобы не записывать массовые изменения в рабочий Google Sheet.
- Массовое заполнение использует последовательные write-операции `selected_dinners` + `calendar_plan`; на Apps Script cold start это может быть заметно медленнее, но сохраняет существующую модель надёжности и retry.
- Если фильтры слишком строгие, часть дней может остаться пустой; UI показывает сообщение с датами, где не хватило вариантов.

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
