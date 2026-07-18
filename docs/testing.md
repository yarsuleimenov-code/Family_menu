# Проверка проекта

## Автоматизированные команды

Из `frontend`:

```powershell
pnpm run typecheck
pnpm run build
pnpm run build:pages
```

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
