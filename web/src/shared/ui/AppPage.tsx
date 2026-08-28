import { Box, Typography, type BoxProps } from '@mui/material';
import type { CSSProperties, ReactNode } from 'react';
import { rem } from '../theme/constants';

type AppPageProps = BoxProps & {
  title: string;
  subtitle?: string;
  maxWidth?: number;
  action?: ReactNode;
};

type AppPageStyle = CSSProperties & { '--app-page-custom-max'?: string };

export function AppPage({
  title,
  subtitle,
  children,
  maxWidth,
  action,
  className,
  style,
  ...rest
}: AppPageProps) {
  const pageStyle: AppPageStyle = {
    ...style,
    ...(maxWidth ? { '--app-page-custom-max': rem(maxWidth) } : {}),
  };

  return (
    <Box className={['app-page', className].filter(Boolean).join(' ')} style={pageStyle} {...rest}>
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
      {children}
    </Box>
  );
}
