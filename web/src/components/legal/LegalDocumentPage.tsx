import { Box, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { AppPage } from '../../shared/ui/AppPage';
import type { LegalDocument } from '../../content/legalDocuments';
import { useAuth } from '../../shared/auth/AuthContext';
import { useI18n } from '../../shared/i18n/I18nContext';
import { AppButton } from '../../shared/ui/AppButton';
import { AppSurface } from '../../shared/ui/AppSurface';

type LegalDocumentPageProps = {
  document: LegalDocument;
};

export function LegalDocumentPage({ document }: LegalDocumentPageProps) {
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
    <AppPage title={document.title} subtitle={`Effective date: ${document.effectiveDate}`} maxWidth={960}>
      <AppSurface className="app-legal-document">
        <Stack className="app-legal-document__content">
          <Box>
            <AppButton variant="outlined" type="button" onClick={handleBack}>
              {t('common.back')}
            </AppButton>
          </Box>

          <Stack className="app-legal-document__intro">
            {document.intro.map((paragraph) => (
              <Typography key={paragraph} variant="body1" color="text.secondary">
                {paragraph}
              </Typography>
            ))}
          </Stack>

          {document.sections.map((section) => (
            <Stack key={section.title} className="app-legal-document__section">
              <Typography variant="h6">{section.title}</Typography>
              {section.paragraphs?.map((paragraph) => (
                <Typography key={paragraph} variant="body1">
                  {paragraph}
                </Typography>
              ))}
              {section.bullets && (
                <Box component="ul" className="app-legal-document__list">
                  {section.bullets.map((bullet) => (
                    <Box key={bullet} component="li" className="app-legal-document__list-item">
                      <Typography variant="body1">{bullet}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Stack>
          ))}
        </Stack>
      </AppSurface>
    </AppPage>
  );
}
