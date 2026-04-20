# Web (`@scheduletm/web`)

React SPA для пользователя/администратора расписания.

## Текущий MVP

- Страницы: `/login`, `/register`, `/settings`.
- UI: MUI.
- Архитектура: `pages`, `containers`, `components`, `shared`, `app`.

## Ближайший roadmap

1. Добавить раздел appointments (список + карточка записи).
2. Добавить действия по записи: cancel/reschedule/mark-paid/notify.
3. Поддержать редактирование meeting link на уровне конкретной записи.
4. Добавить i18n (разнос переводов по страницам).
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
