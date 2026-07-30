import { describe, expect, it } from 'vitest';
import {
  isValidPublicPageSlug,
  publicPageDocumentSchema,
  validatePublicPageForPublish,
} from '../src/config/publicPageSchemas.js';
import { validPublicPageDocument } from './publicPageTestFixture.js';

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
    ['image without url and alt', 'image', { url: '', alt: '' }, 'invalid_block'],
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
});
