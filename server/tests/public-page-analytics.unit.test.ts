import { beforeEach, describe, expect, it, vi } from 'vitest';
import { publicPageEventSchema } from '@scheduletm/shared/public-page-analytics';
import { validPublicPageDocument } from './publicPageTestFixture.js';

const repositories = vi.hoisted(() => ({
  findPublishedPublicPageBySlug: vi.fn(),
  findPublicPage: vi.fn(),
  insertPublicPageEvent: vi.fn(),
  readPublicPageAnalytics: vi.fn(),
}));
vi.mock('../src/repositories/publicPageRepository.js', () => ({
  findPublishedPublicPageBySlug: repositories.findPublishedPublicPageBySlug,
  findPublicPage: repositories.findPublicPage,
  PublicPageRepositoryError: class extends Error { constructor(public readonly code: string) { super(code); } },
}));
vi.mock('../src/repositories/publicPageEventRepository.js', () => ({
  insertPublicPageEvent: repositories.insertPublicPageEvent,
  readPublicPageAnalytics: repositories.readPublicPageAnalytics,
}));

const { getPublicPageAnalytics, recordPublicPageEvent, referrerSource } = await import('../src/services/publicPageAnalyticsService.js');
const blockId = validPublicPageDocument.sections[0]!.blocks[0]!.id;
const browser = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';

beforeEach(() => {
  vi.clearAllMocks();
  repositories.findPublishedPublicPageBySlug.mockResolvedValue({ id: 'page-1', published_document: validPublicPageDocument });
});

describe('public page events', () => {
  it('accepts only views with a referrer and clicks with a block id', () => {
    expect(publicPageEventSchema.safeParse({ type: 'view', referrer: '' }).success).toBe(true);
    expect(publicPageEventSchema.safeParse({ type: 'click', blockId: 'b1' }).success).toBe(true);
    expect(publicPageEventSchema.safeParse({ type: 'view' }).success).toBe(false);
    expect(publicPageEventSchema.safeParse({ type: 'click', blockId: '' }).success).toBe(false);
    expect(publicPageEventSchema.safeParse({ type: 'click', blockId: 'b1', userId: 1 }).success).toBe(false);
  });

  it('reduces a referrer to its host and treats our own site and garbage as direct', () => {
    expect(referrerSource('https://www.instagram.com/some/post?x=1')).toBe('instagram.com');
    expect(referrerSource('https://t.me/channel')).toBe('t.me');
    expect(referrerSource('')).toBeNull();
    expect(referrerSource('not a url')).toBeNull();
    expect(referrerSource('http://localhost:5173/some')).toBeNull();
  });

  it('stores a view with its source and a click on an existing block', async () => {
    await recordPublicPageEvent('valid-page', { type: 'view', referrer: 'https://google.com/search' }, browser);
    await recordPublicPageEvent('valid-page', { type: 'click', blockId }, browser);
    expect(repositories.insertPublicPageEvent).toHaveBeenNthCalledWith(1, { pageId: 'page-1', type: 'view', blockId: null, source: 'google.com' });
    expect(repositories.insertPublicPageEvent).toHaveBeenNthCalledWith(2, { pageId: 'page-1', type: 'click', blockId, source: null });
  });

  it('ignores crawlers, clients without a user agent and clicks on unknown blocks', async () => {
    await recordPublicPageEvent('valid-page', { type: 'view', referrer: '' }, 'Googlebot/2.1');
    await recordPublicPageEvent('valid-page', { type: 'view', referrer: '' }, undefined);
    await recordPublicPageEvent('valid-page', { type: 'click', blockId: 'missing' }, browser);
    expect(repositories.insertPublicPageEvent).not.toHaveBeenCalled();
  });

  it('reports an unpublished page as not found and reads analytics in the page timezone', async () => {
    repositories.findPublishedPublicPageBySlug.mockResolvedValue(null);
    await expect(recordPublicPageEvent('nope', { type: 'view', referrer: '' }, browser)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    repositories.findPublicPage.mockResolvedValue({ id: 'page-1', draft_document: { ...validPublicPageDocument, timezone: 'Europe/Tbilisi' } });
    repositories.readPublicPageAnalytics.mockResolvedValue({ days: 30 });
    await getPublicPageAnalytics(7, 'page-1', 30);
    expect(repositories.findPublicPage).toHaveBeenCalledWith(7, 'page-1');
    expect(repositories.readPublicPageAnalytics).toHaveBeenCalledWith('page-1', 30, 'Europe/Tbilisi');
  });
});
