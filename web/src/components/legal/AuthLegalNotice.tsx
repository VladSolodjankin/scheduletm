import { Link, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useI18n } from '../../shared/i18n/I18nContext';
import { PRIVACY_POLICY_ROUTE, SECURITY_POLICY_ROUTE } from '../../shared/legal/routes';

export function AuthLegalNotice() {
  const { t } = useI18n();

  return (
    <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
      {t('auth.legalPrefix')}{' '}
      <Link component={RouterLink} to={SECURITY_POLICY_ROUTE} underline="hover">
        {t('auth.termsLabel')}
      </Link>{' '}
      {t('auth.legalJoin')}{' '}
      <Link component={RouterLink} to={PRIVACY_POLICY_ROUTE} underline="hover">
        {t('auth.privacyPolicyLabel')}
      </Link>
      {t('auth.legalSuffix')}
    </Typography>
  );
}
