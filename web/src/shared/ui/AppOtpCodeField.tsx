import { Stack, TextField, Typography } from '@mui/material';
import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

type Props = {
  value: string;
  label?: string;
  length?: number;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  onChange: (nextValue: string) => void;
  onComplete?: (nextValue: string) => void;
};

export function AppOtpCodeField({
  value,
  label,
  length = 4,
  disabled = false,
  error = false,
  helperText,
  onChange,
  onComplete,
}: Props) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, index) => value[index] ?? '');

  const applyValue = (nextDigits: string[]) => {
    const nextValue = nextDigits.join('');
    onChange(nextValue);
    if (nextValue.length === length && nextDigits.every(Boolean) && onComplete && !disabled) {
      onComplete(nextValue);
    }
  };

  const handleDigitChange = (index: number, rawValue: string) => {
    const digitsOnly = rawValue.replace(/\D/g, '');
    const nextDigit = digitsOnly.slice(-1);
    const nextDigits = digits.map((digit, digitIndex) => (digitIndex === index ? nextDigit : digit));
    applyValue(nextDigits);
    if (nextDigit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pastedDigits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pastedDigits) {
      return;
    }

    event.preventDefault();

    const nextDigits = Array.from({ length }, (_, index) => pastedDigits[index] ?? '');
    applyValue(nextDigits);

    const focusIndex = Math.min(pastedDigits.length, length - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <Stack spacing={1}>
      {label ? (
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      ) : null}
      <Stack direction="row" spacing={1.5}>
        {digits.map((digit, index) => (
          <TextField
            key={`otp-${index}`}
            value={digit}
            onChange={(event) => handleDigitChange(index, event.target.value)}
            inputRef={(element) => {
              inputRefs.current[index] = element;
            }}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => handleKeyDown(index, event)}
            onPaste={handlePaste}
            disabled={disabled}
            slotProps={{
              htmlInput: {
                inputMode: 'numeric',
                maxLength: 1,
                style: { textAlign: 'center', fontSize: 24, fontWeight: 700, padding: 0, lineHeight: '64px' }
              }
            }}
            sx={{
              width: 64,
              '& .MuiInputBase-input': {
                height: 31,
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }
            }}
            error={error}
          />
        ))}
      </Stack>
      {helperText ? (
        <Typography variant="caption" color="error">
          {helperText}
        </Typography>
      ) : null}
    </Stack>
  );
}
