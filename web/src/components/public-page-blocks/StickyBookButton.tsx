import { Button } from '@mui/material';
import { useEffect, useState } from 'react';
import { useI18n } from '../../shared/i18n/I18nContext';
import { translate } from '../../shared/i18n/translate';

const SERVICES_SELECTOR = '[data-block-type="services"]';

/**
 * Keeps booking one tap away on long pages: shown while the services block is out of view and scrolls to it.
 * It needs no setting, the page offers it exactly when it has services to book.
 */
export function StickyBookButton() {
  const { locale } = useI18n();
  const [servicesOutOfView, setServicesOutOfView] = useState(false);

  useEffect(() => {
    const target = document.querySelector(SERVICES_SELECTOR);
    if (!target) {return undefined;}
    const observer = new IntersectionObserver(([entry]) => setServicesOutOfView(!entry.isIntersecting));
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  if (!servicesOutOfView) {return null;}
  return (
    <Button
      data-sticky-book=""
      variant="contained"
      onClick={() => document.querySelector(SERVICES_SELECTOR)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })}
      sx={{
        position: 'fixed', zIndex: 10, left: '50%', transform: 'translateX(-50%)',
        bottom: 'max(var(--page-space-2), env(safe-area-inset-bottom))',
        minHeight: 'var(--app-control-l)', px: 'var(--page-space-3)', textTransform: 'none',
        borderRadius: 'var(--theme-link-border-radius)',
        border: 'var(--theme-link-border-width) solid var(--theme-link-border-color)',
        bgcolor: 'var(--theme-link-background)', color: 'var(--theme-link-title-color)',
        fontFamily: 'var(--theme-link-title-font-family)', fontWeight: 'var(--theme-link-title-font-weight)',
        boxShadow: 'var(--app-shadow-soft)',
        '&:hover': { bgcolor: 'var(--theme-link-background)', filter: 'brightness(0.95)' },
      }}
    >
      {translate(locale, 'publicPageBuilder.serviceBook')}
    </Button>
  );
}
