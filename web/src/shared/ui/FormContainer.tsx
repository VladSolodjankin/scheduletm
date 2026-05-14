import { Stack, type StackProps } from '@mui/material';
import { APP_SPACING } from '../theme/constants';

type FormContainerProps = StackProps;

export function FormContainer({ children, sx, ...props }: FormContainerProps) {
  return (
    <Stack
      spacing={APP_SPACING.formGap}
      sx={{
        mt: 0.5,
        '& .MuiInputLabel-root': {
          px: 0.5,
          backgroundColor: 'background.paper',
        },
        '& .MuiFormControl-root': {
          width: '100%'
        },
        '& .MuiFormControlLabel-root': {
          ml: 0,
          mr: 0
        },
        ...sx,
      }}
      {...props}
    >
      {children}
    </Stack>
  );
}
