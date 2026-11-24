import type { PublicPageDocument } from './publicPage.js';

export type PublicPageHeadMeta = { attribute: 'name' | 'property'; key: string; content: string };
export type PublicPageHead = { title: string; canonical: string; meta: PublicPageHeadMeta[] };

/** Everything a page contributes to <head>; the browser and the server rendering for crawlers both use it. */
export function publicPageHead(page: Pick<PublicPageDocument, 'seo' | 'media'>, canonicalUrl: string): PublicPageHead {
  const imageUrl = page.seo.imageMediaId
    ? page.media.find((media) => media.id === page.seo.imageMediaId)?.url
    : undefined;
  return {
    title: page.seo.title,
    canonical: canonicalUrl,
    meta: [
      { attribute: 'name', key: 'description', content: page.seo.description },
      { attribute: 'property', key: 'og:type', content: 'website' },
      { attribute: 'property', key: 'og:title', content: page.seo.title },
      { attribute: 'property', key: 'og:description', content: page.seo.description },
      { attribute: 'property', key: 'og:url', content: canonicalUrl },
      { attribute: 'name', key: 'twitter:card', content: imageUrl ? 'summary_large_image' : 'summary' },
      ...(imageUrl ? [{ attribute: 'property' as const, key: 'og:image', content: imageUrl }] : []),
    ],
  };
}
