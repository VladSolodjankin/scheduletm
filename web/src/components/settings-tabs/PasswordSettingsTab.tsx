import { Stack, Typography } from '@mui/material';

import type { SettingsCardCopy } from '../SettingsCard.types';
import { AppButton } from '../../shared/ui/AppButton';
import { AppForm } from '../../shared/ui/AppForm';
import { AppRhfPasswordField } from '../../shared/ui/AppRhfPasswordField';
import { AppRhfTextField } from '../../shared/ui/AppRhfTextField';

type Props = {
  copy: SettingsCardCopy;
  newPassword: string;
  confirmPassword: string;
  otpCode: string;
  passwordStep: 'password' | 'otp';
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onOtpCodeChange: (value: string) => void;
  onCancel: () => void;
  onRequestOtp: () => Promise<void> | void;
  onConfirmOtp: () => Promise<void> | void;
};

export function PasswordSettingsTab({
  copy,
  newPassword,
  confirmPassword,
  otpCode,
  passwordStep,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onOtpCodeChange,
  onCancel,
  onRequestOtp,
  onConfirmOtp,
}: Props) {
  return (
    <AppForm component="form" onSubmit={(event) => event.preventDefault()}>
      <Typography variant="h5">{copy.passwordTitle}</Typography>
      <Stack spacing={2}>
        <AppRhfPasswordField field={{ value: newPassword, onChange: (e: any) => onNewPasswordChange(e.target.value) }} label={copy.newPassword} />
        <AppRhfPasswordField field={{ value: confirmPassword, onChange: (e: any) => onConfirmPasswordChange(e.target.value) }} label={copy.confirmPassword} />
        {passwordStep === 'otp' && (
          <AppRhfTextField
            field={{ value: otpCode, onChange: (e: any) => onOtpCodeChange(e.target.value.replace(/\D/g, '').slice(0, 4)) }}
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
