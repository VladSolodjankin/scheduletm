import { describe, expect, it } from 'vitest';
import {
  parsePublicPageVideoUrl,
  publicPageDocumentSchema,
  publicPageVideoEmbedUrl,
  validatePublicPageForPublish,
} from '@scheduletm/shared/public-page';
import { env } from '../src/config/env.js';
import { validPublicPageDocument } from './publicPageTestFixture.js';

const documentWith = (type: string, content: unknown) => ({
  ...validPublicPageDocument,
  sections: [{
    ...validPublicPageDocument.sections[0],
    blocks: [{ ...validPublicPageDocument.sections[0]!.blocks[0], type, content }],
  }],
});
const publishIssues = (type: string, content: unknown) => (
  validatePublicPageForPublish(publicPageDocumentSchema.parse(documentWith(type, content)), env.API_BASE_URL)
    .filter(({ code }) => code === 'invalid_block').map(({ detail }) => detail)
);

describe('content blocks', () => {
  it('accepts price list, steps, stats, hours and video blocks and publishes valid ones', () => {
    expect(publishIssues('price-list', { title: 'Prices', items: [{ id: 'a', title: 'Session', description: '', price: '50 EUR' }] })).toEqual([]);
    expect(publishIssues('steps', { title: 'How it works', items: [{ id: 'a', title: 'Write to me', description: '' }] })).toEqual([]);
    expect(publishIssues('stats', { title: '', items: [{ id: 'a', value: '10+', description: 'years' }] })).toEqual([]);
    expect(publishIssues('hours', { title: 'Hours', items: [{ id: 'a', days: 'Mon-Fri', hours: '10:00-19:00' }] })).toEqual([]);
    expect(publishIssues('video', { title: '', url: 'https://youtu.be/dQw4w9WgXcQ' })).toEqual([]);
  });

  it('requires the fields a visitor needs to understand each row', () => {
    expect(publishIssues('price-list', { title: '', items: [{ id: 'a', title: ' ', description: '', price: '' }] })).toEqual(['items.0.title is required']);
    expect(publishIssues('steps', { title: '', items: [{ id: 'a', title: '', description: 'x' }] })).toEqual(['items.0.title is required']);
    expect(publishIssues('stats', { title: '', items: [{ id: 'a', value: '', description: 'x' }] })).toEqual(['items.0.value is required']);
    expect(publishIssues('hours', { title: '', items: [{ id: 'a', days: '', hours: '' }] })).toEqual(['items.0.days is required', 'items.0.hours is required']);
  });

  it('rejects unknown fields and oversized lists', () => {
    expect(publicPageDocumentSchema.safeParse(documentWith('stats', { title: '', items: [], extra: 1 })).success).toBe(false);
    const rows = Array.from({ length: 9 }, (_, index) => ({ id: `s${index}`, value: '1', description: '' }));
    expect(publicPageDocumentSchema.safeParse(documentWith('stats', { title: '', items: rows })).success).toBe(false);
  });

  it('embeds only https YouTube and Vimeo videos', () => {
    expect(parsePublicPageVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({ provider: 'youtube', id: 'dQw4w9WgXcQ' });
    expect(parsePublicPageVideoUrl('https://youtu.be/dQw4w9WgXcQ?t=5')).toEqual({ provider: 'youtube', id: 'dQw4w9WgXcQ' });
    expect(parsePublicPageVideoUrl('https://m.youtube.com/shorts/dQw4w9WgXcQ')).toEqual({ provider: 'youtube', id: 'dQw4w9WgXcQ' });
    expect(parsePublicPageVideoUrl('https://vimeo.com/76979871')).toEqual({ provider: 'vimeo', id: '76979871' });
    expect(parsePublicPageVideoUrl('https://player.vimeo.com/video/76979871')).toEqual({ provider: 'vimeo', id: '76979871' });
    for (const rejected of ['http://youtu.be/dQw4w9WgXcQ', 'https://example.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com/watch?v=short', 'https://vimeo.com/channels', 'not a url', '']) {
      expect(parsePublicPageVideoUrl(rejected)).toBeNull();
    }
    expect(publicPageVideoEmbedUrl({ provider: 'youtube', id: 'dQw4w9WgXcQ' })).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(publicPageVideoEmbedUrl({ provider: 'vimeo', id: '76979871' })).toBe('https://player.vimeo.com/video/76979871?dnt=1');
    expect(publishIssues('video', { title: '', url: 'https://example.com/video' })).toEqual(['url is not a YouTube or Vimeo video']);
  });
});
