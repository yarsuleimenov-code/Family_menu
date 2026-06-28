# Migration Guide

## Цель

Перейти от старых вкладок Apps Script концепта к нормализованной структуре v2, не удаляя legacy данные.

## Рекомендуемый порядок

1. Сделать копию Google Sheet.
2. Вставить `apps-script/CodeV2.gs` в Apps Script.
3. Запустить `setupSheets`.
4. Проверить, что созданы вкладки:
   - `dishes`
   - `dish_ingredients`
   - `calendar_plan`
   - `base_products`
   - `shopping_sessions`
   - `selected_dinners`
   - `settings`
5. Запустить `migrateLegacyData`.
6. Проверить активные блюда через `validateData`.
7. Исправить предупреждения вручную в таблице.
8. Задеплоить Web App и подключить endpoint в `.env`.

## Что переносится

- `Dinner options catalog` -> `dishes`
- `Dinner option shopping` -> `dish_ingredients`
- `Base shopping list` -> `base_products`

## Что требует ручной проверки

- Категории продуктов.
- Цены.
- Единицы измерения.
- Запрещённые продукты.
- Calendar plan на будущие недели.
