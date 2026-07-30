import { Box, Container } from '@mui/material';
import type {
  PageSection,
  PublicPageDocument,
  SectionLayout,
} from '../../features/public-page-builder/types/publicPage';
import { BlockRenderer } from './BlockRenderer';

const columnsByLayout: Record<SectionLayout, string> = {
  single: 'minmax(0, 1fr)',
  'two-equal': 'repeat(2, minmax(0, 1fr))',
  'one-third-two-thirds': 'minmax(0, 1fr) minmax(0, 2fr)',
  'two-thirds-one-third': 'minmax(0, 2fr) minmax(0, 1fr)',
  'three-equal': 'repeat(3, minmax(0, 1fr))',
  stack: 'minmax(0, 1fr)',
  'hero-overlay': 'minmax(0, 1fr)',
};

function SectionRenderer({ section }: { section: PageSection }) {
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
      {section.blocks.map((block) => <BlockRenderer key={block.id} block={block} />)}
    </Box>
  );
}

export function PublicPageRenderer({ document }: { document: PublicPageDocument }) {
  const { colors } = document.theme;
  return (
    <Box
      sx={{
        bgcolor: colors.background,
        color: colors.text,
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
        {document.sections.map((section) => <SectionRenderer key={section.id} section={section} />)}
      </Container>
    </Box>
  );
}
