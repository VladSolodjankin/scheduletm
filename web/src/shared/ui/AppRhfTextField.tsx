import type { TextFieldProps } from '@mui/material';
import type { ChangeEvent } from 'react';
import type { ControllerRenderProps, FieldValues, Path } from 'react-hook-form';
import { AppTextField } from './AppTextField';

type AppRhfTextFieldProps<TFieldValues extends FieldValues> = Omit<
  TextFieldProps,
  'name' | 'value' | 'onBlur' | 'onChange' | 'inputRef'
> & {
  field: ControllerRenderProps<TFieldValues, Path<TFieldValues>>;
  parseValue?: (value: string) => unknown;
  onValueChange?: (value: string) => void;
};

export function AppRhfTextField<TFieldValues extends FieldValues>({
  field,
  parseValue,
  onValueChange,
  ...props
}: AppRhfTextFieldProps<TFieldValues>) {
  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;

    if (parseValue) {
      field.onChange(parseValue(value));
    } else {
      field.onChange(event);
      field.onChange(value);
    }

    onValueChange?.(value);
  };

  return (
    <AppTextField
      {...props}
      name={field.name}
      value={field.value ?? ''}
      onBlur={field.onBlur}
      inputRef={field.ref}
      onChange={handleChange}
    />
  );
}
