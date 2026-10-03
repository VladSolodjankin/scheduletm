import { Box, Link, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { AppPage } from '../shared/ui/AppPage';
import { AppSurface } from '../shared/ui/AppSurface';
import { AppButton } from '../shared/ui/AppButton';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import { zoomTestPlanContent as c } from '../content/zoomTestPlan';

export function ZoomTestPlanPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { t } = useI18n();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(isAuthenticated ? '/appointments' : '/login');
  };

  return (
    <AppPage title={c.pageTitle} subtitle={c.effectiveDate} maxWidth={960}>
      <AppSurface className="app-legal-document">
        <Stack className="app-legal-document__content">
          <Box>
            <AppButton variant="outlined" type="button" onClick={handleBack}>
              {t('common.back')}
            </AppButton>
          </Box>

          <Stack className="app-legal-document__intro">
            <Typography variant="body1" color="text.secondary">{c.intro1}</Typography>
            <Typography variant="body1" color="text.secondary">{c.intro2}</Typography>
          </Stack>

          <Stack className="app-legal-document__section">
            <Typography variant="h6">{c.section1Title}</Typography>
            <Typography variant="body1">{c.section1Body}</Typography>
          </Stack>

          <Stack className="app-legal-document__section">
            <Typography variant="h6">{c.section2Title}</Typography>
            <Box component="table" className="app-legal-document__table">
              <Box component="thead">
                <Box component="tr">
                  <Box component="th">{c.scopeTableScopeHeader}</Box>
                  <Box component="th">{c.scopeTablePurposeHeader}</Box>
                </Box>
              </Box>
              <Box component="tbody">
                {c.scopes.map((row) => (
                  <Box component="tr" key={row.scope}>
                    <Box component="td"><code>{row.scope}</code></Box>
                    <Box component="td">{row.purpose}</Box>
                  </Box>
                ))}
              </Box>
            </Box>
            <Typography variant="body1">{c.section2Footer}</Typography>
          </Stack>

          <Stack className="app-legal-document__section">
            <Typography variant="h6">{c.section3Title}</Typography>
            <Typography variant="body1">
              {c.section3LoginLabel} <Link href={c.section3LoginUrl}>{c.section3LoginUrl}</Link>
            </Typography>
            <Typography variant="body1">{c.section3Credentials}</Typography>
          </Stack>

          <Stack className="app-legal-document__section">
            <Typography variant="h6">{c.section4Title}</Typography>

            <Typography variant="subtitle1">{c.step41Title}</Typography>
            <Box component="ol" className="app-legal-document__list">
              {c.step41Items.map((item) => (
                <Box component="li" className="app-legal-document__list-item" key={item}>
                  <Typography variant="body1">{item}</Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="body1" color="text.secondary">{c.step41Result}</Typography>

            <Typography variant="subtitle1">{c.step42Title}</Typography>
            <Box component="ol" className="app-legal-document__list">
              {c.step42Items.map((item) => (
                <Box component="li" className="app-legal-document__list-item" key={item}>
                  <Typography variant="body1">{item}</Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="body1" color="text.secondary">{c.step42Result}</Typography>

            <Typography variant="subtitle1">{c.step43Title}</Typography>
            <Box component="ol" className="app-legal-document__list">
              {c.step43Items.map((item) => (
                <Box component="li" className="app-legal-document__list-item" key={item}>
                  <Typography variant="body1">{item}</Typography>
                </Box>
              ))}
            </Box>

            <Typography variant="subtitle1">{c.step44Title}</Typography>
            <Box component="ol" className="app-legal-document__list">
              {c.step44Items.map((item) => (
                <Box component="li" className="app-legal-document__list-item" key={item}>
                  <Typography variant="body1">{item}</Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="body1" color="text.secondary">{c.step44Result}</Typography>
          </Stack>

          <Stack className="app-legal-document__section">
            <Typography variant="h6">{c.section5Title}</Typography>
            <Box component="ul" className="app-legal-document__list">
              <Box component="li" className="app-legal-document__list-item">
                <Typography variant="body1">
                  <Link href={c.section5SupportLinkUrl}>{c.section5SupportLinkLabel}</Link>
                  {c.section5SupportDescription}
                </Typography>
              </Box>
            </Box>
          </Stack>
        </Stack>
      </AppSurface>
    </AppPage>
  );
}
