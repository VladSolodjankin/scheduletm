import { Box, Container, Typography } from '@mui/material';
import type {
  PageSection,
  PublicPageDocument,
  SectionLayout,
} from '../../features/public-page-builder/types/publicPage';
import { BlockRenderer } from './BlockRenderer';
import { backgroundPresetCss } from '../../features/public-page-builder/config/backgroundPresets';

const columnsByLayout: Record<SectionLayout, string> = {
  single: 'minmax(0, 1fr)',
  'two-equal': 'repeat(2, minmax(0, 1fr))',
  'one-third-two-thirds': 'minmax(0, 1fr) minmax(0, 2fr)',
  'two-thirds-one-third': 'minmax(0, 2fr) minmax(0, 1fr)',
  'three-equal': 'repeat(3, minmax(0, 1fr))',
  stack: 'minmax(0, 1fr)',
  'hero-overlay': 'minmax(0, 1fr)',
};

function SectionRenderer({ section, mediaUrlFor }: { section: PageSection; mediaUrlFor: (id: string) => string | undefined }) {
  if (!section.visible) {
    return null;
  }

  return (
    <Box
      component="section"
      aria-label={section.name}
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: columnsByLayout[section.layout] },
        gap: { xs: 2, md: 3 },
        minWidth: 0,
        '& > *': { minWidth: 0 },
      }}
    >
      {section.blocks.map((block) => <BlockRenderer key={block.id} block={block} mediaUrlFor={mediaUrlFor} />)}
    </Box>
  );
}

export function PublicPageRenderer({ document, mediaUrls }: { document: PublicPageDocument; mediaUrls?: ReadonlyMap<string, string> }) {
  const { colors } = document.theme;
  const mediaUrlFor = (id: string) => mediaUrls?.get(id) ?? document.media.find((media) => media.id === id)?.url;
  const mediaFor = (id: string) => document.media.find((media) => media.id === id);
  const pageBackground = document.theme.backgroundMediaId ? mediaUrlFor(document.theme.backgroundMediaId) : undefined;
  return (
    <Box
      sx={{
        bgcolor: colors.background,
        backgroundImage: pageBackground ? `url("${pageBackground}")` : backgroundPresetCss(document.theme.backgroundPreset),
        backgroundSize: document.theme.backgroundFit,
        backgroundPosition: document.theme.backgroundPosition,
        backgroundAttachment: 'fixed',
        color: colors.text,
        fontFamily: document.theme.fontFamily,
        minHeight: '100%',
        overflowX: 'clip',
        overflowWrap: 'anywhere',
      }}
    >
      <Container
        maxWidth="md"
        sx={{
          display: 'grid',
          gap: { xs: 3, md: 5 },
          py: { xs: 3, md: 6 },
          px: { xs: 2, sm: 3 },
        }}
      >
        {(document.profile.logoMediaId || document.profile.avatarMediaId || document.profile.displayName || document.profile.description) ? (
          <Box component="header" sx={{ textAlign: 'center', display: 'grid', justifyItems: 'center', gap: 1.5 }}>
            {document.profile.logoMediaId ? <Box component="img" src={mediaUrlFor(document.profile.logoMediaId)}
              alt={mediaFor(document.profile.logoMediaId)?.alt ?? ''}
              sx={{ maxWidth: 180, maxHeight: 64, objectFit: 'contain' }} /> : null}
            {document.profile.avatarMediaId ? <Box component="img" src={mediaUrlFor(document.profile.avatarMediaId)}
              alt={mediaFor(document.profile.avatarMediaId)?.alt || document.profile.displayName}
              sx={{ width: 112, height: 112, borderRadius: '50%', objectFit: 'cover' }} /> : null}
            {document.profile.displayName ? <Typography component="h1" variant="h4">{document.profile.displayName}</Typography> : null}
            {document.profile.description ? <Typography sx={{ whiteSpace: 'pre-wrap' }}>{document.profile.description}</Typography> : null}
          </Box>
        ) : null}
        {document.sections.map((section) => <SectionRenderer key={section.id} section={section} mediaUrlFor={mediaUrlFor} />)}
      </Container>
    </Box>
  );
}
