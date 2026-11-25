import { Stack, Typography } from '@mui/material';
import { isAxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { ReviewListRow } from '../components/account-reviews/ReviewListRow';
import { ReviewFormDialog } from '../components/account-reviews/ReviewFormDialog';
import { accountReviewsApi } from '../shared/api/client';
import { useManagedImages } from '../shared/api/useManagedImages';
import { useApiErrorResolver } from '../shared/api/error';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import type { TranslationKey } from '../shared/i18n/dictionaries';
import type { AccountReview, AccountReviewPayload, AccountReviewsResponse } from '../shared/types/api';
import { AppButton } from '../shared/ui/AppButton';
import { AppConfirmDialog } from '../shared/ui/AppDialog';
import { AppIcons } from '../shared/ui/AppIcons';
import { AppImageCleanupNotice } from '../shared/ui/AppImageCleanupNotice';
import { AppList } from '../shared/ui/AppList';
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
  const images = useManagedImages<AppUploadedImage>(
    reviews.flatMap((review) => review.screenshot ? [review.screenshot.mediaId] : []),
  );

  const messageFor = useCallback((caught: unknown, fallbackMessage: string) => {
    if (isAxiosError<{ code?: string }>(caught)) {
      const key = errorKeysByCode[String(caught.response?.data?.code ?? '')];
      if (key) {
        return t(key);
      }
    }
    return resolveError(caught, fallbackMessage).message;
  }, [resolveError, t]);

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

  const screenshotUrlFor = (review: AccountReview | null) => {
    if (!review?.screenshot) {
      return null;
    }
    return images.previewUrlFor(review.screenshot.mediaId) ?? review.screenshot.url;
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
        await images.cleanupImage(previousMediaId);
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
        await images.cleanupImage(review.screenshot.mediaId);
      }
    } catch (caught) {
      setDeletingReview(null);
      setError(messageFor(caught, t('accountReviews.errors.delete')));
    } finally {
      setIsDeleting(false);
    }
  };

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
        <AppImageCleanupNotice
          failedCount={images.failedCleanupMediaIds.length}
          message={t('accountReviews.imageCleanupWarning')}
          retryLabel={t('accountReviews.retryImageCleanup')}
          isRetrying={images.isRetryingCleanup}
          onRetry={() => void images.retryCleanup()}
        />
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
            <AppList>
              {reviews.map((review) => (
                <ReviewListRow
                  key={review.id}
                  review={review}
                  screenshotUrl={screenshotUrlFor(review)}
                  isBusy={busyReviewId === review.id || deletingReview?.id === review.id}
                  onEdit={() => openEdit(review)}
                  onToggleStatus={() => void toggleStatus(review)}
                  onDelete={() => setDeletingReview(review)}
                />
              ))}
            </AppList>
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
        onClose={closeDialog}
        onSubmit={saveReview}
        onUploadImage={images.uploadImage}
        onDeleteImage={images.deleteImage}
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
