# Zoom Beta evidence remediation plan (2026-05-02)

## Что уже хорошо

- TLS 1.2 handshake для `www.meetli.cc` и `dev.meetli.cc` проходит успешно.
- Попытка TLS 1.1 завершается без рукопожатия (legacy protocol effectively disabled).
- По ZAP нет `High`-алертов.

## Что можно поправить в первую очередь (P0)

1. **Security headers на `dev.meetli.cc` (и зеркально на prod):**
   - добавить `Content-Security-Policy`;
   - добавить анти-clickjacking защиту через `frame-ancestors 'none'` в CSP (или `X-Frame-Options: DENY` как fallback);
   - добавить `Strict-Transport-Security`;
   - добавить `X-Content-Type-Options: nosniff`.

2. **Закрыть npm audit moderate/low chain вокруг `firebase-admin` транзитивных зависимостей**
   - обновить `firebase-admin` до версии, в которой закрыт текущий advisory chain;
   - повторно прогнать `npm audit --omit=dev` и приложить новый артефакт.

3. **Semgrep findings (минимальные точечные фиксы):**
   - `server/src/utils/crypto.ts`: для AES-GCM явно задать и проверять `authTag` длиной 16 байт;
   - `bot/src/utils/BPMN/BPMN.ts`: заменить небезопасные merge-паттерны на whitelist-merge или безопасную deep-clone/assign стратегию;
   - `server/.env.example`: убрать/редактировать строку, которая триггерит secret detector (даже если это пример).

## Уже поправили (2026-05-02)

- `server/src/utils/crypto.ts`: добавлена валидация AES-GCM payload перед decrypt (`iv=12 bytes`, `authTag=16 bytes`, ciphertext non-empty).
- `bot/src/utils/BPMN/BPMN.ts`: `Object.assign` для JSON-аннотаций заменен на safe merge с блокировкой `__proto__/constructor/prototype`.
- `server/.env.example`: Zoom OAuth example values заменены на безопасные placeholder-значения без видимости реальных секретов.

## Осталось сделать (следующий шаг)

- Применить security headers для frontend host (`dev.meetli.cc`/`www.meetli.cc`) на уровне reverse proxy/CDN.
- Обновить dependency-chain вокруг `firebase-admin`, затем пересобрать evidence `npm-audit-latest.json`.
- Перезапустить Semgrep/ZAP и обновить evidence артефакты после фиксов.

## P1 (после P0)

- Рассмотреть `Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`, `Cross-Origin-Resource-Policy`, `Permissions-Policy` как baseline hardening для web-приложения.
- Зафиксировать единый baseline security headers в reverse proxy (Nginx/Caddy/Cloudflare) и не дублировать логику по сервисам.
- Добавить CI-gate:
  - fail при `ZAP High > 0`;
  - fail при `npm audit` >= `high` для production deps;
  - fail при Semgrep findings уровня `ERROR` в `server/`.

## Definition of Done для следующего evidence-пакета

- `zap-report.md/json`: `Medium` снижен до 0 или подписан explicit risk-acceptance.
- `npm-audit-latest.json`: `high=0`, `critical=0`, количество `moderate` снижено и объяснено.
- `semgrep-latest.json`: закрыты текущие 4 finding'а либо добавлены обоснованные suppressions с ссылкой на threat model.
- TLS отчет обновлен датой и включает все публичные host'ы Zoom OAuth/API paths.
