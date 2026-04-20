# Web (`@scheduletm/web`)

React SPA для пользователя/администратора расписания.

## Текущий MVP

- Страницы: `/login`, `/register`, `/settings`.
- UI: MUI.
- Архитектура: `pages`, `containers`, `components`, `shared`, `app`.
- Доступ без логина: только `/login` и `/register`, плюс глобальные переключатели темы/языка в header.

## Ближайший roadmap

1. Добавить раздел appointments (список + карточка записи).
2. Добавить действия по записи: cancel/reschedule/mark-paid/notify.
3. Поддержать редактирование meeting link на уровне конкретной записи.
4. ✅ Добавить i18n (реализовано: ru/en, переключатель языка в header, общий словарь переводов).
5. Добавить e2e smoke на auth + settings + appointments.

## UX решение по meeting links

- В UI настроек профиля хранить `defaultMeetingLink`.
- При создании appointment подставлять эту ссылку автоматически.
- В карточке конкретной записи разрешить override `meetingLink`.


## UI-база (добавлено)

- `src/shared/theme/constants.ts` — размеры, отступы, радиусы и 5 мягких цветовых палитр.
- `src/shared/theme/createAppTheme.ts` — единая генерация MUI-темы с поддержкой `light/dark`.
- `src/shared/ui/*` — обертки для кнопок, табов, страниц, форм, полей и иконок.
- `src/components/layout/*` — базовый каркас приложения: `MainLayout`, `Header`, `LeftMenu`.

Это сделано так, чтобы быстро менять дизайн централизованно и не переписывать каждую страницу.


## i18n (добавлено)

- `src/shared/i18n/dictionaries.ts` — переводы для `ru/en`.
- `src/shared/i18n/I18nContext.tsx` — контекст локали + `t(key)` + сохранение выбранного языка в `localStorage`.
- Если в `localStorage` ещё нет локали, приложение берёт дефолт из системного языка браузера (`navigator.languages` / `navigator.language`) с fallback на `ru`.
- Переключатель языка добавлен в `Header`, тексты auth/settings/menu переведены на i18n-слой.

## Синхронизация UI-настроек после логина

- После авторизации web-клиент синхронизирует в `PUT /api/settings`:
  - `locale` (`ru-RU` / `en-US`),
  - `uiThemeMode` (`light` / `dark`),
  - `uiPaletteVariantId`.
- Эти поля хранятся в `server` settings как часть профиля пользователя.
