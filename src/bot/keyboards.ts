import { SupportedLanguage } from '../i18n/dictionaries';
import { t as translate } from '../i18n';

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
