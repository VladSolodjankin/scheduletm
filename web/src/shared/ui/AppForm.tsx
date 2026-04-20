import { Paper, Stack, type PaperProps, type StackProps } from '@mui/material';
import { APP_SPACING } from '../theme/constants';

type AppFormProps = PaperProps & {
  stackProps?: StackProps;
};

export function AppForm({ children, stackProps, ...paperProps }: AppFormProps) {
  return (
    <Paper elevation={0} variant="outlined" sx={{ p: 3 }} {...paperProps}>
      <Stack spacing={APP_SPACING.formGap} {...stackProps}>
        {children}
      </Stack>
    </Paper>
  );
}
