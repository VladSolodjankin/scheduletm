import { FormControl, InputLabel, MenuItem, Select, Stack, TextField, type TextFieldProps } from '@mui/material';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import type { ControllerRenderProps, FieldValues, Path } from 'react-hook-form';

type AppRhfPhoneFieldProps<TFieldValues extends FieldValues> = Omit<
  TextFieldProps,
  'name' | 'value' | 'onBlur' | 'onChange' | 'inputRef'
> & {
  field: ControllerRenderProps<TFieldValues, Path<TFieldValues>>;
  error?: boolean;
  helperText?: string;
};

type PhoneCountry = {
  isoCode: string;
  label: string;
  dialCode: string;
  localDigitsCount: number;
};

const PHONE_COUNTRIES: PhoneCountry[] = [
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

const DEFAULT_COUNTRY = PHONE_COUNTRIES.find((country) => country.isoCode === 'RU') ?? PHONE_COUNTRIES[0];

const onlyDigits = (value: string) => value.replace(/\D/g, '');

const getCountryByIso = (isoCode: string) => PHONE_COUNTRIES.find((country) => country.isoCode === isoCode) ?? DEFAULT_COUNTRY;

const getCountryByPhone = (value: string) => {
  const digits = onlyDigits(value.startsWith('+') ? value.slice(1) : value);
  const matchingCountry = PHONE_COUNTRIES
    .slice()
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((country) => digits.startsWith(country.dialCode));

  return matchingCountry ?? DEFAULT_COUNTRY;
};

const formatMaskedValue = (digits: string, mask: string) => {
  if (!digits) {
    return '';
  }

  let digitIndex = 0;
  let result = '';

  for (const token of mask) {
    if (token === '#') {
      if (digitIndex >= digits.length) {
        break;
      }

      result += digits[digitIndex];
      digitIndex += 1;
      continue;
    }

    if (digitIndex > 0) {
      result += token;
    }
  }

  return result;
};

const parseLocalDigits = (value: string, country: PhoneCountry) => {
  const fullDigits = onlyDigits(value.startsWith('+') ? value.slice(1) : value);

  if (fullDigits.startsWith(country.dialCode)) {
    return fullDigits.slice(country.dialCode.length).slice(0, country.localDigitsCount);
  }

  return fullDigits.slice(0, country.localDigitsCount);
};

const buildMask = (digitsCount: number) => {
  if (digitsCount <= 3) {
    return '#'.repeat(digitsCount);
  }

  const groups: number[] = [];
  let remaining = digitsCount;

  while (remaining > 4) {
    groups.push(3);
    remaining -= 3;
  }

  groups.push(remaining);
  return groups.map((count) => '#'.repeat(count)).join(' ');
};

export function AppRhfPhoneField<TFieldValues extends FieldValues>({
  field,
  label,
  error,
  helperText,
  ...props
}: AppRhfPhoneFieldProps<TFieldValues>) {
  const detectedCountry = useMemo(() => getCountryByPhone(String(field.value ?? '')), [field.value]);
  const [selectedCountryIso, setSelectedCountryIso] = useState(detectedCountry.isoCode);
  const selectedCountry = getCountryByIso(selectedCountryIso);

  useEffect(() => {
    if (!field.value) {
      setSelectedCountryIso(DEFAULT_COUNTRY.isoCode);
      return;
    }

    if (detectedCountry.dialCode !== selectedCountry.dialCode) {
      setSelectedCountryIso(detectedCountry.isoCode);
    }
  }, [detectedCountry.dialCode, detectedCountry.isoCode, field.value, selectedCountry.dialCode]);

  const localDigits = parseLocalDigits(String(field.value ?? ''), selectedCountry);
  const mask = buildMask(selectedCountry.localDigitsCount);
  const maskedValue = formatMaskedValue(localDigits, mask);

  const handleCountryChange = (nextCountryIso: string) => {
    const nextCountry = getCountryByIso(nextCountryIso);
    const digits = parseLocalDigits(String(field.value ?? ''), selectedCountry).slice(0, nextCountry.localDigitsCount);
    setSelectedCountryIso(nextCountry.isoCode);
    field.onChange(digits ? `+${nextCountry.dialCode}${digits}` : '');
  };

  const handlePhoneChange = (event: ChangeEvent<HTMLInputElement>) => {
    const digits = onlyDigits(event.target.value).slice(0, selectedCountry.localDigitsCount);
    field.onChange(digits ? `+${selectedCountry.dialCode}${digits}` : '');
  };

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
      <FormControl sx={{ minWidth: 180 }}>
        <InputLabel id={`${field.name}-country-label`}>Country</InputLabel>
        <Select
          labelId={`${field.name}-country-label`}
          label="Country"
          value={selectedCountry.isoCode}
          onChange={(event) => handleCountryChange(String(event.target.value))}
        >
          {PHONE_COUNTRIES.map((country) => (
            <MenuItem key={country.isoCode} value={country.isoCode}>{`${country.label} (+${country.dialCode})`}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        {...props}
        fullWidth
        label={label}
        placeholder={mask}
        value={maskedValue}
        onChange={handlePhoneChange}
        onBlur={field.onBlur}
        inputRef={field.ref}
        error={error}
        helperText={helperText}
      />
    </Stack>
  );
}

export const isValidPhoneValue = (value: string) => {
  if (!value) {
    return true;
  }

  const country = getCountryByPhone(value);
  const digits = parseLocalDigits(value, country);
  return digits.length === country.localDigitsCount;
};
