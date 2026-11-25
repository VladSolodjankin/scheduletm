import PersonOutlined from '@mui/icons-material/PersonOutlined';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { useState } from 'react';
import type { AvatarFraming } from './avatarFraming';
import { AVATAR_DRAG_SX, useAvatarFramingDrag } from './useAvatarFramingDrag';

type PublicAvatarImageProps = {
  src?: string | null;
  alt: string;
  size: number | string;
  sx?: SxProps<Theme>;
  framing?: AvatarFraming;
  /** When set the photo can be dragged inside its frame (editor preview only). */
  onFramingChange?: (framing: AvatarFraming) => void;
};

const DEFAULT_FRAMING: AvatarFraming = { focusX: 50, focusY: 50, zoom: 1 };

/** Round profile photo. A neutral silhouette stands in when there is no photo or it fails to load. */
export function PublicAvatarImage({ src, alt, size, sx, framing = DEFAULT_FRAMING, onFramingChange }: PublicAvatarImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const dragHandlers = useAvatarFramingDrag(framing, onFramingChange);
  const base = { width: size, height: size, borderRadius: 'var(--app-radius-circle)', flex: '0 0 auto' } as const;
  if (!src || failedSrc === src) {
    return <Box role="img" aria-label={alt || undefined} sx={[{ ...base, display: 'grid', placeItems: 'center',
      color: 'color-mix(in srgb, var(--page-text) 45%, transparent)',
      bgcolor: 'color-mix(in srgb, var(--page-text) 10%, transparent)',
      '& svg': { width: '60%', height: '60%' } }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <PersonOutlined aria-hidden="true" />
    </Box>;
  }

  return <Box {...dragHandlers}
    sx={[{ ...base, overflow: 'hidden', position: 'relative', ...(onFramingChange ? AVATAR_DRAG_SX : {}) },
      ...(Array.isArray(sx) ? sx : [sx])]}>
    <Box component="img" src={src} alt={alt} draggable={false} onError={() => setFailedSrc(src)}
      sx={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none',
        objectPosition: `${framing.focusX}% ${framing.focusY}%`,
        transformOrigin: `${framing.focusX}% ${framing.focusY}%`,
        transform: framing.zoom === 1 ? undefined : `scale(${framing.zoom})` }} />
  </Box>;
}
