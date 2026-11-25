import OpenInNew from '@mui/icons-material/OpenInNew';
import { Button, FormControlLabel, Stack, Switch, TextField, Typography } from '@mui/material';
import { MAX_REVIEWS_TITLE_LENGTH } from '../../features/public-page-builder/model/reviews';
import type { BlockContent, PageBlock } from '../../features/public-page-builder/types/publicPage';
import type { Locale } from '../../shared/i18n/dictionaries';
import { translate } from '../../shared/i18n/translate';

export function ReviewsBlockEditor({ block, locale, onContentChange }: {
  block: PageBlock;
  locale: Locale;
  onContentChange: (content: BlockContent) => void;
}) {
  const update = (changes: BlockContent) => onContentChange({ ...block.content, ...changes });
  return <Stack spacing={2}>
    <TextField size="small" fullWidth label={translate(locale, 'publicPageBuilder.fieldTitle')}
      value={typeof block.content.title === 'string' ? block.content.title : ''}
      slotProps={{ htmlInput: { maxLength: MAX_REVIEWS_TITLE_LENGTH } }}
      onChange={(event) => update({ title: event.target.value })} />
    <FormControlLabel control={<Switch checked={block.content.showSummary !== false}
      onChange={(_, checked) => update({ showSummary: checked })} />} label={translate(locale, 'publicPageBuilder.reviewsShowSummary')} />
    <FormControlLabel control={<Switch checked={block.content.autoplay === true}
      onChange={(_, checked) => update({ autoplay: checked })} />} label={translate(locale, 'publicPageBuilder.reviewsAutoplay')} />
    <Typography variant="body2" color="text.secondary">{translate(locale, 'publicPageBuilder.reviewsEditorHint')}</Typography>
    <Button component="a" href="/account-reviews" target="_blank" rel="noopener noreferrer" startIcon={<OpenInNew />}
      sx={{ alignSelf: 'flex-start' }}>{translate(locale, 'publicPageBuilder.reviewsManageLink')}</Button>
  </Stack>;
}
