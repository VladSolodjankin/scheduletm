import { Stack, Typography } from '@mui/material';

import type { SettingsCardCopy } from '../SettingsCard.types';
import { AppButton } from '../../shared/ui/AppButton';
import { AppForm } from '../../shared/ui/AppForm';
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
  return (
    <AppForm component="form" onSubmit={(event) => event.preventDefault()}>
      <Typography variant="h5">{copy.passwordTitle}</Typography>
      <Stack spacing={2}>
        <AppTextField value={currentPassword} onChange={(event) => onCurrentPasswordChange(event.target.value)} label={copy.currentPassword} type="password" />
        <AppTextField value={newPassword} onChange={(event) => onNewPasswordChange(event.target.value)} label={copy.newPassword} type="password" />
        <AppTextField value={confirmPassword} onChange={(event) => onConfirmPasswordChange(event.target.value)} label={copy.confirmPassword} type="password" />
        {passwordStep === 'otp' && (
          <AppTextField
            value={otpCode}
            onChange={(event) => onOtpCodeChange(event.target.value.replace(/\D/g, '').slice(0, 4))}
            label={copy.otpCode}
          />
        )}
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <AppButton type="button" variant="outlined" onClick={onCancel}>
          {copy.cancel}
        </AppButton>
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
