# Public Pages backlog

Этот документ больше не является отдельной спецификацией. Актуальные контракты и статус находятся в:

- [`public-page-builder/README.md`](./public-page-builder/README.md) — реализованная архитектура и API;
- [`public-page-builder/TODO.md`](./public-page-builder/TODO.md) — незавершённые и отложенные задачи;
- [`../TODO.md`](../TODO.md) — общий web/server backlog.

## Принятые решения

- Канонический публичный идентификатор — slug опубликованной Public Page.
- Отдельные `account_company_id` и legacy route вида `/[account_company_id]/login` не используются.
- Booking работает по `/:slug/booking`.
- Статус встречи доступен по публичному slug, appointment id и фамилии специалиста.
- `owner` и `admin` управляют страницами только своего аккаунта; `product_owner` имеет глобальные права.
- Media upload отложен на следующий этап.

Старые пункты исходного backlog либо реализованы в Public Page Builder, либо перенесены в актуальный TODO. Документ оставлен как redirect для старых ссылок.
