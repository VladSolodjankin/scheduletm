import { CloudDone, ErrorOutlined, Publish as PublishIcon, Redo, Save, Undo } from '@mui/icons-material';
import { Alert, Button, Chip, IconButton, Stack, Tooltip } from '@mui/material';
import type { Locale } from '../../shared/i18n/dictionaries';
import type { EditorSaveStatus } from '../../features/public-page-builder/types/editor';
import { publicPageText } from './uiText';

export function BuilderToolbar(props: {
  locale: Locale;
  saveStatus: EditorSaveStatus;
  isPublishing: boolean;
  canUndo: boolean;
  canRedo: boolean;
  hasPublishErrors: boolean;
  isSlugUnavailable: boolean;
  compact?: boolean;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onPublish: () => void;
}) {
  const { locale, saveStatus } = props;
  const statusLabel = saveStatus === 'saving'
    ? publicPageText(locale, 'saving')
    : saveStatus === 'error'
      ? publicPageText(locale, 'saveError')
      : publicPageText(locale, 'saved');
  if (!props.compact) {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Button startIcon={<Undo />} disabled={!props.canUndo} onClick={props.onUndo}>
          {publicPageText(locale, 'undo')}
        </Button>
        <Button startIcon={<Redo />} disabled={!props.canRedo} onClick={props.onRedo}>
          {publicPageText(locale, 'redo')}
        </Button>
        <Button startIcon={<Save />} disabled={saveStatus === 'saving' || props.isPublishing || props.isSlugUnavailable} onClick={props.onSave}>{publicPageText(locale, 'save')}</Button>
        <Chip
          size="small"
          color={saveStatus === 'error' ? 'error' : saveStatus === 'saving' ? 'default' : 'success'}
          icon={saveStatus === 'error' ? <ErrorOutlined /> : <CloudDone />}
          label={statusLabel}
        />
        <Button variant="contained" disabled={saveStatus === 'saving' || props.isPublishing || props.isSlugUnavailable} onClick={props.onPublish}>
          {publicPageText(locale, 'publish')}
        </Button>
        {props.hasPublishErrors ? <Alert severity="warning">{publicPageText(locale, 'validation')}</Alert> : null}
      </Stack>
    );
  }
  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Tooltip title={publicPageText(locale, 'undo')}><span><IconButton size="small" aria-label={publicPageText(locale, 'undo')} disabled={!props.canUndo} onClick={props.onUndo}><Undo /></IconButton></span></Tooltip>
        <Tooltip title={publicPageText(locale, 'redo')}><span><IconButton size="small" aria-label={publicPageText(locale, 'redo')} disabled={!props.canRedo} onClick={props.onRedo}><Redo /></IconButton></span></Tooltip>
        <Tooltip title={publicPageText(locale, 'save')}><span><IconButton size="small" aria-label={publicPageText(locale, 'save')} disabled={saveStatus === 'saving' || props.isPublishing || props.isSlugUnavailable} onClick={props.onSave}><Save /></IconButton></span></Tooltip>
        <Tooltip title={statusLabel}>
          <Chip
            size="small"
            aria-label={statusLabel}
            color={saveStatus === 'error' ? 'error' : saveStatus === 'saving' ? 'default' : 'success'}
            icon={saveStatus === 'error' ? <ErrorOutlined /> : <CloudDone />}
            label={statusLabel}
          />
        </Tooltip>
        <Tooltip title={publicPageText(locale, 'publish')}><span><IconButton color="primary" aria-label={publicPageText(locale, 'publish')} disabled={saveStatus === 'saving' || props.isPublishing || props.isSlugUnavailable} onClick={props.onPublish}><PublishIcon /></IconButton></span></Tooltip>
      </Stack>
      {props.hasPublishErrors ? <Alert severity="warning">{publicPageText(locale, 'validation')}</Alert> : null}
    </Stack>
  );
}
