import { describe, expect, it } from 'vitest';
import {
  isValidPublicPageSlug,
  publicPageDocumentSchema,
  validatePublicPageForPublish,
} from '../src/config/publicPageSchemas.js';
import { validPublicPageDocument } from './publicPageTestFixture.js';

const emptyTypographyOverride = () => ({
  fontFamily: null,
  fontSize: null,
  fontWeight: null,
  fontStyle: null,
  color: null,
});

const defaultStyleDefaults = () => ({
  sectionBorderRadius: 0,
  blockBorderRadius: 24,
  headingStyle: {
    fontFamily: 'Inter, system-ui, sans-serif', fontSize: 32, fontWeight: 700,
    fontStyle: 'normal', color: '#111827',
  },
  textStyle: {
    fontFamily: 'Inter, system-ui, sans-serif', fontSize: 16, fontWeight: 400,
    fontStyle: 'normal', color: '#111827',
  },
  linkStyle: {
    titleStyle: {
      fontFamily: 'Inter, system-ui, sans-serif', fontSize: 16, fontWeight: 600,
      fontStyle: 'normal', color: '#111827',
    },
    subtitleStyle: {
      fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14, fontWeight: 400,
      fontStyle: 'normal', color: '#111827',
    },
    backgroundColor: '#fff', backgroundOpacity: 1, borderWidth: 0,
    borderColor: 'transparent', shadow: false,
  },
});

describe('public page schemas', () => {
  it('matches slug formatting and reserved rules', () => {
    expect(isValidPublicPageSlug('my-page')).toBe(true);
    expect(isValidPublicPageSlug('Public-Pages')).toBe(false);
    expect(isValidPublicPageSlug('-bad')).toBe(false);
  });

  it('allows unknown blocks structurally but rejects them for publish', () => {
    const document = structuredClone(validPublicPageDocument);
    document.sections[0]!.blocks[0]!.type = 'future-block';
    const parsed = publicPageDocumentSchema.safeParse(document);
    expect(parsed.success).toBe(true);
    expect(validatePublicPageForPublish(parsed.data!).map((issue) => issue.code)).toContain('unknown_block');
  });

  it.each([
    'facebook-messenger', 'vk', 'whatsapp', 'viber', 'telegram',
    'facebook', 'threads', 'instagram', 'tiktok',
  ])('allows social-button platform %s on publish', (platform) => {
    const document = publicPageDocumentSchema.parse({
      ...validPublicPageDocument,
      sections: [{
        ...validPublicPageDocument.sections[0],
        blocks: [{
          ...validPublicPageDocument.sections[0]!.blocks[0],
          type: 'social-button',
          content: { platform, label: 'Follow us', url: 'https://example.com/profile' },
        }],
      }],
    });

    expect(validatePublicPageForPublish(document)).toEqual([]);
  });

  it.each(['x', 'linkedin', 'youtube', 'Telegram', '', 'unknown'])(
    'rejects social-button platform %s at the schema boundary',
    (platform) => {
      const parsed = publicPageDocumentSchema.safeParse({
        ...validPublicPageDocument,
        sections: [{
          ...validPublicPageDocument.sections[0],
          blocks: [{
            ...validPublicPageDocument.sections[0]!.blocks[0],
            type: 'social-button',
            content: { platform, label: 'Follow us', url: 'https://example.com/profile' },
          }],
        }],
      });

      expect(parsed.success).toBe(false);
    },
  );

  it.each([
    [{ platform: 'telegram', label: '', url: 'https://example.com/profile' }, 'label is required'],
    [{ platform: 'telegram', label: 'Chat', url: '' }, 'url is required'],
    [{ platform: 'telegram', label: 'Chat', url: 'javascript:alert(1)' }, 'url is unsafe'],
    [{ platform: 'telegram', label: 'Chat', url: 'ftp://example.com/profile' }, 'url is unsafe'],
  ])('rejects invalid social-button content %# at the schema boundary', (content) => {
    const parsed = publicPageDocumentSchema.safeParse({
      ...validPublicPageDocument,
      sections: [{
        ...validPublicPageDocument.sections[0],
        blocks: [{
          ...validPublicPageDocument.sections[0]!.blocks[0], type: 'social-button', content,
        }],
      }],
    });

    expect(parsed.success).toBe(false);
  });

  it.each(['socials', 'messengers'])(
    'rejects removed grouped block type %s at the schema boundary',
    (type) => {
      const parsed = publicPageDocumentSchema.safeParse({
        ...validPublicPageDocument,
        sections: [{
          ...validPublicPageDocument.sections[0],
          blocks: [{
            ...validPublicPageDocument.sections[0]!.blocks[0],
            type,
            content: { links: [{ label: 'Chat', url: 'https://example.com/profile' }] },
          }],
        }],
      });

      expect(parsed.success).toBe(false);
    },
  );

  it.each([
    { platform: 'telegram', label: 'Chat', url: 'https://example.com', links: [] },
    { platform: 'telegram', label: '   ', url: 'https://example.com' },
    { platform: 'telegram', label: 'Chat', url: '   ' },
    { platform: 'telegram', label: 'Chat', url: 'ftp://example.com' },
    { platform: 'linkedin', label: 'Chat', url: 'https://example.com' },
  ])('rejects invalid social-button content at the schema boundary %#', (content) => {
    expect(publicPageDocumentSchema.safeParse({
      ...validPublicPageDocument,
      sections: [{
        ...validPublicPageDocument.sections[0],
        blocks: [{
          ...validPublicPageDocument.sections[0]!.blocks[0], type: 'social-button', content,
        }],
      }],
    }).success).toBe(false);
  });

  it('rejects duplicate social platforms across the document at save and publish boundaries', () => {
    const duplicateDocument = {
      ...validPublicPageDocument,
      sections: [{
        ...validPublicPageDocument.sections[0],
        blocks: ['social-1', 'social-2'].map((id) => ({
          ...validPublicPageDocument.sections[0]!.blocks[0],
          id,
          type: 'social-button',
          content: { platform: 'telegram', label: 'Chat', url: 'https://example.com' },
        })),
      }],
    };
    expect(publicPageDocumentSchema.safeParse(duplicateDocument).success).toBe(false);

    const document = publicPageDocumentSchema.parse({
      ...duplicateDocument,
      sections: [{
        ...duplicateDocument.sections[0],
        blocks: [duplicateDocument.sections[0]!.blocks[0]],
      }],
    });
    document.sections[0]!.blocks.push({
      ...document.sections[0]!.blocks[0]!,
      id: 'social-2',
    });
    expect(validatePublicPageForPublish(document)).toContainEqual(expect.objectContaining({
      code: 'invalid_block',
      path: 'blocks.social-2',
      detail: 'duplicate_social_platform',
    }));
  });

  it('rejects duplicate stable ids', () => {
    expect(publicPageDocumentSchema.safeParse({
      ...validPublicPageDocument,
      sections: [{ ...validPublicPageDocument.sections[0], id: 'page-1' }],
    }).success).toBe(false);
  });

  it('accepts document ids up to 128 characters', () => {
    expect(publicPageDocumentSchema.safeParse({
      ...validPublicPageDocument,
      id: 'x'.repeat(128),
    }).success).toBe(true);
    expect(publicPageDocumentSchema.safeParse({
      ...validPublicPageDocument,
      id: 'x'.repeat(129),
    }).success).toBe(false);
  });

  it('defaults additive section design for legacy documents', () => {
    const parsed = publicPageDocumentSchema.parse(validPublicPageDocument);
    expect(parsed.sections[0]!.design).toEqual({
      backgroundColor: null,
      textColor: null,
      backgroundMediaId: null,
      backgroundOverlay: 0,
      backgroundFit: 'cover',
      backgroundPosition: '50% 50%',
      variant: 'custom',
      paddingTop: 0,
      paddingBottom: 0,
      horizontalMargin: false,
      borderRadius: null,
      borderWidth: 0,
      borderColor: null,
      shadow: false,
      width: 'full',
      mobileVisible: true,
      headingStyle: emptyTypographyOverride(),
      textStyle: emptyTypographyOverride(),
      linkStyle: {
        titleStyle: emptyTypographyOverride(),
        subtitleStyle: emptyTypographyOverride(),
        backgroundColor: null,
        backgroundOpacity: null,
        borderWidth: null,
        borderColor: null,
        shadow: null,
      },
    });
    expect(parsed.sections[0]!.blocks[0]!.design).toEqual({
      backgroundColor: null,
      textColor: null,
      paddingTop: 0,
      paddingBottom: 0,
      borderRadius: null,
    });
    expect(parsed.theme.styleDefaults).toEqual({
      sectionBorderRadius: 0,
      blockBorderRadius: 24,
      headingStyle: {
        fontFamily: 'Inter, system-ui, sans-serif', fontSize: 32, fontWeight: 700,
        fontStyle: 'normal', color: '#111',
      },
      textStyle: {
        fontFamily: 'Inter, system-ui, sans-serif', fontSize: 16, fontWeight: 400,
        fontStyle: 'normal', color: '#111',
      },
      linkStyle: {
        titleStyle: {
          fontFamily: 'Inter, system-ui, sans-serif', fontSize: 16, fontWeight: 600,
          fontStyle: 'normal', color: '#111',
        },
        subtitleStyle: {
          fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14, fontWeight: 400,
          fontStyle: 'normal', color: '#111',
        },
        backgroundColor: '#fff', backgroundOpacity: 1, borderWidth: 0,
        borderColor: 'transparent', shadow: false,
      },
    });
  });

  it('derives omitted legacy theme style defaults from that theme', () => {
    const parsed = publicPageDocumentSchema.parse({
      ...validPublicPageDocument,
      theme: {
        ...validPublicPageDocument.theme,
        fontFamily: 'Merriweather, serif',
        colors: {
          ...validPublicPageDocument.theme.colors,
          text: '#243142',
          surface: '#f3ead8',
        },
      },
    });
    expect(parsed.theme.styleDefaults.headingStyle).toMatchObject({
      fontFamily: 'Merriweather, serif',
      color: '#243142',
    });
    expect(parsed.theme.styleDefaults.textStyle).toMatchObject({
      fontFamily: 'Merriweather, serif',
      color: '#243142',
    });
    expect(parsed.theme.styleDefaults.linkStyle).toMatchObject({
      titleStyle: { fontFamily: 'Merriweather, serif', color: '#243142' },
      subtitleStyle: { fontFamily: 'Merriweather, serif', color: '#243142' },
      backgroundColor: '#f3ead8',
    });
  });

  it('defaults legacy theme rounding and validates explicit rounding styles', () => {
    expect(publicPageDocumentSchema.parse(validPublicPageDocument).theme.roundingStyle).toBe('rounded');

    for (const roundingStyle of ['rounded', 'pill', 'leaf', 'square'] as const) {
      const parsed = publicPageDocumentSchema.safeParse({
        ...validPublicPageDocument,
        theme: { ...validPublicPageDocument.theme, roundingStyle },
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data.theme.roundingStyle).toBe(roundingStyle);
    }

    expect(publicPageDocumentSchema.safeParse({
      ...validPublicPageDocument,
      theme: { ...validPublicPageDocument.theme, roundingStyle: 'soft' },
    }).success).toBe(false);
  });

  it('defaults legacy link style preset and validates explicit presets', () => {
    expect(publicPageDocumentSchema.parse(validPublicPageDocument).theme.linkStylePreset)
      .toBe('primary-fill');

    const presets = [
      'primary-fill', 'primary-shadow', 'primary-strong', 'primary-outline',
      'surface-fill', 'surface-outline', 'surface-shadow', 'surface-strong',
    ] as const;
    for (const linkStylePreset of presets) {
      const parsed = publicPageDocumentSchema.safeParse({
        ...validPublicPageDocument,
        theme: { ...validPublicPageDocument.theme, linkStylePreset },
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data.theme.linkStylePreset).toBe(linkStylePreset);
    }

    expect(publicPageDocumentSchema.safeParse({
      ...validPublicPageDocument,
      theme: { ...validPublicPageDocument.theme, linkStylePreset: 'primary-raised' },
    }).success).toBe(false);
  });

  it('defaults legacy theme background settings and validates background fit', () => {
    const parsed = publicPageDocumentSchema.parse(validPublicPageDocument);
    expect(parsed.theme).toMatchObject({
      backgroundMediaId: null,
      backgroundPreset: null,
      backgroundFit: 'cover',
      backgroundPosition: '50% 50%',
    });

    expect(publicPageDocumentSchema.safeParse({
      ...validPublicPageDocument,
      theme: { ...validPublicPageDocument.theme, backgroundFit: 'contain' },
    }).success).toBe(true);
    expect(publicPageDocumentSchema.safeParse({
      ...validPublicPageDocument,
      theme: { ...validPublicPageDocument.theme, backgroundFit: 'stretch' },
    }).success).toBe(false);
    expect(publicPageDocumentSchema.safeParse({
      ...validPublicPageDocument,
      theme: { ...validPublicPageDocument.theme, backgroundPosition: '' },
    }).success).toBe(false);
  });

  it('preserves explicit zero styling values and defaults partial overrides to null', () => {
    const parsed = publicPageDocumentSchema.parse({
      ...validPublicPageDocument,
      theme: {
        ...validPublicPageDocument.theme,
        styleDefaults: {
          ...defaultStyleDefaults(),
          sectionBorderRadius: 0,
          blockBorderRadius: 0,
          linkStyle: {
            ...defaultStyleDefaults().linkStyle, backgroundOpacity: 0, borderWidth: 0,
          },
        },
      },
      sections: [{
        ...validPublicPageDocument.sections[0],
        design: {
          borderRadius: 0,
          headingStyle: { fontSize: 8, fontWeight: 100 },
          linkStyle: { backgroundOpacity: 0, borderWidth: 0, titleStyle: { fontSize: 8 } },
        },
        blocks: [{ ...validPublicPageDocument.sections[0]!.blocks[0], design: {
          ...validPublicPageDocument.sections[0]!.blocks[0]!.design, borderRadius: 0,
        } }],
      }],
    });
    expect(parsed.theme.styleDefaults.blockBorderRadius).toBe(0);
    expect(parsed.theme.styleDefaults.linkStyle.backgroundOpacity).toBe(0);
    expect(parsed.sections[0]!.design.headingStyle).toEqual({
      ...emptyTypographyOverride(), fontSize: 8, fontWeight: 100,
    });
    expect(parsed.sections[0]!.design.linkStyle).toMatchObject({
      backgroundOpacity: 0,
      borderWidth: 0,
      titleStyle: { ...emptyTypographyOverride(), fontSize: 8 },
      subtitleStyle: emptyTypographyOverride(),
    });
    expect(parsed.sections[0]!.design.borderRadius).toBe(0);
    expect(parsed.sections[0]!.blocks[0]!.design.borderRadius).toBe(0);
  });

  it.each([
    ['font size below minimum', { headingStyle: { fontSize: 7 } }],
    ['font size above maximum', { textStyle: { fontSize: 97 } }],
    ['font weight below minimum', { headingStyle: { fontWeight: 99 } }],
    ['non-integer font weight', { headingStyle: { fontWeight: 450.5 } }],
    ['opacity above maximum', { linkStyle: { backgroundOpacity: 1.01 } }],
    ['border above maximum', { linkStyle: { borderWidth: 17 } }],
    ['radius above maximum', { borderRadius: 101 }],
  ])('rejects %s', (_name, design) => {
    expect(publicPageDocumentSchema.safeParse({
      ...validPublicPageDocument,
      sections: [{ ...validPublicPageDocument.sections[0], design }],
    }).success).toBe(false);
  });

  it('accepts bounded section design values and rejects values outside the bounds', () => {
    const withDesign = (design: Record<string, unknown>) => ({
      ...validPublicPageDocument,
      sections: [{ ...validPublicPageDocument.sections[0], design }],
    });
    expect(publicPageDocumentSchema.safeParse(withDesign({
      paddingTop: 160,
      paddingBottom: 160,
      borderRadius: 100,
      borderWidth: 16,
      backgroundMediaId: null,
      backgroundOverlay: 1,
      backgroundFit: 'contain',
      backgroundPosition: 'center top',
      variant: 'secondary',
      shadow: true,
      width: 'contained',
      mobileVisible: false,
    })).success).toBe(true);
    expect(publicPageDocumentSchema.safeParse(withDesign({ paddingTop: 161 })).success).toBe(false);
    expect(publicPageDocumentSchema.safeParse(withDesign({ paddingBottom: -1 })).success).toBe(false);
    expect(publicPageDocumentSchema.safeParse(withDesign({ borderRadius: 101 })).success).toBe(false);
    expect(publicPageDocumentSchema.safeParse(withDesign({ borderWidth: 17 })).success).toBe(false);
    expect(publicPageDocumentSchema.safeParse(withDesign({ backgroundOverlay: 1.01 })).success).toBe(false);
    expect(publicPageDocumentSchema.safeParse(withDesign({ backgroundFit: 'stretch' })).success).toBe(false);
    expect(publicPageDocumentSchema.safeParse(withDesign({ variant: 'tertiary' })).success).toBe(false);
    expect(publicPageDocumentSchema.safeParse(withDesign({ width: 'wide' })).success).toBe(false);
  });

  it.each(['off', 'custom', 'primary', 'secondary'] as const)(
    'accepts section design variant %s',
    (variant) => {
      expect(publicPageDocumentSchema.safeParse({
        ...validPublicPageDocument,
        sections: [{ ...validPublicPageDocument.sections[0], design: { variant } }],
      }).success).toBe(true);
    },
  );

  it('accepts bounded block padding and rejects values outside the bounds', () => {
    const withBlockDesign = (design: Record<string, unknown>) => ({
      ...validPublicPageDocument,
      sections: [{
        ...validPublicPageDocument.sections[0],
        blocks: [{ ...validPublicPageDocument.sections[0]!.blocks[0], design }],
      }],
    });
    expect(publicPageDocumentSchema.safeParse(withBlockDesign({
      backgroundColor: null,
      textColor: null,
      paddingTop: 160,
      paddingBottom: 160,
      futureDesignField: true,
    })).success).toBe(true);
    expect(publicPageDocumentSchema.safeParse(withBlockDesign({
      backgroundColor: null, textColor: null, paddingTop: -1,
    })).success).toBe(false);
    expect(publicPageDocumentSchema.safeParse(withBlockDesign({
      backgroundColor: null, textColor: null, paddingBottom: 161,
    })).success).toBe(false);
  });

  it('rejects a missing section background media reference on publish', () => {
    const document = publicPageDocumentSchema.parse({
      ...validPublicPageDocument,
      sections: [{
        ...validPublicPageDocument.sections[0],
        design: { backgroundMediaId: 'missing-media' },
      }],
    });
    expect(validatePublicPageForPublish(document)).toContainEqual({
      code: 'missing_media',
      path: 'sections.0.design.backgroundMediaId',
    });
  });

  it('rejects a missing theme background media reference on publish', () => {
    const document = publicPageDocumentSchema.parse({
      ...validPublicPageDocument,
      theme: { ...validPublicPageDocument.theme, backgroundMediaId: 'missing-media' },
    });
    expect(validatePublicPageForPublish(document)).toContainEqual({
      code: 'missing_media',
      path: 'theme.backgroundMediaId',
    });
  });

  it('requires absolute HTTPS media URLs for publish', () => {
    const document = publicPageDocumentSchema.parse({
      ...validPublicPageDocument,
      media: [{
        id: 'media-1',
        url: 'https://cdn.example.com/image.webp',
        mimeType: 'image/webp',
        alt: 'Example',
        width: 640,
        height: 480,
      }],
    });
    expect(validatePublicPageForPublish(document)).not.toContainEqual(expect.objectContaining({
      code: 'invalid_media',
    }));
  });

  it.each([
    'http://cdn.example.com/image.webp',
    '/image.webp',
    'blob:https://example.com/asset',
    'data:image/png;base64,AAAA',
    'not a url',
    'https://',
    'ftp://cdn.example.com/image.webp',
  ])('rejects non-HTTPS media URL %s for publish', (url) => {
    const document = publicPageDocumentSchema.parse({
      ...validPublicPageDocument,
      media: [{
        id: 'media-1',
        url,
        mimeType: 'image/webp',
        alt: 'Example',
        width: 640,
        height: 480,
      }],
    });
    expect(validatePublicPageForPublish(document)).toContainEqual({
      code: 'invalid_media',
      path: 'media.0.url',
      detail: 'https_url_required',
    });
  });

  it('keeps repairable invalid media URLs structurally saveable as drafts', () => {
    expect(publicPageDocumentSchema.safeParse({
      ...validPublicPageDocument,
      media: [{
        id: 'media-1',
        url: 'blob:https://example.com/asset',
        mimeType: 'image/webp',
        alt: 'Example',
        width: 640,
        height: 480,
      }],
    }).success).toBe(true);
  });

  it.each([
    ['empty hero title', 'hero', { title: '', action: { type: 'booking' } }, 'invalid_block'],
    ['image without media and alt', 'image', { imageMediaId: null, alt: '' }, 'invalid_block'],
    ['unsafe map url', 'map', { address: 'Office', url: 'javascript:alert(1)' }, 'invalid_block'],
    ['unsafe link action', 'links', {
      links: [{ id: 'link-1', label: 'Open', action: { type: 'url', url: 'javascript:alert(1)' } }],
    }, 'invalid_cta'],
    ['malformed link action', 'links', {
      links: [{ id: 'link-1', label: 'Open', action: { type: 'url' } }],
    }, 'invalid_cta'],
    ['unavailable booking block', 'booking', { label: 'Book now' }, 'invalid_block'],
    ['unavailable booking action', 'links', {
      links: [{ id: 'link-1', label: 'Book now', action: { type: 'booking' } }],
    }, 'invalid_cta'],
    ['missing action label', 'links', {
      links: [{ id: 'link-1', label: '', action: { type: 'booking' } }],
    }, 'invalid_block'],
  ])('rejects %s on publish', (_name, type, content, expectedCode) => {
    const parsed = publicPageDocumentSchema.parse({
      ...validPublicPageDocument,
      sections: [{
        ...validPublicPageDocument.sections[0],
        blocks: [{ ...validPublicPageDocument.sections[0]!.blocks[0], type, content }],
      }],
    });
    expect(validatePublicPageForPublish(parsed).map((issue) => issue.code)).toContain(expectedCode);
  });

  it.each([
    ['avatar with a media reference', 'avatar', { heading: 'Profile', imageMediaId: 'media-1' }],
    ['avatar with image content', 'avatar', { heading: 'Profile', imageMediaId: null, imageUrl: '/placeholder.svg' }],
    ['button with an existing CTA action', 'button', {
      label: 'Visit', action: { type: 'url', url: 'https://example.com' },
    }],
    ['legacy hero', 'hero', { title: 'Welcome' }],
  ])('allows %s on publish', (_name, type, content) => {
    const media = type === 'avatar' && 'imageMediaId' in content && content.imageMediaId
      ? [{
        id: 'media-1',
        url: 'https://cdn.example.com/avatar.webp',
        mimeType: 'image/webp' as const,
        alt: 'Profile',
        width: 320,
        height: 320,
      }] : [];
    const parsed = publicPageDocumentSchema.parse({
      ...validPublicPageDocument,
      sections: [{
        ...validPublicPageDocument.sections[0],
        blocks: [{ ...validPublicPageDocument.sections[0]!.blocks[0], type, content }],
      }],
      media,
    });
    expect(validatePublicPageForPublish(parsed)).toEqual([]);
  });

  it.each([
    ['image', { imageMediaId: 'media-1', alt: 'Portrait' }],
    ['gallery', { images: [{ mediaId: 'media-1', alt: 'Portrait' }] }],
  ])('allows upload-only %s content on publish', (type, content) => {
    const parsed = publicPageDocumentSchema.parse({
      ...validPublicPageDocument,
      sections: [{
        ...validPublicPageDocument.sections[0],
        blocks: [{ ...validPublicPageDocument.sections[0]!.blocks[0], type, content }],
      }],
      media: [{
        id: 'media-1', url: 'https://cdn.example.com/image.webp', mimeType: 'image/webp' as const,
        alt: 'Portrait', width: 320, height: 320,
      }],
    });
    expect(validatePublicPageForPublish(parsed)).toEqual([]);
  });

  it.each([
    ['avatar without heading', 'avatar', { heading: '', imageUrl: '/placeholder.svg' }],
    ['avatar without an image', 'avatar', { heading: 'Profile', imageMediaId: null, imageUrl: '' }],
    ['button without a label', 'button', {
      label: '', action: { type: 'url', url: 'https://example.com' },
    }],
    ['button without an action', 'button', { label: 'Visit' }],
    ['button with an invalid action', 'button', {
      label: 'Visit', action: { type: 'url', url: 'javascript:alert(1)' },
    }],
  ])('rejects %s on publish', (_name, type, content) => {
    const parsed = publicPageDocumentSchema.parse({
      ...validPublicPageDocument,
      sections: [{
        ...validPublicPageDocument.sections[0],
        blocks: [{ ...validPublicPageDocument.sections[0]!.blocks[0], type, content }],
      }],
    });
    expect(validatePublicPageForPublish(parsed).length).toBeGreaterThan(0);
  });
});
