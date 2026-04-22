import type { TextFieldProps } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { type Dayjs } from 'dayjs';
import type { ChangeEvent } from 'react';
import { AppTextField } from './AppTextField';

type AppDateTimeFieldProps = Omit<TextFieldProps, 'type'> & {
  type?: 'datetime-local' | 'time';
  minutesStep?: number;
};

export function AppDateTimeField({ type = 'datetime-local', minutesStep, slotProps, ...props }: AppDateTimeFieldProps) {
  const htmlInputSlotProps = typeof slotProps?.htmlInput === 'object' && slotProps.htmlInput
    ? slotProps.htmlInput
    : {};

  if (type === 'time') {
    return (
      <AppTextField
        {...props}
        type={type}
        slotProps={{
          ...slotProps,
          inputLabel: {
            ...(typeof slotProps?.inputLabel === 'object' && slotProps.inputLabel ? slotProps.inputLabel : {}),
            shrink: true,
          },
          htmlInput: {
            ...htmlInputSlotProps,
            step: minutesStep ? minutesStep * 60 : undefined,
          },
        }}
      />
    );
  }

  const pickerValue = typeof props.value === 'string' && props.value ? dayjs(props.value) : null;

  const handleDateTimeChange = (newValue: Dayjs | null) => {
    const formattedValue = newValue?.isValid() ? newValue.format('YYYY-MM-DDTHH:mm') : '';
    const syntheticEvent = {
      target: { value: formattedValue },
    } as ChangeEvent<HTMLInputElement>;

    props.onChange?.(syntheticEvent);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DateTimePicker
        ampm={false}
        value={pickerValue}
        onChange={handleDateTimeChange}
        slotProps={{
          textField: {
            ...props,
            fullWidth: true,
            size: 'medium',
          },
        }}
      />
    </LocalizationProvider>
  );
}
