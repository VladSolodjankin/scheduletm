import CloudDone from '@mui/icons-material/CloudDone';
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined';
import ErrorOutlined from '@mui/icons-material/ErrorOutlined';
import PublishOutlined from '@mui/icons-material/PublishOutlined';
import Redo from '@mui/icons-material/Redo';
import SaveOutlined from '@mui/icons-material/SaveOutlined';
import Undo from '@mui/icons-material/Undo';
import { Alert, Box, Button, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import type { Locale } from '../../shared/i18n/dictionaries';
import type { EditorSaveStatus } from '../../features/public-page-builder/types/editor';
import { publicPageText } from './uiText';

export function BuilderToolbar(props: {
  locale: Locale;
  saveStatus: EditorSaveStatus;
  dirty: boolean;
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
      : publicPageText(locale, props.dirty ? 'unsaved' : 'saved');
  const isBusy = saveStatus === 'saving' || props.isPublishing || props.isSlugUnavailable;
  const compactAction = (label: string, icon: ReactNode, onClick: () => void, disabled: boolean) => (
    <Tooltip title={label}>
      <span>
        <IconButton size="small" aria-label={label} disabled={disabled} onClick={onClick} sx={{ width: 40, height: 40 }}>
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
  return (
    <Stack spacing={1}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 }, minHeight: props.compact ? 0 : 48 }}>
        <Stack sx={{ alignItems: 'flex-start', flex: '1 1 auto', minWidth: 0 }}>
          <Typography noWrap title={props.title} sx={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, maxWidth: '100%' }}>{props.title}</Typography>
          <Chip
            size="small"
            aria-label={statusLabel}
            title={statusLabel}
            color={saveStatus === 'error' ? 'error' : props.dirty || saveStatus === 'saving' ? 'default' : 'success'}
            icon={saveStatus === 'error' ? <ErrorOutlined /> : props.dirty || saveStatus === 'saving' ? <CloudUploadOutlined /> : <CloudDone />}
            label={statusLabel}
            sx={{ flexShrink: 1, maxWidth: '100%', fontSize: 12, height: 18, bgcolor: 'transparent', color: saveStatus === 'error' ? 'error.main' : 'text.secondary', '& .MuiChip-label': { minWidth: 0, px: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, '& .MuiChip-icon': { ml: 0, fontSize: 14, color: 'inherit' } }}
          />
        </Stack>
        {props.compact ? (
          <Stack direction="row" spacing={0} sx={{ flexShrink: 0 }}>
            {compactAction(publicPageText(locale, 'undo'), <Undo fontSize="small" />, props.onUndo, !props.canUndo)}
            {compactAction(publicPageText(locale, 'redo'), <Redo fontSize="small" />, props.onRedo, !props.canRedo)}
            {compactAction(publicPageText(locale, 'save'), <SaveOutlined fontSize="small" />, props.onSave, isBusy)}
            {compactAction(publicPageText(locale, 'publish'), <PublishOutlined fontSize="small" />, props.onPublish, isBusy)}
          </Stack>
        ) : (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0 }}>
            <Stack direction="row" spacing={1}>
              <Button variant="text" color="inherit" aria-label={publicPageText(locale, 'undo')} disabled={!props.canUndo} onClick={props.onUndo}>{publicPageText(locale, 'undo')}</Button>
              <Button variant="text" color="inherit" aria-label={publicPageText(locale, 'redo')} disabled={!props.canRedo} onClick={props.onRedo}>{publicPageText(locale, 'redo')}</Button>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" disabled={isBusy} onClick={props.onSave}>{publicPageText(locale, 'save')}</Button>
              <Button variant="contained" disabled={isBusy} onClick={props.onPublish}>{publicPageText(locale, 'publish')}</Button>
            </Stack>
          </Stack>
        )}
      </Box>
      {props.pageActions}
      {props.hasPublishErrors ? <Alert severity="warning">{publicPageText(locale, 'validation')}</Alert> : null}
    </Stack>
  );
}
