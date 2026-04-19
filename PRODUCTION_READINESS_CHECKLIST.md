# PRODUCTION_READINESS_CHECKLIST

Чеклист для нового контура `server + web`.

## 1. Platform & runtime

- [ ] Зафиксировать Node.js LTS версию для всех workspace.
- [ ] Настроить единые команды CI: install, typecheck, test, build.
- [ ] Добавить lockfile политику и reproducible installs.

## 2. Security

- [ ] Добавить безопасную работу с секретами (`.env`, secret manager).
- [ ] Подключить проверку Firebase ID token на server.
- [ ] Ограничить CORS для production-доменов.
- [ ] Добавить базовые security middleware (helmet, rate limit).

## 3. Observability

- [ ] Добавить health/readiness endpoints на server.
- [ ] Подключить структурированные логи и request-id.
- [ ] Определить SLI/SLO (latency/error rate/auth failures).

## 4. Integrations

- [ ] Описать контракт интеграции с Google Calendar API.
- [ ] Описать политику обновления Firebase SDK / service account ключей.
- [ ] Добавить retry/backoff стратегию для внешних API.

## 5. Web delivery

- [ ] Добавить production build pipeline для web.
- [ ] Подключить error tracking.
- [ ] Настроить кэширование и заголовки безопасности.

## 6. Migration strategy

- [ ] Задокументировать границы ответственности `bot` vs `server/web` на период миграции.
- [ ] Зафиксировать критерии полного перехода на `server/web`.
