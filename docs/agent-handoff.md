# Agent handoff

## Stable shopping sessions

- Branch: `codex/stable-shopping-sessions` from `main` `5da63d8acf58e94c40cd3b31c3bc43a0f477155a`.
- `ShoppingSession` остаётся единственным persistence contract; Apps Script upsert-ит полный snapshot по `sessionId`.
- Существующий лист `shopping_sessions` лениво получает optional status/timestamp columns через `ensureSheet_`; старые строки читаются без массовой перезаписи.
- Active draft хранится в `family-menu:shopping-session-active-v1`. Legacy keys `shopping-status` и `shopping-manual-items` не удаляются и игнорируются новым flow.
- Deployment, live CRUD, integration smoke, production Google Sheet и GitHub Actions не использовались.

## Функциональная ветка repeat past week

- Ветка `codex/repeat-past-week` реализует История → Повторить неделю → preview → последовательное сохранение → переход в План.
- Новая backend-модель и batch endpoint не добавлялись; используются `SelectedDinner`, `CalendarPlanRow` и существующие pending writes.
- Перед каждой серией mutations выполняется refresh целевой недели. При ошибке или неизвестном результате dialog остаётся открытым.

## Текущее состояние после первой технической итерации

- Audit PR #3 squash-merged в `main`: `6c1bc1434f9140cfb02a8ced50efacdd1e6d8a50`.
- Функциональная работа ведётся в `codex/reliable-writes-and-api-timeouts`; deployment и production live smoke не выполнялись.
- Pending mutation UUID создаётся один раз, сохраняется при retry, а timeout/network переводит запись в `outcome_unknown`.
- `LOCK_TIMEOUT` допускает один последовательный retry с jitter 500–1500 мс. Один write не отправляется параллельно.
- Записи старше 30 дней становятся `expired`, остаются видимыми и удаляются только вручную.
- `LockService` не обеспечивает транзакцию между листами; реальную конкуренцию проверить на отдельной тестовой Google Sheet по manual plan из итогового PR.
- Пользовательский `scripts/update_live_recipe_notes.mjs` остаётся untracked и не должен включаться в commits.
- Senior review PR #4 устранил конфликт UUID/payload через лист `mutation_requests`; одинаковый request ID с другим action/payload возвращает `IDEMPOTENCY_CONFLICT`.
- Перед integration smoke проверить редкий разрыв между успешной бизнес-записью и записью idempotency ledger: Google Sheets не поддерживает общую транзакцию для этих операций.

## Точка отсчёта

- Base commit: `2c62b0a0073a7fd41e03862c911e96e1295ea7ee`.
- На момент fetch 2026-07-18 `main` совпадала с `origin/main` (0 ahead / 0 behind).
- Аудит выполняется в `codex/project-audit-2026-07-18`.
- Пользовательский `scripts/update_live_recipe_notes.mjs` был untracked до аудита; не изменять и не включать без подтверждения владельца.

## Подтверждено

- TypeScript и production build проходят.
- Архитектура: React/Vite → API abstraction → localStorage mock или Apps Script → Google Sheets.
- Главный риск: неатомарные конкурентные mutation-операции Apps Script.
- Автоматизированных тестов нет; live CRUD и deployment в рамках аудита не выполнялись.

## Принятое решение

Integration smoke отложен и не выполнялся; реальная конкурентность Apps Script не подтверждена. PR разрешено объединить для продолжения продуктовой разработки с принятием описанных residual risks. Перед полноценным multi-user или production-critical использованием обязательны повторная integration-проверка на отдельной Google Sheet и пересмотр окна между business mutation и записью idempotency ledger.
