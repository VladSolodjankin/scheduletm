import { Button, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material';
import type { Dispatch } from 'react';
import type { EditorAction } from '../../features/public-page-builder/types/actions';
import type { EditorState } from '../../features/public-page-builder/types/editor';
import type { MediaReference, SectionLayout } from '../../features/public-page-builder/types/publicPage';
import type { ApiPublicPageRepository } from '../../features/public-page-builder/repository/ApiPublicPageRepository';
import { PUBLIC_PAGE_BACKGROUND_PRESETS } from '../../features/public-page-builder/config/backgroundPresets';
import { PUBLIC_PAGE_THEMES } from '../../features/public-page-builder/config/themes';
import { selectSelectedBlock, selectSelectedSection } from '../../features/public-page-builder/model/selectors';
import { getBlockDefinition } from '../../features/public-page-builder/model/blockRegistry';
import { validateSlug } from '../../features/public-page-builder/model/slug';
import type { Locale } from '../../shared/i18n/dictionaries';
import { ColorControl } from './ColorControl';
import { publicPageText } from './uiText';
import { ImageUploadControl } from './ImageUploadControl';

const layouts: SectionLayout[] = [
  'single', 'two-equal', 'one-third-two-thirds', 'two-thirds-one-third',
  'three-equal', 'stack', 'hero-overlay',
];

export function InspectorPanel({
  state,
  locale,
  dispatch,
  repository,
  previewUrls,
  onMediaPreview,
}: {
  state: EditorState;
  locale: Locale;
  dispatch: Dispatch<EditorAction>;
  repository: ApiPublicPageRepository;
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
          <MenuItem value="cover">cover</MenuItem><MenuItem value="contain">contain</MenuItem>
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
  return (
    <Stack spacing={2}>
      <Typography variant="h6">{publicPageText(locale, 'page')}</Typography>
      <TextField label={publicPageText(locale, 'displayName')} value={state.document.profile.displayName}
        onChange={(event) => dispatch({ type: 'profile/update', changes: { displayName: event.target.value } })} />
      <TextField multiline label={publicPageText(locale, 'profileDescription')} value={state.document.profile.description}
        onChange={(event) => dispatch({ type: 'profile/update', changes: { description: event.target.value } })} />
      {(['logoMediaId', 'avatarMediaId'] as const).map((field) => <ImageUploadControl key={field}
        label={publicPageText(locale, field === 'logoMediaId' ? 'logo' : 'avatar')} media={mediaFor(state.document.profile[field])}
        previewUrl={state.document.profile[field] ? previewUrls.get(state.document.profile[field]!) : undefined}
        repository={repository} {...uploadLabels}
        onAltChange={(media) => dispatch({ type: 'media/add', media })}
        onUploaded={(media, url) => { const previous = state.document.profile[field]; addMedia(media, url); dispatch({ type: 'profile/update', changes: { [field]: media.id } }); cleanupPreviousMedia(previous); }}
        onRemoved={() => { const previous = state.document.profile[field]; dispatch({ type: 'profile/update', changes: { [field]: null } }); cleanupPreviousMedia(previous); }} />)}
      <TextField label={publicPageText(locale, 'title')} value={state.document.seo.title} onChange={(event) => dispatch({ type: 'seo/update', changes: { title: event.target.value } })} />
      <TextField multiline label={publicPageText(locale, 'description')} value={state.document.seo.description} onChange={(event) => dispatch({ type: 'seo/update', changes: { description: event.target.value } })} />
      <TextField
        label={publicPageText(locale, 'slug')}
        value={state.document.slug}
        error={Boolean(slugError)}
        helperText={slugError ? publicPageText(locale, 'invalidSlug') : `meetli.cc/${state.document.slug}`}
        onChange={(event) => dispatch({ type: 'slug/update', slug: event.target.value })}
      />
      <TextField
        select
        label={publicPageText(locale, 'theme')}
        value={state.document.theme.id}
        onChange={(event) => {
          const theme = PUBLIC_PAGE_THEMES.find((candidate) => candidate.id === event.target.value);
          if (theme) {dispatch({ type: 'theme/update', theme });}
        }}
      >
        {PUBLIC_PAGE_THEMES.map((theme) => <MenuItem key={theme.id} value={theme.id}>{theme.name}</MenuItem>)}
      </TextField>
      <TextField select label={publicPageText(locale, 'font')} value={state.document.theme.fontFamily}
        onChange={(event) => dispatch({ type: 'theme/update', theme: { ...state.document.theme, fontFamily: event.target.value } })}>
        {['Inter, system-ui, sans-serif', 'Arial, sans-serif', 'Georgia, serif', 'Verdana, sans-serif', 'Trebuchet MS, sans-serif', 'system-ui, sans-serif'].map((font) => <MenuItem key={font} value={font}>{font.split(',')[0]}</MenuItem>)}
      </TextField>
      {(['background', 'surface', 'text', 'primary'] as const).map((color) => <ColorControl key={color}
        label={`${publicPageText(locale, 'pageColor')}: ${color}`} value={state.document.theme.colors[color]}
        onChange={(value) => value && dispatch({ type: 'theme/update', theme: { ...state.document.theme, colors: { ...state.document.theme.colors, [color]: value } } })} />)}
      <TextField select label={publicPageText(locale, 'backgroundPreset')} value={state.document.theme.backgroundPreset ?? 'none'}
        onChange={(event) => dispatch({ type: 'theme/update', theme: { ...state.document.theme, backgroundPreset: event.target.value === 'none' ? null : event.target.value } })}>
        {PUBLIC_PAGE_BACKGROUND_PRESETS.map((preset) => <MenuItem key={preset.id} value={preset.id}>{preset.id}</MenuItem>)}
      </TextField>
      <ImageUploadControl label={publicPageText(locale, 'pageBackground')} media={mediaFor(state.document.theme.backgroundMediaId)}
        previewUrl={state.document.theme.backgroundMediaId ? previewUrls.get(state.document.theme.backgroundMediaId) : undefined}
        repository={repository} {...uploadLabels}
        onAltChange={(media) => dispatch({ type: 'media/add', media })}
        onUploaded={(media, url) => { const previous = state.document.theme.backgroundMediaId; addMedia(media, url); dispatch({ type: 'theme/update', theme: { ...state.document.theme, backgroundMediaId: media.id } }); cleanupPreviousMedia(previous); }}
        onRemoved={() => { const previous = state.document.theme.backgroundMediaId; dispatch({ type: 'theme/update', theme: { ...state.document.theme, backgroundMediaId: null } }); cleanupPreviousMedia(previous); }} />
    </Stack>
  );
}
