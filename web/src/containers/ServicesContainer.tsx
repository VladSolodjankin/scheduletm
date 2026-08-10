import { Stack } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ServiceCard } from '../components/services/ServiceCard';
import { ServiceFormDialog } from '../components/services/ServiceFormDialog';
import type { AssignmentPayload, ServiceAssignment, ServiceCatalogItem, ServicePayload, ServicesResponse, ServiceSpecialist } from '../components/services/types';
import { servicesApi } from '../shared/api/client';
import { resolveApiError } from '../shared/api/error';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import { WebUserRole } from '../shared/types/roles';
import { AppButton } from '../shared/ui/AppButton';
import { AppEmptyState, AppLoadingState, AppStatusMessage } from '../shared/ui/AppStatus';
import { AppIcons } from '../shared/ui/AppIcons';
import { AppPage } from '../shared/ui/AppPage';

export function ServicesContainer() {
  const { accessToken, user } = useAuth();
  const { t } = useI18n();
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [specialists, setSpecialists] = useState<ServiceSpecialist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceCatalogItem | null>(null);

  const canManage = user?.role === WebUserRole.ProductOwner || user?.role === WebUserRole.Owner || user?.role === WebUserRole.Admin;
  const canAccess = canManage || user?.role === WebUserRole.Specialist;

  const reportError = useCallback((caught: unknown, fallbackMessage: string) => {
    setError(resolveApiError(caught, {
      fallbackMessage,
      networkMessage: t('common.errors.network'),
    }).message);
  }, [t]);

  const refresh = useCallback(async () => {
    if (!accessToken || !canAccess) {
      return;
    }
    try {
      const response = await servicesApi.list<ServicesResponse>(accessToken);
      setServices(response.data.services);
      setSpecialists(response.data.specialists.filter((item) => item.isActive !== false));
      setError('');
    } catch (caught) {
      reportError(caught, t('services.errors.load'));
    }
  }, [accessToken, canAccess, reportError, t]);

  useEffect(() => {
    if (!accessToken || !canAccess) {
      return;
    }

    let isActive = true;
    const load = async () => {
      try {
        const response = await servicesApi.list<ServicesResponse>(accessToken);
        if (!isActive) {
          return;
        }
        setServices(response.data.services);
        setSpecialists(response.data.specialists.filter((item) => item.isActive !== false));
        setError('');
      } catch (caught) {
        if (isActive) {
          reportError(caught, t('services.errors.load'));
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      isActive = false;
    };
  }, [accessToken, canAccess, reportError, t]);

  const saveService = async (payload: ServicePayload) => {
    if (!accessToken) {
      return;
    }
    setIsSaving(true);
    try {
      if (editingService) {
        await servicesApi.update<ServiceCatalogItem, ServicePayload>(accessToken, editingService.id, payload);
      } else {
        await servicesApi.create<ServiceCatalogItem, ServicePayload>(accessToken, payload);
      }
      setDialogOpen(false);
      setEditingService(null);
      await refresh();
    } catch (caught) {
      reportError(caught, t('services.errors.save'));
    } finally {
      setIsSaving(false);
    }
  };

  const deactivate = async (service: ServiceCatalogItem) => {
    if (!accessToken) {
      return;
    }
    try {
      await servicesApi.update<ServiceCatalogItem, Partial<ServicePayload>>(accessToken, service.id, { isActive: false });
      await refresh();
    } catch (caught) {
      reportError(caught, t('services.errors.save'));
    }
  };

  const saveAssignment = async (service: ServiceCatalogItem, assignment: ServiceAssignment, payload: AssignmentPayload) => {
    if (!accessToken) {
      return;
    }
    try {
      await servicesApi.updateAssignment<ServiceAssignment, AssignmentPayload>(accessToken, service.id, assignment.specialistId, payload);
      await refresh();
    } catch (caught) {
      reportError(caught, t('services.errors.saveAssignment'));
    }
  };

  const labels = useMemo(() => ({
    active: t('services.active'),
    inactive: t('services.inactive'),
    firstSessionFree: t('services.firstSessionFree'),
    minutes: t('services.minutes'),
    assignments: t('services.assignments'),
    noAssignments: t('services.noAssignments'),
    edit: t('services.edit'),
    deactivate: t('services.deactivate'),
    priceOverride: t('services.priceOverride'),
    durationOverride: t('services.durationOverride'),
    save: t('services.save'),
    cancel: t('common.cancel'),
    createTitle: t('services.createTitle'),
    editTitle: t('services.editTitle'),
    name: t('services.name'),
    description: t('services.description'),
    price: t('services.price'),
    duration: t('services.duration'),
    imageUrl: t('services.imageUrl'),
  }), [t]);

  return (
    <AppPage
      title={t('services.pageTitle')}
      subtitle={t('services.pageSubtitle')}
      action={canManage ? <AppButton size="small" startIcon={<AppIcons.add />} onClick={() => { setEditingService(null); setDialogOpen(true); }}>{t('services.create')}</AppButton> : null}
    >
      <Stack spacing={2}>
        {error ? <AppStatusMessage severity="error" message={error} /> : null}
        {!canAccess ? <AppEmptyState title={t('services.accessDenied')} /> : isLoading ? <AppLoadingState lines={3} /> : services.length === 0 ? (
          <AppEmptyState title={t('services.empty')} />
        ) : services.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            canManage={canManage}
            labels={labels}
            onEdit={() => { setEditingService(service); setDialogOpen(true); }}
            onDeactivate={() => void deactivate(service)}
            onSaveAssignment={(assignment, payload) => void saveAssignment(service, assignment, payload)}
          />
        ))}
      </Stack>
      <ServiceFormDialog
        key={`${editingService?.id ?? 'new'}:${dialogOpen}`}
        open={dialogOpen}
        service={editingService}
        specialists={specialists}
        isSaving={isSaving}
        labels={labels}
        onClose={() => setDialogOpen(false)}
        onSubmit={(payload) => void saveService(payload)}
      />
    </AppPage>
  );
}
