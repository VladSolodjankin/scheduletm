import { CloudDone, ErrorOutlined, Redo, Save, Undo } from '@mui/icons-material';
import { Alert, Button, Chip, Stack } from '@mui/material';
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
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
      <Button startIcon={<Undo />} disabled={!props.canUndo} onClick={props.onUndo}>
        {publicPageText(locale, 'undo')}
      </Button>
      <Button startIcon={<Redo />} disabled={!props.canRedo} onClick={props.onRedo}>
        {publicPageText(locale, 'redo')}
      </Button>
      <Button startIcon={<Save />} disabled={saveStatus === 'saving' || props.isPublishing} onClick={props.onSave}>{publicPageText(locale, 'save')}</Button>
      <Chip
        size="small"
        color={saveStatus === 'error' ? 'error' : saveStatus === 'saving' ? 'default' : 'success'}
        icon={saveStatus === 'error' ? <ErrorOutlined /> : <CloudDone />}
        label={statusLabel}
      />
      <Button variant="contained" disabled={saveStatus === 'saving' || props.isPublishing} onClick={props.onPublish}>
        {publicPageText(locale, 'publish')}
      </Button>
      {props.hasPublishErrors ? <Alert severity="warning">{publicPageText(locale, 'validation')}</Alert> : null}
    </Stack>
  );
}
