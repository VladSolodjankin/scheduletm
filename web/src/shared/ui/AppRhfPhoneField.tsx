import { useMemo, useState, type ChangeEvent } from 'react';

import { FormControl, InputLabel, MenuItem, Select, Stack, TextField, type TextFieldProps } from '@mui/material';
import type { ControllerRenderProps, FieldValues, Path } from 'react-hook-form';
import { useI18n } from '../i18n/I18nContext';
import { getCountryByLocale, getCountryByPhone, getCountryByIso, DEFAULT_COUNTRY, PHONE_COUNTRIES, onlyDigits, parseLocalDigits } from './phoneUtils';

type AppRhfPhoneFieldProps<TFieldValues extends FieldValues> = Omit<
  TextFieldProps,
  'name' | 'value' | 'onBlur' | 'onChange' | 'inputRef'
> & {
  field: ControllerRenderProps<TFieldValues, Path<TFieldValues>>;
  error?: boolean;
  helperText?: string;
  onValueChange?: () => void;
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
  onValueChange,
  ...props
}: AppRhfPhoneFieldProps<TFieldValues>) {
  const { t } = useI18n();
  const [manualCountryIso, setManualCountryIso] = useState<string | null>(null);

  const localeCountryIso = useMemo(() => {
    if (typeof navigator === 'undefined') {
      return null;
    }

    return getCountryByLocale(navigator.language)?.isoCode ?? null;
  }, []);

  const detectedCountry = useMemo(
    () => getCountryByPhone(String(field.value ?? '')),
    [field.value],
  );

  const selectedCountryIso =
    manualCountryIso ??
    (field.value ? detectedCountry.isoCode : (localeCountryIso ?? DEFAULT_COUNTRY.isoCode));

  const selectedCountry = getCountryByIso(selectedCountryIso);

  const localDigits = parseLocalDigits(String(field.value ?? ''), selectedCountry);
  const mask = buildMask(selectedCountry.localDigitsCount);
  const maskedValue = formatMaskedValue(localDigits, mask);

  const countryLabel = t('common.country');

  const handleCountryChange = (nextCountryIso: string) => {
    const nextCountry = getCountryByIso(nextCountryIso);

    const digits = parseLocalDigits(String(field.value ?? ''), selectedCountry).slice(
      0,
      nextCountry.localDigitsCount,
    );

    setManualCountryIso(nextCountry.isoCode);
    field.onChange(digits ? `+${nextCountry.dialCode}${digits}` : '');
    onValueChange?.();
  };

  const handlePhoneChange = (event: ChangeEvent<HTMLInputElement>) => {
    const digits = onlyDigits(event.target.value).slice(0, selectedCountry.localDigitsCount);

    field.onChange(digits ? `+${selectedCountry.dialCode}${digits}` : '');
    onValueChange?.();
  };

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
      <FormControl sx={{ minWidth: 180 }}>
        <InputLabel id={`${field.name}-country-label`}>
          {countryLabel}
        </InputLabel>

        <Select
          labelId={`${field.name}-country-label`}
          label={countryLabel}
          value={selectedCountry.isoCode}
          onChange={(event) => handleCountryChange(String(event.target.value))}
        >
          {PHONE_COUNTRIES.map((country) => (
            <MenuItem key={country.isoCode} value={country.isoCode}>
              {`${country.label} (+${country.dialCode})`}
            </MenuItem>
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