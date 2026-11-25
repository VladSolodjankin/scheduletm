import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { moveAvatarFocus, type AvatarFraming } from './avatarFraming';

/** Pointer handlers that drag a photo inside its frame; empty when no change handler is given. */
export function useAvatarFramingDrag(framing: AvatarFraming, onFramingChange?: (framing: AvatarFraming) => void) {
  const drag = useRef<{ x: number; y: number; framing: AvatarFraming } | null>(null);
  if (!onFramingChange) {return {};}

  const endDrag = () => { drag.current = null; };
  return {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      drag.current = { x: event.clientX, y: event.clientY, framing };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      const start = drag.current;
      if (!start) {return;}
      // Measured after any preview scaling, so the ratio does not depend on it.
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {return;}
      onFramingChange(moveAvatarFocus(start.framing, (event.clientX - start.x) / rect.width, (event.clientY - start.y) / rect.height));
    },
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  };
}

export const AVATAR_DRAG_SX = { cursor: 'grab', touchAction: 'none', '&:active': { cursor: 'grabbing' } } as const;
