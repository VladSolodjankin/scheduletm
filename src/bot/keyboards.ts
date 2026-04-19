import { SupportedLanguage } from '../i18n/dictionaries';
import { t as translate } from '../i18n';

type ServiceRow = {
  id: number;
  name_ru: string;
  name_en: string;
};

type SpecialistRow = {
  id: number;
  name: string;
};

type UserAppointmentKeyboardRow = {
  id: number;
  title: string;
};

export function getMainMenuKeyboard(lang: SupportedLanguage) {
  return {
    keyboard: [
      [{ text: translate(lang, 'common.book') }],
      [
        { text: translate(lang, 'common.myAppointments') },
        { text: translate(lang, 'common.changeLanguage') },
      ],
    ],
    resize_keyboard: true,
  };
}

export function getLanguageKeyboard() {
  return {
    keyboard: [[{ text: 'Русский' }, { text: 'English' }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

export function getServicesInlineKeyboard(
  services: ServiceRow[],
  lang: SupportedLanguage,
) {
  return {
    inline_keyboard: services.map((service) => [
      {
        text: lang === 'ru' ? service.name_ru : service.name_en,
        callback_data: `service:${service.id}`,
      },
    ]),
  };
}

export function getSpecialistsInlineKeyboard(specialists: SpecialistRow[]) {
  return {
    inline_keyboard: specialists.map((specialist) => [
      {
        text: specialist.name,
        callback_data: `specialist:${specialist.id}`,
      },
    ]),
  };
}

export function getDatesInlineKeyboard(dates: string[]) {
  return {
    inline_keyboard: dates.map((date) => [
      {
        text: date,
        callback_data: `date:${date}`,
      },
    ]),
  };
}

export function getTimeSlotsInlineKeyboard(
  slots: string[],
  lang: SupportedLanguage,
) {
  const normalizedSlots = slots.filter((slot) => /^\d{2}:\d{2}$/.test(slot));

  return {
    inline_keyboard: [
      ...normalizedSlots.map((slot) => [
        {
          text: slot,
          callback_data: `time_${slot.replace(':', '')}`,
        },
      ]),
      [
        {
          text: translate(lang, 'booking.changeDate'),
          callback_data: 'time_change_date',
        },
      ],
    ],
  };
}

export function getPhoneRequestKeyboard(lang: SupportedLanguage) {
  return {
    keyboard: [
      [{ text: translate(lang, 'booking.sharePhoneButton'), request_contact: true }],
      [{ text: translate(lang, 'booking.skipPhone') }],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

export function getBookingConfirmationKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '✅', callback_data: 'confirm:yes' },
        { text: '✏️', callback_data: 'confirm:edit' },
      ],
    ],
  };
}


export function getBookingFinalInlineKeyboard(
  lang: SupportedLanguage,
  calendarGoogleUrl: string,
  calendarAppleUrl: string,
  calendarMicrosoftUrl: string,
  paymentUrl: string,
) {
  return {
    inline_keyboard: [
      [{ text: translate(lang, 'booking.openCalendarGoogle'), url: calendarGoogleUrl }],
      [{ text: translate(lang, 'booking.openCalendarApple'), url: calendarAppleUrl }],
      [{ text: translate(lang, 'booking.openCalendarMicrosoft'), url: calendarMicrosoftUrl }],
      [{ text: translate(lang, 'booking.openPayment'), url: paymentUrl }],
    ],
  };
}

export function getMyAppointmentsInlineKeyboard(
  appointments: UserAppointmentKeyboardRow[],
) {
  return {
    inline_keyboard: appointments.map((appointment) => [
      {
        text: appointment.title,
        callback_data: `appointment:${appointment.id}`,
      },
    ]),
  };
}

export function getAppointmentEditInlineKeyboard(
  appointmentId: number,
  lang: SupportedLanguage,
) {
  return {
    inline_keyboard: [
      [
        {
          text: translate(lang, 'appointments.editButton'),
          callback_data: `appointment_edit:${appointmentId}`,
        },
      ],
      [
        {
          text: translate(lang, 'appointments.cancelButton'),
          callback_data: `appointment_cancel:${appointmentId}`,
        },
      ],
    ],
  };
}
