import { Rating, Stack, Typography } from '@mui/material';
import type { AccountReview } from '../../shared/types/api';
import { AppIcons } from '../../shared/ui/AppIcons';
import { AppAvatar, AppListRow, AppListThumb } from '../../shared/ui/AppList';
import { AppStatusBadge } from '../../shared/ui/AppStatus';
import { useI18n } from '../../shared/i18n/I18nContext';

type Props = {
  review: AccountReview;
  screenshotUrl: string | null;
  isBusy: boolean;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
};

export function ReviewListRow({ review, screenshotUrl, isBusy, onEdit, onToggleStatus, onDelete }: Props) {
  const { t } = useI18n();
  const published = review.status === 'published';
  return (
    <AppListRow
      muted={!published}
      media={screenshotUrl
        ? <AppListThumb src={screenshotUrl} alt={review.screenshot?.alt ?? ''} />
        : <AppAvatar name={review.name} />}
      title={review.name}
      badges={published ? null : <AppStatusBadge label={t('accountReviews.statusHidden')} tone="neutral" />}
      subtitle={(
        <Stack className="review-row__body">
          <Stack direction="row" className="review-row__meta">
            <Rating
              readOnly
              size="small"
              value={review.rating}
              getLabelText={(value) => t('accountReviews.ratingValue').replace('{rating}', String(value))}
            />
            {review.reviewDate ? <span>{review.reviewDate}</span> : null}
          </Stack>
          <Typography variant="body2" className="review-row__text">{review.text}</Typography>
        </Stack>
      )}
      onClick={isBusy ? undefined : onEdit}
      actionsLabel={t('common.moreActions')}
      actionsDisabled={isBusy}
      actions={[
        { key: 'edit', label: t('accountReviews.edit'), icon: <AppIcons.edit fontSize="small" />, onClick: onEdit },
        published
          ? { key: 'hide', label: t('accountReviews.hide'), icon: <AppIcons.hide fontSize="small" />, onClick: onToggleStatus }
          : { key: 'show', label: t('accountReviews.show'), icon: <AppIcons.show fontSize="small" />, onClick: onToggleStatus },
        { key: 'delete', label: t('accountReviews.delete'), icon: <AppIcons.delete fontSize="small" />, danger: true, onClick: onDelete },
      ]}
    />
  );
}
