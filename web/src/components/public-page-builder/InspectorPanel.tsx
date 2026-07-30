import { Button, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material';
import type { Dispatch } from 'react';
import type { EditorAction } from '../../features/public-page-builder/types/actions';
import type { EditorState } from '../../features/public-page-builder/types/editor';
import type { SectionLayout } from '../../features/public-page-builder/types/publicPage';
import { PUBLIC_PAGE_THEMES } from '../../features/public-page-builder/config/themes';
import { selectSelectedBlock, selectSelectedSection } from '../../features/public-page-builder/model/selectors';
import { getBlockDefinition } from '../../features/public-page-builder/model/blockRegistry';
import { validateSlug } from '../../features/public-page-builder/model/slug';
import type { Locale } from '../../shared/i18n/dictionaries';
import { ColorControl } from './ColorControl';
import { publicPageText } from './uiText';

const layouts: SectionLayout[] = [
  'single', 'two-equal', 'one-third-two-thirds', 'two-thirds-one-third',
  'three-equal', 'stack', 'hero-overlay',
];

export function InspectorPanel({
  state,
  locale,
  dispatch,
}: {
  state: EditorState;
  locale: Locale;
  dispatch: Dispatch<EditorAction>;
}) {
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
    </Stack>
  );
}
