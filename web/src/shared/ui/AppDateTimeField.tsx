import type { TextFieldProps } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { type Dayjs } from 'dayjs';
import type { ChangeEvent, FocusEventHandler } from 'react';

type AppDateTimeFieldProps = Omit<TextFieldProps, 'type'> & {
  type?: 'datetime-local' | 'time';
  minutesStep?: number;
};

export function AppDateTimeField({
  type = 'datetime-local',
  minutesStep,
  value,
  onChange,
  className,
  label,
  error,
  helperText,
  required,
  disabled,
  placeholder,
  name,
  onBlur,
  inputRef,
  sx,
}: AppDateTimeFieldProps) {
  const pickerValue =
    typeof value === 'string' && value
      ? type === 'time'
        ? dayjs(`1970-01-01T${value}`)
        : dayjs(value)
      : null;

  const emitChange = (formattedValue: string) => {
    const syntheticEvent = {
      target: { value: formattedValue },
    } as ChangeEvent<HTMLInputElement>;

    onChange?.(syntheticEvent);
  };

  const handleDateTimeChange = (newValue: Dayjs | null) => {
    emitChange(newValue?.isValid() ? newValue.format('YYYY-MM-DDTHH:mm') : '');
  };

  const handleTimeChange = (newValue: Dayjs | null) => {
    emitChange(newValue?.isValid() ? newValue.format('HH:mm') : '');
  };

  const textFieldSlotProps = {
    label,
    error,
    helperText,
    required,
    disabled,
    placeholder,
    name,
    onBlur: onBlur as unknown as FocusEventHandler<HTMLDivElement> | undefined,
    inputRef,
    sx,
    size: 'small' as const,
    className: ['app-field', className].filter(Boolean).join(' '),
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      {type === 'time' ? (
        <TimePicker
          ampm={false}
          value={pickerValue}
          onChange={handleTimeChange}
          timeSteps={minutesStep ? { minutes: minutesStep } : undefined}
          slotProps={{ textField: textFieldSlotProps }}
        />
      ) : (
        <DateTimePicker
          ampm={false}
          value={pickerValue}
          onChange={handleDateTimeChange}
          slotProps={{ textField: textFieldSlotProps }}
        />
      )}
    </LocalizationProvider>
  );
}
