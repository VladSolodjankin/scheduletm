import type { PublicPageAnalytics, PublicPageAnalyticsPeriod, PublicPageEvent } from '@meetli/shared/public-page-analytics';
import { env } from '../config/env.js';
import { findPublicPage, findPublishedPublicPageBySlug, PublicPageRepositoryError } from '../repositories/publicPageRepository.js';
import { insertPublicPageEvent, readPublicPageAnalytics } from '../repositories/publicPageEventRepository.js';
import { publicPageBlocks } from '../utils/publicPageReferences.js';

const CRAWLER_USER_AGENT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless/i;

const withoutWww = (host: string) => host.replace(/^www\./, '');

/** The host a visit came from; visits from our own site or without a usable referrer count as direct. */
export function referrerSource(referrer: string): string | null {
  try {
    const host = withoutWww(new URL(referrer).hostname);
    return host && host !== withoutWww(new URL(env.APP_URL).hostname) ? host.slice(0, 255) : null;
  } catch {
    return null;
  }
}

export async function recordPublicPageEvent(
  slug: string,
  event: PublicPageEvent,
  userAgent: string | undefined,
): Promise<void> {
  const page = await findPublishedPublicPageBySlug(slug);
  if (!page?.published_document) throw new PublicPageRepositoryError('NOT_FOUND');
  if (!userAgent || CRAWLER_USER_AGENT.test(userAgent)) return;
  if (event.type === 'view') {
    await insertPublicPageEvent({ pageId: page.id, type: 'view', blockId: null, source: referrerSource(event.referrer) });
    return;
  }
  if (!publicPageBlocks(page.published_document).some((block) => block.id === event.blockId)) return;
  await insertPublicPageEvent({ pageId: page.id, type: 'click', blockId: event.blockId, source: null });
}

export async function getPublicPageAnalytics(
  accountId: number,
  pageId: string,
  days: PublicPageAnalyticsPeriod,
): Promise<PublicPageAnalytics> {
  const page = await findPublicPage(accountId, pageId);
  if (!page) throw new PublicPageRepositoryError('NOT_FOUND');
  return readPublicPageAnalytics(page.id, days, page.draft_document.timezone);
}
