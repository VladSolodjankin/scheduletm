import { describe, expect, it } from 'vitest';
import {
  AVATAR_COVER_REFERENCE,
  AVATAR_HERO_REFERENCE,
  AVATAR_PREVIEW_REFERENCE,
  AVATAR_SIZES,
  resolveAvatarCoverCenteredGeometry,
  resolveAvatarCoverLeftGeometry,
  resolveLeadingAvatarSectionMarginTop,
  resolveAvatarPresentation,
  resolveAvatarSizeChange,
} from '../../src/components/public-page-blocks/avatarPresentation';
import { resolvePublicPageThemeVariables } from '../../src/components/public-page-blocks/publicPageThemeVariables';
import { DEFAULT_PUBLIC_PAGE_THEME } from '../../src/features/public-page-builder/config/themes';
import type { PageSection } from '../../src/features/public-page-builder/types/publicPage';

describe('avatar presentation compatibility', () => {
  it('keeps runtime presentation limited to the four normalized layouts', () => {
    expect(resolveAvatarPresentation('compact', undefined)).toEqual({
      editorLayout: 'centered', renderLayout: 'centered', avatarSize: 150,
    });
    expect(resolveAvatarPresentation('image-left', undefined)).toEqual({
      editorLayout: 'centered', renderLayout: 'centered', avatarSize: 150,
    });
    expect(resolveAvatarPresentation('image-right', undefined)).toEqual({
      editorLayout: 'centered', renderLayout: 'centered', avatarSize: 150,
    });
  });

  it('uses new renderer semantics only for new IDs and defaults their size to 150', () => {
    expect(resolveAvatarPresentation('centered', undefined)).toEqual({
      editorLayout: 'centered', renderLayout: 'centered', avatarSize: 150,
    });
    expect(resolveAvatarPresentation('cover-left', 95)).toEqual({
      editorLayout: 'cover-left', renderLayout: 'cover-left', avatarSize: 95,
    });
    expect(resolveAvatarPresentation('image-cover', 65)).toEqual({
      editorLayout: 'image-cover', renderLayout: 'image-cover', avatarSize: null,
    });
  });

  it('keeps size changes on normalized layouts only', () => {
    expect(resolveAvatarSizeChange('compact', 65)).toEqual({ layout: 'centered', avatarSize: 65 });
    expect(resolveAvatarSizeChange('image-left', 125)).toEqual({ layout: 'centered', avatarSize: 125 });
    expect(resolveAvatarSizeChange('centered', 95)).toEqual({ layout: 'centered', avatarSize: 95 });
  });

  it('uses the four measured avatar sizes and shared natural-height frame geometry', () => {
    expect(AVATAR_SIZES).toEqual([65, 95, 125, 150]);
    expect(AVATAR_PREVIEW_REFERENCE).toEqual({
      deviceWidth: 395, screenWidth: 375, screenMargin: 10, sectionPadding: 14,
      contentWidth: 347, contentMarginBottom: 21, copyMarginTop: 7,
    });
    expect(AVATAR_COVER_REFERENCE).toEqual({
      width: 375, height: 112.5, avatarCenterX: 187.5, avatarOffsetX: 28,
    });
    expect(AVATAR_HERO_REFERENCE).toEqual({ imageWidth: 375, imageHeight: 262.5 });
  });

  it('resolves measured cover-centered geometry at the smallest and largest sizes', () => {
    expect(resolveAvatarCoverCenteredGeometry(65)).toEqual({
      coverHeight: 112.5, avatarTop: 47.5, avatarLeft: 187.5,
      avatarTranslateX: -32.5, avatarTranslateY: 32.5, copyPaddingTop: 32.5,
    });
    expect(resolveAvatarCoverCenteredGeometry(150)).toEqual({
      coverHeight: 112.5, avatarTop: -37.5, avatarLeft: 187.5,
      avatarTranslateX: -75, avatarTranslateY: 75, copyPaddingTop: 75,
    });
  });

  it('resolves measured cover-left geometry at the smallest and largest sizes', () => {
    expect(resolveAvatarCoverLeftGeometry(65)).toEqual({
      coverHeight: 112.5, avatarTop: 47.5, avatarTranslateX: 28, avatarTranslateY: 32.5,
      copyMarginLeft: 93, copyWidth: 254,
    });
    expect(resolveAvatarCoverLeftGeometry(150)).toEqual({
      coverHeight: 112.5, avatarTop: -37.5, avatarTranslateX: 28, avatarTranslateY: 75,
      copyMarginLeft: 178, copyWidth: 169,
    });
  });

  it('aligns a leading avatar cover with the section top without double-applying its own bleed', () => {
    expect(resolveLeadingAvatarSectionMarginTop('avatar', 0, 24, false, 'cover-centered')).toBe(-10);
    expect(resolveLeadingAvatarSectionMarginTop('avatar', 0, 14, false, 'cover-centered')).toBe(0);
    expect(resolveLeadingAvatarSectionMarginTop('avatar', 0, 0, false, 'cover-centered')).toBe(14);
    expect(resolveLeadingAvatarSectionMarginTop('avatar', 0, 24, false, 'centered')).toBe(-24);
    expect(resolveLeadingAvatarSectionMarginTop('avatar', 1, 24)).toBe(0);
    expect(resolveLeadingAvatarSectionMarginTop('text', 0, 24)).toBe(0);
    expect(resolveLeadingAvatarSectionMarginTop('avatar', 0, 24, true)).toBe(0);
  });

  it('maps theme and resolved section typography into transient CSS variables', () => {
    const section = {
      design: {
        variant: 'primary', backgroundColor: null,
        headingStyle: { fontFamily: null, fontSize: 18, fontWeight: null, fontStyle: null, color: '#123456' },
        textStyle: { fontFamily: 'Roboto', fontSize: null, fontWeight: 500, fontStyle: 'italic', color: null },
      },
    } as PageSection;
    const variables = resolvePublicPageThemeVariables(DEFAULT_PUBLIC_PAGE_THEME, section, { avatarSize: 96, coverColor: '#abcdef' });

    expect(variables['--page-background']).toBe(DEFAULT_PUBLIC_PAGE_THEME.colors.background);
    expect(variables['--page-section-background']).toBe(DEFAULT_PUBLIC_PAGE_THEME.colors.primary);
    expect(variables['--avatar-cover-background']).toBe('#abcdef');
    expect(variables['--avatar-title-size']).toBe('18px');
    expect(variables['--avatar-title-color']).toBe('#123456');
    expect(variables['--avatar-bio-font-family']).toBe('Roboto');
    expect(variables['--avatar-bio-weight']).toBe(500);
    expect(variables['--avatar-size']).toBe('96px');
  });

  it('resolves an explicit custom section background for transparent avatar content', () => {
    const section = {
      design: {
        variant: 'custom', backgroundColor: '#5d755d',
        headingStyle: { fontFamily: null, fontSize: null, fontWeight: null, fontStyle: null, color: null },
        textStyle: { fontFamily: null, fontSize: null, fontWeight: null, fontStyle: null, color: null },
      },
    } as PageSection;

    expect(resolvePublicPageThemeVariables(DEFAULT_PUBLIC_PAGE_THEME, section)['--page-section-background']).toBe('#5d755d');
  });

  it('falls back to theme defaults without persisting preview-only values', () => {
    const variables = resolvePublicPageThemeVariables(DEFAULT_PUBLIC_PAGE_THEME, undefined, { coverColor: '  ' });

    expect(variables['--avatar-cover-background']).toBe(DEFAULT_PUBLIC_PAGE_THEME.colors.primary);
    expect(variables['--avatar-title-font-family']).toBe(DEFAULT_PUBLIC_PAGE_THEME.tokens.typography.avatarTitle.fontFamily);
    expect(variables['--avatar-bio-size']).toBe(`${DEFAULT_PUBLIC_PAGE_THEME.tokens.typography.avatarBio.fontSize}px`);
    expect(variables['--avatar-size']).toBe('150px');
  });
});
