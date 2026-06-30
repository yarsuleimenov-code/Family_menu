# Project Status

Дата: 2026-06-30

Ветка: `feature/week-planning`

GitHub Pages: `https://yarsuleimenov-code.github.io/Family_menu/`

## Текущий статус

Family Menu v1 готов к review.

Закрыто:

- React/Vite frontend опубликован через GitHub Pages.
- Google Sheets + Apps Script API v2 подключены.
- Рабочий Google Sheet заполнен production-like dataset.
- Главный сценарий работает: `План -> выбор ужина -> Покупки -> отметки в магазине`.
- Mobile QA на ширине `390x844` пройден.
- Mobile QA `/shopping` пройден для ручного товара, статуса `Дома`, `В корзине` и `Скрыть купленное`.
- Mobile QA `/plan` пройден для недельного обзора, фильтров random и перехода в покупки.
- Live CRUD smoke пройден и QA-записи очищены.
- GitHub Pages deep links работают через синхронизированный `404.html`.
- Initial loading не показывает mock-данные.
- На `/shopping` есть явная кнопка `Сформировать список`.
- На `/shopping` магазинный сценарий усилен: закреплённая summary-панель, быстрые действия, ручной товар и статус `Дома` без dropdown.
- На `/plan` добавлен недельный обзор, кнопка `Заполнить неделю случайно`, защита от повторов за последние 14 дней и быстрые статусы дня.
- На `/dishes` есть блок `Качество базы` со списком активных блюд, требующих заполнения.
- Меню расширено до 45 активных блюд; 48/48 активных базовых продуктов имеют цены.

## Рабочие данные

Текущий dataset:

- 45 блюд;
- 48 базовых продуктов с ценами;
- 21 день календарного плана;
- 7 выбранных ужинов;
- 0 shopping sessions после очистки QA/seed записей.

Запрещённые продукты:

- брокколи;
- цветная капуста;
- фасоль;
- бобовые;
- нут.

`validateData` не возвращает предупреждений по текущему dataset.

## Проверки перед review

```bash
cd frontend
npm run typecheck
npm run build
npm run build:pages
```

Live API:

```powershell
$env:APPS_SCRIPT_ENDPOINT="https://script.google.com/macros/s/.../exec"
$env:API_TOKEN=""
node scripts/live_api_smoke.mjs
node scripts/live_crud_smoke.mjs
```

`live_api_smoke` использует QA-дату `2099-12-31`, чтобы не перезаписывать production calendar rows.

После smoke-тестов при необходимости:

```powershell
$env:CLEANUP_DRY_RUN="false"
node scripts/cleanup_family_menu_live.mjs
```

## Что требуется от пользователей

- Проверить реальные блюда, ингредиенты и цены в Google Sheet.
- Подтвердить, какие базовые продукты должны быть `include_by_default=yes`.
- Использовать приложение 5-7 дней в реальном сценарии.
- Фиксировать проблемы в формате: экран, действие, ожидание, факт, скриншот.
- Перед merge подтвердить, что текущая версия подходит для семейного использования.

## Известные ограничения

- Apps Script cold start может занимать 20-45 секунд.
- Frontend token не является полноценным секретом.
- Нет сложной multi-user синхронизации.
- Цены приблизительные.
- Единицы измерения не нормализуются в финансовую модель.
- Legacy migration требует ручной проверки после запуска.
