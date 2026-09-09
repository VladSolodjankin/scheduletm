import { CloudDone, ErrorOutlined, Redo, Undo } from '@mui/icons-material';
import { Alert, Box, Button, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import type { ReactNode } from 'react';
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
  title: string;
  pageActions: ReactNode;
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
    <Stack spacing={1}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', minHeight: props.compact ? 0 : 48 }}>
        <Stack sx={{ alignItems: 'flex-start', flex: props.compact ? '1 1 100%' : '1 1 180px', minWidth: 0 }}>
          <Typography noWrap title={props.title} sx={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, maxWidth: '100%' }}>{props.title}</Typography>
          <Chip
            size="small"
            aria-label={statusLabel}
            color={saveStatus === 'error' ? 'error' : saveStatus === 'saving' ? 'default' : 'success'}
            icon={saveStatus === 'error' ? <ErrorOutlined /> : <CloudDone />}
            label={statusLabel}
            sx={{ flexShrink: 0, fontSize: 12, height: 18, bgcolor: 'transparent', color: saveStatus === 'error' ? 'error.main' : 'text.secondary', '& .MuiChip-label': { px: 0.5 }, '& .MuiChip-icon': { ml: 0, fontSize: 14, color: 'inherit' } }}
          />
        </Stack>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
          <Tooltip title={publicPageText(locale, 'undo')}><span><IconButton aria-label={publicPageText(locale, 'undo')} disabled={!props.canUndo} onClick={props.onUndo}><Undo /></IconButton></span></Tooltip>
          <Tooltip title={publicPageText(locale, 'redo')}><span><IconButton aria-label={publicPageText(locale, 'redo')} disabled={!props.canRedo} onClick={props.onRedo}><Redo /></IconButton></span></Tooltip>
          <Button variant="outlined" disabled={saveStatus === 'saving' || props.isPublishing || props.isSlugUnavailable} onClick={props.onSave}>{publicPageText(locale, 'save')}</Button>
          <Button variant="contained" disabled={saveStatus === 'saving' || props.isPublishing || props.isSlugUnavailable} onClick={props.onPublish}>{publicPageText(locale, 'publish')}</Button>
        </Stack>
        {props.pageActions}
      </Box>
      {props.hasPublishErrors ? <Alert severity="warning">{publicPageText(locale, 'validation')}</Alert> : null}
    </Stack>
  );
}
