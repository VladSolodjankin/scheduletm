import { DEFAULT_AVATAR_POSITION } from '../types/publicPage';

export type AvatarPosition = readonly [number, number];

export function parseAvatarPosition(value: unknown): AvatarPosition | null {
  if (typeof value !== 'string') {return null;}
  const match = /^(0|[1-9]\d?|100)% (0|[1-9]\d?|100)%$/.exec(value);
  if (!match) {return null;}
  const x = Number(match[1]);
  const y = Number(match[2]);
  return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 100 && y >= 0 && y <= 100
    ? [x, y]
    : null;
}

export function formatAvatarPosition([x, y]: AvatarPosition): string {
  const format = (value: number) => String(Math.round(value));
  return `${format(x)}% ${format(y)}%`;
}

export function normalizeAvatarPosition(value: unknown): string {
  const position = parseAvatarPosition(value);
  return position ? formatAvatarPosition(position) : DEFAULT_AVATAR_POSITION;
}

export function moveAvatarPosition(
  position: AvatarPosition,
  deltaX: number,
  deltaY: number,
  viewportSize: number,
  imageWidth: number,
  imageHeight: number,
): AvatarPosition {
  if (viewportSize <= 0 || imageWidth <= 0 || imageHeight <= 0) {return position;}
  const clamp = (value: number) => Math.min(100, Math.max(0, value));
  if (imageWidth > imageHeight) {
    const overflow = viewportSize * (imageWidth / imageHeight - 1);
    return overflow > 0 ? [clamp(position[0] - deltaX / overflow * 100), position[1]] : position;
  }
  if (imageHeight > imageWidth) {
    const overflow = viewportSize * (imageHeight / imageWidth - 1);
    return overflow > 0 ? [position[0], clamp(position[1] - deltaY / overflow * 100)] : position;
  }
  return position;
}
