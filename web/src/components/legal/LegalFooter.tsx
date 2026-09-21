import { Box, Stack, Typography } from '@mui/material';
import { PRIVACY_POLICY_ROUTE, SECURITY_POLICY_ROUTE, TERMS_OF_USE_ROUTE } from '../../shared/legal/routes';
import { useI18n } from '../../shared/i18n/I18nContext';
import { AppLink } from '../../shared/ui/AppLink';

export function LegalFooter() {
  const { t } = useI18n();

  return (
    <Box component="footer" className="app-legal-footer">
      <Stack direction="row" className="app-legal-footer__content">
        <AppLink to={PRIVACY_POLICY_ROUTE} underline="hover" className="app-legal-footer__link">
          {t('common.privacyPolicy')}
        </AppLink>
        <Typography variant="caption" className="app-legal-footer__separator">
          •
        </Typography>
        <AppLink to={SECURITY_POLICY_ROUTE} underline="hover" className="app-legal-footer__link">
          {t('common.securityPolicy')}
        </AppLink>
        <Typography variant="caption" className="app-legal-footer__separator">
          •
        </Typography>
        <AppLink to={TERMS_OF_USE_ROUTE} underline="hover" className="app-legal-footer__link">
          {t('common.termsOfUse')}
        </AppLink>
      </Stack>
    </Box>
  );
}
