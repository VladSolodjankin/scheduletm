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
      pageSubtitle: 'Manage general preferences, integrations, and interface appearance.',
      tabs: {
        general: 'General',
        integrations: 'Integrations'
      },
      profileTitle: 'Profile settings',
      timezone: 'Timezone',
      locale: 'Locale',
      defaultMeetingDuration: 'Default meeting duration (min)',
      dailyDigestEnabled: 'Daily digest enabled',
      weekStartsOnMonday: 'Week starts on Monday',
      integrationsTitle: 'Integrations',
      integrationsSubtitle: 'Connect external services to automate bookings and reminders.',
      connectGoogle: 'Connect Google',
      connectingGoogle: 'Redirecting to Google...',
      googleConnected: 'Google connected',
      googleConnectedSuccessfully: 'Google Calendar connected successfully.',
      errors: {
        load: 'Unable to load settings.',
        save: 'Unable to save settings.',
        connectGoogle: 'Unable to connect Google.'
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
      pageSubtitle: 'Управляйте общими параметрами, интеграциями и внешним видом интерфейса.',
      tabs: {
        general: 'Общие',
        integrations: 'Интеграции'
      },
      profileTitle: 'Настройки профиля',
      timezone: 'Timezone',
      locale: 'Locale',
      defaultMeetingDuration: 'Default meeting duration (min)',
      dailyDigestEnabled: 'Daily digest enabled',
      weekStartsOnMonday: 'Week starts on Monday',
      integrationsTitle: 'Интеграции',
      integrationsSubtitle: 'Подключите внешние сервисы, чтобы автоматизировать бронирования и напоминания.',
      connectGoogle: 'Подключить Google',
      connectingGoogle: 'Переходим в Google...',
      googleConnected: 'Google подключен',
      googleConnectedSuccessfully: 'Google Calendar успешно подключен.',
      errors: {
        load: 'Не удалось загрузить настройки.',
        save: 'Не удалось сохранить настройки.',
        connectGoogle: 'Не удалось подключить Google.'
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
  | 'settings.tabs.general'
  | 'settings.tabs.integrations'
  | 'settings.profileTitle'
  | 'settings.timezone'
  | 'settings.locale'
  | 'settings.defaultMeetingDuration'
  | 'settings.dailyDigestEnabled'
  | 'settings.weekStartsOnMonday'
  | 'settings.integrationsTitle'
  | 'settings.integrationsSubtitle'
  | 'settings.connectGoogle'
  | 'settings.connectingGoogle'
  | 'settings.googleConnected'
  | 'settings.googleConnectedSuccessfully'
  | 'settings.errors.load'
  | 'settings.errors.save'
  | 'settings.errors.connectGoogle';

export const DEFAULT_LOCALE: Locale = 'ru';
