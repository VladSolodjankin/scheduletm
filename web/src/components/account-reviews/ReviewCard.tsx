import { Box, Card, CardActions, CardContent, Rating, Stack, Typography } from '@mui/material';
import { AppButton } from '../../shared/ui/AppButton';
import { AppStatusBadge } from '../../shared/ui/AppStatus';
import type { AccountReview } from '../../shared/types/api';

type Props = {
  review: AccountReview;
  screenshotUrl: string | null;
  labels: Record<string, string>;
  isBusy: boolean;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
};

export function ReviewCard({ review, screenshotUrl, labels, isBusy, onEdit, onToggleStatus, onDelete }: Props) {
  const published = review.status === 'published';
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, opacity: published ? 1 : 0.85 }}>
      <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', minWidth: 0 }}>
        {screenshotUrl ? (
          <Box
            component="img"
            src={screenshotUrl}
            alt={review.screenshot?.alt ?? ''}
            sx={{ width: 72, height: 72, flexShrink: 0, objectFit: 'cover', borderRadius: 1, border: 1, borderColor: 'divider' }}
          />
        ) : null}
        <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
            <Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>{review.name}</Typography>
            <AppStatusBadge
              label={published ? labels.statusPublished : labels.statusHidden}
              tone={published ? 'success' : 'neutral'}
            />
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Rating
              readOnly
              size="small"
              value={review.rating}
              getLabelText={(value) => labels.ratingValue.replace('{rating}', String(value))}
            />
            {review.reviewDate ? <Typography variant="body2" color="text.secondary">{review.reviewDate}</Typography> : null}
          </Stack>
          <Typography
            variant="body2"
            sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {review.text}
          </Typography>
        </Stack>
      </CardContent>
      <CardActions sx={{ px: 2, pb: 2, flexWrap: 'wrap', gap: 1 }}>
        <AppButton size="small" variant="outlined" disabled={isBusy} onClick={onEdit}>{labels.edit}</AppButton>
        <AppButton size="small" variant="text" disabled={isBusy} onClick={onToggleStatus}>
          {published ? labels.hide : labels.show}
        </AppButton>
        <AppButton size="small" variant="text" color="error" disabled={isBusy} onClick={onDelete}>{labels.delete}</AppButton>
      </CardActions>
    </Card>
  );
}
