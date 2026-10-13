import { Box, ButtonBase, Typography } from '@mui/material';
import { lazy, Suspense, useState } from 'react';
import { credentialItems } from '../../features/public-page-builder/model/credentials';
import type { PageBlock } from '../../features/public-page-builder/types/publicPage';
import { useI18n } from '../../shared/i18n/I18nContext';
import { publicPageText } from '../public-page-builder/uiText';
import { Surface, text, wrappingTextSx } from './blocks';

const ImageLightbox = lazy(() => import('./ImageLightbox'));

export function CredentialsBlock({ block, mediaUrlFor, editor = false }: {
  block: PageBlock;
  mediaUrlFor?: (mediaId: string) => string | undefined;
  editor?: boolean;
}) {
  const { locale } = useI18n();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const title = text(block.content.title).trim();
  const cards = credentialItems(block.content).flatMap((item) => {
    const url = item.imageMediaId ? mediaUrlFor?.(item.imageMediaId) : undefined;
    return url ? [{ item, url }] : [];
  });
  const heading = title ? <Typography component="h2" variant="h5" sx={wrappingTextSx}>{title}</Typography> : null;
  if (cards.length === 0) {
    return editor ? <Surface block={block}>{heading}
      <Typography color="text.secondary">{publicPageText(locale, 'credentialsEmpty')}</Typography></Surface> : null;
  }
  return <Surface block={block}>
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      {heading}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
        {cards.map(({ item, url }, index) => {
          const meta = [item.organization.trim(), item.year.trim()].filter(Boolean).join(' · ');
          return <ButtonBase key={item.id} type="button"
            aria-label={publicPageText(locale, 'credentialsOpen').replace('{title}', item.title)}
            onClick={editor ? undefined : () => setOpenIndex(index)}
            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', textAlign: 'left', minWidth: 0, overflow: 'hidden',
              bgcolor: 'var(--avatar-surface-background)', color: 'var(--page-text)', border: '1px solid',
              borderColor: 'color-mix(in srgb, var(--page-text) 14%, transparent)', borderRadius: 'var(--block-border-radius)',
              '&:focus-visible': { outline: '2px solid var(--theme-link-border-color)', outlineOffset: 2 } }}>
            <Box component="img" src={url} alt={item.alt} loading="lazy"
              sx={{ display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover' }} />
            <Box sx={{ p: 1.5, minWidth: 0 }}>
              <Typography component="h3" variant="subtitle1" sx={{ ...wrappingTextSx, fontWeight: 700 }}>{item.title}</Typography>
              {meta ? <Typography variant="body2" sx={{ ...wrappingTextSx, opacity: 0.75 }}>{meta}</Typography> : null}
            </Box>
          </ButtonBase>;
        })}
      </Box>
    </Box>
    {!editor && openIndex !== null ? <Suspense fallback={null}>
      <ImageLightbox images={cards.map(({ item, url }) => ({ src: url, alt: item.alt }))} index={openIndex}
        onClose={() => setOpenIndex(null)} />
    </Suspense> : null}
  </Surface>;
}
