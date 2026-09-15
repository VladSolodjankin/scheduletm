import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Typography } from '@mui/material';
import { useId, useState } from 'react';
import type { PublicPageDocument } from '../../features/public-page-builder/types/publicPage';
import type { Locale } from '../../shared/i18n/dictionaries';
import { publicPageText } from './uiText';

export function BlockArchiveDialog({ open, compact, document, locale, onClose, onRestore }: {
  open: boolean; compact: boolean; document: PublicPageDocument; locale: Locale; onClose: () => void; onRestore: (id: string) => boolean;
}) {
  const titleId = useId();
  const [feedback, setFeedback] = useState<'blockRestored' | 'blockRestoreConflict' | null>(null);
  return <Dialog open={open} fullWidth maxWidth="sm" fullScreen={compact} onClose={onClose} aria-labelledby={titleId}>
    <DialogTitle id={titleId}>{publicPageText(locale, 'blockArchive')}</DialogTitle>
    <DialogContent><Stack spacing={2}>
      <Typography color="text.secondary">{publicPageText(locale, 'blockArchiveHint')}</Typography>
      {feedback ? <Alert severity={feedback === 'blockRestored' ? 'success' : 'error'}>{publicPageText(locale, feedback)}</Alert> : null}
      {document.archivedBlocks.length === 0 ? <Stack spacing={1} sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="h6">{publicPageText(locale, 'blockArchiveEmpty')}</Typography>
        <Typography color="text.secondary">{publicPageText(locale, 'blockArchiveEmptyHint')}</Typography>
      </Stack> : document.archivedBlocks.map(({ block, sourceSectionId }) => {
        const source = document.sections.find((section) => section.id === sourceSectionId);
        return <Paper key={block.id} variant="outlined" sx={{ p: 2 }}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
          <Stack sx={{ flex: 1, minWidth: 0 }}><Typography sx={{ overflowWrap: 'anywhere' }}>{block.name}</Typography>
            <Typography variant="body2" color="text.secondary">{source ? `${publicPageText(locale, 'section')}: ${source.name}` : publicPageText(locale, 'sourceSectionRemoved')}</Typography></Stack>
          <Button variant="outlined" onClick={() => setFeedback(onRestore(block.id) ? 'blockRestored' : 'blockRestoreConflict')}>{publicPageText(locale, 'restore')}</Button>
        </Stack></Paper>;
      })}
      <Typography variant="caption" color="text.secondary">{publicPageText(locale, 'blockRestoreHint')}</Typography>
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose}>{publicPageText(locale, 'close')}</Button></DialogActions>
  </Dialog>;
}
