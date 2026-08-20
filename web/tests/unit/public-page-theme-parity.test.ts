import { describe, expect, it } from 'vitest';
import {
  applyPublicPagePalette,
  applyPublicPageThemeColors,
  PUBLIC_PAGE_THEMES,
} from '../../src/features/public-page-builder/config/themes';
import { normalizeDocument } from '../../src/features/public-page-builder/model/normalizeDocument';
import { sectionSurfaceRadius } from '../../src/components/public-page-blocks/BlockRenderer';
import { resolvePublicPageThemeVariables } from '../../src/components/public-page-blocks/publicPageThemeVariables';
import { PUBLIC_PAGE_PREVIEW_GEOMETRY } from '../../src/components/public-page-builder/ResponsivePreview';
import type { PageSection, SectionDesign } from '../../src/features/public-page-builder/types/publicPage';

const expectedSwatches = {
  z101: ['#f5f5f5', '#313233', '#D1D9DB', '#E4E7E9'],
  z102: ['#e1ecdf', '#ffffff', '#303030', '#CCDFC9'],
  z103: ['#FFF2CF', '#151515', '#F2D589', '#FEE6A5'],
  z104: ['#FEFAEF', '#7194AA', '#7194AA', '#F3E9D5'],
  z105: ['#FFFFFF', '#575E70', '#AA0428', '#EFEFFB'],
  z106: ['#EAE7DC', '#948369', '#A39686', '#CBC8C1'],
  z107: ['#fffaf4', '#5d755d', '#5d755d', '#ebdece'],
  z108: ['#FDFDFD', '#DAFF89', '#C7D8B6', '#EEEEEE'],
  z109: ['#ede2ea', '#7c5872', '#D1BFCD', '#7C5872'],
  z110: ['#f5f5f5', '#e2d4ce', '#E9DFDA', '#E2D4CE'],
};

const sectionDesign = (
  variant: SectionDesign['variant'],
  changes: Partial<SectionDesign> = {},
): PageSection => ({
  id: 'contrast-section', name: 'Contrast', visible: true, layout: 'single', blocks: [],
  design: {
    variant, backgroundColor: null, textColor: null, backgroundMediaId: null, backgroundOverlay: 0,
    backgroundFit: 'cover', backgroundPosition: '50% 50%', paddingTop: 24, paddingBottom: 24,
    horizontalMargin: false, borderRadius: null, borderWidth: 0, borderColor: null, shadow: false,
    width: 'full', mobileVisible: true,
    headingStyle: { fontFamily: null, fontSize: null, fontWeight: null, fontStyle: null, color: null },
    textStyle: { fontFamily: null, fontSize: null, fontWeight: null, fontStyle: null, color: null },
    linkStyle: {
      titleStyle: { fontFamily: null, fontSize: null, fontWeight: null, fontStyle: null, color: null },
      subtitleStyle: { fontFamily: null, fontSize: null, fontWeight: null, fontStyle: null, color: null },
      backgroundColor: null, backgroundOpacity: null, borderWidth: null, borderColor: null, shadow: null,
    },
    ...changes,
  },
});

describe('public page theme parity', () => {
  it('publishes exactly the approved ten palette swatch tuples', () => {
    expect(Object.fromEntries(PUBLIC_PAGE_THEMES.map((theme) => [theme.id, theme.swatches])))
      .toEqual(expectedSwatches);
  });

  it('resolves the complete concrete runtime variable contract', () => {
    const variables = resolvePublicPageThemeVariables(PUBLIC_PAGE_THEMES[0]);
    for (const name of [
      '--page-background', '--page-text', '--page-section-background', '--avatar-cover-background',
      '--avatar-surface-background', '--avatar-leading-section-radius', '--avatar-title-font-family',
      '--avatar-bio-font-family', '--block-border-radius', '--theme-link-offset',
      '--theme-link-border-radius', '--theme-link-background', '--theme-link-background-opacity',
      '--theme-link-title-font-family', '--theme-link-title-fontsize', '--theme-link-title-font-style',
      '--theme-link-subtitle-font-style', '--theme-link-border-width', '--theme-link-border-color',
      '--theme-link-shadow-params', '--theme-h1-fontsize',
      '--theme-h2-fontsize', '--theme-h3-fontsize', '--theme-text-sm-fontsize',
    ]) {
      expect(variables[name as keyof typeof variables], name).not.toBeUndefined();
    }
  });

  it('uses global link variables at page root and contrasting variables inside dark sections', () => {
    const theme = PUBLIC_PAGE_THEMES.find((item) => item.id === 'z106')!;
    const page = resolvePublicPageThemeVariables(theme);
    const off = resolvePublicPageThemeVariables(theme, sectionDesign('off'));
    const primary = resolvePublicPageThemeVariables(theme, sectionDesign('primary'));

    expect(page).toMatchObject({
      '--theme-link-background': '#948369',
      '--theme-link-background-opacity': '100%',
      '--theme-link-title-color': '#ffffff',
      '--theme-link-subtitle-color': '#ffffff',
    });
    expect(off).toMatchObject({
      '--theme-link-background': '#948369',
      '--theme-link-title-color': '#ffffff',
      '--theme-link-subtitle-color': '#ffffff',
    });
    expect(primary).toMatchObject({
      '--theme-link-background': '#EAE7DC',
      '--theme-link-title-color': '#291d0a',
      '--theme-link-subtitle-color': '#291d0a',
      '--theme-link-border-color': '#EAE7DC',
    });
  });

  it('keeps light sections on global link variables and applies every explicit section link override', () => {
    const theme = PUBLIC_PAGE_THEMES.find((item) => item.id === 'z107')!;
    const secondary = resolvePublicPageThemeVariables(theme, sectionDesign('secondary'));
    expect(secondary).toMatchObject({
      '--theme-link-background': '#5d755d',
      '--theme-link-title-color': '#ffffff',
      '--theme-link-subtitle-color': '#ffffff',
    });

    const base = sectionDesign('primary').design.linkStyle;
    const explicit = resolvePublicPageThemeVariables(theme, sectionDesign('primary', {
      linkStyle: {
        ...base,
        backgroundColor: '#123456',
        backgroundOpacity: 0.35,
        borderWidth: 3,
        borderColor: '#654321',
        titleStyle: { ...base.titleStyle, color: '#abcdef', fontStyle: 'italic' },
        subtitleStyle: { ...base.subtitleStyle, color: '#fedcba', fontStyle: 'italic' },
      },
    }));
    expect(explicit).toMatchObject({
      '--theme-link-background': '#123456',
      '--theme-link-background-opacity': '35%',
      '--theme-link-border-width': '3px',
      '--theme-link-border-color': '#654321',
      '--theme-link-title-color': '#abcdef',
      '--theme-link-title-font-style': 'italic',
      '--theme-link-subtitle-color': '#fedcba',
      '--theme-link-subtitle-font-style': 'italic',
    });
  });

  it('keeps the approved z107 root and dark-primary variable snapshots', () => {
    const theme = PUBLIC_PAGE_THEMES.find((item) => item.id === 'z107')!;
    expect(resolvePublicPageThemeVariables(theme)).toMatchObject({
      '--theme-link-background': '#5d755d',
      '--theme-link-title-color': '#ffffff',
      '--theme-link-subtitle-color': '#ffffff',
    });
    expect(resolvePublicPageThemeVariables(theme, sectionDesign('primary'))).toMatchObject({
      '--theme-link-background': '#fffaf4',
      '--theme-link-title-color': '#291d0a',
      '--theme-link-subtitle-color': '#291d0a',
      '--theme-link-border-color': '#fffaf4',
    });
  });

  it('uses readable foregrounds on every primary and surface theme background', () => {
    const expectedPrimary = {
      z101: '#ffffff', z102: '#291d0a', z103: '#ffffff', z104: '#ffffff', z105: '#ffffff',
      z106: '#ffffff', z107: '#ffffff', z108: '#291d0a', z109: '#ffffff', z110: '#291d0a',
    };

    for (const theme of PUBLIC_PAGE_THEMES) {
      const primary = resolvePublicPageThemeVariables(theme, sectionDesign('primary'));
      expect(primary['--page-section-text'], `${theme.id} primary body`).toBe(expectedPrimary[theme.id as keyof typeof expectedPrimary]);
      expect(primary['--theme-heading-color'], `${theme.id} primary heading`).toBe(expectedPrimary[theme.id as keyof typeof expectedPrimary]);
      expect(primary['--avatar-title-color'], `${theme.id} primary avatar title`).toBe(expectedPrimary[theme.id as keyof typeof expectedPrimary]);
      expect(primary['--avatar-bio-color'], `${theme.id} primary avatar bio`).toBe(expectedPrimary[theme.id as keyof typeof expectedPrimary]);

      const surface = resolvePublicPageThemeVariables(theme, sectionDesign('secondary'));
      expect(surface['--page-section-text'], `${theme.id} surface body`).toBe('#291d0a');
      expect(surface['--theme-heading-color'], `${theme.id} surface heading`).toBe('#291d0a');
      expect(surface['--avatar-title-color'], `${theme.id} surface avatar title`).toBe('#291d0a');
      expect(surface['--avatar-bio-color'], `${theme.id} surface avatar bio`).toBe('#291d0a');
    }
  });

  it('derives custom section and link colors from their own effective backgrounds', () => {
    const theme = PUBLIC_PAGE_THEMES[2];
    const darkSection = resolvePublicPageThemeVariables(theme, sectionDesign('custom', { backgroundColor: '#151515' }));
    expect(darkSection).toMatchObject({
      '--page-section-text': '#ffffff', '--theme-heading-color': '#ffffff', '--theme-text-color': '#ffffff',
      '--avatar-title-color': '#ffffff', '--avatar-bio-color': '#ffffff',
    });

    const lightSectionAndLink = sectionDesign('custom', {
      backgroundColor: '#ffffff',
      linkStyle: {
        ...sectionDesign('custom').design.linkStyle,
        backgroundColor: '#151515', backgroundOpacity: 0,
      },
    });
    const lightVariables = resolvePublicPageThemeVariables(theme, lightSectionAndLink);
    expect(lightVariables['--page-section-text']).toBe('#291d0a');
    expect(lightVariables['--theme-link-title-color']).toBe('#291d0a');
    expect(lightVariables['--theme-link-subtitle-color']).toBe('#291d0a');

    const darkLink = resolvePublicPageThemeVariables(theme, sectionDesign('custom', {
      backgroundColor: '#ffffff',
      linkStyle: { ...sectionDesign('custom').design.linkStyle, backgroundColor: '#151515', backgroundOpacity: 1 },
    }));
    expect(darkLink['--theme-link-title-color']).toBe('#ffffff');
    expect(darkLink['--theme-link-subtitle-color']).toBe('#ffffff');
  });

  it('keeps page-level copy dark on the light page background', () => {
    for (const theme of PUBLIC_PAGE_THEMES) {
      const variables = resolvePublicPageThemeVariables(theme);
      expect(variables['--theme-heading-color'], `${theme.id} page heading`).toBe('#291d0a');
      expect(variables['--theme-text-color'], `${theme.id} page body`).toBe('#291d0a');
    }
  });

  it('keeps explicit section typography and link color overrides authoritative', () => {
    const base = sectionDesign('primary').design;
    const variables = resolvePublicPageThemeVariables(PUBLIC_PAGE_THEMES[2], sectionDesign('primary', {
      textColor: '#112233',
      headingStyle: { ...base.headingStyle, color: '#223344' },
      textStyle: { ...base.textStyle, color: '#334455' },
      linkStyle: {
        ...base.linkStyle,
        titleStyle: { ...base.linkStyle.titleStyle, color: '#445566' },
        subtitleStyle: { ...base.linkStyle.subtitleStyle, color: '#556677' },
      },
    }));

    expect(variables).toMatchObject({
      '--page-section-text': '#112233', '--theme-heading-color': '#223344', '--theme-text-color': '#334455',
      '--avatar-title-color': '#223344', '--avatar-bio-color': '#334455',
      '--theme-link-title-color': '#445566', '--theme-link-subtitle-color': '#556677',
    });
  });

  it('uses explicit section radius before the canonical theme section radius', () => {
    expect(sectionSurfaceRadius(12, 'leaf', 40)).toBe('12px');
    expect(sectionSurfaceRadius(null, 'leaf', 40)).toBe('40px');
  });

  it('atomically replaces palettes and marks coherent manual color edits custom', () => {
    const current = { ...PUBLIC_PAGE_THEMES[0], backgroundMediaId: 'background' };
    const selected = applyPublicPagePalette(current, PUBLIC_PAGE_THEMES[7]);
    expect(selected).toMatchObject({ id: 'z108', backgroundMediaId: 'background', colors: PUBLIC_PAGE_THEMES[7].colors });
    const custom = applyPublicPageThemeColors(selected, { primary: '#123456' });
    expect(custom).toMatchObject({ id: 'custom', name: 'Custom', colors: { primary: '#123456' } });
    expect(custom.tokens.colors.focus).toBe('#123456');
    expect(custom.styleDefaults.linkStyle.backgroundColor).toBe('#123456');
  });

  it('normalizes old theme documents additively and keeps approved mobile geometry', () => {
    const normalized = normalizeDocument({ theme: { colors: { background: '#abcabc' } } });
    expect(normalized.theme.colors.background).toBe('#abcabc');
    expect(normalized.theme.tokens.layout.blockRadius).toBe(40);
    expect(PUBLIC_PAGE_PREVIEW_GEOMETRY).toMatchObject({
      widths: { mobile: 375 }, frameBorder: 10, framedMobileOuterWidth: 395,
      shadow: 'rgba(0,0,0,.1) 0 7px 28px 7px',
    });
  });
});
