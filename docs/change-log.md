# Change log

## 2026-07-18 — repeat past week

- В Истории добавлен выбор прошедшей непустой недели и preview переноса на текущую или будущую неделю.
- Поддержаны безопасный режим «только пустые дни» и явно подтверждаемый режим замены конфликтов.
- Дни сохраняются последовательно через существующие mutations/pending writes; итог отображается отдельно для каждого дня.

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
