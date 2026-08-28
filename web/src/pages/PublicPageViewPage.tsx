import { Alert, Box, Button, CircularProgress } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PublicPageRenderer } from '../components/public-page-blocks/PublicPageRenderer';
import { publicPageText } from '../components/public-page-builder/uiText';
import { ApiPublicPageRepository } from '../features/public-page-builder/repository/ApiPublicPageRepository';
import { PublicPageRepositoryError } from '../features/public-page-builder/repository/PublicPageRepository';
import type { PublicPageDocument } from '../features/public-page-builder/types/publicPage';
import { useI18n } from '../shared/i18n/I18nContext';
import { apiClient } from '../shared/api/client';
import type { PublicBookingOptions, PublicBookingService } from '../shared/types/api';
import { publicPageUrl } from '../features/public-page-builder/config/publicPageUrl';
import { normalizeSlug } from '../features/public-page-builder/model/slug';

const repository = new ApiPublicPageRepository('');

type MetaTagSnapshot = {
  element: HTMLMetaElement;
  existed: boolean;
  hadContent: boolean;
  content: string | null;
};

type CanonicalLinkSnapshot = {
  element: HTMLLinkElement;
  existed: boolean;
  hadHref: boolean;
  href: string | null;
};

function applyMetaTag(attribute: 'name' | 'property', key: string, content: string): MetaTagSnapshot {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  const existed = Boolean(element);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  const snapshot = { element, existed, hadContent: element.hasAttribute('content'), content: element.getAttribute('content') };
  element.setAttribute('content', content);
  return snapshot;
}

function restoreMetaTag(snapshot: MetaTagSnapshot): void {
  if (!snapshot.existed) {
    snapshot.element.remove();
  } else if (snapshot.hadContent) {
    snapshot.element.setAttribute('content', snapshot.content ?? '');
  } else {
    snapshot.element.removeAttribute('content');
  }
}

function applyCanonicalLink(href: string): CanonicalLinkSnapshot {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const existed = Boolean(element);
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.append(element);
  }
  const snapshot = { element, existed, hadHref: element.hasAttribute('href'), href: element.getAttribute('href') };
  element.setAttribute('href', href);
  return snapshot;
}

function restoreCanonicalLink(snapshot: CanonicalLinkSnapshot): void {
  if (!snapshot.existed) {
    snapshot.element.remove();
  } else if (snapshot.hadHref) {
    snapshot.element.setAttribute('href', snapshot.href ?? '');
  } else {
    snapshot.element.removeAttribute('href');
  }
}

export function applyPublicPageSeoMetadata(page: PublicPageDocument): () => void {
  const previousTitle = document.title;
  const imageUrl = page.seo.imageMediaId
    ? page.media.find((media) => media.id === page.seo.imageMediaId)?.url
    : undefined;
  const canonicalUrl = publicPageUrl(page.slug);
  document.title = page.seo.title;
  const snapshots = [
    applyMetaTag('name', 'description', page.seo.description),
    applyMetaTag('property', 'og:title', page.seo.title),
    applyMetaTag('property', 'og:description', page.seo.description),
    applyMetaTag('property', 'og:url', canonicalUrl),
    ...(imageUrl ? [applyMetaTag('property', 'og:image', imageUrl)] : []),
  ];
  const canonicalSnapshot = applyCanonicalLink(canonicalUrl);
  return () => {
    document.title = previousTitle;
    snapshots.forEach(restoreMetaTag);
    restoreCanonicalLink(canonicalSnapshot);
  };
}

export function PublicPageViewPage() {
  const { slug = '' } = useParams();
  const canonicalRouteSlug = useMemo(() => normalizeSlug(slug), [slug]);
  const { locale } = useI18n();
  const [page, setPage] = useState<PublicPageDocument | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'unavailable'>('loading');
  const [services, setServices] = useState<PublicBookingService[]>([]);
  const [servicesError, setServicesError] = useState(false);
  const requestIdRef = useRef(0);
  const servicesRequestIdRef = useRef(0);
  const load = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setStatus('loading');
    try {
      const document = await repository.getBySlug(canonicalRouteSlug);
      if (requestIdRef.current !== requestId) {return;}
      if (document.status !== 'published') {
        setPage(null);
        setStatus('unavailable');
        return;
      }
      setServices([]);
      setServicesError(false);
      setPage(document);
      setStatus('ready');
    } catch (error) {
      if (requestIdRef.current !== requestId) {return;}
      setPage(null);
      setStatus(error instanceof PublicPageRepositoryError && error.code === 'not_found' ? 'not-found' : 'unavailable');
    }
  }, [canonicalRouteSlug]);
  useEffect(() => {
    void Promise.resolve().then(load);
    return () => {requestIdRef.current += 1;};
  }, [load]);
  useEffect(() => {
    if (status !== 'ready' || !page || page.slug !== canonicalRouteSlug) {return;}
    return applyPublicPageSeoMetadata(page);
  }, [canonicalRouteSlug, page, status]);
  const needsServices = useMemo(() => Boolean(page?.sections.some((section) => section.visible && section.blocks.some((block) =>
    block.visible && block.type === 'services'
      && Array.isArray(block.content.serviceIds) && block.content.serviceIds.length > 0))), [page]);
  const loadServices = useCallback(async () => {
    if (status !== 'ready' || !page || page.slug !== canonicalRouteSlug || !needsServices) {
      setServices([]);
      setServicesError(false);
      return;
    }
    const requestId = servicesRequestIdRef.current + 1;
    servicesRequestIdRef.current = requestId;
    setServices([]);
    setServicesError(false);
    try {
      const { data } = await apiClient.get<PublicBookingOptions>(`/api/public-pages/by-slug/${encodeURIComponent(canonicalRouteSlug)}/booking-options`);
      if (servicesRequestIdRef.current !== requestId) {return;}
      setServices(data.services);
    } catch {
      if (servicesRequestIdRef.current !== requestId) {return;}
      setServicesError(true);
    }
  }, [canonicalRouteSlug, needsServices, page, status]);
  useEffect(() => {
    const timer = window.setTimeout(() => {void loadServices();}, 0);
    return () => {
      window.clearTimeout(timer);
      servicesRequestIdRef.current += 1;
    };
  }, [loadServices]);
  if (status === 'loading') {return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;}
  if (status !== 'ready' || !page) {
    return <Alert severity="info" action={<Button onClick={() => void load()}>{publicPageText(locale, 'retry')}</Button>}>{publicPageText(locale, status === 'not-found' ? 'notFound' : 'unavailable')}</Alert>;
  }
  return <>
    {servicesError ? <Alert severity="warning" action={<Button onClick={() => void loadServices()}>{publicPageText(locale, 'retry')}</Button>}>
      {publicPageText(locale, 'servicesLoadError')}
    </Alert> : null}
    <PublicPageRenderer document={page} services={services} />
  </>;
}
