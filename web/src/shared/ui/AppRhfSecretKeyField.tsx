import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { IconButton, InputAdornment, type TextFieldProps } from '@mui/material';
import { useState } from 'react';
import type { ControllerRenderProps, FieldValues, Path } from 'react-hook-form';
import { useI18n } from '../i18n/I18nContext';
import { AppRhfTextField } from './AppRhfTextField';

type AppRhfSecretKeyFieldProps<TFieldValues extends FieldValues> = Omit<
  TextFieldProps,
  'name' | 'value' | 'onBlur' | 'onChange' | 'inputRef' | 'type'
> & {
  field: ControllerRenderProps<TFieldValues, Path<TFieldValues>>;
  onValueChange?: (value: string) => void;
};

export function AppRhfSecretKeyField<TFieldValues extends FieldValues>({
  field,
  onValueChange,
  ...props
}: AppRhfSecretKeyFieldProps<TFieldValues>) {
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(false);
  const inputSlotProps = (props.slotProps?.input ?? {}) as Record<string, unknown>;
  const htmlInputSlotProps = (props.slotProps?.htmlInput ?? {}) as Record<string, unknown>;
  const htmlInputStyle = (htmlInputSlotProps.style ?? {}) as Record<string, unknown>;

  return (
    <AppRhfTextField
      {...props}
      field={field}
      onValueChange={onValueChange}
      type="text"
      slotProps={{
        ...props.slotProps,
        htmlInput: {
          ...htmlInputSlotProps,
          style: {
            ...htmlInputStyle,
            WebkitTextSecurity: isVisible ? 'none' : 'disc',
          },
        },
        input: {
          ...inputSlotProps,
          endAdornment: (
            <>
              {inputSlotProps.endAdornment}
              <InputAdornment position="end">
                <IconButton
                  edge="end"
                  onClick={() => setIsVisible((prev) => !prev)}
                  aria-label={t('auth.togglePasswordVisibility')}
                >
                  {isVisible ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
                </IconButton>
              </InputAdornment>
            </>
          ),
        },
      }}
    />
  );
}
