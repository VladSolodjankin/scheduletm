import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

type AppSectionHeaderProps = {
  title?: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
};

export function AppSectionHeader({ title, description, action, icon }: AppSectionHeaderProps) {
  if (!title && !description && !action) {
    return null;
  }

  return (
    <Box className="app-section-header">
      <Box className="app-section-header__copy">
        {icon ? (
          <Box className="app-section-header__icon">
            {icon}
          </Box>
        ) : null}

        <Box className="app-section-header__text">
          {title ? <Typography variant="h6">{title}</Typography> : null}
          {description ? (
            <Typography variant="body2" className="app-section-header__description">
              {description}
            </Typography>
          ) : null}
        </Box>
      </Box>

      {action ? <Box className="app-section-header__action">{action}</Box> : null}
    </Box>
  );
}
