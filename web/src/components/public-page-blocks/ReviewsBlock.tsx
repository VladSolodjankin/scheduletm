import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import Pause from '@mui/icons-material/Pause';
import PlayArrow from '@mui/icons-material/PlayArrow';
import StarBorderRounded from '@mui/icons-material/StarBorderRounded';
import StarRounded from '@mui/icons-material/StarRounded';
import { Box, ButtonBase, Button, Card, CardContent, IconButton, Stack, Typography } from '@mui/material';
import useEmblaCarousel from 'embla-carousel-react';
import { lazy, Suspense, useCallback, useEffect, useState, type FocusEvent, type KeyboardEvent } from 'react';
import type { PageBlock } from '../../features/public-page-builder/types/publicPage';
import { useI18n } from '../../shared/i18n/I18nContext';
import type { PublicReview, PublicReviewsData } from '../../shared/types/api';
import { linkLayoutSx, ordinaryPublicPageLinkSx, Surface, text, useReducedMotion, wrappingTextSx } from './blocks';
import { translate } from '../../shared/i18n/translate';

const ImageLightbox = lazy(() => import('./ImageLightbox'));

const AUTOPLAY_INTERVAL_MS = 6000;
const STAR_COLOR = 'var(--page-star-color)';

function Stars({ rating, label }: { rating: number; label: string }) {
  const value = Math.max(0, Math.min(5, Math.round(rating)));
  return <Box role="img" aria-label={label} sx={{ display: 'inline-flex', alignItems: 'center' }}>
    {[1, 2, 3, 4, 5].map((star) => star <= value
      ? <StarRounded key={star} aria-hidden="true" sx={{ color: STAR_COLOR }} />
      : <StarBorderRounded key={star} aria-hidden="true" sx={{ color: 'color-mix(in srgb, var(--page-text) 40%, transparent)' }} />)}
  </Box>;
}

export function ReviewsBlock({ block, reviews = null, editor = false }: {
  block: PageBlock;
  reviews?: PublicReviewsData | null;
  editor?: boolean;
}) {
  const { locale } = useI18n();
  const reducedMotion = useReducedMotion();
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'center', loop: false, containScroll: false, duration: reducedMotion ? 0 : 25 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [autoplayPaused, setAutoplayPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [pageHidden, setPageHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const [manualNavigation, setManualNavigation] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const list: readonly PublicReview[] = reviews?.reviews ?? [];
  const count = list.length;
  const autoplayConfigured = block.content.autoplay === true && count > 1;
  const onSelect = useCallback(() => setSelectedIndex(emblaApi?.selectedScrollSnap() ?? 0), [emblaApi]);
  useEffect(() => {
    if (!emblaApi) {return;}
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {emblaApi.off('select', onSelect); emblaApi.off('reInit', onSelect);};
  }, [emblaApi, onSelect]);
  useEffect(() => {
    const onVisibilityChange = () => setPageHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);
  useEffect(() => {
    if (!emblaApi || !autoplayConfigured || editor || reducedMotion || autoplayPaused || hovered || focusWithin || pageHidden) {return;}
    const timer = window.setTimeout(() => emblaApi.scrollTo((emblaApi.selectedScrollSnap() + 1) % count), AUTOPLAY_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [autoplayConfigured, autoplayPaused, count, editor, emblaApi, focusWithin, hovered, manualNavigation, pageHidden, reducedMotion, selectedIndex]);
  const navigate = (index: number) => {
    emblaApi?.scrollTo(index);
    setManualNavigation((value) => value + 1);
  };
  const onDotKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1
      : event.key === 'ArrowRight' ? (index + 1) % count
        : event.key === 'ArrowLeft' ? (index - 1 + count) % count : null;
    if (nextIndex === null) {return;}
    event.preventDefault();
    navigate(nextIndex);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button[data-review-dot]')[nextIndex]?.focus();
  };
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {setFocusWithin(false);}
  };
  const title = text(block.content.title) || translate(locale, 'publicPageBuilder.blockTypeReviews');
  if (editor) {
    return <Surface block={block}><Stack sx={{ gap: 'var(--app-space-m)' }}>
      <Typography component="h2" variant="h5" sx={wrappingTextSx}>{title}</Typography>
      <Typography color="text.secondary">{translate(locale, 'publicPageBuilder.reviewsEditorHint')}</Typography>
      <Button component="a" href="/account-reviews" target="_blank" rel="noopener noreferrer" variant="contained"
        sx={{ ...ordinaryPublicPageLinkSx, ...linkLayoutSx, minHeight: 'var(--app-control-l)', textTransform: 'none' }}>{translate(locale, 'publicPageBuilder.reviewsManageLink')}</Button>
    </Stack></Surface>;
  }
  if (count === 0) {return null;}
  const average = reviews?.summary.average ?? null;
  const showSummary = block.content.showSummary !== false && (reviews?.summary.count ?? 0) > 0 && average !== null;
  const summaryText = showSummary
    ? translate(locale, `publicPageBuilder.${reviews!.summary.count === 1 ? 'reviewsSummaryOne' : 'reviewsSummary'}`)
      .replace('{average}', new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(average))
      .replace('{count}', String(reviews!.summary.count))
    : '';
  const screenshots = list.flatMap((review) => review.screenshot ? [{ reviewId: review.id, ...review.screenshot }] : []);
  const slides = list.map((review, index) => {
    const inactive = count > 1 && selectedIndex !== index;
    const screenshotIndex = screenshots.findIndex((shot) => shot.reviewId === review.id);
    return <Box key={review.id} role="group" aria-roledescription={translate(locale, 'publicPageBuilder.carouselSlide')}
      inert={inactive ? true : undefined} aria-hidden={inactive ? true : undefined}
      aria-label={translate(locale, 'publicPageBuilder.reviewsSlidePosition').replace('{current}', String(index + 1)).replace('{total}', String(count))}
      sx={{ flex: count === 1 ? '0 0 100%' : '0 0 88%', minWidth: 0, display: 'flex', opacity: inactive ? 0.56 : 1,
        '@container public-reviews (min-width: 600px)': { flex: count === 1 ? '0 0 100%' : '0 0 72%' } }}>
      <Card variant="outlined" sx={{ width: '100%', minWidth: 0, bgcolor: 'var(--avatar-surface-background)', color: 'var(--page-text)',
        borderColor: 'color-mix(in srgb, var(--page-text) 14%, transparent)', borderRadius: 'var(--block-border-radius)' }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--page-space-1)', p: 'var(--page-space-3)', '&:last-child': { pb: 'var(--page-space-3)' } }}>
          <Stars rating={review.rating} label={translate(locale, 'publicPageBuilder.reviewsRating').replace('{rating}', String(review.rating))} />
          <Stack direction="row" sx={{ alignItems: 'baseline', flexWrap: 'wrap', gap: 'var(--page-space-1)' }}>
            <Typography component="h3" variant="h6" sx={wrappingTextSx}>{review.name}</Typography>
            {review.reviewDate ? <Typography variant="body2" sx={{ ...wrappingTextSx, opacity: 0.75 }}>{review.reviewDate}</Typography> : null}
          </Stack>
          <Typography sx={wrappingTextSx}>{review.text}</Typography>
          {review.screenshot ? <ButtonBase type="button" onClick={() => setLightboxIndex(screenshotIndex)}
            aria-label={translate(locale, 'publicPageBuilder.reviewsScreenshotOpen').replace('{name}', review.name)}
            sx={{ alignSelf: 'flex-start', mt: 'var(--app-space-xs)', borderRadius: 'var(--app-radius-s)', overflow: 'hidden', border: 'var(--app-border-width) solid',
              borderColor: 'color-mix(in srgb, var(--page-text) 14%, transparent)',
              '&:focus-visible': { outline: 'calc(var(--app-border-width) * 2) solid var(--theme-link-border-color)', outlineOffset: 'calc(var(--app-border-width) * 2)' } }}>
            <Box component="img" src={review.screenshot.url} alt={review.screenshot.alt} loading="lazy"
              sx={{ display: 'block', width: 96, height: 96, objectFit: 'cover' }} />
          </ButtonBase> : null}
        </CardContent>
      </Card>
    </Box>;
  });
  return <Surface block={block}><Stack role="region" aria-label={title}
    sx={{ gap: 'var(--page-space-2)', containerType: 'inline-size', containerName: 'public-reviews', minWidth: 0 }}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocusWithin(true)} onBlurCapture={onBlur}>
    <Typography component="h2" variant="h5" sx={wrappingTextSx}>{title}</Typography>
    {summaryText ? <Typography variant="body2" sx={{ opacity: 0.85 }}>{summaryText}</Typography> : null}
    {count === 1 ? slides[0] : <>
      <Box ref={emblaRef} sx={{ overflow: 'hidden', minWidth: 0, maxWidth: '100%', touchAction: 'pan-y pinch-zoom', py: 'var(--page-space-1)' }}>
        <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 'var(--page-space-2)', minWidth: 0,
          '@container public-reviews (min-width: 600px)': { gap: 'var(--page-space-3)' } }}>{slides}</Box>
      </Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'center', gap: 'var(--page-space-1)', minHeight: 'var(--app-control-s)' }}>
        <IconButton size="small" aria-label={translate(locale, 'publicPageBuilder.reviewsPrevious')} disabled={selectedIndex === 0}
          onClick={() => navigate(selectedIndex - 1)}><ChevronLeftRounded /></IconButton>
        <Stack direction="row" role="group" sx={{ gap: 'var(--page-space-1)' }} aria-label={translate(locale, 'publicPageBuilder.reviewsCarouselNavigation')}>
          {list.map((review, index) => <ButtonBase key={review.id} data-review-dot
            aria-label={translate(locale, 'publicPageBuilder.goToReviewSlide').replace('{number}', String(index + 1))}
            aria-current={selectedIndex === index ? 'true' : undefined} onClick={() => navigate(index)}
            onKeyDown={(event) => onDotKeyDown(event, index)}
            sx={{ width: 'var(--app-space-m)', height: 'var(--app-space-m)', borderRadius: 'var(--app-radius-circle)', bgcolor: selectedIndex === index ? 'var(--theme-link-background)' : 'transparent',
              border: 'calc(var(--app-border-width) * 2) solid', borderColor: 'var(--theme-link-background)', '&:focus-visible': { outline: 'calc(var(--app-border-width) * 2) solid var(--theme-link-border-color)', outlineOffset: 'calc(var(--app-border-width) * 2)' } }} />)}
        </Stack>
        <IconButton size="small" aria-label={translate(locale, 'publicPageBuilder.reviewsNext')} disabled={selectedIndex === count - 1}
          onClick={() => navigate(selectedIndex + 1)}><ChevronRightRounded /></IconButton>
        {autoplayConfigured && !reducedMotion ? <IconButton size="small" aria-label={translate(locale, `publicPageBuilder.${autoplayPaused ? 'carouselPlay' : 'carouselPause'}`)}
          onClick={() => setAutoplayPaused((value) => !value)}>{autoplayPaused ? <PlayArrow /> : <Pause />}</IconButton> : null}
      </Stack>
    </>}
    {lightboxIndex !== null ? <Suspense fallback={null}>
      <ImageLightbox images={screenshots.map((shot) => ({ src: shot.url, alt: shot.alt, width: shot.width, height: shot.height }))}
        index={lightboxIndex} onClose={() => setLightboxIndex(null)} />
    </Suspense> : null}
  </Stack></Surface>;
}
