import { Box, FormControl, FormHelperText, FormLabel, MenuItem, Rating, useMediaQuery, useTheme } from '@mui/material';
import { useState, type FormEvent } from 'react';
import type { AccountReview, AccountReviewPayload, AccountReviewStatus } from '../../shared/types/api';
import { AppButton } from '../../shared/ui/AppButton';
import { AppDialog } from '../../shared/ui/AppDialog';
import { AppImageUpload, type AppUploadedImage } from '../../shared/ui/AppImageUpload';
import { AppStatusMessage } from '../../shared/ui/AppStatus';
import { AppTextField } from '../../shared/ui/AppTextField';
import { FormContainer } from '../../shared/ui/FormContainer';
import { useI18n } from '../../shared/i18n/I18nContext';

const FORM_ID = 'account-review-form';
const MAX_NAME_LENGTH = 80;
const MAX_TEXT_LENGTH = 1500;
const MAX_DATE_LENGTH = 40;
const MAX_ALT_LENGTH = 200;

type PendingImage = { media: AppUploadedImage; objectUrl: string };

type Props = {
  open: boolean;
  review: AccountReview | null;
  screenshotPreviewUrl: string | null;
  isSaving: boolean;
  saveError: string;
  onClose: () => void;
  onSubmit: (payload: AccountReviewPayload) => Promise<boolean>;
  onUploadImage: (file: File, onProgress: (percent: number) => void) => Promise<AppUploadedImage>;
  onDeleteImage: (mediaId: string) => Promise<void>;
};

export function ReviewFormDialog({
  open,
  review,
  screenshotPreviewUrl,
  isSaving,
  saveError,
  onClose,
  onSubmit,
  onUploadImage,
  onDeleteImage,
}: Props) {
  const { t } = useI18n();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [name, setName] = useState(review?.name ?? '');
  const [text, setText] = useState(review?.text ?? '');
  const [rating, setRating] = useState<number | null>(review?.rating ?? null);
  const [reviewDate, setReviewDate] = useState(review?.reviewDate ?? '');
  const [status, setStatus] = useState<AccountReviewStatus>(review?.status ?? 'published');
  const [screenshotMediaId, setScreenshotMediaId] = useState<string | null>(review?.screenshot?.mediaId ?? null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(screenshotPreviewUrl ?? review?.screenshot?.url ?? null);
  const [screenshotAlt, setScreenshotAlt] = useState(review?.screenshot?.alt ?? '');
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [imageError, setImageError] = useState('');
  const [isCleaningImage, setIsCleaningImage] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const nameInvalid = !name.trim() || name.trim().length > MAX_NAME_LENGTH;
  const textInvalid = !text.trim() || text.trim().length > MAX_TEXT_LENGTH;
  const ratingInvalid = rating === null || rating < 1 || rating > 5;
  const altInvalid = Boolean(screenshotMediaId) && !screenshotAlt.trim();
  const formInvalid = nameInvalid || textInvalid || ratingInvalid || altInvalid;
  const isImageBusy = isCleaningImage || isUploadingImage;

  const cleanupPendingImage = async (image = pendingImage) => {
    if (!image) {
      return true;
    }
    setIsCleaningImage(true);
    setImageError('');
    try {
      await onDeleteImage(image.media.id);
      URL.revokeObjectURL(image.objectUrl);
      if (pendingImage?.media.id === image.media.id) {
        setPendingImage(null);
      }
      return true;
    } catch {
      setImageError(t('accountReviews.errors.imageCleanup'));
      return false;
    } finally {
      setIsCleaningImage(false);
    }
  };

  const handleUploaded = async (media: AppUploadedImage, objectUrl: string) => {
    if (pendingImage) {
      const cleaned = await cleanupPendingImage(pendingImage);
      if (!cleaned) {
        try {
          await onDeleteImage(media.id);
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
        throw new Error('pending_image_cleanup_failed');
      }
    }
    setImageError('');
    setPendingImage({ media, objectUrl });
    setScreenshotMediaId(media.id);
    setScreenshotUrl(objectUrl);
    setScreenshotAlt((current) => current.trim() ? current : media.alt.slice(0, MAX_ALT_LENGTH));
  };

  const handleRemoveImage = async () => {
    if (pendingImage && !(await cleanupPendingImage(pendingImage))) {
      return;
    }
    setImageError('');
    setScreenshotMediaId(null);
    setScreenshotUrl(null);
    setScreenshotAlt('');
  };

  const handleClose = async () => {
    if (isUploadingImage) {
      return;
    }
    if (pendingImage && !(await cleanupPendingImage(pendingImage))) {
      return;
    }
    onClose();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setHasSubmitted(true);
    if (formInvalid || isImageBusy || rating === null) {
      return;
    }
    const saved = await onSubmit({
      name: name.trim(),
      text: text.trim(),
      rating,
      reviewDate: reviewDate.trim(),
      screenshotMediaId,
      screenshotAlt: screenshotMediaId ? screenshotAlt.trim() : '',
      status,
    });
    if (saved) {
      if (pendingImage) {
        URL.revokeObjectURL(pendingImage.objectUrl);
      }
      setPendingImage(null);
      onClose();
    }
  };

  const currentImage = pendingImage?.media ?? (screenshotUrl ? { url: screenshotUrl, alt: screenshotAlt } : null);

  return (
    <AppDialog
      open={open}
      fullScreen={fullScreen}
      onClose={isSaving || isImageBusy ? undefined : () => void handleClose()}
      maxWidth="sm"
      title={review ? t('accountReviews.editTitle') : t('accountReviews.createTitle')}
      description={t('accountReviews.formDescription')}
      actions={(
        <>
          <AppButton variant="text" onClick={() => void handleClose()} disabled={isSaving || isImageBusy}>
            {t('common.cancel')}
          </AppButton>
          <AppButton type="submit" form={FORM_ID} isLoading={isSaving} disabled={isImageBusy}>
            {t('accountReviews.save')}
          </AppButton>
        </>
      )}
    >
      <Box component="form" id={FORM_ID} onSubmit={(event) => void submit(event)} noValidate>
        <FormContainer>
          {saveError ? <AppStatusMessage severity="error" message={saveError} /> : null}
          {imageError ? <AppStatusMessage severity="error" message={imageError} /> : null}

          <AppTextField
            required
            label={t('accountReviews.name')}
            value={name}
            error={hasSubmitted && nameInvalid}
            helperText={hasSubmitted && nameInvalid ? t('accountReviews.nameError') : `${name.length}/${MAX_NAME_LENGTH}`}
            slotProps={{ htmlInput: { maxLength: MAX_NAME_LENGTH } }}
            onChange={(event) => setName(event.target.value)}
          />

          <FormControl component="fieldset" error={hasSubmitted && ratingInvalid} required>
            <FormLabel component="legend" sx={{ mb: 0.5 }}>{t('accountReviews.rating')}</FormLabel>
            <Rating
              name="account-review-rating"
              value={rating}
              onChange={(_, value) => setRating(value)}
              getLabelText={(value) => t('accountReviews.ratingValue').replace('{rating}', String(value))}
            />
            {hasSubmitted && ratingInvalid ? <FormHelperText>{t('accountReviews.ratingError')}</FormHelperText> : null}
          </FormControl>

          <AppTextField
            label={t('accountReviews.date')}
            value={reviewDate}
            helperText={t('accountReviews.dateHelper')}
            slotProps={{ htmlInput: { maxLength: MAX_DATE_LENGTH } }}
            onChange={(event) => setReviewDate(event.target.value)}
          />

          <AppTextField
            required
            multiline
            minRows={4}
            label={t('accountReviews.text')}
            value={text}
            error={hasSubmitted && textInvalid}
            helperText={hasSubmitted && textInvalid ? t('accountReviews.textError') : `${text.length}/${MAX_TEXT_LENGTH}`}
            slotProps={{ htmlInput: { maxLength: MAX_TEXT_LENGTH } }}
            onChange={(event) => setText(event.target.value)}
          />

          <AppImageUpload<AppUploadedImage>
            key={screenshotMediaId ?? screenshotUrl ?? 'empty'}
            label={t('accountReviews.screenshot')}
            image={currentImage}
            previewUrl={pendingImage?.objectUrl ?? screenshotUrl ?? undefined}
            uploadImage={onUploadImage}
            onUploaded={handleUploaded}
            onRemoved={handleRemoveImage}
            uploadLabel={t('accountReviews.uploadImage')}
            replaceLabel={t('accountReviews.replaceImage')}
            removeLabel={t('accountReviews.removeImage')}
            invalidTypeText={t('accountReviews.invalidImageType')}
            tooLargeText={t('accountReviews.imageTooLarge')}
            uploadErrorText={t('accountReviews.errors.imageUpload')}
            defaultAlt={name.trim()}
            disabled={isSaving || isImageBusy}
            onBusyChange={setIsUploadingImage}
          />
          {screenshotMediaId ? (
            <AppTextField
              required
              label={t('accountReviews.screenshotAlt')}
              value={screenshotAlt}
              error={hasSubmitted && altInvalid}
              helperText={hasSubmitted && altInvalid ? t('accountReviews.screenshotAltError') : `${screenshotAlt.length}/${MAX_ALT_LENGTH}`}
              slotProps={{ htmlInput: { maxLength: MAX_ALT_LENGTH } }}
              onChange={(event) => setScreenshotAlt(event.target.value)}
            />
          ) : null}

          <AppTextField
            select
            label={t('accountReviews.status')}
            value={status}
            onChange={(event) => setStatus(event.target.value as AccountReviewStatus)}
          >
            <MenuItem value="published">{t('accountReviews.statusPublished')}</MenuItem>
            <MenuItem value="hidden">{t('accountReviews.statusHidden')}</MenuItem>
          </AppTextField>
        </FormContainer>
      </Box>
    </AppDialog>
  );
}
