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
      notificationLogs: 'Notification logs',
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
      inviteVerifyTitle: 'Verify email and create account',
      inviteContextGeneric: 'You were invited to join Meetli.',
      inviteContextFallback: 'You were invited to join the “{team}” team.',
      inviteContextFromInviter: '{inviter} invited you to the “{team}” team.',
      inviteFallbackTeamName: 'your team',
      inviteLoading: 'Checking invitation...',
      inviteInvalidTitle: 'Invitation is invalid',
      inviteInvalidText: 'This link has expired or has already been used.',
      inviteRequestNew: 'Request a new invitation',
      inviteCreateAccountSubmit: 'Create account',
      inviteWeakPassword: 'Weak password',
      passwordRepeatLabel: 'Repeat password',
      passwordMismatch: 'Passwords do not match',
      togglePasswordVisibility: 'Toggle password visibility',
      inviteServerError: 'Could not create account, please try again later',
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
        account: 'Account settings',
        specialistPolicy: 'Booking policies',
        notifications: 'Notifications',
        user: 'User settings'
      },
      systemTitle: 'System settings',
      accountTitle: 'Account settings',
      userTitle: 'User settings',
      timezone: 'Timezone',
      locale: 'Locale',
      defaultMeetingDuration: 'Default meeting duration (min)',
      dailyDigestEnabled: 'Daily digest enabled',
      weekStartsOnMonday: 'Week starts on Monday',
      refreshTokenTtlDays: 'Refresh token TTL (days)',
      accessTokenTtlSeconds: 'Access token TTL (seconds)',
      sessionCookieName: 'Session cookie name',
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
      specialistPolicyTitle: 'Specialist booking policies',
      cancelGracePeriodHours: 'Cancel grace period (hours)',
      refundOnLateCancel: 'Refund on late cancel',
      autoCancelUnpaidEnabled: 'Auto-cancel unpaid appointment',
      unpaidAutoCancelAfterHours: 'Auto-cancel unpaid after (hours)',
      notificationSettingsTitle: 'Notification settings',
      reminderChannelsLabel: 'Channels',
      appointmentReminderTimingsLabel: 'Appointment reminder timings',
      paymentReminderTimingsLabel: 'Payment reminder timings',
      disabledOption: 'Disabled',
      channels: {
        email: 'Email',
        telegram: 'Telegram',
        viber: 'Viber',
        sms: 'SMS',
        whatsapp: 'WhatsApp',
      },
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
      specialistSettings: {
        baseSessionPrice: 'Base session price',
        baseHourPrice: 'Base hour price',
        workStartHour: 'Work start hour',
        workEndHour: 'Work end hour',
        slotDurationMin: 'Slot duration (min)',
        slotStepMin: 'Slot step (min)',
        defaultSessionContinuationMin: 'Default session continuation (min)'
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
      resendInvite: 'Resend invite',
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
        delete: 'Unable to delete user.',
        inviteResend: 'Unable to resend invite.'
      },
      success: {
        inviteResent: 'Invite link sent.'
      }
    },
    notificationLogs: {
      pageTitle: 'Notification logs',
      pageSubtitle: 'Delivery history and retry for failed notifications.',
      accessDenied: 'You do not have access to notification logs.',
      empty: 'No notification logs found.',
      resend: 'Resend',
      filters: {
        accountId: 'Account ID',
        specialistId: 'Specialist ID',
        userId: 'User ID',
        apply: 'Apply filters'
      },
      columns: {
        accountId: 'Account',
        specialistId: 'Specialist',
        userId: 'Client',
        specialist: 'Specialist',
        client: 'Client',
        message: 'Message',
        telegram: 'Telegram',
        email: 'Email',
        type: 'Type',
        channel: 'Channel',
        status: 'Status',
        attempts: 'Attempts',
        lastError: 'Error',
        createdAt: 'Created at',
        actions: 'Actions'
      },
      errors: {
        load: 'Unable to load notification logs.',
        resend: 'Unable to resend notification.'
      },
      success: {
        resent: 'Notification queued for resend.'
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
      cancelConfirmRefund: 'Cancel this appointment? Payment refund is allowed.',
      cancelConfirmNoRefund: 'Cancel this appointment? Late cancellation without refund.',
      cancelPolicyRefund: 'Cancellation policy: refund is allowed.',
      cancelPolicyNoRefund: 'Cancellation policy: late cancellation without refund.',
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
      notificationLogs: 'Логи уведомлений',
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
      inviteVerifyTitle: 'Подтвердите email и создайте аккаунт',
      inviteContextGeneric: 'Вас пригласили в Meetli.',
      inviteContextFallback: 'Вас пригласили в команду “{team}”.',
      inviteContextFromInviter: 'Вас пригласил {inviter} в команду “{team}”.',
      inviteFallbackTeamName: 'вашей команды',
      inviteLoading: 'Проверяем приглашение...',
      inviteInvalidTitle: 'Приглашение недействительно',
      inviteInvalidText: 'Ссылка устарела или уже была использована.',
      inviteRequestNew: 'Запросить новое приглашение',
      inviteCreateAccountSubmit: 'Создать аккаунт',
      inviteWeakPassword: 'Слабый пароль',
      passwordRepeatLabel: 'Повторите пароль',
      passwordMismatch: 'Пароли не совпадают',
      togglePasswordVisibility: 'Показать или скрыть пароль',
      inviteServerError: 'Не удалось создать аккаунт, попробуйте позже',
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
        account: 'Аккаунт',
        specialistPolicy: 'Правила брони',
        notifications: 'Оповещения',
        user: 'Пользовательские'
      },
      systemTitle: 'Системные настройки',
      accountTitle: 'Настройки аккаунта',
      userTitle: 'Пользовательские настройки',
      timezone: 'Часовой пояс',
      locale: 'Локаль',
      defaultMeetingDuration: 'Длительность встречи по умолчанию (мин)',
      dailyDigestEnabled: 'Ежедневный дайджест включен',
      weekStartsOnMonday: 'Неделя начинается с понедельника',
      refreshTokenTtlDays: 'TTL refresh token (дни)',
      accessTokenTtlSeconds: 'TTL access token (сек)',
      sessionCookieName: 'Имя session cookie',
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
      specialistPolicyTitle: 'Правила бронирования специалиста',
      cancelGracePeriodHours: 'Окно отмены без штрафа (часы)',
      refundOnLateCancel: 'Возвращать оплату при поздней отмене',
      autoCancelUnpaidEnabled: 'Авто-отмена неоплаченной записи',
      unpaidAutoCancelAfterHours: 'Авто-отмена через (часы)',
      notificationSettingsTitle: 'Настройки оповещений',
      reminderChannelsLabel: 'Каналы',
      appointmentReminderTimingsLabel: 'Напоминание о записи',
      paymentReminderTimingsLabel: 'Напоминание об оплате',
      disabledOption: 'Отключено',
      channels: {
        email: 'Email',
        telegram: 'Telegram',
        viber: 'Viber',
        sms: 'SMS',
        whatsapp: 'WhatsApp',
      },
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
      specialistSettings: {
        baseSessionPrice: 'Базовая цена сессии',
        baseHourPrice: 'Базовая цена часа',
        workStartHour: 'Час начала работы',
        workEndHour: 'Час окончания работы',
        slotDurationMin: 'Длительность слота (мин)',
        slotStepMin: 'Шаг слота (мин)',
        defaultSessionContinuationMin: 'Продление сессии по умолчанию (мин)'
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
      resendInvite: 'Отправить инвайт повторно',
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
        delete: 'Не удалось удалить пользователя.',
        inviteResend: 'Не удалось отправить приглашение повторно.'
      },
      success: {
        inviteResent: 'Ссылка-приглашение отправлена.'
      }
    },
    notificationLogs: {
      pageTitle: 'Логи уведомлений',
      pageSubtitle: 'История доставки и повторная отправка недоставленных уведомлений.',
      accessDenied: 'У вас нет доступа к логам уведомлений.',
      empty: 'Логи уведомлений не найдены.',
      resend: 'Повторить отправку',
      filters: {
        accountId: 'ID аккаунта',
        specialistId: 'ID специалиста',
        userId: 'ID клиента',
        apply: 'Применить фильтры'
      },
      columns: {
        accountId: 'Аккаунт',
        specialistId: 'Специалист',
        userId: 'Клиент',
        specialist: 'Специалист',
        client: 'Клиент',
        message: 'Сообщение',
        telegram: 'Telegram',
        email: 'Email',
        type: 'Тип',
        channel: 'Канал',
        status: 'Статус',
        attempts: 'Попытки',
        lastError: 'Ошибка',
        createdAt: 'Создано',
        actions: 'Действия'
      },
      errors: {
        load: 'Не удалось загрузить логи уведомлений.',
        resend: 'Не удалось повторно отправить уведомление.'
      },
      success: {
        resent: 'Уведомление поставлено в очередь на повторную отправку.'
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
      cancelConfirmRefund: 'Отменить запись? Возврат оплаты разрешён.',
      cancelConfirmNoRefund: 'Отменить запись? Поздняя отмена без возврата оплаты.',
      cancelPolicyRefund: 'Правило отмены: возврат оплаты разрешён.',
      cancelPolicyNoRefund: 'Правило отмены: поздняя отмена без возврата оплаты.',
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
  | 'common.notificationLogs'
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

  | 'auth.inviteVerifyTitle'
  | 'auth.inviteContextGeneric'
  | 'auth.inviteContextFallback'
  | 'auth.inviteContextFromInviter'
  | 'auth.inviteFallbackTeamName'
  | 'auth.inviteLoading'
  | 'auth.inviteInvalidTitle'
  | 'auth.inviteInvalidText'
  | 'auth.inviteRequestNew'
  | 'auth.inviteCreateAccountSubmit'
  | 'auth.inviteWeakPassword'
  | 'auth.passwordRepeatLabel'
  | 'auth.passwordMismatch'
  | 'auth.togglePasswordVisibility'
  | 'auth.inviteServerError'
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
  | 'settings.tabs.account'
  | 'settings.tabs.specialistPolicy'
  | 'settings.tabs.notifications'
  | 'settings.tabs.user'
  | 'settings.systemTitle'
  | 'settings.accountTitle'
  | 'settings.userTitle'
  | 'settings.timezone'
  | 'settings.locale'
  | 'settings.defaultMeetingDuration'
  | 'settings.dailyDigestEnabled'
  | 'settings.weekStartsOnMonday'
  | 'settings.refreshTokenTtlDays'
  | 'settings.accessTokenTtlSeconds'
  | 'settings.sessionCookieName'
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
  | 'settings.specialistPolicyTitle'
  | 'settings.cancelGracePeriodHours'
  | 'settings.refundOnLateCancel'
  | 'settings.autoCancelUnpaidEnabled'
  | 'settings.unpaidAutoCancelAfterHours'
  | 'settings.notificationSettingsTitle'
  | 'settings.reminderChannelsLabel'
  | 'settings.appointmentReminderTimingsLabel'
  | 'settings.paymentReminderTimingsLabel'
  | 'settings.disabledOption'
  | 'settings.channels.email'
  | 'settings.channels.telegram'
  | 'settings.channels.viber'
  | 'settings.channels.sms'
  | 'settings.channels.whatsapp'
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
  | 'settings.specialistSettings.baseSessionPrice'
  | 'settings.specialistSettings.baseHourPrice'
  | 'settings.specialistSettings.workStartHour'
  | 'settings.specialistSettings.workEndHour'
  | 'settings.specialistSettings.slotDurationMin'
  | 'settings.specialistSettings.slotStepMin'
  | 'settings.specialistSettings.defaultSessionContinuationMin'
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
  | 'users.resendInvite'
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
  | 'users.errors.inviteResend'
  | 'users.success.inviteResent'
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
  | 'appointments.cancelConfirmRefund'
  | 'appointments.cancelConfirmNoRefund'
  | 'appointments.cancelPolicyRefund'
  | 'appointments.cancelPolicyNoRefund'
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
  | 'notificationLogs.pageTitle'
  | 'notificationLogs.pageSubtitle'
  | 'notificationLogs.accessDenied'
  | 'notificationLogs.empty'
  | 'notificationLogs.resend'
  | 'notificationLogs.filters.accountId'
  | 'notificationLogs.filters.specialistId'
  | 'notificationLogs.filters.userId'
  | 'notificationLogs.filters.apply'
  | 'notificationLogs.columns.accountId'
  | 'notificationLogs.columns.specialistId'
  | 'notificationLogs.columns.userId'
  | 'notificationLogs.columns.specialist'
  | 'notificationLogs.columns.client'
  | 'notificationLogs.columns.message'
  | 'notificationLogs.columns.telegram'
  | 'notificationLogs.columns.email'
  | 'notificationLogs.columns.type'
  | 'notificationLogs.columns.channel'
  | 'notificationLogs.columns.status'
  | 'notificationLogs.columns.attempts'
  | 'notificationLogs.columns.lastError'
  | 'notificationLogs.columns.createdAt'
  | 'notificationLogs.columns.actions'
  | 'notificationLogs.errors.load'
  | 'notificationLogs.errors.resend'
  | 'notificationLogs.success.resent'
  | 'appointments.fields.notes';

export const DEFAULT_LOCALE: Locale = 'ru';
