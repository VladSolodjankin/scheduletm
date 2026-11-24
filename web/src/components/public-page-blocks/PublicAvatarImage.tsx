import PersonOutlined from '@mui/icons-material/PersonOutlined';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { useState } from 'react';

type PublicAvatarImageProps = {
  src?: string | null;
  alt: string;
  size: number | string;
  sx?: SxProps<Theme>;
};

/** Round profile photo. A neutral silhouette stands in when there is no photo or it fails to load. */
export function PublicAvatarImage({ src, alt, size, sx }: PublicAvatarImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const base = { width: size, height: size, borderRadius: 'var(--app-radius-circle)', flex: '0 0 auto' } as const;
  if (!src || failedSrc === src) {
    return <Box role="img" aria-label={alt || undefined} sx={[{ ...base, display: 'grid', placeItems: 'center',
      color: 'color-mix(in srgb, var(--page-text) 45%, transparent)',
      bgcolor: 'color-mix(in srgb, var(--page-text) 10%, transparent)',
      '& svg': { width: '60%', height: '60%' } }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <PersonOutlined aria-hidden="true" />
    </Box>;
  }
  return <Box component="img" src={src} alt={alt} onError={() => setFailedSrc(src)}
    sx={[{ ...base, objectFit: 'cover' }, ...(Array.isArray(sx) ? sx : [sx])]} />;
}
