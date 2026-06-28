# Family menu

React Web App для планирования семейных ужинов, списка покупок и базовых продуктов.

## Минимальный результат v1

- 4 основных экрана: `План`, `Покупки`, `Блюда`, `Базовые продукты`.
- Выбор ужина на дату и случайный подбор блюда.
- Список покупок строится только по выбранным блюдам.
- Базовые продукты добавляются отдельным переключателем.
- Статусы покупок и кэш данных сохраняются в `localStorage`.
- Google Sheets подключается через Apps Script API, но локальный mock-режим работает сразу.

## Запуск локально

```bash
cd frontend
npm install
npm run dev
```

Локальный адрес Vite будет показан в терминале, обычно `http://127.0.0.1:5173/`.

## GitHub Pages

Для режима GitHub Pages `Deploy from a branch` нужно публиковать собранный Vite output, а не корень репозитория. Иначе GitHub Pages показывает `README.md`.

Сборка для Pages:

```bash
cd frontend
npm run build:pages
```

В настройках GitHub Pages выберите:

- Branch: `feature/react-family-menu`
- Folder: `/docs`

`docs/index.html` является стартовой страницей приложения. `docs/404.html` дублирует `index.html`, чтобы прямые ссылки React Router вроде `/Family_menu/plan` открывались корректно.

## Настройка `.env`

Скопируйте `frontend/.env.example` в `frontend/.env`.

```env
VITE_APPS_SCRIPT_ENDPOINT=
VITE_API_TOKEN=
VITE_DATA_SOURCE=mock
```

Режимы:

- `VITE_DATA_SOURCE=mock` - локальный режим через `localStorage`, подходит для разработки.
- `VITE_DATA_SOURCE=googleSheets` - запросы идут в Apps Script endpoint.

`VITE_API_TOKEN` не является полноценной защитой, потому что frontend-код виден пользователю. Для личного приложения безопаснее деплоить Apps Script с доступом только нужному Google account или использовать токен только как защиту от случайных запросов.

## Источник данных

Рекомендованный v1 вариант: Google Sheets + Apps Script JSON API.

Почему не Supabase/Firebase в v1:

- Google Sheet проще редактировать вручную без админки.
- Бесплатно и уже близко к текущему концепту.
- Не требует отдельного backend-хостинга.
- Данные легко экспортировать и бэкапить копией таблицы.

Ограничения:

- Apps Script имеет квоты Google.
- Нет полноценной multi-user авторизации внутри приложения.
- Frontend token нельзя считать секретом.

## Apps Script

Новый backend лежит в `apps-script/CodeV2.gs`.

Шаги деплоя:

1. Откройте Google Sheet.
2. `Extensions -> Apps Script`.
3. Создайте или замените `Code.gs` содержимым `apps-script/CodeV2.gs`.
4. Запустите `setupSheets`.
5. При наличии старых вкладок запустите `migrateLegacyData`.
6. `Deploy -> New deployment -> Web app`.
7. `Execute as: Me`.
8. Access: `Only myself` или ограниченный доступ для семьи.
9. Скопируйте Web App URL в `VITE_APPS_SCRIPT_ENDPOINT`.

Если нужен простой token:

1. В Apps Script откройте `Project Settings`.
2. Добавьте Script Property `API_TOKEN`.
3. Укажите такое же значение в `VITE_API_TOKEN`.

## Схема Google Sheets v2

- `dishes`
- `dish_ingredients`
- `calendar_plan`
- `base_products`
- `shopping_sessions`
- `selected_dinners`
- `settings`

API не зависит от порядка колонок: строки читаются по заголовкам.

## Миграция legacy

Legacy вкладки не удаляются:

- `Menu with dinner options`
- `Dinner options catalog`
- `Dinner option shopping`
- `Base shopping list`
- `Selected dinners`
- `Shopping sessions`

Функция `migrateLegacyData` переносит каталог блюд, ингредиенты и базовые продукты в v2. Если `Dish ID` отсутствует, используется fallback по названию блюда там, где это возможно.

## Архитектура frontend

```text
src/
  app/              App shell, router, state provider
  components/       Повторяемые UI-компоненты
  pages/            Экраны приложения
  services/         API, Google Sheets adapter, random, shopping builder, storage
  types/            Доменные типы
  utils/            Даты, бюджет, нормализация
  data/             Mock data для локального режима
  styles/           Общий CSS
```

Ключевой принцип: UI работает с `services/api.ts`, а не напрямую с Google Sheets. Это сохраняет возможность заменить источник данных позже.

## Проверка

```bash
cd frontend
npm run typecheck
npm run build
```

Live smoke-test реального Apps Script API:

```bash
$env:APPS_SCRIPT_ENDPOINT="https://script.google.com/macros/s/.../exec"
$env:API_TOKEN="optional-token"
node scripts/live_api_smoke.mjs
```

Скрипт создаёт QA-записи с префиксом `QA-...` в реальной таблице и проверяет чтение `dishes`, `calendar_plan`, `base_products`, запись `selected_dinners`, запись `shopping_sessions`, а также правила shopping list: только выбранное блюдо, без невыбранной альтернативы, base products только при включённом флаге.

Ручные smoke-тесты:

1. Открыть `/plan`.
2. Выбрать блюдо на сегодня.
3. Нажать `Случайное блюдо`.
4. Открыть `/shopping`.
5. Включить базовые покупки.
6. Отметить товар как `В корзине`.
7. Скопировать и сохранить список.
8. Добавить блюдо в `/dishes`.
9. Добавить базовый продукт в `/base-products`.

## Известные ограничения v1

- Нет сложной авторизации и multi-user конфликтов.
- Цены ориентировочные, без нормализации упаковок.
- Сложные единицы измерения объединяются текстом через `+`.
- Фото блюд пока не являются обязательной частью модели.
- Импорт legacy покрывает базовые поля и требует ручной проверки после миграции.

## Следующие улучшения

- Нормализация единиц измерения.
- Импорт/экспорт JSON из интерфейса.
- Улучшенная история повторов блюд.
- Отдельная админка для массового редактирования меню.
- Больше проверок качества данных перед активацией блюда.
