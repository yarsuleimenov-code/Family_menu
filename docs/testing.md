# Проверка проекта

## Автоматизированные команды

Из `frontend`:

```powershell
pnpm run typecheck
pnpm run test:run
pnpm run build
pnpm run build:pages
```

## Первая техническая итерация 2026-07-18

- Vitest покрывает shopping list, random dish, нормализацию строк и дат, API timeout/network/protocol/API errors, `LOCK_TIMEOUT`, единственный автоматический retry, запрет retry при неизвестном результате, UUID и expiration pending writes.
- VM-тесты Apps Script покрывают `tryLock(5000)`, освобождение lock, cache invalidation после success, idempotency keys, компенсационное восстановление и `PARTIAL_WRITE_RISK`.
- Локальные unit-тесты не доказывают справедливость очереди `LockService`, реальное время ожидания и взаимное исключение параллельных Apps Script executions. Для этого нужен integration smoke на отдельной тестовой Google Sheet.
- Production Google Sheet, live CRUD и deployment в этой итерации не выполнялись.

Live smoke-команды и необходимые переменные описаны в `README.md`. Они изменяют рабочую Google Sheet и запускаются только осознанно.

## Результат аудита 2026-07-18

- TypeScript: PASS.
- Production build: PASS, 1607 модулей, JS bundle 276.07 kB (gzip 87.16 kB).
- Синтаксис 11 `.mjs`-скриптов: PASS; один из них — пользовательский untracked-файл и в commit не включён.
- Unit/integration/e2e: отсутствуют.
- Live API/CRUD: не запускались, чтобы не менять внешнюю систему без отдельного разрешения.
- Rendered UI: встроенный Browser не получил доступ к localhost; fallback Playwright заблокирован отсутствующим `npx` в доступном runtime.

## Ручной smoke

Использовать `TEST_CASES.md` и `docs/FAMILY_TEST_GUIDE.md`; обязательно проверить desktop/mobile, loading, empty, error, локальные pending writes и повтор сохранения.
