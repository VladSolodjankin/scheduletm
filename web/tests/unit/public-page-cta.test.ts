import { describe, expect, it } from 'vitest';
import {
  contactHref,
  validateContacts,
} from '../../src/features/public-page-builder/model/cta';
import { getPublicPageTemplate } from '../../src/features/public-page-builder/templates';
import { getBlockDefinition, registerBlock } from '../../src/features/public-page-builder/model/blockRegistry';
import { validateForPublish } from '../../src/features/public-page-builder/model/publishValidation';

describe('public page contact actions', () => {
  it.each([
    [{ action: { type: 'url', url: 'https://example.com/contact' } }, 'https://example.com/contact'],
    [{ action: { type: 'phone', phone: '+1 (555) 123-4567' } }, 'tel:+15551234567'],
    [{ action: { type: 'email', email: 'Hello@Example.com' } }, 'mailto:hello@example.com'],
    [{ action: { type: 'messenger', url: 'https://t.me/example' } }, 'https://t.me/example'],
  ])('resolves each canonical action type', (row, expected) => {
    expect(contactHref(row)).toBe(expected);
  });

  it('rejects rows without a typed action', () => {
    expect(contactHref({ url: 'https://example.com/contact' })).toBeNull();
    expect(contactHref({ url: 'javascript:alert(1)' })).toBeNull();
  });

  it('treats an own action property as authoritative', () => {
    expect(contactHref({ action: { type: 'email', email: 'valid@example.com' }, url: 'tel:+15551234567' }))
      .toBe('mailto:valid@example.com');
    expect(contactHref({ action: { type: 'email', email: 'invalid' }, url: 'https://example.com/fallback' }))
      .toBeNull();
    expect(contactHref({ action: { type: 'email' }, url: 'https://example.com/fallback' }))
      .toBeNull();
  });

  it('validates list, labels, and typed action presence while delegating action safety', () => {
    expect(validateContacts([])).toEqual(['contacts is required']);
    expect(validateContacts([{ id: 'valid', label: 'Email', action: { type: 'email', email: 'hello@example.com' } }]))
      .toEqual([]);
    expect(validateContacts([{ id: 'missing', label: 'Call', url: 'tel:+15551234567' }]))
      .toContain('contacts.0.action is invalid');
    expect(validateContacts([{ id: 'blank', label: ' ', action: { type: 'url', url: 'https://example.com' } }]))
      .toContain('contacts.0.label is required');
    expect(validateContacts([{ id: 'unsafe', label: 'Unsafe', action: { type: 'url', url: 'javascript:alert(1)' } }]))
      .toEqual([]);
    expect(validateContacts([{ id: 'precedence', label: 'Broken', action: { type: 'email' }, url: 'https://example.com' }]))
      .toEqual(['contacts.0.action is invalid']);
  });

  it('reports one generic publish issue for an invalid canonical contact action', () => {
    const blockType = 'contacts';
    if (!getBlockDefinition(blockType)) {
      registerBlock({
        type: blockType,
        name: 'Contacts',
        createContent: () => ({ title: '', contacts: [] }),
        Renderer: () => null,
        validate: ({ content }) => validateContacts(content.contacts),
      });
    }
    const document = getPublicPageTemplate('specialist')!.createDocument('contact-action-validation');
    document.seo.description = 'A valid SEO description for contact action validation.';
    document.sections = [{
      ...document.sections[0],
      blocks: [{
        ...document.sections[0].blocks[0],
        type: blockType,
        content: { title: 'Contacts', contacts: [{ id: 'broken', label: 'Email', action: { type: 'email', email: 'invalid' } }] },
      }],
    }];

    expect(validateForPublish(document).issues).toEqual([expect.objectContaining({
        code: 'invalid_cta',
        path: 'sections.0.blocks.0.content.contacts.0.action',
      })]);
  });

  it('creates canonical template contacts', () => {
    for (const templateId of ['specialist', 'small-business']) {
      const document = getPublicPageTemplate(templateId)!.createDocument(`typed-${templateId}`);
      const rows = document.sections.flatMap((section) => section.blocks)
        .filter((block) => block.type === 'contacts')
        .flatMap((block) => block.content.contacts as Array<Record<string, unknown>>);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((row) => 'action' in row && !('url' in row))).toBe(true);
    }
  });
});
