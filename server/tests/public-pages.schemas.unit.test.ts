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

function setPath(target: Record<string, any>, path: string, value: unknown): void {
  const parts = path.split('.');
  const key = parts.pop()!;
  const parent = parts.reduce<Record<string, any>>((current, part) => current[part], target);
  parent[key] = value;
}

describe('public page schemas', () => {
  it('matches slug formatting and reserved rules', () => {
    expect(isValidPublicPageSlug('my-page')).toBe(true);
    expect(isValidPublicPageSlug('Public-Pages')).toBe(false);
    expect(isValidPublicPageSlug('-bad')).toBe(false);
  });

  it('rejects unknown blocks at the document boundary', () => {
    const document = structuredClone(validPublicPageDocument);
    document.sections[0]!.blocks[0]!.type = 'future-block';
    expect(publicPageDocumentSchema.safeParse(document).success).toBe(false);
  });

  it('requires visible non-whitespace content in rich text blocks', () => {
    const document = structuredClone(validPublicPageDocument);
    const block = document.sections[0]!.blocks[0]!;
    block.type = 'text';
    block.content = { document: { type: 'rich-text-v1', paragraphs: [{ size: 'medium', fontFamily: null, alignment: 'left', runs: [{ text: '  ' }] }] } };
    expect(validatePublicPageForPublish(publicPageDocumentSchema.parse(document))).toContainEqual(expect.objectContaining({
      code: 'invalid_block', detail: 'document is required', path: `blocks.${block.id}`,
    }));
    block.content = { document: { paragraphs: [{ runs: [{ text: 'Visible' }] }] } };
    expect(publicPageDocumentSchema.safeParse(document).success).toBe(false);
    block.content = { document: { type: 'rich-text-v1', paragraphs: [{ size: 'medium', fontFamily: null, alignment: 'left', runs: [{ text: 'Visible' }] }] } };
    expect(validatePublicPageForPublish(publicPageDocumentSchema.parse(document))).not.toContainEqual(expect.objectContaining({
      code: 'invalid_block', path: `blocks.${block.id}`,
    }));
  });

  it('accepts an empty ID-based services selection in a draft but rejects it on publish', () => {
    const parsed = publicPageDocumentSchema.safeParse({
      ...validPublicPageDocument,
      sections: [{
        ...validPublicPageDocument.sections[0],
        blocks: [{
          ...validPublicPageDocument.sections[0]!.blocks[0],
          type: 'services',
          content: {
            title: 'Services',
            serviceIds: [],
            autoplayIntervalSeconds: null,
            showBookingButton: true,
          },
        }],
      }],
    });

    expect(parsed.success).toBe(true);
    expect(validatePublicPageForPublish(parsed.data!)).toContainEqual(expect.objectContaining({
      code: 'invalid_block',
      detail: 'serviceIds must contain at least one service',
    }));
  });

  it('accepts valid ID-based services content on publish', () => {
    const document = publicPageDocumentSchema.parse({
      ...validPublicPageDocument,
      sections: [{
        ...validPublicPageDocument.sections[0],
        blocks: [{
          ...validPublicPageDocument.sections[0]!.blocks[0],
          type: 'services',
          content: {
            title: 'Services',
            serviceIds: [3, 9],
            autoplayIntervalSeconds: 5,
            showBookingButton: false,
          },
        }],
      }],
    });

    expect(validatePublicPageForPublish(document)).toEqual([]);
  });

  it.each([
    ['duplicate service IDs', [3, 3], null, true],
    ['non-positive service IDs', [0], null, true],
    ['more than 12 service IDs', Array.from({ length: 13 }, (_, index) => index + 1), null, true],
    ['autoplay below 3 seconds', [3], 2, true],
    ['autoplay above 30 seconds', [3], 31, true],
    ['non-integer autoplay', [3], 3.5, true],
    ['non-boolean booking flag', [3], null, 'true'],
  ])('rejects ID-based services content with %s at the schema boundary', (
    _name,
    serviceIds,
    autoplayIntervalSeconds,
    showBookingButton,
  ) => {
    expect(publicPageDocumentSchema.safeParse({
      ...validPublicPageDocument,
      sections: [{
        ...validPublicPageDocument.sections[0],
        blocks: [{
          ...validPublicPageDocument.sections[0]!.blocks[0],
          type: 'services',
          content: { serviceIds, autoplayIntervalSeconds, showBookingButton },
        }],
      }],
    }).success).toBe(false);
  });

  it('rejects legacy inline services content without runtime conversion', () => {
    const content = {
      title: 'Services',
      services: [{ id: 'service-1', title: 'Consultation', description: '', price: '100 RUB' }],
    };
    expect(publicPageDocumentSchema.safeParse({
      ...validPublicPageDocument,
      sections: [{
        ...validPublicPageDocument.sections[0],
        blocks: [{
          ...validPublicPageDocument.sections[0]!.blocks[0], type: 'services', content,
        }],
      }],
    }).success).toBe(false);
  });

  const contactsDocument = (contacts: unknown[]) => publicPageDocumentSchema.parse({
    ...validPublicPageDocument,
    sections: [{
      ...validPublicPageDocument.sections[0],
      blocks: [{
        ...validPublicPageDocument.sections[0]!.blocks[0],
        type: 'contacts',
        content: { title: 'Contacts', contacts },
      }],
    }],
  });

  it.each([
    ['website', { type: 'url', url: 'https://example.com/contact' }],
    ['phone', { type: 'phone', phone: '+15551234567' }],
    ['email', { type: 'email', email: 'hello@example.com' }],
    ['messenger', { type: 'messenger', url: 'https://t.me/example' }],
  ])('allows canonical %s contact actions on publish', (_name, action) => {
    expect(validatePublicPageForPublish(contactsDocument([
      { id: 'contact-1', label: 'Contact us', action },
    ]))).toEqual([]);
  });

  it.each([
    'https://example.com/contact',
    'http://example.com/contact',
    'tel:+15551234567',
    'mailto:hello@example.com',
  ])('rejects legacy contact URL %s at the schema boundary', (url) => {
    expect(() => contactsDocument([
      { id: 'contact-1', label: 'Contact us', url },
    ])).toThrow();
  });

  it('rejects mixed canonical and legacy contact fields', () => {
    expect(() => contactsDocument([{
      id: 'contact-1',
      label: 'Contact us',
      action: { type: 'url', url: 'https://example.com/contact' },
      url: 'https://example.com/contact',
    }])).toThrow();
  });

  it.each([
    ['missing action', [{ id: 'contact-1', label: 'Contact us' }]],
    ['legacy URL', [{ id: 'contact-1', label: 'Contact us', url: 'javascript:alert(1)' }]],
  ])('rejects contacts with %s at the schema boundary', (_name, contacts) => {
    expect(() => contactsDocument(contacts)).toThrow();
  });

  it.each([
    ['empty contacts list', [], 'contacts must contain at least one contact'],
    ['blank contact label', [{
      id: 'contact-1', label: '  ', action: { type: 'email', email: 'hello@example.com' },
    }], 'contacts.0.label is required'],
  ])('rejects canonical contacts with %s on publish', (_name, contacts, detail) => {
    expect(validatePublicPageForPublish(contactsDocument(contacts))).toContainEqual(expect.objectContaining({
      code: 'invalid_block', detail,
    }));
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

  it.each([
    ['section.design', (document: any) => { delete document.sections[0].design; }],
    ['block.design.backgroundMediaId', (document: any) => { delete document.sections[0].blocks[0].design.backgroundMediaId; }],
    ['section.design.headingStyle.color', (document: any) => { delete document.sections[0].design.headingStyle.color; }],
    ['section.design.linkStyle.shadow', (document: any) => { delete document.sections[0].design.linkStyle.shadow; }],
    ['theme.swatches', (document: any) => { delete document.theme.swatches; }],
    ['theme.tokens', (document: any) => { delete document.theme.tokens; }],
    ['theme.fontFamily', (document: any) => { delete document.theme.fontFamily; }],
    ['theme.roundingStyle', (document: any) => { delete document.theme.roundingStyle; }],
    ['theme.backgroundMediaId', (document: any) => { delete document.theme.backgroundMediaId; }],
    ['theme.backgroundPreset', (document: any) => { delete document.theme.backgroundPreset; }],
    ['theme.backgroundFit', (document: any) => { delete document.theme.backgroundFit; }],
    ['theme.backgroundPosition', (document: any) => { delete document.theme.backgroundPosition; }],
    ['theme.linkStylePreset', (document: any) => { delete document.theme.linkStylePreset; }],
    ['theme.styleDefaults', (document: any) => { delete document.theme.styleDefaults; }],
  ])('rejects v2 documents missing persisted field %s', (_path, remove) => {
    const document = structuredClone(validPublicPageDocument);
    remove(document);
    expect(publicPageDocumentSchema.safeParse(document).success).toBe(false);
  });

  it.each([
    'theme.swatches.0',
    'theme.colors.background',
    'theme.colors.surface',
    'theme.colors.text',
    'theme.colors.primary',
    'theme.fontFamily',
    'theme.tokens.colors.contrast',
    'theme.tokens.colors.linkTitle',
    'theme.tokens.colors.linkSubtitle',
    'theme.tokens.colors.linkShadow',
    'theme.tokens.colors.linkBorder',
    'theme.tokens.colors.focus',
    'theme.tokens.colors.checkboxBackground',
    'theme.tokens.typography.fontFamily',
    'theme.tokens.typography.headingColor',
    'theme.tokens.typography.avatarTitle.fontFamily',
    'theme.styleDefaults.headingStyle.fontFamily',
    'theme.styleDefaults.headingStyle.color',
    'theme.styleDefaults.textStyle.fontFamily',
    'theme.styleDefaults.textStyle.color',
    'theme.styleDefaults.linkStyle.titleStyle.fontFamily',
    'theme.styleDefaults.linkStyle.titleStyle.color',
    'theme.styleDefaults.linkStyle.subtitleStyle.fontFamily',
    'theme.styleDefaults.linkStyle.subtitleStyle.color',
    'theme.styleDefaults.linkStyle.backgroundColor',
    'theme.styleDefaults.linkStyle.borderColor',
  ])('rejects a blank required v2 theme string at %s', (path) => {
    const document = structuredClone(validPublicPageDocument) as Record<string, any>;
    setPath(document, path, '');
    expect(publicPageDocumentSchema.safeParse(document).success).toBe(false);
  });

  it('validates explicit canonical theme rounding styles', () => {

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

  it('validates explicit canonical link style presets', () => {
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

  it('validates explicit canonical theme background settings', () => {
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

  it('preserves explicit zero styling values in complete canonical overrides', () => {
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
          ...validPublicPageDocument.sections[0]!.design,
          borderRadius: 0,
          headingStyle: {
            ...validPublicPageDocument.sections[0]!.design.headingStyle,
            fontSize: 8, fontWeight: 100,
          },
          linkStyle: {
            ...validPublicPageDocument.sections[0]!.design.linkStyle,
            backgroundOpacity: 0,
            borderWidth: 0,
            titleStyle: {
              ...validPublicPageDocument.sections[0]!.design.linkStyle.titleStyle,
              fontSize: 8,
            },
          },
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
    const base = validPublicPageDocument.sections[0]!.design;
    const headingStyle = 'headingStyle' in design
      ? { ...base.headingStyle, ...design.headingStyle } : base.headingStyle;
    const textStyle = 'textStyle' in design
      ? { ...base.textStyle, ...design.textStyle } : base.textStyle;
    const partialLink = 'linkStyle' in design ? design.linkStyle : undefined;
    const linkStyle = partialLink ? {
      ...base.linkStyle,
      ...partialLink,
      titleStyle: { ...base.linkStyle.titleStyle, ...partialLink.titleStyle },
      subtitleStyle: { ...base.linkStyle.subtitleStyle, ...partialLink.subtitleStyle },
    } : base.linkStyle;
    expect(publicPageDocumentSchema.safeParse({
      ...validPublicPageDocument,
      sections: [{
        ...validPublicPageDocument.sections[0],
        design: { ...base, ...design, headingStyle, textStyle, linkStyle },
      }],
    }).success).toBe(false);
  });

  it('accepts bounded section design values and rejects values outside the bounds', () => {
    const withDesign = (design: Record<string, unknown>) => ({
      ...validPublicPageDocument,
      sections: [{
        ...validPublicPageDocument.sections[0],
        design: { ...validPublicPageDocument.sections[0]!.design, ...design },
      }],
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
        sections: [{
          ...validPublicPageDocument.sections[0],
          design: { ...validPublicPageDocument.sections[0]!.design, variant },
        }],
      }).success).toBe(true);
    },
  );

  it('accepts bounded block padding and rejects values outside the bounds', () => {
    const withBlockDesign = (design: Record<string, unknown>) => ({
      ...validPublicPageDocument,
      sections: [{
        ...validPublicPageDocument.sections[0],
        blocks: [{
          ...validPublicPageDocument.sections[0]!.blocks[0],
          design: { ...validPublicPageDocument.sections[0]!.blocks[0]!.design, ...design },
        }],
      }],
    });
    expect(publicPageDocumentSchema.safeParse(withBlockDesign({
      backgroundColor: null,
      textColor: null,
      paddingTop: 160,
      paddingBottom: 160,
    })).success).toBe(true);
    expect(publicPageDocumentSchema.safeParse(withBlockDesign({
      backgroundColor: null, textColor: null, paddingTop: -1,
    })).success).toBe(false);
    expect(publicPageDocumentSchema.safeParse(withBlockDesign({
      backgroundColor: null, textColor: null, paddingBottom: 161,
    })).success).toBe(false);
  });

  it('validates explicit block background design fields', () => {
    const withBlockDesign = (design: Record<string, unknown>) => ({
      ...validPublicPageDocument,
      sections: [{
        ...validPublicPageDocument.sections[0],
        blocks: [{
          ...validPublicPageDocument.sections[0]!.blocks[0],
          design: { ...validPublicPageDocument.sections[0]!.blocks[0]!.design, ...design },
        }],
      }],
    });
    const parsed = publicPageDocumentSchema.parse(withBlockDesign({
      backgroundColor: null,
      textColor: null,
      backgroundMediaId: 'media-1',
      backgroundOverlay: 1,
      backgroundFit: 'contain',
      backgroundPosition: 'left top',
    }));
    expect(parsed.sections[0]!.blocks[0]!.design).toMatchObject({
      backgroundMediaId: 'media-1',
      backgroundOverlay: 1,
      backgroundFit: 'contain',
      backgroundPosition: 'left top',
    });

    expect(publicPageDocumentSchema.safeParse(withBlockDesign({
      backgroundColor: null, textColor: null, backgroundOverlay: -0.01,
    })).success).toBe(false);
    expect(publicPageDocumentSchema.safeParse(withBlockDesign({
      backgroundColor: null, textColor: null, backgroundOverlay: 1.01,
    })).success).toBe(false);
    expect(publicPageDocumentSchema.safeParse(withBlockDesign({
      backgroundColor: null, textColor: null, backgroundFit: 'stretch',
    })).success).toBe(false);
    expect(publicPageDocumentSchema.safeParse(withBlockDesign({
      backgroundColor: null, textColor: null, backgroundPosition: '',
    })).success).toBe(false);
  });

  it('rejects unknown block design fields', () => {
    expect(publicPageDocumentSchema.safeParse({
      ...validPublicPageDocument,
      sections: [{
        ...validPublicPageDocument.sections[0],
        blocks: [{
          ...validPublicPageDocument.sections[0]!.blocks[0],
          design: {
            ...validPublicPageDocument.sections[0]!.blocks[0]!.design,
            futureDesignField: { mode: 'experimental' },
          },
        }],
      }],
    }).success).toBe(false);
  });

  it.each([
    ['profile.logoMediaId', {
      ...validPublicPageDocument,
      profile: { ...validPublicPageDocument.profile, logoMediaId: 'missing-media' },
    }],
    ['profile.avatarMediaId', {
      ...validPublicPageDocument,
      profile: { ...validPublicPageDocument.profile, avatarMediaId: 'missing-media' },
    }],
    ['seo.imageMediaId', {
      ...validPublicPageDocument,
      seo: { ...validPublicPageDocument.seo, imageMediaId: 'missing-media' },
    }],
  ])('keeps dangling %s draft-saveable but rejects it on publish', (path, input) => {
    const parsed = publicPageDocumentSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    expect(validatePublicPageForPublish(parsed.data!)).toContainEqual({
      code: 'missing_media',
      path,
    });
  });

  it('rejects a missing section background media reference on publish', () => {
    const document = publicPageDocumentSchema.parse({
      ...validPublicPageDocument,
      sections: [{
        ...validPublicPageDocument.sections[0],
        design: { ...validPublicPageDocument.sections[0]!.design, backgroundMediaId: 'missing-media' },
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
    ['hero', { title: 'Welcome' }],
    ['booking', { label: 'Book now' }],
    ['socials', { links: [] }],
    ['messengers', { links: [] }],
    ['future-block', {}],
  ])('rejects removed or unknown block type %s at the schema boundary', (type, content) => {
    expect(publicPageDocumentSchema.safeParse({
      ...validPublicPageDocument,
      sections: [{
        ...validPublicPageDocument.sections[0],
        blocks: [{ ...validPublicPageDocument.sections[0]!.blocks[0], type, content }],
      }],
    }).success).toBe(false);
  });

  it('allows canonical avatar and button blocks on publish', () => {
    const parsed = publicPageDocumentSchema.parse({
      ...validPublicPageDocument,
      sections: [{
        ...validPublicPageDocument.sections[0],
        blocks: [{
          ...validPublicPageDocument.sections[0]!.blocks[0],
          type: 'avatar',
          content: {
            heading: 'Profile', subtitle: '', imageMediaId: 'media-1', imageAlt: 'Profile',
            layout: 'centered', avatarSize: 150, coverColor: null, coverMediaId: null,
          },
        }, {
          ...validPublicPageDocument.sections[0]!.blocks[0], id: 'button-1', type: 'button',
          content: {
            label: 'Visit', icon: 'link', color: '', textColor: '', radius: 12,
            action: { type: 'url', url: 'https://example.com' },
          },
        }],
      }],
      media: [{
        id: 'media-1', url: 'https://cdn.example.com/avatar.webp', mimeType: 'image/webp' as const,
        alt: 'Profile', width: 320, height: 320,
      }],
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
    ['avatar without heading', 'avatar', {
      heading: '', subtitle: '', imageMediaId: 'media-1', imageAlt: 'Profile',
      layout: 'centered', avatarSize: 150, coverColor: null, coverMediaId: null,
    }],
    ['avatar without an image', 'avatar', {
      heading: 'Profile', subtitle: '', imageMediaId: null, imageAlt: 'Profile',
      layout: 'centered', avatarSize: 150, coverColor: null, coverMediaId: null,
    }],
    ['button without a label', 'button', {
      label: '', icon: 'link', color: '', textColor: '', radius: 12,
      action: { type: 'url', url: 'https://example.com' },
    }],
    ['button with an invalid action', 'button', {
      label: 'Visit', icon: 'link', color: '', textColor: '', radius: 12,
      action: { type: 'url', url: 'javascript:alert(1)' },
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
