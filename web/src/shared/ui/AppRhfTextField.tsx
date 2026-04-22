import type { TextFieldProps } from '@mui/material';
import type { ChangeEvent } from 'react';
import type { ControllerRenderProps, FieldValues, Path } from 'react-hook-form';
import { AppDateTimeField } from './AppDateTimeField';
import { AppTextField } from './AppTextField';

type AppRhfTextFieldProps<TFieldValues extends FieldValues> = Omit<
  TextFieldProps,
  'name' | 'value' | 'onBlur' | 'onChange' | 'inputRef'
> & {
  field: ControllerRenderProps<TFieldValues, Path<TFieldValues>>;
  parseValue?: (value: string) => unknown;
  onValueChange?: (value: string) => void;
  minutesStep?: number;
};

export function AppRhfTextField<TFieldValues extends FieldValues>({
  field,
  parseValue,
  onValueChange,
  minutesStep,
  ...props
}: AppRhfTextFieldProps<TFieldValues>) {
  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;

    if (parseValue) {
      field.onChange(parseValue(value));
    } else {
      field.onChange(value);
    }

    onValueChange?.(value);
  };

  const { type, ...restProps } = props;

  const commonProps = {
    ...restProps,
    name: field.name,
    value: field.value ?? '',
    onBlur: field.onBlur,
    inputRef: field.ref,
    onChange: handleChange,
  };

  if (type === 'datetime-local') {
    return <AppDateTimeField {...commonProps} minutesStep={minutesStep} />;
  }

  return <AppTextField {...commonProps} />;
}
