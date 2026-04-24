import { Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { ManagedUserItem } from '../../shared/types/api';
import { AppButton } from '../../shared/ui/AppButton';
import { AppRhfPhoneField } from '../../shared/ui/AppRhfPhoneField';
import { AppRhfTextField } from '../../shared/ui/AppRhfTextField';

type UserFormDialogProps = {
  open: boolean;
  isSaving: boolean;
  editingUser: ManagedUserItem | null;
  title: string;
  emailLabel: string;
  roleLabel: string;
  firstNameLabel: string;
  lastNameLabel: string;
  phoneLabel: string;
  telegramLabel: string;
  closeLabel: string;
  saveLabel: string;
  onClose: () => void;
  onSubmit: (payload: {
    email: string;
    role: 'admin' | 'specialist' | 'client';
    firstName: string;
    lastName: string;
    phone?: string;
    telegramUsername?: string;
  }) => Promise<void> | void;
};

type UserFormState = {
  email: string;
  role: 'admin' | 'specialist' | 'client';
  firstName: string;
  lastName: string;
  phone: string;
  telegramUsername: string;
};

const EMPTY_FORM: UserFormState = {
  email: '',
  role: 'specialist',
  firstName: '',
  lastName: '',
  phone: '',
  telegramUsername: '',
};

export function UserFormDialog({
  open,
  isSaving,
  editingUser,
  title,
  emailLabel,
  roleLabel,
  firstNameLabel,
  lastNameLabel,
  phoneLabel,
  telegramLabel,
  closeLabel,
  saveLabel,
  onClose,
  onSubmit
}: UserFormDialogProps) {
  const { control, handleSubmit, reset, watch } = useForm<UserFormState>({
    defaultValues: EMPTY_FORM
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    reset({
      email: editingUser?.email ?? '',
      role: editingUser?.role === 'admin'
        ? 'admin'
        : editingUser?.role === 'client'
          ? 'client'
          : 'specialist',
      firstName: editingUser?.firstName ?? '',
      lastName: editingUser?.lastName ?? '',
      phone: editingUser?.phone ?? '',
      telegramUsername: editingUser?.telegramUsername ?? '',
    });
  }, [editingUser, open, reset]);

  const [email, firstName, lastName] = watch(['email', 'firstName', 'lastName']);
  const isValid = Boolean(email?.trim() && firstName?.trim() && lastName?.trim());

  const submitForm = handleSubmit(async (form) => {
    await onSubmit({
      email: form.email.trim(),
      role: form.role,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim(),
      telegramUsername: form.telegramUsername.trim(),
    });
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Controller
          name="email"
          control={control}
          render={({ field }) => <AppRhfTextField margin="dense" fullWidth label={emailLabel} field={field} />}
        />
        <Controller
          name="role"
          control={control}
          render={({ field }) => (
            <FormControl margin="dense" fullWidth>
              <InputLabel id="managed-user-role-label">{roleLabel}</InputLabel>
              <Select labelId="managed-user-role-label" label={roleLabel} value={field.value} onChange={(event) => field.onChange(event.target.value as 'admin' | 'specialist' | 'client')}>
                <MenuItem value="admin">admin</MenuItem>
                <MenuItem value="specialist">specialist</MenuItem>
                <MenuItem value="client">client</MenuItem>
              </Select>
            </FormControl>
          )}
        />
        <Controller
          name="firstName"
          control={control}
          render={({ field }) => <AppRhfTextField margin="dense" fullWidth label={firstNameLabel} field={field} />}
        />
        <Controller
          name="lastName"
          control={control}
          render={({ field }) => <AppRhfTextField margin="dense" fullWidth label={lastNameLabel} field={field} />}
        />
        <Controller
          name="phone"
          control={control}
          render={({ field }) => <AppRhfPhoneField field={field} label={phoneLabel} sx={{ mt: 1 }} />}
        />
        <Controller
          name="telegramUsername"
          control={control}
          render={({ field }) => <AppRhfTextField margin="dense" fullWidth label={telegramLabel} field={field} />}
        />
      </DialogContent>
      <DialogActions>
        <AppButton variant="text" onClick={onClose}>{closeLabel}</AppButton>
        <AppButton onClick={() => void submitForm()} isLoading={isSaving} disabled={!isValid}>{saveLabel}</AppButton>
      </DialogActions>
    </Dialog>
  );
}
