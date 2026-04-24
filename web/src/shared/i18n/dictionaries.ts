export const dictionaries = {
  en: {
    common: {
      appTitle: 'Meetli',
      email: 'Email',
      password: 'Password',
      saveSettings: 'Save settings',
      logout: 'Log out',
      settings: 'Settings',
      login: 'Login',
      register: 'Register',
      language: 'Language',
      appointments: 'Appointments',
      profileMenuAria: 'Open profile menu',
      appearancePaletteAria: 'Select color palette',
      themeToggleAria: 'Toggle theme mode',
      languageAria: 'Select language'
    },
    auth: {
      loginTitle: 'Sign in to your account',
      loginSubtitle: 'Continue working with your schedule.',
      registerTitle: 'Register',
      registerSubtitle: 'Create an account and start setup.',
      formLoginTitle: 'Login',
      formRegisterTitle: 'Register',
      submitLogin: 'Sign in',
      submitRegister: 'Create account',
      switchToRegister: "Don't have an account? Register",
      switchToLogin: 'Already have an account? Sign in',
      errors: {
        loginFailed: 'Unable to sign in. Check your email and password.',
        registerFailed: 'Unable to register.'
      }
    },
    settings: {
      pageTitle: 'Settings',
      pageSubtitle: 'Manage system and personal settings, integrations, and interface appearance.',
      tabs: {
        system: 'System settings',
        user: 'User settings'
      },
      systemTitle: 'System settings',
      userTitle: 'User settings',
      timezone: 'Timezone',
      locale: 'Locale',
      defaultMeetingDuration: 'Default meeting duration (min)',
      dailyDigestEnabled: 'Daily digest enabled',
      weekStartsOnMonday: 'Week starts on Monday',
      integrationsTitle: 'Integrations',
      integrationsSubtitle: 'Connect external services to automate bookings and reminders.',
      connectGoogle: 'Connect Google',
      connectingGoogle: 'Redirecting to Google...',
      disconnectGoogle: 'Disconnect Google',
      disconnectingGoogle: 'Disconnecting...',
      googleConnected: 'Google connected',
      googleConnectedSuccessfully: 'Google Calendar connected successfully.',
      errors: {
        load: 'Unable to load settings.',
        save: 'Unable to save settings.',
        connectGoogle: 'Unable to connect Google.',
        disconnectGoogle: 'Unable to disconnect Google.'
      }
    },
    appointments: {
      pageTitle: 'Appointments',
      pageSubtitle: 'Calendar view with schedule by day and time.',
      specialistFilter: 'Specialist',
      allSpecialists: 'All specialists',
      create: 'Create',
      createTitle: 'Create appointment',
      editTitle: 'Edit appointment',
      save: 'Save',
      close: 'Close',
      emptyDay: 'No appointments on this day.',
      viewDay: 'Day',
      viewWeek: 'Week',
      viewMonth: 'Month',
      today: 'Today',
      loading: 'Loading appointments...',
      dragHint: 'Drag and drop appointment to move it to another slot.',
      pastSlotError: 'Cannot create or move an appointment to a past date/time.',
      cancelAction: 'Cancel appointment',
      fields: {
        scheduledAt: 'Date and time',
        status: 'Status',
        meetingLink: 'Meeting link',
        notes: 'Notes'
      }
    }
  },
  ru: {
    common: {
      appTitle: 'Meetli',
      email: 'Email',
      password: 'Пароль',
      saveSettings: 'Сохранить настройки',
      logout: 'Выйти',
      settings: 'Настройки',
      login: 'Вход',
      register: 'Регистрация',
      language: 'Язык',
      appointments: 'Записи',
      profileMenuAria: 'Открыть меню профиля',
      appearancePaletteAria: 'Выбрать цветовую палитру',
      themeToggleAria: 'Переключить тему',
      languageAria: 'Выбрать язык'
    },
    auth: {
      loginTitle: 'Вход в аккаунт',
      loginSubtitle: 'Продолжайте работу со своим расписанием.',
      registerTitle: 'Регистрация',
      registerSubtitle: 'Создайте аккаунт и начните настройки.',
      formLoginTitle: 'Вход',
      formRegisterTitle: 'Регистрация',
      submitLogin: 'Войти',
      submitRegister: 'Зарегистрироваться',
      switchToRegister: 'Нет аккаунта? Зарегистрироваться',
      switchToLogin: 'Уже есть аккаунт? Войти',
      errors: {
        loginFailed: 'Не удалось войти. Проверьте email и пароль.',
        registerFailed: 'Не удалось зарегистрироваться.'
      }
    },
    settings: {
      pageTitle: 'Настройки',
      pageSubtitle: 'Управляйте системными и личными настройками, интеграциями и внешним видом интерфейса.',
      tabs: {
        system: 'Системные',
        user: 'Пользовательские'
      },
      systemTitle: 'Системные настройки',
      userTitle: 'Пользовательские настройки',
      timezone: 'Часовой пояс',
      locale: 'Локаль',
      defaultMeetingDuration: 'Длительность встречи по умолчанию (мин)',
      dailyDigestEnabled: 'Ежедневный дайджест включен',
      weekStartsOnMonday: 'Неделя начинается с понедельника',
      integrationsTitle: 'Интеграции',
      integrationsSubtitle: 'Подключите внешние сервисы, чтобы автоматизировать бронирования и напоминания.',
      connectGoogle: 'Подключить Google',
      connectingGoogle: 'Переходим в Google...',
      disconnectGoogle: 'Отключить Google',
      disconnectingGoogle: 'Отключаем...',
      googleConnected: 'Google подключен',
      googleConnectedSuccessfully: 'Google Calendar успешно подключен.',
      errors: {
        load: 'Не удалось загрузить настройки.',
        save: 'Не удалось сохранить настройки.',
        connectGoogle: 'Не удалось подключить Google.',
        disconnectGoogle: 'Не удалось отключить Google.'
      }
    },
    appointments: {
      pageTitle: 'Записи',
      pageSubtitle: 'Календарный вид с расписанием по дням и времени.',
      specialistFilter: 'Специалист',
      allSpecialists: 'Все специалисты',
      create: 'Создать',
      createTitle: 'Создать запись',
      editTitle: 'Редактировать запись',
      save: 'Сохранить',
      close: 'Закрыть',
      emptyDay: 'На этот день записей нет.',
      viewDay: 'День',
      viewWeek: 'Неделя',
      viewMonth: 'Месяц',
      today: 'Сегодня',
      loading: 'Загрузка записей...',
      dragHint: 'Перетащите запись в другой слот, чтобы перенести её.',
      pastSlotError: 'Нельзя создать или перенести запись на прошедшие дату и время.',
      cancelAction: 'Отменить запись',
      fields: {
        scheduledAt: 'Дата и время',
        status: 'Статус',
        meetingLink: 'Ссылка на встречу',
        notes: 'Комментарий'
      }
    }
  }
} as const;

export type Locale = keyof typeof dictionaries;

export type TranslationKey =
  | 'common.appTitle'
  | 'common.email'
  | 'common.password'
  | 'common.saveSettings'
  | 'common.logout'
  | 'common.settings'
  | 'common.login'
  | 'common.register'
  | 'common.language'
  | 'common.appointments'
  | 'common.profileMenuAria'
  | 'common.appearancePaletteAria'
  | 'common.themeToggleAria'
  | 'common.languageAria'
  | 'auth.loginTitle'
  | 'auth.loginSubtitle'
  | 'auth.registerTitle'
  | 'auth.registerSubtitle'
  | 'auth.formLoginTitle'
  | 'auth.formRegisterTitle'
  | 'auth.submitLogin'
  | 'auth.submitRegister'
  | 'auth.switchToRegister'
  | 'auth.switchToLogin'
  | 'auth.errors.loginFailed'
  | 'auth.errors.registerFailed'
  | 'settings.pageTitle'
  | 'settings.pageSubtitle'
  | 'settings.tabs.system'
  | 'settings.tabs.user'
  | 'settings.systemTitle'
  | 'settings.userTitle'
  | 'settings.timezone'
  | 'settings.locale'
  | 'settings.defaultMeetingDuration'
  | 'settings.dailyDigestEnabled'
  | 'settings.weekStartsOnMonday'
  | 'settings.integrationsTitle'
  | 'settings.integrationsSubtitle'
  | 'settings.connectGoogle'
  | 'settings.connectingGoogle'
  | 'settings.disconnectGoogle'
  | 'settings.disconnectingGoogle'
  | 'settings.googleConnected'
  | 'settings.googleConnectedSuccessfully'
  | 'settings.errors.load'
  | 'settings.errors.save'
  | 'settings.errors.connectGoogle'
  | 'settings.errors.disconnectGoogle'
  | 'appointments.pageTitle'
  | 'appointments.pageSubtitle'
  | 'appointments.specialistFilter'
  | 'appointments.allSpecialists'
  | 'appointments.create'
  | 'appointments.createTitle'
  | 'appointments.editTitle'
  | 'appointments.save'
  | 'appointments.close'
  | 'appointments.emptyDay'
  | 'appointments.viewDay'
  | 'appointments.viewWeek'
  | 'appointments.viewMonth'
  | 'appointments.today'
  | 'appointments.loading'
  | 'appointments.dragHint'
  | 'appointments.pastSlotError'
  | 'appointments.cancelAction'
  | 'appointments.fields.scheduledAt'
  | 'appointments.fields.status'
  | 'appointments.fields.meetingLink'
  | 'appointments.fields.notes';

export const DEFAULT_LOCALE: Locale = 'ru';
