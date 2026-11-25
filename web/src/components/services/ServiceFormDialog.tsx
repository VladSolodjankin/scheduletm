import {
  Box,
  Checkbox,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material';
import { useState, type FormEvent } from 'react';
import { AppButton } from '../../shared/ui/AppButton';
import { AppDialog } from '../../shared/ui/AppDialog';
import { AppImageUpload } from '../../shared/ui/AppImageUpload';
import { AppSectionHeader } from '../../shared/ui/AppSectionHeader';
import { AppStatusMessage } from '../../shared/ui/AppStatus';
import { AppTextField } from '../../shared/ui/AppTextField';
import { FormContainer } from '../../shared/ui/FormContainer';
import {
  ServiceAssignmentsEditor,
  createAssignmentDraft,
  getChangedAssignmentDrafts,
  hasInvalidAssignmentDrafts,
  toAssignmentPayload,
  type AssignmentDraft,
} from './ServiceAssignmentsEditor';
import type {
  AssignmentChange,
  ServiceCatalogItem,
  ServiceImageMedia,
  ServicePayload,
  ServiceSpecialist,
} from './types';
import './services.css';
import { useI18n } from '../../shared/i18n/I18nContext';

const FORM_ID = 'service-form';
const MAX_NAME_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_PRICE = 10_000_000;
const MIN_DURATION = 5;
const MAX_DURATION = 1440;

type Props = {
  open: boolean;
  service: ServiceCatalogItem | null;
  specialists: ServiceSpecialist[];
  isSaving: boolean;
  saveError: string;
  onClose: () => void;
  onSubmit: (payload: ServicePayload, assignmentChanges: AssignmentChange[]) => Promise<boolean>;
  onUploadImage: (file: File, onProgress: (percent: number) => void) => Promise<ServiceImageMedia>;
  onDeleteImage: (mediaId: string) => Promise<void>;
};

type PendingImage = {
  media: ServiceImageMedia;
  objectUrl: string;
};

export function ServiceFormDialog({
  open,
  service,
  specialists,
  isSaving,
  saveError,
  onClose,
  onSubmit,
  onUploadImage,
  onDeleteImage,
}: Props) {
  const { t } = useI18n();
  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [basePrice, setBasePrice] = useState(String(service?.basePrice ?? 0));
  const [baseDurationMinutes, setBaseDurationMinutes] = useState(String(service?.baseDurationMinutes ?? 60));
  const [imageMediaId, setImageMediaId] = useState<string | null>(service?.imageMediaId ?? null);
  const [imageUrl, setImageUrl] = useState<string | null>(service?.imageUrl ?? null);
  const [imageChanged, setImageChanged] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [firstSessionFree, setFirstSessionFree] = useState(service?.firstSessionFree ?? false);
  const [isActive, setIsActive] = useState(service?.isActive ?? true);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [imageError, setImageError] = useState('');
  const [isCleaningImage, setIsCleaningImage] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [assignmentDrafts, setAssignmentDrafts] = useState<AssignmentDraft[]>(() => {
    const availableSpecialistIds = new Set(specialists.map((item) => item.id));
    const activeIds = new Set(service?.assignments
      .filter((item) => item.isActive && availableSpecialistIds.has(item.specialistId))
      .map((item) => item.specialistId) ?? []);
    return specialists.map((specialist) => createAssignmentDraft(
      specialist.id,
      specialist.name,
      service?.assignments.find((item) => item.specialistId === specialist.id) ?? null,
      activeIds.has(specialist.id),
      true,
    ));
  });
  const specialistIds = assignmentDrafts.filter((draft) => draft.enabled).map((draft) => draft.specialistId);
  const setAllSpecialists = (enabled: boolean) => setAssignmentDrafts((current) => current.map((draft) => ({ ...draft, enabled })));

  const parsedPrice = Number(basePrice);
  const parsedDuration = Number(baseDurationMinutes);
  const nameInvalid = !name.trim() || name.trim().length > MAX_NAME_LENGTH;
  const descriptionInvalid = description.length > MAX_DESCRIPTION_LENGTH;
  const priceInvalid = basePrice === '' || !Number.isInteger(parsedPrice) || parsedPrice < 0 || parsedPrice > MAX_PRICE;
  const durationInvalid = baseDurationMinutes === '' || !Number.isInteger(parsedDuration)
    || parsedDuration < MIN_DURATION || parsedDuration > MAX_DURATION;
  const formInvalid = nameInvalid || descriptionInvalid || priceInvalid || durationInvalid
    || hasInvalidAssignmentDrafts(assignmentDrafts);

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
      setImageError(t('services.errors.imageCleanup'));
      return false;
    } finally {
      setIsCleaningImage(false);
    }
  };

  const handleUploaded = async (media: ServiceImageMedia, objectUrl: string) => {
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
    setImageMediaId(media.id);
    setImageUrl(objectUrl);
    setImageChanged(true);
  };

  const handleRemoveImage = async () => {
    if (pendingImage && !(await cleanupPendingImage(pendingImage))) {
      return;
    }
    setImageError('');
    setImageMediaId(null);
    setImageUrl(null);
    setImageChanged(true);
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
    if (formInvalid || isUploadingImage) {
      return;
    }

    const saved = await onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      basePrice: parsedPrice,
      baseDurationMinutes: parsedDuration,
      firstSessionFree,
      ...(!service || imageChanged ? { imageMediaId } : {}),
      isActive,
      specialistIds,
    }, getChangedAssignmentDrafts(assignmentDrafts, { includeAvailability: false }).map((draft) => ({
      specialistId: draft.specialistId,
      ...toAssignmentPayload(draft),
    })));
    if (saved) {
      if (pendingImage) {
        URL.revokeObjectURL(pendingImage.objectUrl);
      }
      setPendingImage(null);
      onClose();
    }
  };

  const currentImage = pendingImage?.media ?? (imageUrl ? { url: imageUrl, alt: name } : null);
  const isImageBusy = isCleaningImage || isUploadingImage;

  return (
    <AppDialog
      open={open}
      onClose={isSaving || isImageBusy ? undefined : () => void handleClose()}
      maxWidth="md"
      title={service ? t('services.editTitle') : t('services.createTitle')}
      description={t('services.formDescription')}
      actions={(
        <>
          <AppButton variant="text" onClick={() => void handleClose()} disabled={isSaving || isImageBusy}>
            {t('common.cancel')}
          </AppButton>
          <AppButton
            type="submit"
            form={FORM_ID}
            isLoading={isSaving}
            disabled={isImageBusy || !name.trim()}
          >
            {t('services.save')}
          </AppButton>
        </>
      )}
    >
      <Box component="form" id={FORM_ID} onSubmit={(event) => void submit(event)} noValidate>
        <FormContainer>
          {saveError ? <AppStatusMessage severity="error" message={saveError} /> : null}
          {imageError ? <AppStatusMessage severity="error" message={imageError} /> : null}

          <Box className="service-form__main">
            <Stack className="service-form__column">
              <AppTextField
                required
                label={t('services.name')}
                value={name}
                error={hasSubmitted && nameInvalid}
                helperText={hasSubmitted && nameInvalid ? t('services.nameError') : `${name.length}/${MAX_NAME_LENGTH}`}
                slotProps={{ htmlInput: { maxLength: MAX_NAME_LENGTH } }}
                onChange={(event) => setName(event.target.value)}
              />
              <AppTextField
                multiline
                minRows={5}
                label={t('services.description')}
                value={description}
                error={hasSubmitted && descriptionInvalid}
                helperText={hasSubmitted && descriptionInvalid ? t('services.descriptionError') : `${description.length}/${MAX_DESCRIPTION_LENGTH}`}
                slotProps={{ htmlInput: { maxLength: MAX_DESCRIPTION_LENGTH } }}
                onChange={(event) => setDescription(event.target.value)}
              />
              <AppImageUpload<ServiceImageMedia>
                key={imageMediaId ?? imageUrl ?? 'empty'}
                label={t('services.image')}
                image={currentImage}
                previewUrl={pendingImage?.objectUrl ?? imageUrl ?? undefined}
                uploadImage={onUploadImage}
                onUploaded={handleUploaded}
                onRemoved={handleRemoveImage}
                uploadLabel={t('services.uploadImage')}
                replaceLabel={t('services.replaceImage')}
                removeLabel={t('services.removeImage')}
                invalidTypeText={t('services.invalidImageType')}
                tooLargeText={t('services.imageTooLarge')}
                uploadErrorText={t('services.errors.imageUpload')}
                defaultAlt={name.trim()}
                disabled={isSaving || isImageBusy}
                onBusyChange={setIsUploadingImage}
              />
            </Stack>

            <Stack className="service-form__column">
              <AppTextField
                required
                type="number"
                label={t('services.price')}
                value={basePrice}
                error={hasSubmitted && priceInvalid}
                helperText={hasSubmitted && priceInvalid ? t('services.priceError') : t('services.priceHelper')}
                slotProps={{ htmlInput: { min: 0, max: MAX_PRICE, step: 1 } }}
                onChange={(event) => setBasePrice(event.target.value)}
              />
              <AppTextField
                required
                type="number"
                label={t('services.duration')}
                value={baseDurationMinutes}
                error={hasSubmitted && durationInvalid}
                helperText={hasSubmitted && durationInvalid ? t('services.durationError') : t('services.durationHelper')}
                slotProps={{ htmlInput: { min: MIN_DURATION, max: MAX_DURATION, step: 1 } }}
                onChange={(event) => setBaseDurationMinutes(event.target.value)}
              />
              <FormControlLabel
                control={<Checkbox checked={firstSessionFree} onChange={(event) => setFirstSessionFree(event.target.checked)} />}
                label={t('services.firstSessionFree')}
              />
              <FormControlLabel
                control={<Checkbox checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />}
                label={t('services.active')}
              />
            </Stack>
          </Box>

          <Stack className="service-form__specialists">
            <AppSectionHeader
              title={t('services.specialistsTitle')}
              description={t('services.assignmentsHelper')}
              action={specialists.length ? (
                <Stack direction="row" className="service-form__selector-actions">
                  <AppButton size="small" variant="text" onClick={() => setAllSpecialists(true)}>
                    {t('services.selectAll')}
                  </AppButton>
                  <AppButton size="small" variant="text" onClick={() => setAllSpecialists(false)}>
                    {t('services.clear')}
                  </AppButton>
                </Stack>
              ) : null}
            />
            {specialists.length ? (
              <ServiceAssignmentsEditor
                drafts={assignmentDrafts}
                basePrice={priceInvalid ? 0 : parsedPrice}
                baseDurationMinutes={durationInvalid ? 60 : parsedDuration}
                disabled={isSaving}
                onChange={setAssignmentDrafts}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">{t('services.noSpecialists')}</Typography>
            )}
          </Stack>
        </FormContainer>
      </Box>
    </AppDialog>
  );
}
