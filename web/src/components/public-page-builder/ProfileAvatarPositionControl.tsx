import { Box, Button, Stack, Typography } from '@mui/material';
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  formatAvatarPosition,
  moveAvatarPosition,
  parseAvatarPosition,
  type AvatarPosition,
} from '../../features/public-page-builder/model/avatarPosition';
import { DEFAULT_AVATAR_POSITION } from '../../features/public-page-builder/types/publicPage';

type ActiveDrag = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPosition: AvatarPosition;
  viewportSize: number;
};

export function ProfileAvatarPositionControl({
  previewUrl,
  position,
  label,
  hint,
  centerLabel,
  disabled = false,
  onChange,
}: {
  previewUrl: string;
  position: string;
  label: string;
  hint: string;
  centerLabel: string;
  disabled?: boolean;
  onChange: (position: string) => void;
}) {
  const hintId = useId();
  const activeDragRef = useRef<ActiveDrag | null>(null);
  const committedPosition = parseAvatarPosition(position) ?? [50, 50];
  const previewPositionRef = useRef<AvatarPosition>(committedPosition);
  const [transientPosition, setTransientPosition] = useState<AvatarPosition | null>(null);
  const [decodedImage, setDecodedImage] = useState<{ source: string; width: number; height: number } | null>(null);
  const decodedDimensions = decodedImage?.source === previewUrl ? decodedImage : null;

  const updatePreview = (next: AvatarPosition) => {
    previewPositionRef.current = next;
    setTransientPosition(next);
  };

  const moveByKeyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || !decodedDimensions) {return;}
    const [x, y] = committedPosition;
    const step = event.shiftKey ? 10 : 5;
    let next: AvatarPosition | null = null;
    if (decodedDimensions.width > decodedDimensions.height) {
      if (event.key === 'ArrowLeft') {next = [Math.min(100, x + step), y];}
      if (event.key === 'ArrowRight') {next = [Math.max(0, x - step), y];}
    } else if (decodedDimensions.height > decodedDimensions.width) {
      if (event.key === 'ArrowUp') {next = [x, Math.min(100, y + step)];}
      if (event.key === 'ArrowDown') {next = [x, Math.max(0, y - step)];}
    }
    if (!next) {return;}
    event.preventDefault();
    const formatted = formatAvatarPosition(next);
    if (formatted !== position) {onChange(formatted);}
  };

  const cancelDrag = () => {
    activeDragRef.current = null;
    setTransientPosition(null);
  };

  const finishDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const active = activeDragRef.current;
    if (!active || active.pointerId !== event.pointerId) {return;}
    activeDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const formatted = formatAvatarPosition(previewPositionRef.current);
    setTransientPosition(null);
    if (formatted !== formatAvatarPosition(committedPosition)) {onChange(formatted);}
  };

  return (
    <Stack spacing={1.25} sx={{ alignItems: 'center' }}>
      <Typography variant="subtitle2" sx={{ alignSelf: 'stretch' }}>{label}</Typography>
      <Box
        component="button"
        type="button"
        disabled={disabled || !decodedDimensions}
        aria-busy={!decodedDimensions}
        aria-label={label}
        aria-describedby={hintId}
        data-testid="profile-avatar-position-control"
        onKeyDown={moveByKeyboard}
        onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
          if (disabled || !decodedDimensions || (event.pointerType === 'mouse' && event.button !== 0)) {return;}
          event.preventDefault();
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          previewPositionRef.current = committedPosition;
          activeDragRef.current = {
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startPosition: committedPosition,
            viewportSize: event.currentTarget.getBoundingClientRect().width,
          };
        }}
        onPointerMove={(event: PointerEvent<HTMLButtonElement>) => {
          const active = activeDragRef.current;
          if (!active || active.pointerId !== event.pointerId) {return;}
          updatePreview(moveAvatarPosition(
            active.startPosition,
            event.clientX - active.startClientX,
            event.clientY - active.startClientY,
            active.viewportSize,
            decodedDimensions?.width ?? 0,
            decodedDimensions?.height ?? 0,
          ));
        }}
        onPointerUp={finishDrag}
        onPointerCancel={cancelDrag}
        onLostPointerCapture={() => {
          if (activeDragRef.current) {cancelDrag();}
        }}
        sx={{
          appearance: 'none',
          width: 'min(13.75rem, 100%)',
          aspectRatio: '1',
          p: 0,
          border: 1,
          borderColor: 'divider',
          borderRadius: '50%',
          overflow: 'hidden',
          bgcolor: 'background.default',
          cursor: disabled ? 'default' : !decodedDimensions ? 'progress' : transientPosition ? 'grabbing' : 'grab',
          touchAction: 'none',
          userSelect: 'none',
          boxShadow: 1,
          '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: 3 },
          '&:disabled': { opacity: 0.6 },
        }}
      >
        <Box
          component="img"
          src={previewUrl}
          alt=""
          draggable={false}
          onLoad={(event) => {
            const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
            setDecodedImage(width > 0 && height > 0 ? { source: previewUrl, width, height } : null);
          }}
          onError={() => setDecodedImage(null)}
          sx={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', objectPosition: formatAvatarPosition(transientPosition ?? committedPosition), pointerEvents: 'none' }}
        />
      </Box>
      <Typography id={hintId} variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>{hint}</Typography>
      <Button
        size="small"
        variant="outlined"
        disabled={disabled || formatAvatarPosition(committedPosition) === DEFAULT_AVATAR_POSITION}
        onClick={() => onChange(DEFAULT_AVATAR_POSITION)}
      >
        {centerLabel}
      </Button>
    </Stack>
  );
}
