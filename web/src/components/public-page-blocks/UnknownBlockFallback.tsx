import { Alert, Stack, Typography } from '@mui/material';
import { useI18n } from '../../shared/i18n/I18nContext';

type UnknownBlockFallbackProps = {
  blockType: string;
};

export function UnknownBlockFallback({ blockType }: UnknownBlockFallbackProps) {
  const { t } = useI18n();

  return (
    <Alert severity="warning">
      <Stack spacing={0.5}>
        <Typography sx={{ fontWeight: 600 }}>{t('publicPageBuilder.unknownBlockTitle')}</Typography>
        <Typography variant="body2">{t('publicPageBuilder.unknownBlockDescription')}</Typography>
        <Typography variant="caption" component="code">{blockType}</Typography>
      </Stack>
    </Alert>
  );
}
