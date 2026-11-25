import { Box, Typography, type BoxProps } from '@mui/material';
import type { ReactNode } from 'react';

type AppPageProps = Omit<BoxProps, 'maxWidth' | 'width'> & {
  title: string;
  subtitle?: string;
  /**
   * Page column width. Every workspace page uses the shared `workspace` width so the layout never jumps
   * between routes; `document` and `compact` are reserved for client-facing and legal pages.
   */
  size?: 'workspace' | 'document' | 'compact';
  /** Limits the content (not the header) to a comfortable form width, aligned to the page's left edge. */
  contentWidth?: 'full' | 'form';
  action?: ReactNode;
};

export function AppPage({
  title,
  subtitle,
  children,
  size = 'workspace',
  contentWidth = 'full',
  action,
  className,
  ...rest
}: AppPageProps) {
  return (
    <Box
      className={['app-page', size === 'workspace' ? '' : `app-page--${size}`, className].filter(Boolean).join(' ')}
      {...rest}
    >
      <Box className="app-page__header">
        <Box className="app-page__heading">
          <Typography variant="h4" className="app-page__title">{title}</Typography>
          {subtitle && (
            <Typography variant="body1" className="app-page__subtitle">
              {subtitle}
            </Typography>
          )}
        </Box>
        {action ? <Box className="app-page__action">{action}</Box> : null}
      </Box>
      {contentWidth === 'form' ? <Box className="app-page__content--form">{children}</Box> : children}
    </Box>
  );
}
