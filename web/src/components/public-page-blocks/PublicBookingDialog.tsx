import Close from '@mui/icons-material/Close';
import { Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import { useI18n } from '../../shared/i18n/I18nContext';
import { publicPageText } from '../public-page-builder/uiText';
import { PublicBookingForm } from './PublicBookingForm';

export function PublicBookingDialog({ open, onClose, slug, serviceId }: {
  open: boolean;
  onClose: () => void;
  slug: string;
  serviceId: string;
}) {
  const { t, locale } = useI18n();
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="body">
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 68, px: 3, py: 1.5 }}>
      <Typography component="span" variant="h6" sx={{ flex: 1 }}>{t('publicBooking.title')}</Typography>
      <IconButton aria-label={publicPageText(locale, 'close')} onClick={onClose}><Close /></IconButton>
    </DialogTitle>
    <DialogContent dividers sx={{ px: { xs: 2, sm: 3 }, py: 3 }}>
      <PublicBookingForm slug={slug} initialServiceId={serviceId} />
    </DialogContent>
  </Dialog>;
}
