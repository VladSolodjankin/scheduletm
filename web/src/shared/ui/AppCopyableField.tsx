import { IconButton, InputAdornment, Tooltip, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

import { AppIcons } from './AppIcons';
import { AppTextField } from './AppTextField';

const COPIED_FEEDBACK_MS = 2000;

type AppCopyableFieldProps = {
  label: string;
  value: string;
  helperText?: string;
  copyLabel: string;
  copiedLabel: string;
  copyFailedLabel: string;
};

/** Read-only text with a copy button; announces the result through a live region. */
export function AppCopyableField({
  label,
  value,
  helperText,
  copyLabel,
  copiedLabel,
  copyFailedLabel,
}: AppCopyableFieldProps) {
  const [feedback, setFeedback] = useState<'copied' | 'failed' | null>(null);

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => setFeedback(null), COPIED_FEEDBACK_MS);
    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback('copied');
    } catch {
      setFeedback('failed');
    }
  };

  const feedbackText = feedback === 'copied' ? copiedLabel : feedback === 'failed' ? copyFailedLabel : '';

  return (
    <>
      <AppTextField
        size="small"
        label={label}
        value={value}
        helperText={helperText}
        slotProps={{
          htmlInput: { readOnly: true },
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title={feedback === 'copied' ? copiedLabel : copyLabel}>
                  <IconButton edge="end" size="small" aria-label={`${copyLabel}: ${label}`} onClick={() => void copy()}>
                    <AppIcons.copy fontSize="small" />
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            ),
          },
        }}
      />
      <Typography
        component="span"
        role="status"
        aria-live="polite"
        sx={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
        }}
      >
        {feedbackText}
      </Typography>
    </>
  );
}
