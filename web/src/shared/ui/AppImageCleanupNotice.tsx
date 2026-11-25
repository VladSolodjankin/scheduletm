import { Stack } from '@mui/material';
import { AppButton } from './AppButton';
import { AppStatusMessage } from './AppStatus';

type Props = {
  failedCount: number;
  message: string;
  retryLabel: string;
  isRetrying: boolean;
  disabled?: boolean;
  onRetry: () => void;
};

/** Warning shown when replaced images could not be deleted, with a retry for the pending cleanup. */
export function AppImageCleanupNotice({ failedCount, message, retryLabel, isRetrying, disabled = false, onRetry }: Props) {
  if (!failedCount) {
    return null;
  }
  return (
    <Stack className="app-image-cleanup-notice">
      <AppStatusMessage severity="warning" message={message} />
      <Stack direction="row" className="app-image-cleanup-notice__actions">
        <AppButton size="small" variant="outlined" isLoading={isRetrying} disabled={disabled} onClick={onRetry}>
          {retryLabel}
        </AppButton>
      </Stack>
    </Stack>
  );
}
