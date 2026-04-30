import type { TextFieldProps } from '@mui/material';
import type { ControllerRenderProps, FieldValues, Path } from 'react-hook-form';
import { AppRhfTextField } from './AppRhfTextField';

type AppRhfPasswordFieldProps<TFieldValues extends FieldValues> = Omit<
  TextFieldProps,
  'name' | 'value' | 'onBlur' | 'onChange' | 'inputRef' | 'type'
> & {
  field: ControllerRenderProps<TFieldValues, Path<TFieldValues>>;
  onValueChange?: (value: string) => void;
};

export function AppRhfPasswordField<TFieldValues extends FieldValues>({
  field,
  onValueChange,
  ...props
}: AppRhfPasswordFieldProps<TFieldValues>) {
  return (
    <AppRhfTextField
      {...props}
      field={field}
      onValueChange={onValueChange}
      type="password"
    />
  );
}
