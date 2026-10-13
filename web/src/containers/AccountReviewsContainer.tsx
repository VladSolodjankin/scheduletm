import { Stack, Typography } from '@mui/material';
import { isAxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReviewCard } from '../components/account-reviews/ReviewCard';
import { ReviewFormDialog } from '../components/account-reviews/ReviewFormDialog';
import { accountReviewsApi, imageMediaApi } from '../shared/api/client';
import { useApiErrorResolver } from '../shared/api/error';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import type { TranslationKey } from '../shared/i18n/dictionaries';
import type { AccountReview, AccountReviewPayload, AccountReviewsResponse } from '../shared/types/api';
import { AppButton } from '../shared/ui/AppButton';
import { AppConfirmDialog } from '../shared/ui/AppDialog';
import { AppIcons } from '../shared/ui/AppIcons';
import { AppPage } from '../shared/ui/AppPage';
import type { AppUploadedImage } from '../shared/ui/AppImageUpload';
import { AppEmptyState, AppLoadingState, AppStatusMessage } from '../shared/ui/AppStatus';

const DEFAULT_LIMIT = 30;

const errorKeysByCode: Record<string, TranslationKey> = {
  forbidden: 'accountReviews.errors.forbidden',
  not_found: 'accountReviews.errors.notFound',
  media_not_found: 'accountReviews.errors.mediaNotFound',
  review_limit_reached: 'accountReviews.errors.limitReached',
};

type MediaPreviewState = { accessToken: string | null; urls: Map<string, string> };

export function AccountReviewsContainer() {
  const { accessToken } = useAuth();
  const { t } = useI18n();
  const resolveError = useApiErrorResolver();
  const [reviews, setReviews] = useState<AccountReview[]>([]);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<AccountReview | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [busyReviewId, setBusyReviewId] = useState<number | null>(null);
  const [deletingReview, setDeletingReview] = useState<AccountReview | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [failedCleanupMediaIds, setFailedCleanupMediaIds] = useState<string[]>([]);
  const [isRetryingCleanup, setIsRetryingCleanup] = useState(false);
  const [mediaPreviews, setMediaPreviews] = useState<MediaPreviewState>(() => ({ accessToken: null, urls: new Map() }));
  const mediaPreviewUrlsRef = useRef<Map<string, string>>(new Map());

  const messageFor = useCallback((caught: unknown, fallbackMessage: string) => {
    if (isAxiosError<{ code?: string }>(caught)) {
      const key = errorKeysByCode[String(caught.response?.data?.code ?? '')];
      if (key) {
        return t(key);
      }
    }
    return resolveError(caught, fallbackMessage).message;
  }, [resolveError, t]);

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

  const load = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    try {
      const response = await accountReviewsApi.list<AccountReviewsResponse>(accessToken);
      setReviews(response.data.reviews);
      setLimit(response.data.limit || DEFAULT_LIMIT);
      setLoadFailed(false);
      setError('');
    } catch (caught) {
      setLoadFailed(true);
      setError(messageFor(caught, t('accountReviews.errors.load')));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, messageFor, t]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    let isActive = true;
    const run = async () => {
      try {
        const response = await accountReviewsApi.list<AccountReviewsResponse>(accessToken);
        if (!isActive) {
          return;
        }
        setReviews(response.data.reviews);
        setLimit(response.data.limit || DEFAULT_LIMIT);
        setLoadFailed(false);
        setError('');
      } catch (caught) {
        if (isActive) {
          setLoadFailed(true);
          setError(messageFor(caught, t('accountReviews.errors.load')));
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };
    void run();
    return () => {
      isActive = false;
    };
  }, [accessToken, messageFor, t]);

  useEffect(() => {
    const previewUrls = mediaPreviewUrlsRef.current;
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.clear();
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    let cancelled = false;
    const mediaIds = new Set(reviews.flatMap((review) => review.screenshot ? [review.screenshot.mediaId] : []));
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
          // Keep the API-provided URL; hidden reviews may show an empty thumbnail.
        }
      }));
    return () => {
      cancelled = true;
    };
  }, [accessToken, reviews]);

  const screenshotUrlFor = (review: AccountReview | null) => {
    if (!review?.screenshot) {
      return null;
    }
    const preview = mediaPreviews.accessToken === accessToken ? mediaPreviews.urls.get(review.screenshot.mediaId) : undefined;
    return preview ?? review.screenshot.url;
  };

  const openCreate = () => {
    setEditingReview(null);
    setDialogError('');
    setDialogOpen(true);
  };

  const openEdit = (review: AccountReview) => {
    setEditingReview(review);
    setDialogError('');
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingReview(null);
    setDialogError('');
  };

  const saveReview = async (payload: AccountReviewPayload) => {
    if (!accessToken) {
      return false;
    }
    setIsSaving(true);
    setDialogError('');
    try {
      const previousMediaId = editingReview?.screenshot?.mediaId ?? null;
      if (editingReview) {
        await accountReviewsApi.update<AccountReview, AccountReviewPayload>(accessToken, editingReview.id, payload);
      } else {
        await accountReviewsApi.create<AccountReview, AccountReviewPayload>(accessToken, payload);
      }
      await load();
      if (previousMediaId && previousMediaId !== payload.screenshotMediaId) {
        await cleanupManagedImage(previousMediaId);
      }
      return true;
    } catch (caught) {
      setDialogError(messageFor(caught, t('accountReviews.errors.save')));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async (review: AccountReview) => {
    if (!accessToken) {
      return;
    }
    setBusyReviewId(review.id);
    try {
      await accountReviewsApi.update<AccountReview, Partial<AccountReviewPayload>>(accessToken, review.id, {
        status: review.status === 'published' ? 'hidden' : 'published',
      });
      await load();
    } catch (caught) {
      setError(messageFor(caught, t('accountReviews.errors.save')));
    } finally {
      setBusyReviewId(null);
    }
  };

  const deleteReview = async (review: AccountReview) => {
    if (!accessToken) {
      return;
    }
    setIsDeleting(true);
    try {
      await accountReviewsApi.delete(accessToken, review.id);
      setDeletingReview(null);
      await load();
      if (review.screenshot) {
        await cleanupManagedImage(review.screenshot.mediaId);
      }
    } catch (caught) {
      setDeletingReview(null);
      setError(messageFor(caught, t('accountReviews.errors.delete')));
    } finally {
      setIsDeleting(false);
    }
  };

  const labels = useMemo(() => ({
    createTitle: t('accountReviews.createTitle'),
    editTitle: t('accountReviews.editTitle'),
    formDescription: t('accountReviews.formDescription'),
    edit: t('accountReviews.edit'),
    hide: t('accountReviews.hide'),
    show: t('accountReviews.show'),
    delete: t('accountReviews.delete'),
    statusPublished: t('accountReviews.statusPublished'),
    statusHidden: t('accountReviews.statusHidden'),
    status: t('accountReviews.status'),
    name: t('accountReviews.name'),
    nameError: t('accountReviews.nameError'),
    text: t('accountReviews.text'),
    textError: t('accountReviews.textError'),
    rating: t('accountReviews.rating'),
    ratingError: t('accountReviews.ratingError'),
    ratingValue: t('accountReviews.ratingValue'),
    date: t('accountReviews.date'),
    dateHelper: t('accountReviews.dateHelper'),
    screenshot: t('accountReviews.screenshot'),
    screenshotAlt: t('accountReviews.screenshotAlt'),
    screenshotAltError: t('accountReviews.screenshotAltError'),
    uploadImage: t('accountReviews.uploadImage'),
    replaceImage: t('accountReviews.replaceImage'),
    removeImage: t('accountReviews.removeImage'),
    invalidImageType: t('accountReviews.invalidImageType'),
    imageTooLarge: t('accountReviews.imageTooLarge'),
    imageUploadError: t('accountReviews.errors.imageUpload'),
    imageCleanupError: t('accountReviews.errors.imageCleanup'),
    save: t('accountReviews.save'),
    cancel: t('common.cancel'),
  }), [t]);

  const limitReached = reviews.length >= limit;
  const addButton = (
    <AppButton size="small" startIcon={<AppIcons.add />} disabled={limitReached} onClick={openCreate}>
      {t('accountReviews.create')}
    </AppButton>
  );

  return (
    <AppPage
      title={t('accountReviews.pageTitle')}
      subtitle={t('accountReviews.pageSubtitle')}
      action={!isLoading && !loadFailed ? addButton : null}
    >
      <Stack spacing={2}>
        {error ? <AppStatusMessage severity="error" message={error} /> : null}
        {failedCleanupMediaIds.length ? (
          <Stack spacing={1}>
            <AppStatusMessage severity="warning" message={t('accountReviews.imageCleanupWarning')} />
            <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
              <AppButton size="small" variant="outlined" isLoading={isRetryingCleanup} onClick={() => void retryFailedMediaCleanup()}>
                {t('accountReviews.retryImageCleanup')}
              </AppButton>
            </Stack>
          </Stack>
        ) : null}
        {isLoading ? (
          <AppLoadingState lines={3} />
        ) : loadFailed ? (
          <AppEmptyState
            title={t('accountReviews.errors.load')}
            action={(
              <AppButton size="small" variant="outlined" onClick={() => { setIsLoading(true); void load(); }}>
                {t('accountReviews.retry')}
              </AppButton>
            )}
          />
        ) : reviews.length ? (
          <>
            <Typography variant="body2" color="text.secondary" aria-live="polite">
              {t('accountReviews.counter').replace('{count}', String(reviews.length)).replace('{limit}', String(limit))}
              {limitReached ? ` · ${t('accountReviews.limitReached').replace('{limit}', String(limit))}` : ''}
            </Typography>
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                screenshotUrl={screenshotUrlFor(review)}
                labels={labels}
                isBusy={busyReviewId === review.id || deletingReview?.id === review.id}
                onEdit={() => openEdit(review)}
                onToggleStatus={() => void toggleStatus(review)}
                onDelete={() => setDeletingReview(review)}
              />
            ))}
          </>
        ) : (
          <AppEmptyState
            title={t('accountReviews.empty')}
            description={t('accountReviews.emptyHelper')}
            action={addButton}
          />
        )}
      </Stack>

      <ReviewFormDialog
        key={`${editingReview?.id ?? 'new'}:${dialogOpen}`}
        open={dialogOpen}
        review={editingReview}
        screenshotPreviewUrl={screenshotUrlFor(editingReview)}
        isSaving={isSaving}
        saveError={dialogError}
        labels={labels}
        onClose={closeDialog}
        onSubmit={saveReview}
        onUploadImage={async (file, onProgress) => {
          if (!accessToken) {
            throw new Error('missing_access_token');
          }
          const response = await imageMediaApi.upload<AppUploadedImage>(accessToken, file, onProgress);
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
        open={Boolean(deletingReview)}
        onClose={() => !isDeleting && setDeletingReview(null)}
        maxWidth="xs"
        title={t('accountReviews.deleteConfirmTitle')}
        description={t('accountReviews.deleteConfirmDescription')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('accountReviews.delete')}
        confirmColor="error"
        isLoading={isDeleting}
        onCancel={() => setDeletingReview(null)}
        onConfirm={() => {
          if (deletingReview) {
            void deleteReview(deletingReview);
          }
        }}
      />
    </AppPage>
  );
}
