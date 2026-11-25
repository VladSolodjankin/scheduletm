import { useCallback, useEffect, useState } from 'react';

export type CopyStatus = 'idle' | 'copied' | 'failed';

/**
 * Clipboard writes with a shared result state. The status resets to `idle` after `resetAfterMs`
 * (pass `null` when a Snackbar or Alert closes it through `reset`).
 */
export function useCopyToClipboard({ resetAfterMs = 2000 }: { resetAfterMs?: number | null } = {}) {
  const [status, setStatus] = useState<CopyStatus>('idle');

  useEffect(() => {
    if (status === 'idle' || resetAfterMs === null) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => setStatus('idle'), resetAfterMs);
    return () => window.clearTimeout(timeoutId);
  }, [resetAfterMs, status]);

  const run = useCallback(async (write: () => Promise<void>) => {
    try {
      await write();
      setStatus('copied');
      return true;
    } catch {
      setStatus('failed');
      return false;
    }
  }, []);

  const copyText = useCallback((text: string) => run(() => navigator.clipboard.writeText(text)), [run]);

  const copyImage = useCallback((blob: Blob, mimeType = blob.type || 'image/png') => run(
    () => navigator.clipboard.write([new ClipboardItem({ [mimeType]: blob })]),
  ), [run]);

  const reset = useCallback(() => setStatus('idle'), []);

  return { status, copyText, copyImage, reset };
}
