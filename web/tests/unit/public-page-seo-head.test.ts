// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  routeSlug: '',
  renderedDocuments: [] as unknown[],
}));

vi.mock('@mui/material', () => ({
  Alert: () => null,
  Box: () => null,
  Button: () => null,
  CircularProgress: () => null,
}));
vi.mock('../../src/components/public-page-blocks/PublicPageRenderer', () => ({
  PublicPageRenderer: (props: { document: unknown }) => {
    runtime.renderedDocuments.push(props.document);
    return null;
  },
}));
vi.mock('react-router-dom', () => ({
  useParams: () => ({ slug: runtime.routeSlug }),
}));
vi.mock('../../src/shared/i18n/I18nContext', () => ({
  useI18n: () => ({ locale: 'en' }),
}));

import { applyPublicPageSeoMetadata, PublicPageViewPage } from '../../src/pages/PublicPageViewPage';
import { publicPageUrl } from '../../src/features/public-page-builder/config/publicPageUrl';
import { normalizeDocument } from '../../src/features/public-page-builder/model/normalizeDocument';
import type { PublicPageDocument } from '../../src/features/public-page-builder/types/publicPage';
import { ApiPublicPageRepository } from '../../src/features/public-page-builder/repository/ApiPublicPageRepository';
import { apiClient } from '../../src/shared/api/client';

const mountedRoots: Root[] = [];

function page(slug: string, image = false): PublicPageDocument {
  return normalizeDocument({
    id: `page-${slug}`,
    slug,
    status: 'published',
    seo: {
      title: `Title ${slug}`,
      description: `Description ${slug}`,
      imageMediaId: image ? 'seo-image' : null,
    },
    media: image ? [{
      id: 'seo-image',
      url: 'https://cdn.example.com/seo-image.jpg',
      mimeType: 'image/jpeg',
      alt: 'SEO image',
      width: 1200,
      height: 630,
    }] : [],
  });
}

function meta(attribute: 'name' | 'property', key: string): HTMLMetaElement | null {
  return document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
}

function appendMeta(attribute: 'name' | 'property', key: string, content?: string): HTMLMetaElement {
  const element = document.createElement('meta');
  element.setAttribute(attribute, key);
  if (content !== undefined) {element.setAttribute('content', content);}
  document.head.append(element);
  return element;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  runtime.routeSlug = '';
  runtime.renderedDocuments.length = 0;
  document.head.replaceChildren();
  document.title = 'Host application';
});

afterEach(async () => {
  for (const root of mountedRoots.splice(0)) {
    await act(async () => root.unmount());
  }
  document.head.replaceChildren();
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('public page SEO head lifecycle', () => {
  it('creates metadata and canonical nodes, then removes component-owned nodes on cleanup', () => {
    const publicPage = page('created-head');

    const cleanup = applyPublicPageSeoMetadata(publicPage);

    expect(document.title).toBe('Title created-head');
    expect(meta('name', 'description')?.getAttribute('content')).toBe('Description created-head');
    expect(meta('property', 'og:title')?.getAttribute('content')).toBe('Title created-head');
    expect(meta('property', 'og:description')?.getAttribute('content')).toBe('Description created-head');
    expect(meta('property', 'og:url')?.getAttribute('content')).toBe(publicPageUrl('created-head'));
    expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.getAttribute('href'))
      .toBe(publicPageUrl('created-head'));

    cleanup();

    expect(document.title).toBe('Host application');
    expect(document.head.querySelector('meta[name="description"]')).toBeNull();
    expect(document.head.querySelector('meta[property^="og:"]')).toBeNull();
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });

  it('reuses the first pre-existing nodes and restores their exact values', () => {
    const description = appendMeta('name', 'description', 'Host description');
    const ogTitle = appendMeta('property', 'og:title', 'Host OG title');
    const ogDescription = appendMeta('property', 'og:description', 'Host OG description');
    const ogUrl = appendMeta('property', 'og:url', 'https://host.example.com/original');
    const secondCanonical = document.createElement('link');
    secondCanonical.setAttribute('rel', 'canonical');
    secondCanonical.setAttribute('href', 'https://host.example.com/second');
    const canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    canonical.setAttribute('href', 'https://host.example.com/original');
    document.head.append(canonical, secondCanonical);

    const cleanup = applyPublicPageSeoMetadata(page('existing-head'));

    expect(meta('name', 'description')).toBe(description);
    expect(meta('property', 'og:title')).toBe(ogTitle);
    expect(meta('property', 'og:description')).toBe(ogDescription);
    expect(meta('property', 'og:url')).toBe(ogUrl);
    expect(document.head.querySelector('link[rel="canonical"]')).toBe(canonical);
    expect(canonical.getAttribute('href')).toBe(publicPageUrl('existing-head'));
    expect(secondCanonical.getAttribute('href')).toBe('https://host.example.com/second');

    cleanup();

    expect(description.getAttribute('content')).toBe('Host description');
    expect(ogTitle.getAttribute('content')).toBe('Host OG title');
    expect(ogDescription.getAttribute('content')).toBe('Host OG description');
    expect(ogUrl.getAttribute('content')).toBe('https://host.example.com/original');
    expect(canonical.getAttribute('href')).toBe('https://host.example.com/original');
    expect(secondCanonical.getAttribute('href')).toBe('https://host.example.com/second');
  });

  it('restores missing content and href attributes as absent', () => {
    const description = appendMeta('name', 'description');
    const ogUrl = appendMeta('property', 'og:url');
    const canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.append(canonical);

    const cleanup = applyPublicPageSeoMetadata(page('missing-attributes'));
    expect(description.hasAttribute('content')).toBe(true);
    expect(ogUrl.hasAttribute('content')).toBe(true);
    expect(canonical.hasAttribute('href')).toBe(true);

    cleanup();

    expect(description.hasAttribute('content')).toBe(false);
    expect(ogUrl.hasAttribute('content')).toBe(false);
    expect(canonical.hasAttribute('href')).toBe(false);
    expect(document.head.contains(description)).toBe(true);
    expect(document.head.contains(ogUrl)).toBe(true);
    expect(document.head.contains(canonical)).toBe(true);
  });

  it('cleans slug A before applying slug B without accumulating canonical or og:url nodes', () => {
    const cleanupA = applyPublicPageSeoMetadata(page('slug-a'));
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('meta[property="og:url"]')).toHaveLength(1);
    cleanupA();

    const cleanupB = applyPublicPageSeoMetadata(page('slug-b'));
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('meta[property="og:url"]')).toHaveLength(1);
    expect(meta('property', 'og:url')?.getAttribute('content')).toBe(publicPageUrl('slug-b'));
    expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.getAttribute('href'))
      .toBe(publicPageUrl('slug-b'));
    cleanupB();
  });

  it('preserves existing SEO tags and keeps optional og:image apply/restore behavior', () => {
    const hostImage = appendMeta('property', 'og:image', 'https://host.example.com/image.jpg');
    const hostDescription = appendMeta('name', 'description', 'Host description');

    const cleanupWithImage = applyPublicPageSeoMetadata(page('with-image', true));
    expect(hostImage.getAttribute('content')).toBe('https://cdn.example.com/seo-image.jpg');
    expect(hostDescription.getAttribute('content')).toBe('Description with-image');
    cleanupWithImage();
    expect(hostImage.getAttribute('content')).toBe('https://host.example.com/image.jpg');
    expect(hostDescription.getAttribute('content')).toBe('Host description');

    const cleanupWithoutImage = applyPublicPageSeoMetadata(page('without-image'));
    expect(hostImage.getAttribute('content')).toBe('https://host.example.com/image.jpg');
    cleanupWithoutImage();
    expect(hostImage.getAttribute('content')).toBe('https://host.example.com/image.jpg');
  });

  it('normalizes a non-canonical route spelling for lookup, SEO, and Services loading', async () => {
    vi.useFakeTimers();
    runtime.routeSlug = '  MiXeD-Slug  ';
    const publicPage = normalizeDocument({
      ...page('mixed-slug'),
      sections: [{
        id: 'services-section',
        visible: true,
        blocks: [{
          id: 'services-block',
          type: 'services',
          visible: true,
          content: { serviceIds: [1], showBookingButton: true },
        }],
      }],
    });
    const getBySlug = vi.spyOn(ApiPublicPageRepository.prototype, 'getBySlug').mockResolvedValue(publicPage);
    const getBookingOptions = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { services: [] } });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    await act(async () => {
      root.render(createElement(PublicPageViewPage));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getBySlug).toHaveBeenCalledWith('mixed-slug');
    expect(runtime.renderedDocuments).toContain(publicPage);
    expect(meta('property', 'og:url')?.getAttribute('content')).toBe(publicPageUrl(publicPage.slug));
    expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.getAttribute('href'))
      .toBe(publicPageUrl(publicPage.slug));

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(getBookingOptions).toHaveBeenCalledWith('/api/public-pages/by-slug/mixed-slug/booking-options');
  });
});
