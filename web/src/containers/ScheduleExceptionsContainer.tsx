import { FormControl, InputLabel, MenuItem, Select, Stack } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ScheduleExceptionsTab } from '../components/settings-tabs/ScheduleExceptionsTab';
import type { ScheduleExceptionsCopy } from '../components/SettingsCard.types';
import { apiClient, authHeaders } from '../shared/api/client';
import { useApiErrorResolver } from '../shared/api/error';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import { AppPage } from '../shared/ui/AppPage';
import { AppLoadingState, AppStatusMessage } from '../shared/ui/AppStatus';
import type {
  ScheduleException,
  ScheduleExceptionCreatePayload,
  SpecialistsListResponse,
} from '../shared/types/api';

export function ScheduleExceptionsContainer() {
  const { accessToken, user } = useAuth();
  const { t } = useI18n();
  const resolveError = useApiErrorResolver();
  const [items, setItems] = useState<ScheduleException[]>([]);
  const [specialists, setSpecialists] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const isSpecialist = user?.role === 'specialist';
  const canManage = isSpecialist || user?.role === 'owner';

  const copy = useMemo<ScheduleExceptionsCopy>(() => ({
    title: t('settings.scheduleExceptions.title'),
    addButton: t('settings.scheduleExceptions.addButton'),
    deleteLabel: t('settings.scheduleExceptions.deleteLabel'),
    empty: t('settings.scheduleExceptions.empty'),
    dialogTitle: t('settings.scheduleExceptions.dialogTitle'),
    date: t('settings.scheduleExceptions.date'),
    type: t('settings.scheduleExceptions.type'),
    startsAt: t('settings.scheduleExceptions.startsAt'),
    endsAt: t('settings.scheduleExceptions.endsAt'),
    note: t('settings.scheduleExceptions.note'),
    wholeDayHint: t('settings.scheduleExceptions.wholeDayHint'),
    wholeDayLabel: t('settings.scheduleExceptions.wholeDayLabel'),
    save: t('common.saveSettings'),
    cancel: t('common.cancel'),
    types: {
      day_off: t('settings.scheduleExceptions.types.dayOff'),
      vacation: t('settings.scheduleExceptions.types.vacation'),
      interval: t('settings.scheduleExceptions.types.interval'),
      break: t('settings.scheduleExceptions.types.break'),
    },
  }), [t]);

  // A specialist edits their own schedule; an owner picks which specialist to edit.
  const scopeParams = isSpecialist || !selectedSpecialistId ? undefined : { specialistId: selectedSpecialistId };

  useEffect(() => {
    if (!accessToken || !canManage || isSpecialist) {
      return;
    }

    let isActive = true;

    const loadSpecialists = async () => {
      try {
        const response = await apiClient.get<SpecialistsListResponse>('/api/specialists', {
          headers: authHeaders(accessToken),
        });
        if (!isActive) {
          return;
        }
        setSpecialists(response.data.specialists.map(({ id, name }) => ({ id, name })));
        setSelectedSpecialistId((current) => current ?? response.data.specialists[0]?.id ?? null);
        if (response.data.specialists.length === 0) {
          setIsLoading(false);
        }
      } catch (err) {
        if (isActive) {
          setError(resolveError(err, t('settings.errors.load')).message);
          setIsLoading(false);
        }
      }
    };

    void loadSpecialists();

    return () => {
      isActive = false;
    };
  }, [accessToken, canManage, isSpecialist, resolveError, t]);

  useEffect(() => {
    if (!accessToken || !canManage) {
      return;
    }

    if (!isSpecialist && !selectedSpecialistId) {
      return;
    }

    let isActive = true;

    const loadExceptions = async () => {
      setIsLoading(true);
      try {
        const response = await apiClient.get<ScheduleException[]>('/api/settings/specialist-schedule-exceptions', {
          headers: authHeaders(accessToken),
          params: isSpecialist ? undefined : { specialistId: selectedSpecialistId },
        });
        if (isActive) {
          setItems(response.data);
          setError('');
        }
      } catch (err) {
        if (isActive) {
          setError(resolveError(err, t('settings.errors.load')).message);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadExceptions();

    return () => {
      isActive = false;
    };
  }, [accessToken, canManage, isSpecialist, resolveError, selectedSpecialistId, t]);

  const createException = async (payload: ScheduleExceptionCreatePayload) => {
    if (!accessToken || !canManage) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiClient.post<ScheduleException>(
        '/api/settings/specialist-schedule-exceptions',
        payload,
        { headers: authHeaders(accessToken), params: scopeParams },
      );
      setItems((prev) => [...prev, response.data].sort((left, right) => left.date.localeCompare(right.date)));
      setError('');
    } catch (err) {
      setError(resolveError(err, t('settings.errors.save')).message);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteException = async (id: number) => {
    if (!accessToken || !canManage) {
      return;
    }

    try {
      await apiClient.delete(`/api/settings/specialist-schedule-exceptions/${id}`, {
        headers: authHeaders(accessToken),
        params: scopeParams,
      });
      setItems((prev) => prev.filter((item) => item.id !== id));
      setError('');
    } catch (err) {
      setError(resolveError(err, t('settings.errors.save')).message);
    }
  };

  if (!canManage) {
    return <Navigate to="/appointments" replace />;
  }

  return (
    <AppPage title={t('common.daysOff')} maxWidth={900}>
      <Stack spacing={2.5}>
        {!isSpecialist && specialists.length > 0 ? (
          <FormControl size="small" sx={{ maxWidth: 360 }}>
            <InputLabel id="days-off-specialist">{t('settings.scopeSpecialist')}</InputLabel>
            <Select
              labelId="days-off-specialist"
              label={t('settings.scopeSpecialist')}
              value={selectedSpecialistId ?? ''}
              onChange={(event) => {
                const nextSpecialistId = Number(event.target.value);
                setSelectedSpecialistId(Number.isInteger(nextSpecialistId) ? nextSpecialistId : null);
              }}
            >
              {specialists.map((specialist) => (
                <MenuItem key={specialist.id} value={specialist.id}>
                  {specialist.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : null}

        {error ? <AppStatusMessage severity="error" message={error} /> : null}

        {isLoading ? (
          <AppLoadingState lines={4} />
        ) : (
          <ScheduleExceptionsTab
            copy={copy}
            items={items}
            isSaving={isSaving}
            onCreate={createException}
            onDelete={deleteException}
          />
        )}
      </Stack>
    </AppPage>
  );
}
