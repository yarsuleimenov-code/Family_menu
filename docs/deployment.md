# Deployment

## Окружения

- Локально: Vite, `VITE_DATA_SOURCE=mock` или `googleSheets`.
- Frontend: GitHub Pages из ветки `main`, каталог `/docs`.
- Backend: Google Apps Script Web App, связанный с рабочей Google Sheet.

## Flow

1. Выполнить typecheck, build и релевантный smoke.
2. Собрать Pages: `pnpm run build:pages` из `frontend`.
3. Проверить `docs/index.html`, `docs/404.html` и одинаковые ссылки на актуальные assets.
4. После разрешения закоммитить и push; deployment/Apps Script выполняются отдельно.

## Post-deploy

- Открыть `/Family_menu/plan` и прямую ссылку `/Family_menu/shopping`.
- Проверить консоль, загрузку live-данных и одно контролируемое сохранение.
- Подтвердить, что mock-данные не показываются как live.

Apps Script deployment и внешние данные в аудите 2026-07-18 не изменялись.
