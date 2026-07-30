import { Alert, Stack, Typography } from '@mui/material';
import { useI18n } from '../../shared/i18n/I18nContext';

export function BlockRenderErrorFallback() {
  const { t } = useI18n();

  return (
    <Alert severity="error">
      <Stack spacing={0.5}>
        <Typography sx={{ fontWeight: 600 }}>{t('publicPageBuilder.blockErrorTitle')}</Typography>
        <Typography variant="body2">{t('publicPageBuilder.blockErrorDescription')}</Typography>
      </Stack>
    </Alert>
  );
}
