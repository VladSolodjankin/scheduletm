# Web (`@scheduletm/web`)

React SPA для пользователя/администратора расписания.

## Текущий MVP

- Страницы: `/login`, `/register`, `/settings`, `/appointments`.
- UI: MUI.
- Архитектура: `pages`, `containers`, `components`, `shared`, `app`.
- Доступ без логина: только `/login` и `/register` (без header/menu/settings).
- После успешной регистрации: redirect на `/login` (без автологина).
- Обновлен auth UI: используется `logo_text.svg` в карточке и более аккуратная центрированная компоновка с мягкой карточкой (production-friendly без переусложнения).
- Appointments-календарь отображает записи прямо в time-grid по времени (режимы Day/Week) и поддерживает drag&drop перенос между слотами.
- Appointments-календарь показывает внешнюю занятость (`busySlots`) из Google Calendar отдельными индикаторами.
- Отображение времени в appointments идет в локальной timezone браузера пользователя, при этом на backend время остается в UTC.
- При создании/редактировании/переносе appointment дата/время (`date` + `time`, а также `datetime-local` где применимо) конвертируются из локального времени выбранной timezone в UTC перед отправкой в API.

## Ближайший roadmap

1. Добавить `mark-paid` и `notify` actions для appointments.
2. Поддержать расширенные фильтры и групповые операции в календаре.
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

## Google OAuth flow (добавлено)

- На странице settings кнопка `Connect Google` вызывает backend `POST /api/integrations/google/oauth/start`.
- Клиент получает `authorizeUrl` и делает redirect в Google OAuth consent flow.
- После callback backend возвращает пользователя обратно на `/settings` c query-параметром результата.

## Переменные окружения (важно для Railway)

- `VITE_API_URL` — базовый URL backend API (build-time переменная для Vite).

Пример для production:

```bash
VITE_API_URL=https://api.meetli.cc
```

Важно:

- переменная читается во время сборки фронтенда (после изменения нужен новый deploy/rebuild);
- можно указывать URL как с суффиксом `/api`, так и без него — клиент нормализует путь и не дублирует `/api`;
- если `VITE_API_URL` не задан, клиент использует текущий `window.location.origin`, что корректно только когда `/api/*` реально проксируется на backend в проде.
