# RBAC

Права централизованы в `server/src/policies/rolePermissions.ts`. Все tenant-запросы дополнительно ограничиваются `account_id`.

## Роли

- `product_admin` — глобальный Product Admin с доступом ко всем аккаунтам и системным настройкам. Не назначается через обычный Users API/UI.
- `owner` — владелец одного пространства; управляет его настройками, специалистами, пользователями и записями.
- `specialist` — управляет своими записями и доступными клиентами.
- `client` — управляет своим профилем, настройками уведомлений и своими записями.

| Действие | product_admin | owner | specialist | client |
|---|---:|---:|---:|---:|
| System settings и error logs | ✅ | ❌ | ❌ | ❌ |
| Account settings | ✅ | ✅ | ❌ | ❌ |
| Управление пользователями аккаунта | ✅ | ✅ | клиенты | ❌ |
| Создание `owner`/`product_admin` через Users API | ❌ | ❌ | ❌ | ❌ |
| Управление специалистами | ✅ | ✅ | ❌ | ❌ |
| Все записи аккаунта | ✅ | ✅ | ❌ | ❌ |
| Все аккаунты | ✅ | ❌ | ❌ | ❌ |
| Собственные записи специалиста | ✅ | ✅ | ✅ | ❌ |
| Собственные записи клиента | ✅ | ✅ | ❌ | ✅ |

## Оплата (Payment setup)

- `GET/PUT /api/settings/payments*`, `POST /api/settings/payments/providers/:provider/disconnect`,
  `POST /api/settings/payments/test-reminder`, `POST /api/integrations/stripe/oauth/start` — только
  `canManageAccountSettings` (`owner`, `product_admin`), всегда в рамках `user.accountId`.
- `POST /api/appointments/:id/mark-paid` и `POST /api/appointments/:id/mark-unpaid` — `canMarkPaidAndNotify`
  (все, кроме `client`); специалист — только свои записи; аудит `mark-paid` / `mark-unpaid`.
- Публичные (без авторизации, по токену, rate limit по IP): `GET /api/public/payments/:token`,
  `POST /api/public/payments/:token/checkout`; вебхуки провайдеров — см. [`payment-webhooks.md`](./payment-webhooks.md).

Self-registration создаёт новый аккаунт и пользователя `owner`. Существующие `owner` автоматически не преобразуются в `product_admin`; глобальная роль назначается только контролируемой операцией в БД.
