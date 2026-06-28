# QA Report

Дата проверки: 2026-06-28

Endpoint: `https://script.google.com/macros/s/AKfycbwxBrNP6JNIeafbm7iw0uAFyAC9REAzAHRAcYyrxab43tsfXnKh-0u5AHPMtwv97pps/exec`

## Вывод

Статус: Passed for v1 review.

Проверена цепочка:

`React frontend -> Apps Script Web App -> Google Sheets -> чтение и запись данных`

`main` не изменялся. Рабочая ветка: `feature/react-family-menu`.

## Production-like Dataset

Google Sheet заполнен рабочими данными:

- `dishes`: 20
- `base_products`: 24
- `calendar_plan`: 14
- `selected_dinners`: 7
- `shopping_sessions`: 0 после очистки QA/seed мусора

`validateData.warnings`: `[]`.

## Live API Checks

Проверено через Apps Script deployment v6:

| Проверка | Статус | Факт |
|---|---|---|
| `getAppData` читает `dishes`, `calendar_plan`, `base_products` | Passed | Live API возвращает production-like dataset. |
| `selected_dinners` очищен от старых битых seed rows | Passed | Осталось 7 корректных строк `PROD-*`. |
| `buildShoppingList` строит список только по выбранным блюдам | Passed | Для `D-001` список содержит ингредиенты выбранного блюда. |
| Невыбранные альтернативы не попадают в покупки | Passed | Уникальные ингредиенты option B / quick отсутствуют при выключенных базовых продуктах. |
| Базовые продукты добавляются только при включённом переключателе | Passed | Base-only товары появляются только при `includeBaseProducts=true`. |
| `randomDish` исключает запрещённые продукты без false positive по `минут` / `нут` | Passed | `validateData.warnings=[]`, quick random возвращает валидное блюдо. |
| CRUD блюд и базовых продуктов | Passed | `scripts/live_crud_smoke.mjs`: create/update/deactivate для блюд и базовых продуктов, затем `cleanupSeedRows`. |

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

Результат:

```json
{
  "ok": true,
  "runId": "QA-CRUD-1782672265173",
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
