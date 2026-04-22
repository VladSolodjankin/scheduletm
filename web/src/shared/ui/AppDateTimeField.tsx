import type { TextFieldProps } from '@mui/material';
import { AppTextField } from './AppTextField';

type AppDateTimeFieldProps = Omit<TextFieldProps, 'type'> & {
  type?: 'datetime-local' | 'time';
  minutesStep?: number;
};

export function AppDateTimeField({ type = 'datetime-local', minutesStep, slotProps, ...props }: AppDateTimeFieldProps) {
  const htmlInputSlotProps = typeof slotProps?.htmlInput === 'object' && slotProps.htmlInput
    ? slotProps.htmlInput
    : {};

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
