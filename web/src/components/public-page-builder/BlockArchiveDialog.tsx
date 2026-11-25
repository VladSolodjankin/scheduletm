import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Typography } from '@mui/material';
import { useId, useState } from 'react';
import type { PublicPageDocument } from '../../features/public-page-builder/types/publicPage';
import type { Locale } from '../../shared/i18n/dictionaries';
import { translate } from '../../shared/i18n/translate';

export function BlockArchiveDialog({ open, compact, document, locale, onClose, onRestore }: {
  open: boolean; compact: boolean; document: PublicPageDocument; locale: Locale; onClose: () => void; onRestore: (id: string) => boolean;
}) {
  const titleId = useId();
  const [feedback, setFeedback] = useState<'blockRestored' | 'blockRestoreConflict' | null>(null);
  return <Dialog open={open} fullWidth maxWidth="sm" fullScreen={compact} onClose={onClose} aria-labelledby={titleId}>
    <DialogTitle id={titleId}>{translate(locale, 'publicPageBuilder.blockArchive')}</DialogTitle>
    <DialogContent><Stack spacing={2}>
      <Typography color="text.secondary">{translate(locale, 'publicPageBuilder.blockArchiveHint')}</Typography>
      {feedback ? <Alert severity={feedback === 'blockRestored' ? 'success' : 'error'}>{translate(locale, `publicPageBuilder.${feedback}`)}</Alert> : null}
      {document.archivedBlocks.length === 0 ? <Stack spacing={1} sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="h6">{translate(locale, 'publicPageBuilder.blockArchiveEmpty')}</Typography>
        <Typography color="text.secondary">{translate(locale, 'publicPageBuilder.blockArchiveEmptyHint')}</Typography>
      </Stack> : document.archivedBlocks.map(({ block, sourceSectionId }) => {
        const source = document.sections.find((section) => section.id === sourceSectionId);
        return <Paper key={block.id} variant="outlined" sx={{ p: 2 }}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
          <Stack sx={{ flex: 1, minWidth: 0 }}><Typography sx={{ overflowWrap: 'anywhere' }}>{block.name}</Typography>
            <Typography variant="body2" color="text.secondary">{source ? `${translate(locale, 'publicPageBuilder.section')}: ${source.name}` : translate(locale, 'publicPageBuilder.sourceSectionRemoved')}</Typography></Stack>
          <Button variant="outlined" onClick={() => setFeedback(onRestore(block.id) ? 'blockRestored' : 'blockRestoreConflict')}>{translate(locale, 'publicPageBuilder.restore')}</Button>
        </Stack></Paper>;
      })}
      <Typography variant="caption" color="text.secondary">{translate(locale, 'publicPageBuilder.blockRestoreHint')}</Typography>
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose}>{translate(locale, 'publicPageBuilder.close')}</Button></DialogActions>
  </Dialog>;
}
