import { Box, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { PRIVACY_POLICY_ROUTE, SECURITY_POLICY_ROUTE } from '../../shared/legal/routes';
import { useI18n } from '../../shared/i18n/I18nContext';
import { rem } from '../../shared/theme/constants';

export function LegalFooter() {
  const { t } = useI18n();

  return (
    <Box
      component="footer"
      sx={{
        borderTop: `${rem(1)} solid`,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        px: { xs: 2, sm: 3 },
        py: 1.5
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 0.5, sm: 2 }}
        sx={{ alignItems: 'center', justifyContent: 'center' }}
      >
        <Link component={RouterLink} to={PRIVACY_POLICY_ROUTE} underline="hover" color="text.secondary">
          {t('common.privacyPolicy')}
        </Link>
        <Typography variant="caption" color="text.disabled" sx={{ display: { xs: 'none', sm: 'block' } }}>
          •
        </Typography>
        <Link component={RouterLink} to={SECURITY_POLICY_ROUTE} underline="hover" color="text.secondary">
          {t('common.securityPolicy')}
        </Link>
      </Stack>
    </Box>
  );
}
