import type { ChangeEvent } from 'react';
import { Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import type { ManagedUserItem } from '../../shared/types/api';
import { AppButton } from '../../shared/ui/AppButton';

type UserFormDialogProps = {
  open: boolean;
  isSaving: boolean;
  editingUser: ManagedUserItem | null;
  onClose: () => void;
  onSubmit: (payload: {
    email: string;
    role: 'admin' | 'specialist';
    firstName: string;
    lastName: string;
    phone?: string;
    telegramUsername?: string;
  }) => Promise<void> | void;
};

export function UserFormDialog({ open, isSaving, editingUser, onClose, onSubmit }: UserFormDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'specialist'>('specialist');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setEmail(editingUser?.email ?? '');
    setRole(editingUser?.role === 'admin' ? 'admin' : 'specialist');
    setFirstName(editingUser?.firstName ?? '');
    setLastName(editingUser?.lastName ?? '');
    setPhone(editingUser?.phone ?? '');
    setTelegramUsername(editingUser?.telegramUsername ?? '');
  }, [editingUser, open]);

  const isValid = Boolean(email.trim() && firstName.trim() && lastName.trim());

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editingUser ? 'Редактировать пользователя' : 'Добавить пользователя'}</DialogTitle>
      <DialogContent>
        <TextField margin="dense" fullWidth label="Email" value={email} onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)} />
        <FormControl margin="dense" fullWidth>
          <InputLabel id="managed-user-role-label">Роль</InputLabel>
          <Select labelId="managed-user-role-label" label="Роль" value={role} onChange={(event) => setRole(event.target.value as 'admin' | 'specialist')}>
            <MenuItem value="admin">admin</MenuItem>
            <MenuItem value="specialist">specialist</MenuItem>
          </Select>
        </FormControl>
        <TextField margin="dense" fullWidth label="Имя" value={firstName} onChange={(event: ChangeEvent<HTMLInputElement>) => setFirstName(event.target.value)} />
        <TextField margin="dense" fullWidth label="Фамилия" value={lastName} onChange={(event: ChangeEvent<HTMLInputElement>) => setLastName(event.target.value)} />
        <TextField margin="dense" fullWidth label="Телефон" value={phone} onChange={(event: ChangeEvent<HTMLInputElement>) => setPhone(event.target.value)} />
        <TextField margin="dense" fullWidth label="Telegram" value={telegramUsername} onChange={(event: ChangeEvent<HTMLInputElement>) => setTelegramUsername(event.target.value)} />
      </DialogContent>
      <DialogActions>
        <AppButton variant="text" onClick={onClose}>Закрыть</AppButton>
        <AppButton
          onClick={() => void onSubmit({ email: email.trim(), role, firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(), telegramUsername: telegramUsername.trim() })}
          isLoading={isSaving}
          disabled={!isValid}
        >
          Сохранить
        </AppButton>
      </DialogActions>
    </Dialog>
  );
}
