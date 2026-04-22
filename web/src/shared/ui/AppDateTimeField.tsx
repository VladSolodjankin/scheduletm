import type { TextFieldProps } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { type Dayjs } from 'dayjs';
import type { ChangeEvent } from 'react';

type AppDateTimeFieldProps = Omit<TextFieldProps, 'type'> & {
  type?: 'datetime-local' | 'time';
  minutesStep?: number;
};

export function AppDateTimeField({ type = 'datetime-local', minutesStep, slotProps, ...props }: AppDateTimeFieldProps) {
  const pickerValue =
    typeof props.value === 'string' && props.value
      ? type === 'time'
        ? dayjs(`1970-01-01T${props.value}`)
        : dayjs(props.value)
      : null;

  const emitChange = (formattedValue: string) => {
    const syntheticEvent = {
      target: { value: formattedValue },
    } as ChangeEvent<HTMLInputElement>;

    props.onChange?.(syntheticEvent);
  };

  const handleDateTimeChange = (newValue: Dayjs | null) => {
    emitChange(newValue?.isValid() ? newValue.format('YYYY-MM-DDTHH:mm') : '');
  };

  const handleTimeChange = (newValue: Dayjs | null) => {
    emitChange(newValue?.isValid() ? newValue.format('HH:mm') : '');
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      {type === 'time' ? (
        <TimePicker
          ampm={false}
          value={pickerValue}
          onChange={handleTimeChange}
          timeSteps={minutesStep ? { minutes: minutesStep } : undefined}

        />
      ) : (
        <DateTimePicker
          ampm={false}
          value={pickerValue}
          onChange={handleDateTimeChange}
        />
      )}
    </LocalizationProvider>
  );
}
