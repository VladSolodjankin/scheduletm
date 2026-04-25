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
      specialists: 'Specialists',
      users: 'Users',
      profileMenuAria: 'Open profile menu',
      appearancePaletteAria: 'Select color palette',
      themeToggleAria: 'Toggle theme mode',
      languageAria: 'Select language',
      errors: {
        network: 'Network connection issue. Please check your internet and try again.'
      }
    },
    auth: {
      loginTitle: 'Sign in to your account',
      loginSubtitle: 'Continue working with your schedule.',
      registerTitle: 'Register',
      registerSubtitle: 'Create an account and start setup.',
      formLoginTitle: 'Login',
      formRegisterTitle: 'Register',
      verifyTitle: 'Verify email',
      verifySubtitle: 'Enter the OTP code from email for {email}.',
      verifyCodeLabel: 'OTP code',
      verifyCodeRequired: 'Enter verification code',
      verifyCodeInvalid: 'Invalid verification code',
      verifySubmit: 'Confirm email',
      verifyResend: 'Resend code',
      verifyBack: 'Back',
      inviteAcceptTitle: 'Accept invitation',
      inviteAcceptSubtitle: 'Set your password to activate access.',
      inviteTokenInvalid: 'Invite token is missing or invalid.',
      inviteAcceptSubmit: 'Accept invite',
      inviteTokenLabel: 'Invite token',
      inviteAcceptedSuccess: 'Invitation accepted. You can now sign in.',
      registerOtpSentHint: 'Verification code sent to {email}.',
      registerOtpRestoreHint: 'Continue verification for {email}.',
      submitLogin: 'Sign in',
      submitRegister: 'Create account',
      switchToRegister: "Don't have an account? Register",
      switchToLogin: 'Already have an account? Sign in',
      errors: {
        loginFailed: 'Unable to sign in. Check your email and password.',
        registerFailed: 'Unable to register.',
        verifyFailed: 'Unable to verify email.',
        verifyResendFailed: 'Unable to resend verification code.'
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
      telegramBotToken: 'Telegram BOT_TOKEN',
      telegramBotConnected: 'Telegram bot connected',
      telegramBotNotConnected: 'Telegram bot is not connected',
      clearTelegramBotToken: 'Disconnect Telegram bot',
      googleConnectedSuccessfully: 'Google Calendar connected successfully.',
      specialists: {
        title: 'Specialists',
        add: 'Add specialist',
        edit: 'Edit specialist',
        delete: 'Delete specialist',
        empty: 'No specialists yet.',
        addDialogTitle: 'Add specialist',
        editDialogTitle: 'Edit specialist',
        columns: {
          name: 'Name',
          timezone: 'Timezone',
          active: 'Active',
          actions: 'Actions'
        }
      },
      errors: {
        load: 'Unable to load settings.',
        save: 'Unable to save settings.',
        connectGoogle: 'Unable to connect Google.',
        disconnectGoogle: 'Unable to disconnect Google.',
        saveSpecialist: 'Unable to save specialist.',
        deleteSpecialist: 'Unable to delete specialist.'
      }
    },
    specialists: {
      pageTitle: 'Specialists',
      pageSubtitle: 'Create and manage specialist profiles for your team.',
      accessDenied: 'Only owner or admin can manage specialists.'
    },

    users: {
      pageTitle: 'Users',
      pageSubtitle: 'Create, edit and deactivate users for your account.',
      accessDenied: 'Only owner or admin can manage users.',
      tableTitle: 'Users',
      add: 'Add user',
      edit: 'Edit user',
      delete: 'Deactivate user',
      empty: 'No users yet.',
      save: 'Save',
      close: 'Close',
      form: {
        addTitle: 'Add user',
        editTitle: 'Edit user',
        email: 'Email',
        role: 'Role',
        firstName: 'First name',
        lastName: 'Last name',
        phone: 'Phone',
        telegram: 'Telegram'
      },
      adminConfirm: {
        title: 'Create admin user?',
        description: 'You are about to create a user with admin role. Please confirm this action.',
        cancel: 'Cancel',
        confirm: 'Create admin'
      },
      columns: {
        email: 'Email',
        firstName: 'First name',
        lastName: 'Last name',
        role: 'Role',
        verified: 'Verified',
        active: 'Active',
        actions: 'Actions'
      },
      errors: {
        load: 'Unable to load users.',
        save: 'Unable to save user.',
        delete: 'Unable to delete user.'
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
      markPaidAction: 'Mark as paid',
      notifyAction: 'Notify client',
      paymentStatusPaid: 'Paid',
      paymentStatusUnpaid: 'Unpaid',
      auditTitle: 'Activity',
      eventCancel: 'Appointment cancelled',
      eventReschedule: 'Appointment rescheduled',
      eventMarkPaid: 'Payment confirmed',
      eventNotify: 'Manual notification sent',
      errors: {
        load: 'Unable to load appointments.',
        save: 'Unable to save appointment.',
        cancel: 'Unable to cancel appointment.',
        reschedule: 'Unable to reschedule appointment.',
        markPaid: 'Unable to confirm payment.',
        notify: 'Unable to send notification.',
        createSpecialistFirst: 'Create at least one specialist first.',
      },
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
      specialists: 'Специалисты',
      users: 'Пользователи',
      profileMenuAria: 'Открыть меню профиля',
      appearancePaletteAria: 'Выбрать цветовую палитру',
      themeToggleAria: 'Переключить тему',
      languageAria: 'Выбрать язык',
      errors: {
        network: 'Проблема с подключением к сети. Проверьте интернет и попробуйте снова.'
      }
    },
    auth: {
      loginTitle: 'Вход в аккаунт',
      loginSubtitle: 'Продолжайте работу со своим расписанием.',
      registerTitle: 'Регистрация',
      registerSubtitle: 'Создайте аккаунт и начните настройки.',
      formLoginTitle: 'Вход',
      formRegisterTitle: 'Регистрация',
      verifyTitle: 'Подтверждение email',
      verifySubtitle: 'Введите OTP-код из письма для {email}.',
      verifyCodeLabel: 'OTP-код',
      verifyCodeRequired: 'Введите код подтверждения',
      verifyCodeInvalid: 'Некорректный код подтверждения',
      verifySubmit: 'Подтвердить email',
      verifyResend: 'Отправить код снова',
      verifyBack: 'Назад',
      inviteAcceptTitle: 'Принять приглашение',
      inviteAcceptSubtitle: 'Задайте пароль, чтобы активировать доступ.',
      inviteTokenInvalid: 'Токен приглашения отсутствует или некорректен.',
      inviteAcceptSubmit: 'Принять приглашение',
      inviteTokenLabel: 'Токен приглашения',
      inviteAcceptedSuccess: 'Приглашение принято. Теперь можно войти.',
      registerOtpSentHint: 'Код подтверждения отправлен на {email}.',
      registerOtpRestoreHint: 'Продолжите подтверждение для {email}.',
      submitLogin: 'Войти',
      submitRegister: 'Зарегистрироваться',
      switchToRegister: 'Нет аккаунта? Зарегистрироваться',
      switchToLogin: 'Уже есть аккаунт? Войти',
      errors: {
        loginFailed: 'Не удалось войти. Проверьте email и пароль.',
        registerFailed: 'Не удалось зарегистрироваться.',
        verifyFailed: 'Не удалось подтвердить email.',
        verifyResendFailed: 'Не удалось отправить код повторно.'
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
      telegramBotToken: 'Telegram BOT_TOKEN',
      telegramBotConnected: 'Telegram-бот подключен',
      telegramBotNotConnected: 'Telegram-бот не подключен',
      clearTelegramBotToken: 'Отключить Telegram-бота',
      googleConnectedSuccessfully: 'Google Calendar успешно подключен.',
      specialists: {
        title: 'Специалисты',
        add: 'Добавить специалиста',
        edit: 'Редактировать специалиста',
        delete: 'Удалить специалиста',
        empty: 'Специалисты пока не добавлены.',
        addDialogTitle: 'Добавить специалиста',
        editDialogTitle: 'Редактировать специалиста',
        columns: {
          name: 'Имя',
          timezone: 'Часовой пояс',
          active: 'Активен',
          actions: 'Действия'
        }
      },
      errors: {
        load: 'Не удалось загрузить настройки.',
        save: 'Не удалось сохранить настройки.',
        connectGoogle: 'Не удалось подключить Google.',
        disconnectGoogle: 'Не удалось отключить Google.',
        saveSpecialist: 'Не удалось сохранить специалиста.',
        deleteSpecialist: 'Не удалось удалить специалиста.'
      }
    },
    specialists: {
      pageTitle: 'Специалисты',
      pageSubtitle: 'Добавляйте и управляйте профилями специалистов вашей команды.',
      accessDenied: 'Управлять специалистами может только владелец или администратор.'
    },

    users: {
      pageTitle: 'Пользователи',
      pageSubtitle: 'Добавляйте, редактируйте и деактивируйте пользователей аккаунта.',
      accessDenied: 'Управлять пользователями может только владелец или администратор.',
      tableTitle: 'Пользователи',
      add: 'Добавить пользователя',
      edit: 'Редактировать пользователя',
      delete: 'Деактивировать пользователя',
      empty: 'Пользователи пока не добавлены.',
      save: 'Сохранить',
      close: 'Закрыть',
      form: {
        addTitle: 'Добавить пользователя',
        editTitle: 'Редактировать пользователя',
        email: 'Email',
        role: 'Роль',
        firstName: 'Имя',
        lastName: 'Фамилия',
        phone: 'Телефон',
        telegram: 'Telegram'
      },
      adminConfirm: {
        title: 'Создать администратора?',
        description: 'Вы собираетесь создать пользователя с ролью admin. Подтвердите действие.',
        cancel: 'Отмена',
        confirm: 'Создать admin'
      },
      columns: {
        email: 'Email',
        firstName: 'Имя',
        lastName: 'Фамилия',
        role: 'Роль',
        verified: 'Верифицирован',
        active: 'Активен',
        actions: 'Действия'
      },
      errors: {
        load: 'Не удалось загрузить пользователей.',
        save: 'Не удалось сохранить пользователя.',
        delete: 'Не удалось удалить пользователя.'
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
      markPaidAction: 'Подтвердить оплату',
      notifyAction: 'Уведомить клиента',
      paymentStatusPaid: 'Оплачено',
      paymentStatusUnpaid: 'Не оплачено',
      auditTitle: 'История действий',
      eventCancel: 'Запись отменена',
      eventReschedule: 'Запись перенесена',
      eventMarkPaid: 'Оплата подтверждена',
      eventNotify: 'Ручное уведомление отправлено',
      errors: {
        load: 'Не удалось загрузить записи.',
        save: 'Не удалось сохранить запись.',
        cancel: 'Не удалось отменить запись.',
        reschedule: 'Не удалось перенести запись.',
        markPaid: 'Не удалось подтвердить оплату.',
        notify: 'Не удалось отправить уведомление.',
        createSpecialistFirst: 'Сначала создайте хотя бы одного специалиста.',
      },
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
  | 'common.specialists'
  | 'common.users'
  | 'common.profileMenuAria'
  | 'common.appearancePaletteAria'
  | 'common.themeToggleAria'
  | 'common.languageAria'
  | 'common.errors.network'
  | 'auth.loginTitle'
  | 'auth.loginSubtitle'
  | 'auth.registerTitle'
  | 'auth.registerSubtitle'
  | 'auth.formLoginTitle'
  | 'auth.formRegisterTitle'
  | 'auth.verifyTitle'
  | 'auth.verifySubtitle'
  | 'auth.verifyCodeLabel'
  | 'auth.verifyCodeRequired'
  | 'auth.verifyCodeInvalid'
  | 'auth.verifySubmit'
  | 'auth.verifyResend'
  | 'auth.verifyBack'
  | 'auth.inviteAcceptTitle'
  | 'auth.inviteAcceptSubtitle'
  | 'auth.inviteTokenInvalid'
  | 'auth.inviteAcceptSubmit'
  | 'auth.inviteTokenLabel'
  | 'auth.inviteAcceptedSuccess'
  | 'auth.registerOtpSentHint'
  | 'auth.registerOtpRestoreHint'
  | 'auth.submitLogin'
  | 'auth.submitRegister'
  | 'auth.switchToRegister'
  | 'auth.switchToLogin'
  | 'auth.errors.loginFailed'
  | 'auth.errors.registerFailed'
  | 'auth.errors.verifyFailed'
  | 'auth.errors.verifyResendFailed'
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
  | 'settings.telegramBotToken'
  | 'settings.telegramBotConnected'
  | 'settings.telegramBotNotConnected'
  | 'settings.clearTelegramBotToken'
  | 'settings.googleConnectedSuccessfully'
  | 'settings.specialists.title'
  | 'settings.specialists.add'
  | 'settings.specialists.edit'
  | 'settings.specialists.delete'
  | 'settings.specialists.empty'
  | 'settings.specialists.addDialogTitle'
  | 'settings.specialists.editDialogTitle'
  | 'settings.specialists.columns.name'
  | 'settings.specialists.columns.timezone'
  | 'settings.specialists.columns.active'
  | 'settings.specialists.columns.actions'
  | 'settings.errors.saveSpecialist'
  | 'settings.errors.deleteSpecialist'
  | 'settings.errors.load'
  | 'settings.errors.save'
  | 'settings.errors.connectGoogle'
  | 'settings.errors.disconnectGoogle'
  | 'specialists.pageTitle'
  | 'specialists.pageSubtitle'
  | 'specialists.accessDenied'
  | 'users.pageTitle'
  | 'users.pageSubtitle'
  | 'users.accessDenied'
  | 'users.tableTitle'
  | 'users.add'
  | 'users.edit'
  | 'users.delete'
  | 'users.empty'
  | 'users.save'
  | 'users.close'
  | 'users.form.addTitle'
  | 'users.form.editTitle'
  | 'users.form.email'
  | 'users.form.role'
  | 'users.form.firstName'
  | 'users.form.lastName'
  | 'users.form.phone'
  | 'users.form.telegram'
  | 'users.adminConfirm.title'
  | 'users.adminConfirm.description'
  | 'users.adminConfirm.cancel'
  | 'users.adminConfirm.confirm'
  | 'users.columns.email'
  | 'users.columns.firstName'
  | 'users.columns.lastName'
  | 'users.columns.role'
  | 'users.columns.verified'
  | 'users.columns.active'
  | 'users.columns.actions'
  | 'users.errors.load'
  | 'users.errors.save'
  | 'users.errors.delete'
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
  | 'appointments.markPaidAction'
  | 'appointments.notifyAction'
  | 'appointments.paymentStatusPaid'
  | 'appointments.paymentStatusUnpaid'
  | 'appointments.auditTitle'
  | 'appointments.eventCancel'
  | 'appointments.eventReschedule'
  | 'appointments.eventMarkPaid'
  | 'appointments.eventNotify'
  | 'appointments.errors.load'
  | 'appointments.errors.save'
  | 'appointments.errors.cancel'
  | 'appointments.errors.reschedule'
  | 'appointments.errors.markPaid'
  | 'appointments.errors.notify'
  | 'appointments.errors.createSpecialistFirst'
  | 'appointments.fields.scheduledAt'
  | 'appointments.fields.status'
  | 'appointments.fields.meetingLink'
  | 'appointments.fields.notes';

export const DEFAULT_LOCALE: Locale = 'ru';
