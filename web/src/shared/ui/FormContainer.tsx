import { Stack, type StackProps } from "@mui/material";
import { APP_SPACING } from "../theme/constants";

type FormContainerProps = StackProps;

export function FormContainer({ children, sx, ...props }: FormContainerProps) {
  return (
    <Stack
      spacing={APP_SPACING.formGap}
      sx={{
        mt: 1,
        "& .MuiInputLabel-root": {
          px: 0.5,
          backgroundColor: "background.paper",
        },
        "& .MuiOutlinedInput-root": {
          borderRadius: 2,
        },
        ...sx,
      }}
      {...props}
    >
      {children}
    </Stack>
  );
}
