import type { ApiPublicPageRepository } from '../../features/public-page-builder/repository/ApiPublicPageRepository';
import type { MediaReference } from '../../features/public-page-builder/types/publicPage';
import { AppImageUpload } from '../../shared/ui/AppImageUpload';

export function ImageUploadControl({ label, media, previewUrl, repository, onUploaded, onAltChange, onRemoved,
  uploadLabel, replaceLabel, removeLabel, altLabel, invalidTypeText, tooLargeText, uploadErrorText, compact = false, defaultAlt = '',
  focusMarker,
  altFocusMarker, disabled, onBusyChange,
}: {
  label: string; media: MediaReference | null; previewUrl?: string; repository: ApiPublicPageRepository;
  onUploaded: (media: MediaReference, objectUrl: string) => void | Promise<void>; onRemoved: () => void | Promise<void>;
  onAltChange: (media: MediaReference) => void;
  uploadLabel: string; replaceLabel: string; removeLabel: string; altLabel: string;
  invalidTypeText: string; tooLargeText: string; uploadErrorText: string;
  compact?: boolean; defaultAlt?: string;
  focusMarker?: string;
  altFocusMarker?: string;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  return (
    <AppImageUpload<MediaReference>
      key={media?.id ?? 'empty'}
      disabled={disabled}
      onBusyChange={onBusyChange}
      label={label}
      image={media}
      previewUrl={previewUrl}
      uploadImage={(file, onProgress) => repository.uploadMedia(file, onProgress)}
      onUploaded={onUploaded}
      onAltChange={onAltChange}
      onRemoved={onRemoved}
      uploadLabel={uploadLabel}
      replaceLabel={replaceLabel}
      removeLabel={removeLabel}
      altLabel={altLabel}
      invalidTypeText={invalidTypeText}
      tooLargeText={tooLargeText}
      uploadErrorText={uploadErrorText}
      compact={compact}
      defaultAlt={defaultAlt}
      focusMarker={focusMarker}
      altFocusMarker={altFocusMarker}
    />
  );
}
