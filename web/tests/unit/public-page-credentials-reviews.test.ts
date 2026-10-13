import { describe, expect, it } from 'vitest';
import { registerPublicPageBlocks } from '../../src/features/public-page-builder/config/registerBlocks';
import { createBlock, getBlockDefinition } from '../../src/features/public-page-builder/model/blockRegistry';
import {
  isValidCredentialYear,
  validateCredentialsContent,
} from '../../src/features/public-page-builder/model/credentials';
import { validateReviewsContent } from '../../src/features/public-page-builder/model/reviews';
import { resolvePublishIssueFocusTarget } from '../../src/features/public-page-builder/model/publishValidation';
import type { PublicPageDocument } from '../../src/features/public-page-builder/types/publicPage';

const NOW = new Date('2026-10-13T00:00:00Z');
const credential = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1', imageMediaId: 'media-1', alt: 'Diploma', title: 'Diploma', organization: 'University', year: '2020', ...overrides,
});

describe('credentials block content validation', () => {
  it('accepts a valid certificate and an empty list', () => {
    expect(validateCredentialsContent({ title: 'Credentials', items: [credential()] }, NOW)).toEqual([]);
    expect(validateCredentialsContent({ title: '', items: [] }, NOW)).toEqual([]);
  });

  it('requires title, image and alt for every item', () => {
    const issues = validateCredentialsContent({ title: '', items: [credential({ title: ' ', imageMediaId: null, alt: '' })] }, NOW);
    expect(issues).toEqual(expect.arrayContaining([
      'items.0.title is required', 'items.0.imageMediaId is required', 'items.0.alt is required',
    ]));
  });

  it('accepts an empty year and years from 1950 to next year only', () => {
    expect(isValidCredentialYear('', NOW)).toBe(true);
    expect(isValidCredentialYear('1950', NOW)).toBe(true);
    expect(isValidCredentialYear('2027', NOW)).toBe(true);
    expect(isValidCredentialYear('1949', NOW)).toBe(false);
    expect(isValidCredentialYear('2028', NOW)).toBe(false);
    expect(isValidCredentialYear('99', NOW)).toBe(false);
    expect(isValidCredentialYear('20x0', NOW)).toBe(false);
    expect(validateCredentialsContent({ title: '', items: [credential({ year: '1900' })] }, NOW)).toContain('items.0.year is invalid');
  });

  it('enforces length limits and the maximum of 10 items', () => {
    const issues = validateCredentialsContent({
      title: 'x'.repeat(121),
      items: [credential({ title: 'x'.repeat(121), organization: 'y'.repeat(121), alt: 'z'.repeat(201) })],
    }, NOW);
    expect(issues).toEqual(expect.arrayContaining([
      'title is too long', 'items.0.title is too long', 'items.0.organization is too long', 'items.0.alt is too long',
    ]));
    const many = Array.from({ length: 11 }, (_, index) => credential({ id: `c${index}` }));
    expect(validateCredentialsContent({ title: '', items: many }, NOW)).toContain('items has too many entries');
    expect(validateCredentialsContent({ title: '', items: many.slice(0, 10) }, NOW)).toEqual([]);
  });
});

describe('reviews block content validation', () => {
  it('has no publish content requirement besides the title length', () => {
    expect(validateReviewsContent({ title: '', showSummary: true, autoplay: false })).toEqual([]);
    expect(validateReviewsContent({ title: 'x'.repeat(121), showSummary: true, autoplay: false })).toEqual(['title is too long']);
  });
});

describe('createBlock with locale', () => {
  registerPublicPageBlocks();

  it('localizes names and defaults of the new blocks', () => {
    const ru = createBlock('credentials', 'ru');
    const en = createBlock('reviews', 'en');
    expect(ru).toMatchObject({ name: 'Сертификаты и дипломы', content: { items: [] } });
    expect(en).toMatchObject({ name: 'Reviews', content: { title: 'Client reviews', showSummary: true, autoplay: false } });
    expect(createBlock('reviews', 'ru')?.content).toEqual({ title: 'Отзывы клиентов', showSummary: true, autoplay: false });
    expect(Object.keys(en?.content ?? {}).sort()).toEqual(['autoplay', 'showSummary', 'title']);
  });

  it('localizes the defaults of existing blocks', () => {
    expect(createBlock('avatar', 'ru')).toMatchObject({ name: 'Аватар', content: { heading: 'Ваше имя', subtitle: 'Короткое представление' } });
    expect(createBlock('avatar', 'en')?.content).toMatchObject({ heading: 'Your name', subtitle: 'A short introduction' });
    expect(createBlock('button', 'en')?.content).toMatchObject({ label: 'Learn more' });
    expect(createBlock('map', 'en')?.content).toMatchObject({ title: 'Find us', label: 'Open map' });
    expect(createBlock('map', 'ru')?.content).toMatchObject({ title: 'Как нас найти', label: 'Открыть карту' });
    expect(createBlock('faq', 'en')?.content).toMatchObject({ title: 'Frequently asked questions' });
    expect(createBlock('services', 'ru')?.content).toMatchObject({ title: 'Услуги' });
    expect(createBlock('contacts', 'ru')).toMatchObject({ name: 'Контакты', content: { title: 'Контакты' } });
  });

  it('registers localized names for every block definition', () => {
    for (const type of ['avatar', 'button', 'links', 'text', 'image', 'gallery', 'services', 'contacts', 'social-button', 'map', 'divider', 'faq', 'credentials', 'reviews']) {
      expect(getBlockDefinition(type)?.localizedName, type).toBeTypeOf('function');
      expect(createBlock(type, 'ru')?.name, type).toBeTruthy();
    }
  });
});

describe('credentials publish focus mapping', () => {
  it('points media issues to the credentials media control', () => {
    const document = {
      profile: { logoMediaId: null, avatarMediaId: null }, theme: { backgroundMediaId: null },
      sections: [{ id: 's1', design: { backgroundMediaId: null }, blocks: [{
        id: 'b1', type: 'credentials', content: { title: '', items: [credential()] }, design: { backgroundMediaId: null },
      }] }],
      media: [{ id: 'media-1', alt: '' }],
    } as unknown as PublicPageDocument;
    expect(resolvePublishIssueFocusTarget(document, { code: 'missing_alt', path: 'media.0.alt' })).toMatchObject({
      type: 'block-dialog', blockId: 'b1', marker: 'media:media-1:alt',
    });
    expect(resolvePublishIssueFocusTarget(document, {
      code: 'missing_media', path: 'sections.0.blocks.0.content.items.0.imageMediaId',
    })).toMatchObject({ type: 'block-dialog', marker: 'block.content.media' });
  });
});
