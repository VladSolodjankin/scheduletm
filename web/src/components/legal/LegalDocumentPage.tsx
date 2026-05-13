import { Box, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { AppPage } from '../../shared/ui/AppPage';
import type { LegalDocument } from '../../content/legalDocuments';
import { useAuth } from '../../shared/auth/AuthContext';
import { useI18n } from '../../shared/i18n/I18nContext';
import { AppButton } from '../../shared/ui/AppButton';

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
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          bgcolor: 'background.paper',
          px: { xs: 2.5, sm: 4 },
          py: { xs: 3, sm: 4 }
        }}
      >
        <Stack spacing={3}>
          <Box>
            <AppButton variant="outlined" type="button" onClick={handleBack}>
              {t('common.back')}
            </AppButton>
          </Box>

          <Stack spacing={1.5}>
            {document.intro.map((paragraph) => (
              <Typography key={paragraph} variant="body1" color="text.secondary">
                {paragraph}
              </Typography>
            ))}
          </Stack>

          {document.sections.map((section) => (
            <Stack key={section.title} spacing={1.5}>
              <Typography variant="h6">{section.title}</Typography>
              {section.paragraphs?.map((paragraph) => (
                <Typography key={paragraph} variant="body1">
                  {paragraph}
                </Typography>
              ))}
              {section.bullets && (
                <Box component="ul" sx={{ m: 0, pl: 3 }}>
                  {section.bullets.map((bullet) => (
                    <Box key={bullet} component="li" sx={{ mb: 1 }}>
                      <Typography variant="body1">{bullet}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Stack>
          ))}
        </Stack>
      </Box>
    </AppPage>
  );
}
