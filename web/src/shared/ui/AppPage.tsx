import { Box, Stack, Typography, type BoxProps } from '@mui/material';
import { APP_SPACING, APP_SIZING } from '../theme/constants';

type AppPageProps = BoxProps & {
  title: string;
  subtitle?: string;
};

export function AppPage({ title, subtitle, children, ...rest }: AppPageProps) {
  return (
    <Box
      sx={{
        maxWidth: APP_SIZING.contentMaxWidth,
        mx: 'auto',
        px: APP_SPACING.pageX,
        py: APP_SPACING.pageY,
        width: '100%'
      }}
      {...rest}
    >
      <Stack spacing={1} sx={{ mb: 3 }}>
        <Typography variant="h4">{title}</Typography>
        {subtitle && (
          <Typography color="text.secondary" variant="body1">
            {subtitle}
          </Typography>
        )}
      </Stack>
      {children}
    </Box>
  );
}
