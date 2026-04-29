# Database readiness (`server`)

## 1) Migration policy (approved)

Политика для production и staging:

- **Forward-only**: каждая новая migration добавляется как новая версия, без редактирования уже применённых migration-файлов.
- `down` в migration-файлах сохраняется как **аварийный инструмент** для dev/stage и для controlled rollback, но основная стратегия релиза — новая компенсирующая migration.
- Перед deploy:
  1. `npm run -w @scheduletm/server migrate:latest` на staging.
  2. smoke-check API.
  3. `npm run -w @scheduletm/server migrate:latest` на production.
- Если после deploy найден дефект схемы:
  - не переписывать старую migration;
  - выпускать новую migration-fix;
  - rollback (`migrate:rollback`) использовать только по решению ответственного и только при подтверждённом impact/risk.

## 2) Backup + test restore (Railway, manual mode)

Текущий режим (на 2026-04-29):

- backup/restore реализованы в Railway на стороне managed Postgres;
- проверка restore выполняется **в ручном режиме** (manual test restore);
- требуется поддерживать целевые показатели:
  - **RPO** (допустимая потеря данных) — фиксируется командой в ops runbook;
  - **RTO** (время восстановления) — фиксируется по результатам тестового восстановления.

Минимальный цикл проверки:

1. Создать backup/snapshot в Railway.
2. Восстановить в отдельную БД (не production).
3. Прогнать `migrate:latest` и smoke API.
4. Зафиксировать фактическое время восстановления и gap по данным (RTO/RPO).

## 3) Hot-path query plans

Для таблиц `appointments`, `notifications`, `web_user_sessions`, `telegram_user_sessions` обязательна периодическая проверка `EXPLAIN (ANALYZE, BUFFERS)` на ключевых запросах.

Примеры запросов для проверки:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM appointments
WHERE account_id = 1
  AND start_at >= now() - interval '30 days'
ORDER BY start_at DESC
LIMIT 100;

EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM notifications
WHERE status IN ('pending', 'retry')
  AND send_at <= now()
ORDER BY send_at ASC
LIMIT 200;

EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM web_user_sessions
WHERE web_user_id = 1
ORDER BY created_at DESC
LIMIT 20;

EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM telegram_user_sessions
WHERE telegram_user_id = 1
ORDER BY updated_at DESC
LIMIT 20;
```

Критерии:

- отсутствие full table scan на больших таблицах в hot-path;
- использование ожидаемых индексов;
- стабильное время выполнения на production-like данных.

## 4) Strict dev/stage/prod separation

Рекомендуемая схема в Railway:

- отдельные окружения: `dev`, `stage`, `prod`;
- отдельная БД/инстанс Postgres для каждого окружения;
- отдельные credentials и URL для каждого окружения;
- запрет на использование production URL в dev/stage сервисах.

Практическая настройка:

1. Создать 3 независимых Postgres services в Railway (или 3 независимых DB в изолированных проектах).
2. Привязать каждую БД только к соответствующему environment.
3. В переменных сервиса `server`:
   - dev: `DATABASE_PUBLIC_URL`/`DATABASE_URL` только dev-БД;
   - stage: только stage-БД;
   - prod: только prod-БД.
4. В CI/CD добавить environment-guard: deploy в `prod` только с prod-secrets.
5. Зафиксировать mapping `environment -> database` в runbook и периодически проверять.
