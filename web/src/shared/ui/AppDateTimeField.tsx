import type { TextFieldProps } from '@mui/material';
import { AppTextField } from './AppTextField';

type AppDateTimeFieldProps = Omit<TextFieldProps, 'type'> & {
  minutesStep?: number;
};

export function AppDateTimeField({ minutesStep, slotProps, ...props }: AppDateTimeFieldProps) {
  const htmlInputSlotProps = typeof slotProps?.htmlInput === 'object' && slotProps.htmlInput
    ? slotProps.htmlInput
    : {};

  return (
    <AppTextField
      {...props}
      type="datetime-local"
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
