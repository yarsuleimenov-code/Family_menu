# Change log

## 2026-07-18 — reliable writes and API timeouts

- Mutation endpoints Apps Script защищены единым `ScriptLock` с ожиданием 5000 мс и структурированной `LOCK_TIMEOUT`.
- Для повторяемых mutation добавлены стабильные UUID/idempotency keys; составная запись блюда использует подготовку строк, batch rewrite, snapshot и ограниченную компенсацию.
- API transport получил configurable timeout, `AbortController`, проверку HTTP/envelope и типизированные ошибки.
- Pending writes получили явные состояния, запрет параллельной отправки одного UUID, один retry lock conflict и 30-дневный срок без скрытого удаления.
- UI различает timeout, offline, lock conflict, validation error, неизвестный результат и expired write.
- Добавлена минимальная Vitest-инфраструктура и unit/VM-тесты без production live CRUD.
- Senior review добавил persistent idempotency ledger с `IDEMPOTENCY_CONFLICT`, безопасный cache cleanup, сохранение неизвестных колонок и порядка соседних строк, миграцию legacy pending writes и защиту логически повторного submit.

## 2026-07-18 — repository audit

- Сверены Git, код, архитектура, документация и доступные проверки.
- Исправлена устаревшая ветка GitHub Pages в README.
- Добавлена минимальная документация контекста, правил, тестирования, deployment, проблем и handoff.
- Функциональная логика и внешние системы не изменялись.
