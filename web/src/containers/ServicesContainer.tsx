import { MenuItem, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ServiceFormDialog } from '../components/services/ServiceFormDialog';
import { ServiceListRow } from '../components/services/ServiceListRow';
import { ServicePricingDialog } from '../components/services/ServicePricingDialog';
import type {
  AssignmentChange,
  AssignmentPayload,
  ServiceAssignment,
  ServiceCatalogItem,
  ServiceDeleteImpact,
  ServiceImageMedia,
  ServicePayload,
  ServicesResponse,
  ServiceSpecialist,
} from '../components/services/types';
import { servicesApi } from '../shared/api/client';
import { useManagedImages } from '../shared/api/useManagedImages';
import { useApiErrorResolver } from '../shared/api/error';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import { WebUserRole } from '../shared/types/roles';
import { AppButton } from '../shared/ui/AppButton';
import { AppConfirmDialog } from '../shared/ui/AppDialog';
import { AppEmptyState, AppLoadingState, AppStatusMessage } from '../shared/ui/AppStatus';
import { AppIcons } from '../shared/ui/AppIcons';
import { AppFilterBar } from '../shared/ui/AppFilterBar';
import { AppImageCleanupNotice } from '../shared/ui/AppImageCleanupNotice';
import { AppList } from '../shared/ui/AppList';
import { AppPage } from '../shared/ui/AppPage';
import { AppTextField } from '../shared/ui/AppTextField';

type ServiceFilter = 'active' | 'archived';

export function ServicesContainer() {
  const { accessToken, user } = useAuth();
  const { locale, t } = useI18n();
  const resolveError = useApiErrorResolver();
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [specialists, setSpecialists] = useState<ServiceSpecialist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceCatalogItem | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ServiceFilter>('active');
  const [statusService, setStatusService] = useState<ServiceCatalogItem | null>(null);
  const [isStatusSaving, setIsStatusSaving] = useState(false);
  const [deletingService, setDeletingService] = useState<ServiceCatalogItem | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<ServiceDeleteImpact | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleteImpactLoading, setIsDeleteImpactLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pricingService, setPricingService] = useState<ServiceCatalogItem | null>(null);
  const [pricingError, setPricingError] = useState('');
  const [isPricingSaving, setIsPricingSaving] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const openedIntentRef = useRef('');

  const canManage = user?.role === WebUserRole.ProductAdmin
    || user?.role === WebUserRole.Owner;
  const canAccess = canManage || user?.role === WebUserRole.Specialist;

  const images = useManagedImages<ServiceImageMedia>(
    canAccess ? services.flatMap((service) => service.imageMediaId ? [service.imageMediaId] : []) : [],
  );
  const { previewUrlFor, cleanupImage } = images;
  const resolvedServices = useMemo(() => services.map((service) => {
    const previewUrl = previewUrlFor(service.imageMediaId);
    return previewUrl ? { ...service, imageUrl: previewUrl } : service;
  }), [previewUrlFor, services]);

  const clearDialogQuery = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('create');
    next.delete('edit');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const reportError = useCallback((caught: unknown, fallbackMessage: string) => {
    setError(resolveError(caught, fallbackMessage).message);
  }, [resolveError]);

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

  useEffect(() => {
    const intent = `${searchParams.get('create') ?? ''}:${searchParams.get('edit') ?? ''}`;
    if (!intent.replace(':', '')) {
      openedIntentRef.current = '';
      return;
    }
    if (isLoading || !canManage || openedIntentRef.current === intent) {
      return;
    }
    openedIntentRef.current = intent;
    if (searchParams.get('create') === '1') {
      queueMicrotask(() => {
        setEditingService(null);
        setDialogError('');
        setDialogOpen(true);
      });
      return;
    }
    const editId = Number(searchParams.get('edit'));
    const service = Number.isInteger(editId) && editId > 0
      ? resolvedServices.find(({ id }) => id === editId)
      : undefined;
    if (service) {
      queueMicrotask(() => {
        setEditingService(service);
        setDialogError('');
        setDialogOpen(true);
      });
    }
  }, [canManage, isLoading, resolvedServices, searchParams]);

  const openCreate = () => {
    setEditingService(null);
    setDialogError('');
    setDialogOpen(true);
  };

  const openEdit = (service: ServiceCatalogItem) => {
    setEditingService(service);
    setDialogError('');
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingService(null);
    setDialogError('');
    clearDialogQuery();
  };

  const saveAssignmentChanges = async (serviceId: number, changes: AssignmentChange[]) => {
    if (!accessToken) {
      return;
    }
    for (const { specialistId, ...assignmentPayload } of changes) {
      await servicesApi.updateAssignment<ServiceAssignment, AssignmentPayload>(
        accessToken,
        serviceId,
        specialistId,
        assignmentPayload,
      );
    }
  };

  const saveService = async (payload: ServicePayload, assignmentChanges: AssignmentChange[]) => {
    if (!accessToken) {
      return false;
    }
    setIsSaving(true);
    setDialogError('');
    try {
      const previousImageMediaId = editingService?.imageMediaId ?? null;
      const changedManagedImage = editingService
        && payload.imageMediaId !== undefined
        && payload.imageMediaId !== previousImageMediaId;
      const response = editingService
        ? await servicesApi.update<ServiceCatalogItem, ServicePayload>(accessToken, editingService.id, payload)
        : await servicesApi.create<ServiceCatalogItem, ServicePayload>(accessToken, payload);
      let assignmentError: unknown = null;
      try {
        await saveAssignmentChanges(editingService?.id ?? response.data.id, assignmentChanges);
      } catch (caught) {
        assignmentError = caught;
      }
      await refresh();
      if (assignmentError) {
        // The service itself is saved; report pricing failure on the page so a retry cannot duplicate it.
        reportError(assignmentError, t('services.errors.saveAssignment'));
      }
      if (changedManagedImage && previousImageMediaId) {
        await cleanupImage(previousImageMediaId);
      }
      return true;
    } catch (caught) {
      setDialogError(resolveError(caught, t('services.errors.save')).message);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const changeStatus = async (service: ServiceCatalogItem) => {
    if (!accessToken) {
      return;
    }
    setIsStatusSaving(true);
    try {
      await servicesApi.update<ServiceCatalogItem, Partial<ServicePayload>>(accessToken, service.id, {
        isActive: !service.isActive,
      });
      setStatusService(null);
      await refresh();
    } catch (caught) {
      reportError(caught, t('services.errors.save'));
    } finally {
      setIsStatusSaving(false);
    }
  };

  const savePricing = async (service: ServiceCatalogItem, changes: AssignmentChange[]) => {
    if (!accessToken) {
      return false;
    }
    setIsPricingSaving(true);
    setPricingError('');
    try {
      await saveAssignmentChanges(service.id, changes);
      await refresh();
      return true;
    } catch (caught) {
      setPricingError(resolveError(caught, t('services.errors.saveAssignment')).message);
      return false;
    } finally {
      setIsPricingSaving(false);
    }
  };

  const openService = (service: ServiceCatalogItem) => {
    if (canManage) {
      openEdit(service);
      return;
    }
    setPricingError('');
    setPricingService(service);
  };

  const openDeleteDialog = async (service: ServiceCatalogItem) => {
    if (!accessToken) {
      return;
    }
    setDeletingService(service);
    setDeleteImpact(null);
    setDeleteError('');
    setIsDeleteImpactLoading(true);
    try {
      const response = await servicesApi.getDeleteImpact<ServiceDeleteImpact>(accessToken, service.id);
      setDeleteImpact(response.data);
    } catch (caught) {
      setDeleteError(resolveError(caught, t('services.errors.deleteImpact')).message);
    } finally {
      setIsDeleteImpactLoading(false);
    }
  };

  const deleteService = async (service: ServiceCatalogItem) => {
    if (!accessToken || !deleteImpact?.canDelete) {
      return;
    }
    setIsDeleting(true);
    setDeleteError('');
    try {
      await servicesApi.delete(accessToken, service.id);
      setDeletingService(null);
      setDeleteImpact(null);
      await refresh();
      if (service.imageMediaId) {
        await cleanupImage(service.imageMediaId);
      }
    } catch (caught) {
      setDeleteError(resolveError(caught, t('services.errors.delete')).message);
      try {
        const response = await servicesApi.getDeleteImpact<ServiceDeleteImpact>(accessToken, service.id);
        setDeleteImpact(response.data);
      } catch {
        // Keep the original mutation error visible if the follow-up impact check also fails.
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredServices = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase(locale);
    return resolvedServices.filter((service) => {
      if (filter === 'active' ? !service.isActive : service.isActive) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      return service.name.toLocaleLowerCase(locale).includes(normalizedSearch)
        || (service.description ?? '').toLocaleLowerCase(locale).includes(normalizedSearch);
    });
  }, [filter, locale, resolvedServices, search]);

  const closeDeleteDialog = () => {
    if (isDeleting) {
      return;
    }
    setDeletingService(null);
    setDeleteImpact(null);
    setDeleteError('');
  };

  return (
    <AppPage
      title={t('services.pageTitle')}
      subtitle={t('services.pageSubtitle')}
      action={canManage ? (
        <AppButton size="small" startIcon={<AppIcons.add />} onClick={openCreate}>
          {t('services.create')}
        </AppButton>
      ) : null}
    >
      <Stack className="services-list">
        {error ? <AppStatusMessage severity="error" message={error} /> : null}
        <AppImageCleanupNotice
          failedCount={images.failedCleanupMediaIds.length}
          message={t('services.imageCleanupWarning')}
          retryLabel={t('services.retryImageCleanup')}
          isRetrying={images.isRetryingCleanup}
          disabled={isSaving || isDeleting}
          onRetry={() => void images.retryCleanup()}
        />
        {!canAccess ? (
          <AppEmptyState title={t('services.accessDenied')} />
        ) : isLoading ? (
          <AppLoadingState lines={3} />
        ) : (
          <>
            <AppFilterBar
              mobileTitle={t('services.filters')}
              mobileLabel={filter === 'active' ? t('services.activeServices') : t('services.archivedServices')}
              activeFiltersCount={(search.trim() ? 1 : 0) + (filter === 'archived' ? 1 : 0)}
            >
              <AppTextField
                label={t('services.search')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <AppTextField
                select
                label={t('services.status')}
                value={filter}
                onChange={(event) => setFilter(event.target.value as ServiceFilter)}
              >
                <MenuItem value="active">{t('services.activeServices')}</MenuItem>
                <MenuItem value="archived">{t('services.archivedServices')}</MenuItem>
              </AppTextField>
            </AppFilterBar>

            {filteredServices.length ? (
              <AppList className="services-list__rows">
                {filteredServices.map((service) => (
                  <ServiceListRow
                    key={service.id}
                    service={service}
                    canManage={canManage}
                    isMutating={statusService?.id === service.id || deletingService?.id === service.id}
                    onOpen={() => openService(service)}
                    onArchive={() => setStatusService(service)}
                    onRestore={() => setStatusService(service)}
                    onDelete={() => void openDeleteDialog(service)}
                  />
                ))}
              </AppList>
            ) : (
              <AppEmptyState
                title={services.length ? t('services.noResults') : t('services.empty')}
                description={services.length ? t('services.noResultsHelper') : t('services.emptyHelper')}
                action={canManage && !services.length ? (
                  <AppButton size="small" startIcon={<AppIcons.add />} onClick={openCreate}>
                    {t('services.create')}
                  </AppButton>
                ) : null}
              />
            )}
          </>
        )}
      </Stack>

      <ServiceFormDialog
        key={`${editingService?.id ?? 'new'}:${dialogOpen}`}
        open={dialogOpen}
        service={editingService}
        specialists={specialists}
        isSaving={isSaving}
        saveError={dialogError}
        onClose={closeDialog}
        onSubmit={saveService}
        onUploadImage={images.uploadImage}
        onDeleteImage={images.deleteImage}
      />

      {pricingService ? (
        <ServicePricingDialog
          key={pricingService.id}
          open
          service={pricingService}
          isSaving={isPricingSaving}
          saveError={pricingError}
          onClose={() => setPricingService(null)}
          onSubmit={(changes) => savePricing(pricingService, changes)}
        />
      ) : null}

      <AppConfirmDialog
        open={Boolean(statusService)}
        onClose={() => !isStatusSaving && setStatusService(null)}
        maxWidth="xs"
        title={statusService?.isActive ? t('services.archiveConfirmTitle') : t('services.restoreConfirmTitle')}
        description={statusService?.isActive ? t('services.archiveConfirmDescription') : t('services.restoreConfirmDescription')}
        cancelLabel={t('common.cancel')}
        confirmLabel={statusService?.isActive ? t('services.archive') : t('services.restore')}
        confirmColor={statusService?.isActive ? 'warning' : 'primary'}
        isLoading={isStatusSaving}
        onCancel={() => setStatusService(null)}
        onConfirm={() => {
          if (statusService) {
            void changeStatus(statusService);
          }
        }}
      />

      <AppConfirmDialog
        open={Boolean(deletingService)}
        onClose={closeDeleteDialog}
        maxWidth="xs"
        title={t('services.deleteConfirmTitle')}
        description={t('services.deleteConfirmDescription')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('services.deletePermanently')}
        confirmColor="error"
        isLoading={isDeleting}
        disabled={isDeleteImpactLoading || !deleteImpact?.canDelete}
        onCancel={closeDeleteDialog}
        onConfirm={() => {
          if (deletingService) {
            void deleteService(deletingService);
          }
        }}
      >
        {deleteError ? <AppStatusMessage severity="error" message={deleteError} /> : null}
        {isDeleteImpactLoading ? (
          <AppLoadingState lines={1} hasHeader={false} />
        ) : deleteImpact ? (
          <Stack className="services-delete-impact">
            <Typography variant="body2">
              {t('services.deleteAppointments').replace('{count}', String(deleteImpact.impact.appointments))}
            </Typography>
            <Typography variant="body2">
              {t('services.deleteAppointmentGroups').replace('{count}', String(deleteImpact.impact.appointmentGroups))}
            </Typography>
            <Typography variant="body2">
              {t('services.deletePublicPages').replace('{count}', String(deleteImpact.impact.publicPages))}
            </Typography>
            {!deleteImpact.canDelete ? (
              <Typography variant="body2" color="warning.main">
                {t('services.deleteBlocked')}
              </Typography>
            ) : null}
          </Stack>
        ) : null}
      </AppConfirmDialog>
    </AppPage>
  );
}
