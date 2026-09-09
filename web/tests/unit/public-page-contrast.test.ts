import { describe, expect, it } from 'vitest';
import { PUBLIC_PAGE_THEMES } from '../../src/features/public-page-builder/config/themes';
import {
  analyzeBlockContrast,
  analyzePageContrast,
  analyzeSectionContrast,
  contrastRatio,
  minimumTextContrast,
} from '../../src/features/public-page-builder/model/contrast';
import type { PageBlock, PageSection, SectionDesign } from '../../src/features/public-page-builder/types/publicPage';

function section(changes: Partial<SectionDesign> = {}): PageSection {
  const design: SectionDesign = {
    variant: 'custom', backgroundColor: null, textColor: null, backgroundMediaId: null, backgroundOverlay: 0,
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
  };
  return { id: 'section', name: 'Section', visible: true, layout: 'single', design, blocks: [] };
}

function block(type: string, design: Partial<PageBlock['design']> = {}, content: Record<string, unknown> = {}): PageBlock {
  return {
    id: 'block', type, name: 'Block', visible: true, content,
    design: {
      backgroundColor: null, textColor: null, backgroundMediaId: null, backgroundOverlay: 0,
      backgroundFit: 'cover', backgroundPosition: '50% 50%', paddingTop: 0, paddingBottom: 0,
      borderRadius: null, ...design,
    },
  };
}

describe('public page contrast guidance', () => {
  it('uses the WCAG 2.2 relative luminance formula', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 10);
    expect(contrastRatio('#777', '#fff')).toBeCloseTo(4.478, 3);
    expect(contrastRatio('rgb(10 10 10)', 'white')).toBeCloseTo(19.798, 3);
  });

  it('parses supported CSS colors and composites alpha over a known background', () => {
    expect(contrastRatio('#000f', '#fff')).toBeCloseTo(21, 10);
    expect(contrastRatio('#ffffff80', '#000')).toBeCloseTo(5.317, 3);
    expect(contrastRatio('rgba(100%, 100%, 100%, 50%)', 'rgb(0 0 0)')).toBeCloseTo(5.281, 3);
    expect(contrastRatio('transparent', 'black')).toBe(1);
    expect(contrastRatio('hsl(0 0% 0%)', 'white')).toBeNull();
    expect(contrastRatio('red', 'white')).toBeNull();
    expect(contrastRatio('var(--text)', 'white')).toBeNull();
    expect(contrastRatio('white', 'rgba(0,0,0,.5)')).toBeNull();
  });

  it('uses the normal and large-text thresholds at the WCAG boundaries', () => {
    expect(minimumTextContrast(17, 700)).toBe(4.5);
    expect(minimumTextContrast(18.49, 700)).toBe(4.5);
    expect(minimumTextContrast(18.5, 700)).toBe(3);
    expect(minimumTextContrast(23.99, 600)).toBe(4.5);
    expect(minimumTextContrast(24, 400)).toBe(3);
  });

  it('analyzes solid page text while leaving image and preset surfaces unknown', () => {
    const solid = structuredClone(PUBLIC_PAGE_THEMES[0]);
    solid.colors.background = '#ffffff';
    solid.styleDefaults.headingStyle.color = '#000000';
    solid.styleDefaults.textStyle.color = '#000000';
    solid.tokens.typography.headingColor = '#000000';
    const solidChecks = analyzePageContrast(solid);
    expect(solidChecks.map(({ id }) => id)).toEqual([
      'page.heading', 'page.text', 'page.link-title', 'page.link-subtitle',
    ]);
    expect(solidChecks.find(({ id }) => id === 'page.heading')?.status).toBe('pass');

    const image = structuredClone(solid);
    image.backgroundMediaId = 'image';
    expect(analyzePageContrast(image).filter(({ id }) => id.startsWith('page.') && !id.includes('link-'))
      .every(({ status, reason }) => status === 'unknown' && reason === 'background-image')).toBe(true);

    const preset = structuredClone(solid);
    preset.backgroundPreset = 'aurora';
    expect(analyzePageContrast(preset).find(({ id }) => id === 'page.text')).toMatchObject({ status: 'unknown', reason: 'background-preset' });
  });

  it('uses the root h1 token and the independently configured page text color', () => {
    const theme = structuredClone(PUBLIC_PAGE_THEMES[0]);
    theme.colors.background = '#000000';
    theme.colors.text = '#111111';
    const checks = analyzePageContrast(theme);

    expect(checks.find(({ id }) => id === 'page.heading')).toMatchObject({ minimum: 3, status: 'pass' });
    expect(checks.find(({ id }) => id === 'page.text')).toMatchObject({ minimum: 4.5, status: 'fail' });
    expect(checks.find(({ id }) => id === 'page.text')?.ratio).toBeCloseTo(1.112, 3);
  });

  it('follows section variants, inheritance, and multiplied link opacity', () => {
    const theme = structuredClone(PUBLIC_PAGE_THEMES[0]);
    theme.colors.background = '#ffffff';
    const off = section({ variant: 'off', backgroundColor: null, textColor: null });
    expect(analyzeSectionContrast(theme, off).find(({ id }) => id === 'section.text')?.status).toBe('pass');

    const primary = section({ variant: 'primary', backgroundColor: null, textColor: '#ffffff' });
    expect(analyzeSectionContrast(theme, primary).find(({ id }) => id === 'section.text')?.status).toBe('pass');

    const translucentLink = section({
      backgroundColor: '#ffffff',
      linkStyle: {
        ...section().design.linkStyle,
        backgroundColor: 'rgba(0, 0, 0, 0.5)', backgroundOpacity: 0.5,
        titleStyle: { ...section().design.linkStyle.titleStyle, color: '#000000' },
      },
    });
    const linkRatio = analyzeSectionContrast(theme, translucentLink).find(({ id }) => id === 'section.link-title')?.ratio;
    expect(linkRatio).toBeCloseTo(11.45, 1);
  });

  it('analyzes block inheritance and custom solid surfaces', () => {
    const theme = structuredClone(PUBLIC_PAGE_THEMES[0]);
    theme.colors.background = '#ffffff';
    const parent = section({ backgroundColor: '#ffffff', textColor: '#000000' });
    const inherited = analyzeBlockContrast(theme, parent, block('avatar'));
    expect(inherited.find(({ id }) => id === 'block.heading')?.status).toBe('pass');

    const custom = analyzeBlockContrast(theme, parent, block('avatar', { backgroundColor: '#000000', textColor: '#ffffff' }));
    expect(custom.find(({ id }) => id === 'block.heading')?.status).toBe('pass');
    expect(custom.find(({ id }) => id === 'block.text')?.status).toBe('pass');

    const customButton = analyzeBlockContrast(theme, parent, block('button', {}, { color: '#ffffff', textColor: '#000000' }));
    expect(customButton).toEqual([expect.objectContaining({ id: 'block.link-title', status: 'pass' })]);
  });

  it('uses effective section and avatar typography at the large-text boundaries', () => {
    const theme = structuredClone(PUBLIC_PAGE_THEMES[0]);
    theme.colors.background = '#ffffff';
    const parent = section({
      backgroundColor: '#ffffff',
      headingStyle: { ...section().design.headingStyle, color: '#777777', fontSize: 18, fontWeight: 700 },
      textStyle: { ...section().design.textStyle, color: '#888888', fontSize: 24, fontWeight: 400 },
    });

    expect(analyzeBlockContrast(theme, parent, block('contacts')).find(({ id }) => id === 'block.heading'))
      .toMatchObject({ minimum: 4.5, status: 'fail' });
    expect(analyzeBlockContrast(theme, parent, block('text')).find(({ id }) => id === 'block.text'))
      .toMatchObject({ minimum: 3, status: 'pass' });

    const avatar = block('avatar', { backgroundColor: '#ffffff', textColor: '#777777' });
    const avatarChecks = analyzeBlockContrast(theme, section({ backgroundColor: '#ffffff' }), avatar);
    expect(theme.tokens.typography.avatarTitle).toMatchObject({ fontSize: 16, fontWeight: 700 });
    expect(avatarChecks.find(({ id }) => id === 'block.heading')).toMatchObject({ minimum: 4.5, status: 'fail' });
    expect(avatarChecks.find(({ id }) => id === 'block.text')).toMatchObject({ minimum: 4.5, status: 'fail' });
  });

  it('uses the canonical service card surface and keeps FAQ nested cards manual', () => {
    const theme = structuredClone(PUBLIC_PAGE_THEMES[0]);
    theme.colors.background = '#ffffff';
    theme.colors.surface = '#ffffff';
    const parent = section({ backgroundColor: '#ffffff' });
    const catalog = block('services', { backgroundColor: '#000000', textColor: '#ffffff' }, {
      serviceIds: [1], showBookingButton: true,
    });
    const catalogChecks = analyzeBlockContrast(theme, parent, catalog);

    expect(catalogChecks.find(({ id }) => id === 'block.heading')?.status).toBe('pass');
    expect(catalogChecks.find(({ id }) => id === 'block.card-heading')?.status).toBe('fail');
    expect(catalogChecks.find(({ id }) => id === 'block.card-text')?.status).toBe('fail');
    expect(catalogChecks.find(({ id }) => id === 'block.card-link-title')).toBeDefined();

    expect(analyzeBlockContrast(theme, parent, block('faq')).find(({ id }) => id === 'block.card-content'))
      .toMatchObject({ status: 'unknown', reason: 'nested-surface' });
  });

  it('leaves image blocks unknown except for a fully opaque black overlay', () => {
    const theme = PUBLIC_PAGE_THEMES[0];
    const parent = section({ backgroundColor: '#ffffff' });
    const image = block('avatar', { backgroundMediaId: 'image', backgroundOverlay: 0.6, textColor: '#ffffff' });
    expect(analyzeBlockContrast(theme, parent, image).find(({ id }) => id === 'block.heading'))
      .toMatchObject({ status: 'unknown', reason: 'background-image' });

    const blackOverlay = block('avatar', { backgroundMediaId: 'image', backgroundOverlay: 1, textColor: '#ffffff' });
    expect(analyzeBlockContrast(theme, parent, blackOverlay).find(({ id }) => id === 'block.heading')?.status).toBe('pass');

    const sectionImage = section({ backgroundMediaId: 'image', backgroundOverlay: 1, textColor: '#ffffff' });
    expect(analyzeSectionContrast(theme, sectionImage).find(({ id }) => id === 'section.text')?.status).toBe('pass');
  });

  it('never throws for unsupported colors and does not mutate inputs', () => {
    const theme = structuredClone(PUBLIC_PAGE_THEMES[0]);
    const parent = section({ backgroundColor: 'linear-gradient(red, blue)', textColor: 'var(--text)' });
    const value = block('faq', { backgroundColor: 'hsl(0 0% 100%)', textColor: 'rebeccapurple' });
    const before = JSON.stringify({ theme, parent, value });

    expect(() => analyzePageContrast({ ...theme, colors: { ...theme.colors, background: 'invalid' } })).not.toThrow();
    expect(() => analyzeSectionContrast(theme, parent)).not.toThrow();
    expect(() => analyzeBlockContrast(theme, parent, value)).not.toThrow();
    expect(analyzeBlockContrast(theme, parent, value).every(({ status }) => status === 'unknown')).toBe(true);
    expect(JSON.stringify({ theme, parent, value })).toBe(before);
  });
});
