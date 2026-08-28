import { Button, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material';
import type { Dispatch } from 'react';
import type { EditorAction } from '../../features/public-page-builder/types/actions';
import type { EditorState } from '../../features/public-page-builder/types/editor';
import type { MediaReference, SectionLayout } from '../../features/public-page-builder/types/publicPage';
import type { ApiPublicPageRepository } from '../../features/public-page-builder/repository/ApiPublicPageRepository';
import { selectSelectedBlock, selectSelectedSection } from '../../features/public-page-builder/model/selectors';
import { getBlockDefinition } from '../../features/public-page-builder/model/blockRegistry';
import {
  normalizeSlug,
  validateSlug,
  type SlugAvailabilityState,
} from '../../features/public-page-builder/model/slug';
import type { Locale } from '../../shared/i18n/dictionaries';
import { ColorControl } from './ColorControl';
import { publicPageText } from './uiText';
import { ImageUploadControl } from './ImageUploadControl';
import { applyPublicPageThemeColors } from '../../features/public-page-builder/config/themes';
import { publicPageDisplayUrl } from '../../features/public-page-builder/config/publicPageUrl';
import { analyzeBlockContrast, analyzePageContrast } from '../../features/public-page-builder/model/contrast';
import { ContrastGuidance } from './ContrastGuidance';

const layouts: SectionLayout[] = [
  'single', 'two-equal', 'one-third-two-thirds', 'two-thirds-one-third',
  'three-equal', 'stack', 'hero-overlay',
];

export function InspectorPanel({
  state,
  locale,
  dispatch,
  repository,
  slugAvailability,
  previewUrls,
  onMediaPreview,
}: {
  state: EditorState;
  locale: Locale;
  dispatch: Dispatch<EditorAction>;
  repository: ApiPublicPageRepository;
  slugAvailability: SlugAvailabilityState;
  previewUrls: ReadonlyMap<string, string>;
  onMediaPreview: (media: MediaReference, objectUrl: string) => void;
}) {
  const uploadLabels = {
    uploadLabel: publicPageText(locale, 'uploadImage'), replaceLabel: publicPageText(locale, 'replaceImage'),
    removeLabel: publicPageText(locale, 'remove'), altLabel: publicPageText(locale, 'imageAlt'),
    invalidTypeText: publicPageText(locale, 'invalidImageType'), tooLargeText: publicPageText(locale, 'imageTooLarge'),
    uploadErrorText: publicPageText(locale, 'imageUploadError'),
  };
  const mediaFor = (id: string | null) => state.document.media.find((media) => media.id === id) ?? null;
  const addMedia = (media: MediaReference, objectUrl: string) => {
    dispatch({ type: 'media/add', media }); onMediaPreview(media, objectUrl);
  };
  const cleanupPreviousMedia = (mediaId: string | null) => {
    if (mediaId) {dispatch({ type: 'media/remove', mediaId });}
  };
  const section = selectSelectedSection(state);
  const block = selectSelectedBlock(state);
  if (block && section) {
    const BlockEditor = getBlockDefinition(block.type)?.Editor;
    return (
      <Stack spacing={2}>
        <Typography variant="h6">{publicPageText(locale, 'block')}</Typography>
        <TextField
          size="small"
          label={publicPageText(locale, 'name')}
          value={block.name}
          onChange={(event) => dispatch({ type: 'block/update', sectionId: section.id, blockId: block.id, changes: { name: event.target.value } })}
        />
        <FormControlLabel
          label={publicPageText(locale, 'visible')}
          control={<Switch checked={block.visible} onChange={() => dispatch({ type: 'block/toggle', sectionId: section.id, blockId: block.id })} />}
        />
        <ColorControl
          label={publicPageText(locale, 'background')}
          value={block.design.backgroundColor}
          onChange={(value) => dispatch({ type: 'block/design', sectionId: section.id, blockId: block.id, changes: { backgroundColor: value } })}
        />
        <ImageUploadControl label={publicPageText(locale, 'blockBackground')} media={mediaFor(block.design.backgroundMediaId)}
          previewUrl={block.design.backgroundMediaId ? previewUrls.get(block.design.backgroundMediaId) : undefined}
          repository={repository} {...uploadLabels}
          onAltChange={(media) => dispatch({ type: 'media/add', media })}
          onUploaded={(media, url) => { const previous = block.design.backgroundMediaId; addMedia(media, url); dispatch({ type: 'block/design', sectionId: section.id, blockId: block.id, changes: { backgroundMediaId: media.id } }); cleanupPreviousMedia(previous); }}
          onRemoved={() => { const previous = block.design.backgroundMediaId; dispatch({ type: 'block/design', sectionId: section.id, blockId: block.id, changes: { backgroundMediaId: null } }); cleanupPreviousMedia(previous); }} />
        <TextField type="number" size="small" label={publicPageText(locale, 'overlay')}
          slotProps={{ htmlInput: { min: 0, max: 100 } }} value={Math.round(block.design.backgroundOverlay * 100)}
          onChange={(event) => dispatch({ type: 'block/design', sectionId: section.id, blockId: block.id, changes: { backgroundOverlay: Number(event.target.value) / 100 } })} />
        <TextField select size="small" label={publicPageText(locale, 'imageFit')} value={block.design.backgroundFit}
          onChange={(event) => dispatch({ type: 'block/design', sectionId: section.id, blockId: block.id, changes: { backgroundFit: event.target.value as 'cover' | 'contain' } })}>
          <MenuItem value="cover">{publicPageText(locale, 'imageFitCover')}</MenuItem>
          <MenuItem value="contain">{publicPageText(locale, 'imageFitContain')}</MenuItem>
        </TextField>
        <TextField size="small" label={publicPageText(locale, 'focalPoint')} value={block.design.backgroundPosition}
          onChange={(event) => dispatch({ type: 'block/design', sectionId: section.id, blockId: block.id, changes: { backgroundPosition: event.target.value } })} />
        <ColorControl
          label={publicPageText(locale, 'textColor')}
          value={block.design.textColor}
          onChange={(value) => dispatch({ type: 'block/design', sectionId: section.id, blockId: block.id, changes: { textColor: value } })}
        />
        {BlockEditor ? (
          <BlockEditor
            block={block}
            onContentChange={(content) => dispatch({
              type: 'block/update',
              sectionId: section.id,
              blockId: block.id,
              changes: { content },
            })}
          />
        ) : null}
        <Button onClick={() => dispatch({ type: 'block/design', sectionId: section.id, blockId: block.id, changes: { backgroundColor: null, textColor: null } })}>
          {publicPageText(locale, 'theme')}
        </Button>
        {block.design.backgroundColor || block.design.backgroundMediaId || block.design.textColor
          ? <ContrastGuidance locale={locale} checks={analyzeBlockContrast(state.document.theme, section, block)} />
          : null}
      </Stack>
    );
  }
  if (section) {
    return (
      <Stack spacing={2}>
        <Typography variant="h6">{publicPageText(locale, 'section')}</Typography>
        <TextField size="small" label={publicPageText(locale, 'name')} value={section.name} onChange={(event) => dispatch({ type: 'section/update', sectionId: section.id, changes: { name: event.target.value } })} />
        <TextField select size="small" value={section.layout} onChange={(event) => dispatch({ type: 'section/update', sectionId: section.id, changes: { layout: event.target.value as SectionLayout } })}>
          {layouts.map((layout) => <MenuItem key={layout} value={layout}>{layout}</MenuItem>)}
        </TextField>
      </Stack>
    );
  }
  const slugError = validateSlug(state.document.slug);
  const canonicalSlug = normalizeSlug(state.document.slug);
  const slugAvailabilityStatus = slugAvailability.slug === canonicalSlug ? slugAvailability.status : 'idle';
  const slugHelperText = slugError
    ? publicPageText(locale, 'invalidSlug')
    : slugAvailabilityStatus === 'checking'
      ? publicPageText(locale, 'slugChecking')
      : slugAvailabilityStatus === 'available'
        ? `${publicPageText(locale, 'slugAvailable')} · ${publicPageDisplayUrl(canonicalSlug)}`
        : slugAvailabilityStatus === 'unavailable'
          ? publicPageText(locale, 'slugUnavailable')
          : slugAvailabilityStatus === 'error'
            ? publicPageText(locale, 'slugCheckError')
            : publicPageDisplayUrl(canonicalSlug);
  return (
    <Stack spacing={2}>
      <Typography variant="h6">{publicPageText(locale, 'page')}</Typography>
      <TextField label={publicPageText(locale, 'displayName')} value={state.document.profile.displayName}
        slotProps={{ htmlInput: { 'data-public-page-focus': 'profile.displayName' } }}
        onChange={(event) => dispatch({ type: 'profile/update', changes: { displayName: event.target.value } })} />
      <TextField multiline label={publicPageText(locale, 'profileDescription')} value={state.document.profile.description}
        slotProps={{ htmlInput: { 'data-public-page-focus': 'profile.description' } }}
        onChange={(event) => dispatch({ type: 'profile/update', changes: { description: event.target.value } })} />
      {(['logoMediaId', 'avatarMediaId'] as const).map((field) => <ImageUploadControl key={field}
        focusMarker={`profile.${field}`}
        altFocusMarker={state.document.profile[field] ? `media:${state.document.profile[field]}:alt` : undefined}
        label={publicPageText(locale, field === 'logoMediaId' ? 'logo' : 'avatar')} media={mediaFor(state.document.profile[field])}
        previewUrl={state.document.profile[field] ? previewUrls.get(state.document.profile[field]!) : undefined}
        repository={repository} {...uploadLabels}
        onAltChange={(media) => dispatch({ type: 'media/add', media })}
        onUploaded={(media, url) => { const previous = state.document.profile[field]; addMedia(media, url); dispatch({ type: 'profile/update', changes: { [field]: media.id } }); cleanupPreviousMedia(previous); }}
        onRemoved={() => { const previous = state.document.profile[field]; dispatch({ type: 'profile/update', changes: { [field]: null } }); cleanupPreviousMedia(previous); }} />)}
      <TextField label={publicPageText(locale, 'title')} value={state.document.seo.title}
        slotProps={{ htmlInput: { 'data-public-page-focus': 'seo.title' } }}
        onChange={(event) => dispatch({ type: 'seo/update', changes: { title: event.target.value } })} />
      <TextField multiline label={publicPageText(locale, 'description')} value={state.document.seo.description}
        slotProps={{ htmlInput: { 'data-public-page-focus': 'seo.description' } }}
        onChange={(event) => dispatch({ type: 'seo/update', changes: { description: event.target.value } })} />
      <TextField
        label={publicPageText(locale, 'slug')}
        value={state.document.slug}
        slotProps={{ htmlInput: { 'data-public-page-focus': 'slug' } }}
        error={Boolean(slugError) || slugAvailabilityStatus === 'unavailable'}
        helperText={slugHelperText}
        onChange={(event) => dispatch({ type: 'slug/update', slug: event.target.value })}
      />
      {(['background', 'surface', 'text', 'primary'] as const).map((color) => <ColorControl key={color}
        label={`${publicPageText(locale, 'pageColor')}: ${color}`} value={state.document.theme.colors[color]}
        presetColors={[...state.document.theme.swatches]}
        onChange={(value) => value && dispatch({ type: 'theme/update', theme: applyPublicPageThemeColors(state.document.theme, { [color]: value }) })} />)}
      <ContrastGuidance locale={locale} checks={analyzePageContrast(state.document.theme)} />
    </Stack>
  );
}
