export type SupportedLanguage = 'ru' | 'en';

type Dictionary = Record<string, string>;

export const dictionaries: Record<SupportedLanguage, Dictionary> = {
  ru: {
    'common.book': 'Записаться',
    'common.myAppointments': 'Мои записи',
    'common.changeLanguage': 'Сменить язык',
    'common.back': 'Назад',

    'start.welcomeNew': 'Привет, {{name}}! Я бот для записи к психологу.',
    'start.welcomeBack': 'С возвращением, {{name}}!',
    'start.chooseAction': 'Выберите действие:',

    'language.changed': 'Язык переключён на русский.',
    'language.choose': 'Выберите язык:',

    'booking.chooseService': 'Выберите услугу:',
    'booking.noServices': 'Сейчас нет доступных услуг.',
    'booking.chooseSpecialist': 'Выберите специалиста:',
    'booking.noSpecialists': 'Сейчас нет доступных специалистов.',
    'booking.chooseDate': 'Выберите дату:',
    'booking.enterName': 'Введите ваше имя:',
    'booking.chooseTime': 'Выберите время:',
    'booking.noSlots': 'На эту дату нет свободного времени.',
    'booking.specialistSelected': 'Специалист: {{name}}',
    'booking.serviceSelected': 'Услуга: {{name}}',
  },

  en: {
    'common.book': 'Book an appointment',
    'common.myAppointments': 'My appointments',
    'common.changeLanguage': 'Change language',
    'common.back': 'Back',

    'start.welcomeNew': 'Hi, {{name}}! I’m your psychology booking bot.',
    'start.welcomeBack': 'Welcome back, {{name}}!',
    'start.chooseAction': 'Choose an action:',

    'language.changed': 'Language switched to English.',
    'language.choose': 'Choose a language:',

    'booking.chooseService': 'Choose a service:',
    'booking.noServices': 'There are no available services right now.',
    'booking.chooseSpecialist': 'Choose a specialist:',
    'booking.noSpecialists': 'There are no available specialists right now.',
    'booking.chooseTime': 'Choose a time:',
    'booking.enterName': 'Please enter your name:',
    'booking.noSlots': 'No available time slots for this date.',
    'booking.specialistSelected': 'Specialist: {{name}}',
    'booking.serviceSelected': 'Service: {{name}}',
  },
};
