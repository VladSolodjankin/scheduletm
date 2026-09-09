import DeleteRounded from '@mui/icons-material/DeleteRounded';
import UploadRounded from '@mui/icons-material/UploadRounded';
import { Alert, Box, LinearProgress, Stack, Typography } from '@mui/material';
import { useRef, useState } from 'react';
import { AppButton } from './AppButton';
import { AppTextField } from './AppTextField';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ACCEPT_ATTRIBUTE = 'image/jpeg,image/png,image/webp';

export type AppUploadedImage = {
  id: string;
  url: string;
  mimeType: string;
  alt: string;
  width: number;
  height: number;
};

type AppImageUploadProps<TImage extends AppUploadedImage> = {
  label: string;
  image: Pick<TImage, 'url' | 'alt'> | null;
  previewUrl?: string;
  uploadImage: (file: File, onProgress: (percent: number) => void) => Promise<TImage>;
  onUploaded: (image: TImage, objectUrl: string) => void | Promise<void>;
  onRemoved: () => void | Promise<void>;
  onAltChange?: (image: TImage) => void;
  uploadLabel: string;
  replaceLabel: string;
  removeLabel: string;
  altLabel?: string;
  invalidTypeText: string;
  tooLargeText: string;
  uploadErrorText: string;
  compact?: boolean;
  defaultAlt?: string;
  focusMarker?: string;
  altFocusMarker?: string;
  disabled?: boolean;
  onBusyChange?: (isBusy: boolean) => void;
};

export function AppImageUpload<TImage extends AppUploadedImage>({
  label,
  image,
  previewUrl,
  uploadImage,
  onUploaded,
  onRemoved,
  onAltChange,
  uploadLabel,
  replaceLabel,
  removeLabel,
  altLabel,
  invalidTypeText,
  tooLargeText,
  uploadErrorText,
  compact = false,
  defaultAlt = '',
  focusMarker,
  altFocusMarker,
  disabled = false,
  onBusyChange,
}: AppImageUploadProps<TImage>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [alt, setAlt] = useState(image?.alt || defaultAlt);
  const hasImage = Boolean(previewUrl || image?.url);

  const upload = async (file?: File) => {
    if (!file) {
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      setError(invalidTypeText);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(tooLargeText);
      return;
    }

    setError('');
    setProgress(0);
    onBusyChange?.(true);
    let objectUrl = '';
    try {
      const uploaded = await uploadImage(file, setProgress);
      const uploadedAlt = alt.trim() || uploaded.alt.trim() || defaultAlt.trim() || label.trim() || file.name;
      objectUrl = URL.createObjectURL(file);
      await onUploaded({ ...uploaded, alt: uploadedAlt }, objectUrl);
    } catch {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setError(uploadErrorText);
    } finally {
      onBusyChange?.(false);
      setProgress(null);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const imagePreview = hasImage ? (
    <Box
      component="img"
      src={previewUrl ?? image?.url}
      alt={alt}
      className={`app-image-upload__preview${compact ? ' app-image-upload__preview--compact' : ''}`}
    />
  ) : null;

  return (
    <Stack className={`app-image-upload${compact ? ' app-image-upload--compact' : ''}`}>
      <input
        ref={inputRef}
        hidden
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        disabled={disabled || progress !== null}
        onChange={(event) => void upload(event.target.files?.[0])}
      />

      {compact ? (
        <Stack className="app-image-upload--compact">
          <Stack className="app-image-upload__header">
            {label ? <Typography variant="subtitle2">{label}</Typography> : <Box />}
            <Stack className="app-image-upload__actions">
              {imagePreview}
              <AppButton
                size="small"
                variant="text"
                startIcon={<UploadRounded />}
                disabled={disabled || progress !== null}
                onClick={() => inputRef.current?.click()}
                data-public-page-focus={focusMarker}
              >
                {hasImage ? replaceLabel : uploadLabel}
              </AppButton>
              {hasImage ? (
                <AppButton
                  size="small"
                  variant="text"
                  color="error"
                  aria-label={removeLabel}
                  disabled={disabled || progress !== null}
                  onClick={() => void onRemoved()}
                  className="app-image-upload__remove-icon"
                >
                  <DeleteRounded fontSize="small" />
                </AppButton>
              ) : null}
            </Stack>
          </Stack>
          {hasImage && onAltChange && altLabel && image && 'id' in image ? (
            <AppTextField
              label={altLabel}
              value={alt}
              disabled={disabled}
              slotProps={{ htmlInput: { 'data-public-page-focus': altFocusMarker } }}
              onChange={(event) => setAlt(event.target.value)}
              onBlur={() => onAltChange({ ...image, alt: alt.trim() || defaultAlt.trim() || label.trim() } as TImage)}
            />
          ) : null}
        </Stack>
      ) : (
        <>
          <Typography variant="subtitle2">{label}</Typography>
          {imagePreview}
          {hasImage && onAltChange && altLabel && image && 'id' in image ? (
            <AppTextField
              label={altLabel}
              value={alt}
              disabled={disabled}
              slotProps={{ htmlInput: { 'data-public-page-focus': altFocusMarker } }}
              onChange={(event) => setAlt(event.target.value)}
              onBlur={() => onAltChange({ ...image, alt } as TImage)}
            />
          ) : null}
          <Stack className="app-image-upload__actions">
            <AppButton
              size="small"
              variant="outlined"
              startIcon={<UploadRounded />}
              disabled={disabled || progress !== null}
              onClick={() => inputRef.current?.click()}
              data-public-page-focus={focusMarker}
            >
              {hasImage ? replaceLabel : uploadLabel}
            </AppButton>
            {hasImage ? (
              <AppButton
                size="small"
                variant="text"
                color="error"
                startIcon={<DeleteRounded />}
                disabled={disabled || progress !== null}
                onClick={() => void onRemoved()}
              >
                {removeLabel}
              </AppButton>
            ) : null}
          </Stack>
        </>
      )}

      {progress !== null ? <LinearProgress variant="determinate" value={progress} /> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  );
}
