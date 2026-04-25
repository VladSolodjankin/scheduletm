# Meetli (`scheduletm`) Monorepo

Единый репозиторий платформы управления расписанием:

- **`web/`** — React SPA для owner/admin/specialist.
- **`server/`** — Node.js/Express API для web-клиента и интеграций.
- **`bot/`** — Telegram-бот для записи клиентов.

---

## 1) Быстрый старт

### Требования

- Node.js 20+
- npm 10+
- PostgreSQL

### Установка

```bash
npm install
```

### Запуск по модулям

```bash
# API
npm run -w @scheduletm/server dev

# Web
npm run -w @scheduletm/web dev

# Bot
npm run -w bot dev
```

> Точные переменные окружения и команды для production — в README каждого модуля.

---

## 2) Архитектура

```text
scheduletm/
├── README.md
├── PROJECT_MAP.md
├── TODO.md
├── PRODUCTION_READINESS_CHECKLIST.md
├── web/
│   ├── README.md
│   └── PROJECT_MAP.md
├── server/
│   ├── README.md
│   └── PROJECT_MAP.md
└── bot/
    ├── README.md
    └── PROJECT_MAP.md
```

- Глобальная карта: [`PROJECT_MAP.md`](./PROJECT_MAP.md)
- Карта web: [`web/PROJECT_MAP.md`](./web/PROJECT_MAP.md)
- Карта server: [`server/PROJECT_MAP.md`](./server/PROJECT_MAP.md)
- Права ролей (RBAC): [`server/docs/rbac.md`](./server/docs/rbac.md)
- Карта bot: [`bot/PROJECT_MAP.md`](./bot/PROJECT_MAP.md)

---

## 3) Что уже реализовано (MVP)

### Web + Server

- Auth: register/login/refresh/logout + OTP email verification by unique code (with resend) + invite onboarding page `/verify-email` for creating account from invitation.
- Роли: `owner` / `admin` / `specialist` / `client` (RBAC policy централизована в server).
- Settings: system + user settings.
- Integrations: Google OAuth start/callback, Telegram bot token в user integrations.
- Notifications: appointment notify flow with channel fallback (Telegram -> Email).
- Appointments lifecycle: list/create/edit/reschedule/cancel/mark-paid/notify.
- Specialists и Users CRUD (с role-gates).
- Client web users:
  - owner/admin/specialist могут создавать пользователей с ролью `client`;
  - `client` может входить в web-приложение, редактировать собственный профиль и управлять только своими записями (создание/редактирование/перенос/отмена);
  - Google OAuth доступен для подключения календаря и синхронизации занятости.
- Базовая i18n поддержка (`ru/en`) в web + локализованные server messages.
- Email notifications via Brevo SMTP API (`no-reply@meetli.cc`) with hardcoded templates:
  - email verification;
  - registration success;
  - appointment reminder;
  - managed user invite-link onboarding (one-time invite link with 24h TTL, invited user stays inactive until verification/accept-invite, managers can resend invite link for unverified users).

### Bot

- Запись через Telegram webhook.
- State machine сценария в Postgres.
- Выбор услуги/специалиста/даты/времени.
- Перенос и отмена записи.
- Напоминания с retry-механизмом.
- Учет timezone через IANA, хранение времени в UTC.

---

## 4) Документация и статус

- Глобальный roadmap: [`TODO.md`](./TODO.md)
- Глобальная production-ready проверка: [`PRODUCTION_READINESS_CHECKLIST.md`](./PRODUCTION_READINESS_CHECKLIST.md)
- Bot-специфика:
  - [`bot/TODO.md`](./bot/TODO.md)
  - [`bot/PRODUCTION_READINESS_CHECKLIST.md`](./bot/PRODUCTION_READINESS_CHECKLIST.md)
  - [`bot/MVP_NO_PAYMENT_PLAN.md`](./bot/MVP_NO_PAYMENT_PLAN.md)

---

## 5) Принципы разработки

- **KISS**: делаем простейшее рабочее решение.
- **DRY**: не дублируем доменную логику.
- **SOLID**: сохраняем четкие границы между слоями и модулями.
- **Не over-engineer**: никаких преждевременных абстракций.


Основываясь на README.md
Не забудь обновить документации
