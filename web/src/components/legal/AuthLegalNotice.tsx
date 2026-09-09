import { Typography } from '@mui/material';
import { useI18n } from '../../shared/i18n/I18nContext';
import { PRIVACY_POLICY_ROUTE, SECURITY_POLICY_ROUTE } from '../../shared/legal/routes';
import { AppLink } from '../../shared/ui/AppLink';

export function AuthLegalNotice() {
  const { t } = useI18n();

  return (
    <Typography variant="caption" className="app-auth-legal-notice">
      {t('auth.legalPrefix')}{' '}
      <AppLink to={SECURITY_POLICY_ROUTE} underline="hover">
        {t('auth.termsLabel')}
      </AppLink>{' '}
      {t('auth.legalJoin')}{' '}
      <AppLink to={PRIVACY_POLICY_ROUTE} underline="hover">
        {t('auth.privacyPolicyLabel')}
      </AppLink>
      {t('auth.legalSuffix')}
    </Typography>
  );
}
