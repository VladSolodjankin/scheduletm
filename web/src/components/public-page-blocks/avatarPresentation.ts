export const AVATAR_LAYOUTS = ['centered', 'cover-centered', 'cover-left', 'image-cover'] as const;
export type AvatarLayout = typeof AVATAR_LAYOUTS[number];
export const AVATAR_SIZES = [65, 95, 125, 150] as const;
export type AvatarSize = typeof AVATAR_SIZES[number];
export type AvatarRenderLayout = AvatarLayout;

export const AVATAR_PREVIEW_REFERENCE = {
  deviceWidth: 395,
  screenWidth: 375,
  screenMargin: 10,
  sectionPadding: 14,
  contentWidth: 347,
  contentMarginBottom: 21,
  copyMarginTop: 7,
} as const;

export const AVATAR_COVER_REFERENCE = {
  width: 375,
  height: 112.5,
  avatarCenterX: 187.5,
  avatarOffsetX: 28,
} as const;

export const AVATAR_HERO_REFERENCE = {
  imageWidth: 375,
  imageHeight: 262.5,
} as const;

export function resolveAvatarCoverCenteredGeometry(avatarSize: number): {
  coverHeight: number;
  avatarTop: number;
  avatarLeft: number;
  avatarTranslateX: number;
  avatarTranslateY: number;
  copyPaddingTop: number;
} {
  return {
    coverHeight: AVATAR_COVER_REFERENCE.height,
    avatarTop: AVATAR_COVER_REFERENCE.height - avatarSize,
    avatarLeft: AVATAR_COVER_REFERENCE.avatarCenterX,
    avatarTranslateX: -avatarSize / 2,
    avatarTranslateY: avatarSize / 2,
    copyPaddingTop: avatarSize / 2,
  };
}

export function resolveAvatarCoverLeftGeometry(avatarSize: number): {
  coverHeight: number;
  avatarTop: number;
  avatarTranslateX: number;
  avatarTranslateY: number;
  copyMarginLeft: number;
  copyWidth: number;
} {
  const copyMarginLeft = AVATAR_COVER_REFERENCE.avatarOffsetX + avatarSize;
  return {
    coverHeight: AVATAR_COVER_REFERENCE.height,
    avatarTop: AVATAR_COVER_REFERENCE.height - avatarSize,
    avatarTranslateX: AVATAR_COVER_REFERENCE.avatarOffsetX,
    avatarTranslateY: avatarSize / 2,
    copyMarginLeft,
    copyWidth: AVATAR_PREVIEW_REFERENCE.contentWidth - copyMarginLeft,
  };
}

export function resolveLeadingAvatarSectionMarginTop(
  blockType: unknown,
  blockIndex: number,
  paddingTop: number,
  isOff = false,
  layoutValue?: unknown,
): number {
  if (
    isOff
    || blockType !== 'avatar'
    || blockIndex !== 0
    || !Number.isFinite(paddingTop)
    || paddingTop < 0
  ) {
    return 0;
  }

  const innerTopBleed = normalizeAvatarLayout(layoutValue) === 'centered'
    ? 0
    : AVATAR_PREVIEW_REFERENCE.sectionPadding;

  return innerTopBleed - paddingTop;
}

export function normalizeAvatarLayout(value: unknown): AvatarLayout {
  return AVATAR_LAYOUTS.includes(value as AvatarLayout) ? value as AvatarLayout : 'centered';
}

export function normalizeAvatarSize(value: unknown): AvatarSize {
  return AVATAR_SIZES.includes(value as AvatarSize) ? value as AvatarSize : 150;
}

export function resolveAvatarSizeChange(layoutValue: unknown, avatarSize: AvatarSize): { layout: AvatarLayout; avatarSize: AvatarSize } {
  return { layout: normalizeAvatarLayout(layoutValue), avatarSize };
}

export function resolveAvatarPresentation(layoutValue: unknown, avatarSizeValue: unknown): {
  editorLayout: AvatarLayout;
  renderLayout: AvatarRenderLayout;
  avatarSize: AvatarSize | null;
} {
  const layout = normalizeAvatarLayout(layoutValue);
  return { editorLayout: layout, renderLayout: layout, avatarSize: layout === 'image-cover' ? null : normalizeAvatarSize(avatarSizeValue) };
}
