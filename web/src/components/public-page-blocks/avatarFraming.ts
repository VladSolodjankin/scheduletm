export const AVATAR_ZOOM_MIN = 1;
export const AVATAR_ZOOM_MAX = 3;

export type AvatarFraming = { focusX: number; focusY: number; zoom: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Reads the optional framing fields of an avatar block; absent values mean centred without zoom. */
export function resolveAvatarFraming(content: Record<string, unknown>): AvatarFraming {
  return {
    focusX: clamp(numberOr(content.imageFocusX, 50), 0, 100),
    focusY: clamp(numberOr(content.imageFocusY, 50), 0, 100),
    zoom: clamp(numberOr(content.imageZoom, 1), AVATAR_ZOOM_MIN, AVATAR_ZOOM_MAX),
  };
}

/**
 * Dragging the photo right shows more of its left side, so the focus moves opposite to the pointer.
 * `deltaRatio` is the pointer travel as a share of the frame size; zoom slows the movement down.
 */
export function moveAvatarFocus(framing: AvatarFraming, deltaRatioX: number, deltaRatioY: number): AvatarFraming {
  return {
    ...framing,
    focusX: Math.round(clamp(framing.focusX - (deltaRatioX * 100) / framing.zoom, 0, 100) * 10) / 10,
    focusY: Math.round(clamp(framing.focusY - (deltaRatioY * 100) / framing.zoom, 0, 100) * 10) / 10,
  };
}

/** Removes the framing fields when they equal the defaults, so untouched pages stay unchanged. */
export function applyAvatarFraming(content: Record<string, unknown>, framing: AvatarFraming): Record<string, unknown> {
  const next = { ...content };
  delete next.imageFocusX;
  delete next.imageFocusY;
  delete next.imageZoom;
  if (framing.focusX !== 50) {next.imageFocusX = framing.focusX;}
  if (framing.focusY !== 50) {next.imageFocusY = framing.focusY;}
  if (framing.zoom !== 1) {next.imageZoom = framing.zoom;}
  return next;
}
