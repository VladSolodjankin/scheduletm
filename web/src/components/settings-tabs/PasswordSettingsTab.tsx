import { Stack, Typography } from '@mui/material';

import type { SettingsCardCopy } from '../SettingsCard.types';
import { AppButton } from '../../shared/ui/AppButton';
import { AppForm } from '../../shared/ui/AppForm';
import { AppRhfPasswordField } from '../../shared/ui/AppRhfPasswordField';
import { AppTextField } from '../../shared/ui/AppTextField';

type Props = {
  copy: SettingsCardCopy;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  otpCode: string;
  passwordStep: 'password' | 'otp';
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onOtpCodeChange: (value: string) => void;
  onCancel: () => void;
  onRequestOtp: () => Promise<void> | void;
  onConfirmOtp: () => Promise<void> | void;
};

export function PasswordSettingsTab({
  copy,
  currentPassword,
  newPassword,
  confirmPassword,
  otpCode,
  passwordStep,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onOtpCodeChange,
  onCancel,
  onRequestOtp,
  onConfirmOtp,
}: Props) {
  const passwordFieldBase = {
    onBlur: () => undefined,
    ref: () => undefined,
  };

  return (
    <AppForm component="form" onSubmit={(event) => event.preventDefault()}>
      <Typography variant="h5">{copy.passwordTitle}</Typography>
      <Stack spacing={2}>
        <AppRhfPasswordField
          field={{ ...passwordFieldBase, name: 'currentPassword', value: currentPassword, onChange: onCurrentPasswordChange }}
          label={copy.currentPassword}
          autoComplete="current-password"
        />
        <AppRhfPasswordField
          field={{ ...passwordFieldBase, name: 'newPassword', value: newPassword, onChange: onNewPasswordChange }}
          label={copy.newPassword}
          autoComplete="new-password"
        />
        <AppRhfPasswordField
          field={{ ...passwordFieldBase, name: 'confirmPassword', value: confirmPassword, onChange: onConfirmPasswordChange }}
          label={copy.confirmPassword}
          autoComplete="new-password-confirm"
        />
        {passwordStep === 'otp' && (
          <AppTextField
            value={otpCode}
            onChange={(event) => onOtpCodeChange(event.target.value.replace(/\D/g, '').slice(0, 4))}
            label={copy.otpCode}
          />
        )}
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        {passwordStep === 'otp' && (
          <AppButton type="button" variant="outlined" onClick={onCancel}>
            {copy.cancel}
          </AppButton>
        )}
        {passwordStep === 'password' ? (
          <AppButton type="button" onClick={() => void onRequestOtp()}>
            {copy.sendOtp}
          </AppButton>
        ) : (
          <AppButton type="button" onClick={() => void onConfirmOtp()}>
            {copy.confirmOtp}
          </AppButton>
        )}
      </Stack>
    </AppForm>
  );
}
