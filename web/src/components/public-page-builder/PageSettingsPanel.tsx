import { MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useRef, type Dispatch } from 'react';
import type { EditorAction } from '../../features/public-page-builder/types/actions';
import type { EditorState } from '../../features/public-page-builder/types/editor';
import { PUBLIC_PAGE_LOCALES, type MediaReference } from '../../features/public-page-builder/types/publicPage';
import type { ApiPublicPageRepository } from '../../features/public-page-builder/repository/ApiPublicPageRepository';
import { normalizeSlug, validateSlug, type SlugAvailabilityState } from '../../features/public-page-builder/model/slug';
import { publicPageDisplayUrl } from '../../features/public-page-builder/config/publicPageUrl';
import type { Locale } from '../../shared/i18n/dictionaries';
import { ImageUploadControl } from './ImageUploadControl';
import { PageDomainSettings } from './PageDomainSettings';
import { SettingsRow } from './SettingsRow';
import { translate } from '../../shared/i18n/translate';

/**
 * The few page settings that do not change how the page looks: its address and what search engines and
 * messengers show for it. Everything a visitor sees on the page itself is built from sections and blocks.
 */
export function PageSettingsPanel({ state, locale, dispatch, repository, slugAvailability, previewUrls, onMediaPreview, busy = false, onBusyChange }: {
  state: EditorState;
  locale: Locale;
  dispatch: Dispatch<EditorAction>;
  repository: ApiPublicPageRepository;
  slugAvailability: SlugAvailabilityState;
  previewUrls: ReadonlyMap<string, string>;
  onMediaPreview: (media: MediaReference, objectUrl: string) => void;
  busy?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const mountedRef = useRef(true);
  const repositoryRef = useRef(repository);
  useEffect(() => {repositoryRef.current = repository;}, [repository]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {mountedRef.current = false;};
  }, []);
  const { seo, slug, media } = state.document;
  const shareMedia = media.find((item) => item.id === seo.imageMediaId) ?? null;
  const sharePreviewUrl = shareMedia ? previewUrls.get(shareMedia.id) ?? shareMedia.url : undefined;
  const uploadLabels = {
    uploadLabel: translate(locale, 'publicPageBuilder.uploadImage'), replaceLabel: translate(locale, 'publicPageBuilder.replaceImage'),
    removeLabel: translate(locale, 'publicPageBuilder.remove'), altLabel: translate(locale, 'publicPageBuilder.imageAlt'),
    invalidTypeText: translate(locale, 'publicPageBuilder.invalidImageType'), tooLargeText: translate(locale, 'publicPageBuilder.imageTooLarge'),
    uploadErrorText: translate(locale, 'publicPageBuilder.imageUploadError'),
  };
  const slugError = validateSlug(slug);
  const canonicalSlug = normalizeSlug(slug);
  const slugStatus = slugAvailability.slug === canonicalSlug ? slugAvailability.status : 'idle';
  const slugProblem = Boolean(slugError) || slugStatus === 'unavailable';
  const slugHelperText = slugError
    ? translate(locale, 'publicPageBuilder.invalidSlug')
    : slugStatus === 'checking'
      ? translate(locale, 'publicPageBuilder.slugChecking')
      : slugStatus === 'available'
        ? `${translate(locale, 'publicPageBuilder.slugAvailable')} · ${publicPageDisplayUrl(canonicalSlug)}`
        : slugStatus === 'unavailable'
          ? translate(locale, 'publicPageBuilder.slugUnavailable')
          : slugStatus === 'error'
            ? translate(locale, 'publicPageBuilder.slugCheckError')
            : publicPageDisplayUrl(canonicalSlug);
  return (
    <Stack component="fieldset" disabled={busy} spacing={2} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
      <Stack spacing={0.5}>
        <SettingsRow label={translate(locale, 'publicPageBuilder.slug')}>
          <TextField size="small" value={slug} sx={{ width: { xs: 160, sm: 220 } }} error={slugProblem}
            slotProps={{ htmlInput: { 'aria-label': translate(locale, 'publicPageBuilder.slug'), 'data-public-page-focus': 'slug' } }}
            onChange={(event) => dispatch({ type: 'slug/update', slug: event.target.value })} />
        </SettingsRow>
        <Typography variant="caption" color={slugProblem ? 'error' : 'text.secondary'} sx={{ textAlign: 'right' }}>{slugHelperText}</Typography>
      </Stack>
      <SettingsRow label={translate(locale, 'publicPageBuilder.pageLanguage')}>
        <TextField select size="small" value={state.document.locale} sx={{ width: { xs: 160, sm: 220 } }}
          slotProps={{ htmlInput: { 'aria-label': translate(locale, 'publicPageBuilder.pageLanguage') } }}
          onChange={(event) => dispatch({ type: 'locale/update', locale: event.target.value as typeof PUBLIC_PAGE_LOCALES[number] })}>
          {PUBLIC_PAGE_LOCALES.map((code) => (
            <MenuItem key={code} value={code}>{translate(locale, `publicPageBuilder.${code === 'ru' ? 'languageRu' : 'languageEn'}`)}</MenuItem>
          ))}
        </TextField>
      </SettingsRow>
      <SettingsRow label={translate(locale, 'publicPageBuilder.title')}>
        <TextField size="small" value={seo.title} sx={{ width: { xs: 160, sm: 220 } }}
          slotProps={{ htmlInput: { 'aria-label': translate(locale, 'publicPageBuilder.title'), 'data-public-page-focus': 'seo.title' } }}
          onChange={(event) => dispatch({ type: 'seo/update', changes: { title: event.target.value } })} />
      </SettingsRow>
      <TextField multiline label={translate(locale, 'publicPageBuilder.description')} value={seo.description}
        slotProps={{ htmlInput: { 'data-public-page-focus': 'seo.description' } }}
        onChange={(event) => dispatch({ type: 'seo/update', changes: { description: event.target.value } })} />
      <ImageUploadControl compact disabled={busy} onBusyChange={onBusyChange}
        focusMarker="seo.imageMediaId" altFocusMarker={seo.imageMediaId ? `media:${seo.imageMediaId}:alt` : undefined}
        label={translate(locale, 'publicPageBuilder.previewImage')} media={shareMedia} previewUrl={sharePreviewUrl}
        repository={repository} {...uploadLabels}
        onAltChange={(updatedMedia) => dispatch({ type: 'media/add', media: updatedMedia })}
        onUploaded={async (uploadedMedia, url) => {
          if (!mountedRef.current) {
            try {await repositoryRef.current.deleteMedia(uploadedMedia.id);}
            finally {URL.revokeObjectURL(url);}
            return;
          }
          const previous = seo.imageMediaId;
          dispatch({ type: 'media/add', media: uploadedMedia });
          onMediaPreview(uploadedMedia, url);
          dispatch({ type: 'seo/update', changes: { imageMediaId: uploadedMedia.id } });
          if (previous) {dispatch({ type: 'media/remove', mediaId: previous });}
        }}
        onRemoved={() => {
          const previous = seo.imageMediaId;
          dispatch({ type: 'seo/update', changes: { imageMediaId: null } });
          if (previous) {dispatch({ type: 'media/remove', mediaId: previous });}
        }} />
      <PageDomainSettings pageId={state.document.id} locale={locale} repository={repository} />
    </Stack>
  );
}
