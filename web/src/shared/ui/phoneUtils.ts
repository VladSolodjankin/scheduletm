export type PhoneCountry = {
  isoCode: string;
  label: string;
  dialCode: string;
  localDigitsCount: number;
};

export const onlyDigits = (value: string) => value.replace(/\D/g, '');

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { isoCode: 'AL', label: 'Albania', dialCode: '355', localDigitsCount: 9 },
  { isoCode: 'AD', label: 'Andorra', dialCode: '376', localDigitsCount: 6 },
  { isoCode: 'AM', label: 'Armenia', dialCode: '374', localDigitsCount: 8 },
  { isoCode: 'AT', label: 'Austria', dialCode: '43', localDigitsCount: 10 },
  { isoCode: 'AZ', label: 'Azerbaijan', dialCode: '994', localDigitsCount: 9 },
  { isoCode: 'BY', label: 'Belarus', dialCode: '375', localDigitsCount: 9 },
  { isoCode: 'BE', label: 'Belgium', dialCode: '32', localDigitsCount: 9 },
  { isoCode: 'BA', label: 'Bosnia and Herzegovina', dialCode: '387', localDigitsCount: 8 },
  { isoCode: 'BG', label: 'Bulgaria', dialCode: '359', localDigitsCount: 9 },
  { isoCode: 'HR', label: 'Croatia', dialCode: '385', localDigitsCount: 9 },
  { isoCode: 'CY', label: 'Cyprus', dialCode: '357', localDigitsCount: 8 },
  { isoCode: 'CZ', label: 'Czechia', dialCode: '420', localDigitsCount: 9 },
  { isoCode: 'DK', label: 'Denmark', dialCode: '45', localDigitsCount: 8 },
  { isoCode: 'EE', label: 'Estonia', dialCode: '372', localDigitsCount: 8 },
  { isoCode: 'FI', label: 'Finland', dialCode: '358', localDigitsCount: 9 },
  { isoCode: 'FR', label: 'France', dialCode: '33', localDigitsCount: 9 },
  { isoCode: 'GE', label: 'Georgia', dialCode: '995', localDigitsCount: 9 },
  { isoCode: 'DE', label: 'Germany', dialCode: '49', localDigitsCount: 10 },
  { isoCode: 'GR', label: 'Greece', dialCode: '30', localDigitsCount: 10 },
  { isoCode: 'HU', label: 'Hungary', dialCode: '36', localDigitsCount: 9 },
  { isoCode: 'IS', label: 'Iceland', dialCode: '354', localDigitsCount: 7 },
  { isoCode: 'IE', label: 'Ireland', dialCode: '353', localDigitsCount: 9 },
  { isoCode: 'IT', label: 'Italy', dialCode: '39', localDigitsCount: 10 },
  { isoCode: 'KZ', label: 'Kazakhstan', dialCode: '7', localDigitsCount: 10 },
  { isoCode: 'XK', label: 'Kosovo', dialCode: '383', localDigitsCount: 8 },
  { isoCode: 'KG', label: 'Kyrgyzstan', dialCode: '996', localDigitsCount: 9 },
  { isoCode: 'LV', label: 'Latvia', dialCode: '371', localDigitsCount: 8 },
  { isoCode: 'LI', label: 'Liechtenstein', dialCode: '423', localDigitsCount: 7 },
  { isoCode: 'LT', label: 'Lithuania', dialCode: '370', localDigitsCount: 8 },
  { isoCode: 'LU', label: 'Luxembourg', dialCode: '352', localDigitsCount: 9 },
  { isoCode: 'MT', label: 'Malta', dialCode: '356', localDigitsCount: 8 },
  { isoCode: 'MD', label: 'Moldova', dialCode: '373', localDigitsCount: 8 },
  { isoCode: 'MC', label: 'Monaco', dialCode: '377', localDigitsCount: 8 },
  { isoCode: 'ME', label: 'Montenegro', dialCode: '382', localDigitsCount: 8 },
  { isoCode: 'NL', label: 'Netherlands', dialCode: '31', localDigitsCount: 9 },
  { isoCode: 'MK', label: 'North Macedonia', dialCode: '389', localDigitsCount: 8 },
  { isoCode: 'NO', label: 'Norway', dialCode: '47', localDigitsCount: 8 },
  { isoCode: 'PL', label: 'Poland', dialCode: '48', localDigitsCount: 9 },
  { isoCode: 'PT', label: 'Portugal', dialCode: '351', localDigitsCount: 9 },
  { isoCode: 'RO', label: 'Romania', dialCode: '40', localDigitsCount: 9 },
  { isoCode: 'RU', label: 'Russia', dialCode: '7', localDigitsCount: 10 },
  { isoCode: 'SM', label: 'San Marino', dialCode: '378', localDigitsCount: 10 },
  { isoCode: 'RS', label: 'Serbia', dialCode: '381', localDigitsCount: 9 },
  { isoCode: 'SK', label: 'Slovakia', dialCode: '421', localDigitsCount: 9 },
  { isoCode: 'SI', label: 'Slovenia', dialCode: '386', localDigitsCount: 8 },
  { isoCode: 'ES', label: 'Spain', dialCode: '34', localDigitsCount: 9 },
  { isoCode: 'SE', label: 'Sweden', dialCode: '46', localDigitsCount: 9 },
  { isoCode: 'CH', label: 'Switzerland', dialCode: '41', localDigitsCount: 9 },
  { isoCode: 'TJ', label: 'Tajikistan', dialCode: '992', localDigitsCount: 9 },
  { isoCode: 'TM', label: 'Turkmenistan', dialCode: '993', localDigitsCount: 8 },
  { isoCode: 'UA', label: 'Ukraine', dialCode: '380', localDigitsCount: 9 },
  { isoCode: 'GB', label: 'United Kingdom', dialCode: '44', localDigitsCount: 10 },
  { isoCode: 'UZ', label: 'Uzbekistan', dialCode: '998', localDigitsCount: 9 },
  { isoCode: 'VA', label: 'Vatican City', dialCode: '379', localDigitsCount: 10 },
];

export const DEFAULT_COUNTRY = PHONE_COUNTRIES.find((country) => country.isoCode === 'RU') ?? PHONE_COUNTRIES[0];

export const getCountryByIso = (isoCode: string) =>
  PHONE_COUNTRIES.find((country) => country.isoCode === isoCode) ?? DEFAULT_COUNTRY;

export const parseLocalDigits = (value: string, country: PhoneCountry) => {
  const fullDigits = onlyDigits(value.startsWith('+') ? value.slice(1) : value);

  if (fullDigits.startsWith(country.dialCode)) {
    return fullDigits.slice(country.dialCode.length).slice(0, country.localDigitsCount);
  }

  return fullDigits.slice(0, country.localDigitsCount);
};

export const getCountryByPhone = (value: string) => {
  const digits = onlyDigits(value.startsWith('+') ? value.slice(1) : value);

  const matchingCountry = PHONE_COUNTRIES
    .slice()
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((country) => digits.startsWith(country.dialCode));

  return matchingCountry ?? DEFAULT_COUNTRY;
};

export const isValidPhoneValue = (value: string) => {
  if (!value) {
    return true;
  }

  const country = getCountryByPhone(value);
  const digits = parseLocalDigits(value, country);

  return digits.length === country.localDigitsCount;
};
