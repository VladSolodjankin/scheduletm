import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { IconButton, InputAdornment, type TextFieldProps } from '@mui/material';
import { useState } from 'react';
import type { ControllerRenderProps, FieldValues, Path } from 'react-hook-form';
import { useI18n } from '../i18n/I18nContext';
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
  const { t } = useI18n();
  const [showPassword, setShowPassword] = useState(false);
  const inputSlotProps = (props.slotProps?.input ?? {}) as Record<string, unknown>;
  const htmlInputSlotProps = (props.slotProps?.htmlInput ?? {}) as Record<string, unknown>;

  return (
    <AppRhfTextField
      {...props}
      field={field}
      onValueChange={onValueChange}
      type={showPassword ? 'text' : 'password'}
      slotProps={{
        ...props.slotProps,
        htmlInput: {
          ...htmlInputSlotProps,
          autoComplete: props.autoComplete ?? htmlInputSlotProps.autoComplete,
        },
        input: {
          ...inputSlotProps,
          endAdornment: (
            <>
              {inputSlotProps.endAdornment}
              <InputAdornment position="end">
                <IconButton
                  edge="end"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={t('auth.togglePasswordVisibility')}
                >
                  {showPassword ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
                </IconButton>
              </InputAdornment>
            </>
          ),
        },
      }}
    />
  );
}
