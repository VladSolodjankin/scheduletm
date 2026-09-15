import { MenuItem, Stack, Typography } from '@mui/material';
import { isAxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ServiceCard } from '../components/services/ServiceCard';
import { ServiceFormDialog } from '../components/services/ServiceFormDialog';
import type {
  AssignmentPayload,
  ServiceAssignment,
  ServiceCatalogItem,
  ServiceDeleteImpact,
  ServiceImageMedia,
  ServicePayload,
  ServicesResponse,
  ServiceSpecialist,
} from '../components/services/types';
import { imageMediaApi, servicesApi } from '../shared/api/client';
import { resolveApiError } from '../shared/api/error';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import { WebUserRole } from '../shared/types/roles';
import { AppButton } from '../shared/ui/AppButton';
import { AppConfirmDialog } from '../shared/ui/AppDialog';
import { AppEmptyState, AppLoadingState, AppStatusMessage } from '../shared/ui/AppStatus';
import { AppIcons } from '../shared/ui/AppIcons';
import { AppFilterBar } from '../shared/ui/AppFilterBar';
import { AppPage } from '../shared/ui/AppPage';
import { AppTextField } from '../shared/ui/AppTextField';

type ServiceFilter = 'active' | 'archived';
type MediaPreviewState = { accessToken: string | null; urls: Map<string, string> };

export function ServicesContainer() {
  const { accessToken, user } = useAuth();
  const { locale, t } = useI18n();
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
  const [failedCleanupMediaIds, setFailedCleanupMediaIds] = useState<string[]>([]);
  const [isRetryingCleanup, setIsRetryingCleanup] = useState(false);
  const [savingAssignmentKey, setSavingAssignmentKey] = useState<string | null>(null);
  const [mediaPreviews, setMediaPreviews] = useState<MediaPreviewState>(() => ({
    accessToken: null,
    urls: new Map(),
  }));
  const [searchParams, setSearchParams] = useSearchParams();
  const openedIntentRef = useRef('');
  const mediaPreviewUrlsRef = useRef<Map<string, string>>(new Map());

  const canManage = user?.role === WebUserRole.ProductAdmin
    || user?.role === WebUserRole.Owner;
  const canAccess = canManage || user?.role === WebUserRole.Specialist;

  const resolvedServices = useMemo(() => services.map((service) => {
    const previewUrl = mediaPreviews.accessToken === accessToken && service.imageMediaId
      ? mediaPreviews.urls.get(service.imageMediaId)
      : undefined;
    return previewUrl ? { ...service, imageUrl: previewUrl } : service;
  }), [accessToken, mediaPreviews, services]);

  const clearDialogQuery = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('create');
    next.delete('edit');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const reportError = useCallback((caught: unknown, fallbackMessage: string) => {
    setError(resolveApiError(caught, {
      fallbackMessage,
      networkMessage: t('common.errors.network'),
    }).message);
  }, [t]);

  const cleanupManagedImage = async (mediaId: string) => {
    if (!accessToken) {
      setFailedCleanupMediaIds((current) => current.includes(mediaId) ? current : [...current, mediaId]);
      return false;
    }
    try {
      await imageMediaApi.delete(accessToken, mediaId);
      setFailedCleanupMediaIds((current) => current.filter((id) => id !== mediaId));
      return true;
    } catch (caught) {
      if (isAxiosError(caught) && caught.response?.status === 404) {
        setFailedCleanupMediaIds((current) => current.filter((id) => id !== mediaId));
        return true;
      }
      setFailedCleanupMediaIds((current) => current.includes(mediaId) ? current : [...current, mediaId]);
      return false;
    }
  };

  const retryFailedMediaCleanup = async () => {
    if (!failedCleanupMediaIds.length || isRetryingCleanup) {
      return;
    }
    setIsRetryingCleanup(true);
    try {
      await Promise.all(failedCleanupMediaIds.map((mediaId) => cleanupManagedImage(mediaId)));
    } finally {
      setIsRetryingCleanup(false);
    }
  };

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
    const previewUrls = mediaPreviewUrlsRef.current;
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.clear();
    };
  }, [accessToken]);

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
    if (!accessToken || !canAccess) {
      return;
    }

    let cancelled = false;
    const mediaIds = new Set(services.flatMap((service) => service.imageMediaId ? [service.imageMediaId] : []));
    mediaPreviewUrlsRef.current.forEach((url, mediaId) => {
      if (!mediaIds.has(mediaId)) {
        URL.revokeObjectURL(url);
        mediaPreviewUrlsRef.current.delete(mediaId);
      }
    });

    void Promise.all([...mediaIds]
      .filter((mediaId) => !mediaPreviewUrlsRef.current.has(mediaId))
      .map(async (mediaId) => {
        try {
          const response = await imageMediaApi.getPreview(accessToken, mediaId);
          if (cancelled) {
            return;
          }
          const previewUrl = URL.createObjectURL(response.data);
          if (mediaPreviewUrlsRef.current.has(mediaId)) {
            URL.revokeObjectURL(previewUrl);
            return;
          }
          mediaPreviewUrlsRef.current.set(mediaId, previewUrl);
          setMediaPreviews({ accessToken, urls: new Map(mediaPreviewUrlsRef.current) });
        } catch {
          // Keep the API-provided public URL for active services; archived services show the empty image state.
        }
      }));

    return () => {
      cancelled = true;
    };
  }, [accessToken, canAccess, services]);

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

  const saveService = async (payload: ServicePayload) => {
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
      if (editingService) {
        await servicesApi.update<ServiceCatalogItem, ServicePayload>(accessToken, editingService.id, payload);
      } else {
        await servicesApi.create<ServiceCatalogItem, ServicePayload>(accessToken, payload);
      }
      await refresh();
      if (changedManagedImage && previousImageMediaId) {
        await cleanupManagedImage(previousImageMediaId);
      }
      return true;
    } catch (caught) {
      setDialogError(resolveApiError(caught, {
        fallbackMessage: t('services.errors.save'),
        networkMessage: t('common.errors.network'),
      }).message);
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

  const saveAssignment = async (
    service: ServiceCatalogItem,
    assignment: ServiceAssignment,
    payload: AssignmentPayload,
  ) => {
    if (!accessToken) {
      return;
    }
    const assignmentKey = `${service.id}:${assignment.specialistId}`;
    setSavingAssignmentKey(assignmentKey);
    try {
      await servicesApi.updateAssignment<ServiceAssignment, AssignmentPayload>(
        accessToken,
        service.id,
        assignment.specialistId,
        payload,
      );
      await refresh();
    } catch (caught) {
      reportError(caught, t('services.errors.saveAssignment'));
    } finally {
      setSavingAssignmentKey(null);
    }
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
      setDeleteError(resolveApiError(caught, {
        fallbackMessage: t('services.errors.deleteImpact'),
        networkMessage: t('common.errors.network'),
      }).message);
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
        await cleanupManagedImage(service.imageMediaId);
      }
    } catch (caught) {
      setDeleteError(resolveApiError(caught, {
        fallbackMessage: t('services.errors.delete'),
        networkMessage: t('common.errors.network'),
      }).message);
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

  const labels = useMemo(() => ({
    active: t('services.active'),
    archived: t('services.archived'),
    firstSessionFree: t('services.firstSessionFree'),
    minutes: t('services.minutes'),
    hoursShort: t('services.hoursShort'),
    assignments: t('services.assignments'),
    assignmentsHelper: t('services.assignmentsHelper'),
    noAssignments: t('services.noAssignments'),
    edit: t('services.edit'),
    archive: t('services.archive'),
    restore: t('services.restore'),
    deletePermanently: t('services.deletePermanently'),
    save: t('services.save'),
    cancel: t('common.cancel'),
    createTitle: t('services.createTitle'),
    editTitle: t('services.editTitle'),
    formDescription: t('services.formDescription'),
    name: t('services.name'),
    nameError: t('services.nameError'),
    description: t('services.description'),
    descriptionError: t('services.descriptionError'),
    price: t('services.price'),
    priceHelper: t('services.priceHelper'),
    priceError: t('services.priceError'),
    duration: t('services.duration'),
    durationHelper: t('services.durationHelper'),
    durationError: t('services.durationError'),
    image: t('services.image'),
    uploadImage: t('services.uploadImage'),
    replaceImage: t('services.replaceImage'),
    removeImage: t('services.removeImage'),
    invalidImageType: t('services.invalidImageType'),
    imageTooLarge: t('services.imageTooLarge'),
    imageUploadError: t('services.errors.imageUpload'),
    imageCleanupError: t('services.errors.imageCleanup'),
    specialistsTitle: t('services.specialistsTitle'),
    specialistsHelper: t('services.specialistsHelper'),
    selectAll: t('services.selectAll'),
    clear: t('services.clear'),
    noSpecialists: t('services.noSpecialists'),
    availableForBooking: t('services.availableForBooking'),
    serviceDefault: t('services.serviceDefault'),
    customValue: t('services.customValue'),
    useServiceDefaults: t('services.useServiceDefaults'),
  }), [t]);

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
        {failedCleanupMediaIds.length ? (
          <Stack className="services-cleanup">
            <AppStatusMessage severity="warning" message={t('services.imageCleanupWarning')} />
            <Stack className="services-actions">
              <AppButton
                size="small"
                variant="outlined"
                isLoading={isRetryingCleanup}
                disabled={isSaving || isDeleting}
                onClick={() => void retryFailedMediaCleanup()}
              >
                {t('services.retryImageCleanup')}
              </AppButton>
            </Stack>
          </Stack>
        ) : null}
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

            {filteredServices.length ? filteredServices.map((service) => {
              const savingSpecialistId = savingAssignmentKey?.startsWith(`${service.id}:`)
                ? Number(savingAssignmentKey.split(':')[1])
                : null;
              return (
                <ServiceCard
                  key={service.id}
                  service={service}
                  locale={locale}
                  canManage={canManage}
                  labels={labels}
                  savingAssignmentId={savingSpecialistId}
                  isMutating={statusService?.id === service.id || deletingService?.id === service.id}
                  onEdit={() => openEdit(service)}
                  onArchive={() => setStatusService(service)}
                  onRestore={() => setStatusService(service)}
                  onDelete={() => void openDeleteDialog(service)}
                  onSaveAssignment={(assignment, payload) => saveAssignment(service, assignment, payload)}
                />
              );
            }) : (
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
        labels={labels}
        onClose={closeDialog}
        onSubmit={saveService}
        onUploadImage={async (file, onProgress) => {
          if (!accessToken) {
            throw new Error('missing_access_token');
          }
          const response = await imageMediaApi.upload<ServiceImageMedia>(accessToken, file, onProgress);
          return response.data;
        }}
        onDeleteImage={async (mediaId) => {
          if (!accessToken) {
            throw new Error('missing_access_token');
          }
          await imageMediaApi.delete(accessToken, mediaId);
        }}
      />

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
