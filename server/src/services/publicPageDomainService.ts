import { promises as dns } from 'node:dns';
import { normalizePublicPageDomain, type PublicPageDomain } from '@meetli/shared/public-page-domain';
import type { PublicPageDocument } from '@meetli/shared/public-page';
import { env } from '../config/env.js';
import {
  deletePublicPageDomain,
  findPublicPageDomain,
  findPublishedPublicPageByDomain,
  markPublicPageDomainVerified,
  replacePublicPageDomain,
} from '../repositories/publicPageDomainRepository.js';
import { findPublicPage, PublicPageRepositoryError } from '../repositories/publicPageRepository.js';
import { PublicPageServiceError } from './publicPageService.js';

const appHost = () => new URL(env.APP_URL).hostname;

async function ownedPage(accountId: number, pageId: string): Promise<void> {
  if (!await findPublicPage(accountId, pageId)) throw new PublicPageRepositoryError('NOT_FOUND');
}

export async function getPublicPageDomain(accountId: number, pageId: string): Promise<PublicPageDomain | null> {
  await ownedPage(accountId, pageId);
  const record = await findPublicPageDomain(accountId, pageId);
  return record ? { domain: record.domain, verified: record.verified_at !== null, target: appHost() } : null;
}

export async function setPublicPageDomain(accountId: number, pageId: string, input: string): Promise<PublicPageDomain> {
  await ownedPage(accountId, pageId);
  const domain = normalizePublicPageDomain(input);
  const host = appHost();
  if (!domain || domain === host || domain.endsWith(`.${host}`)) throw new PublicPageServiceError('INVALID_DOMAIN');
  try {
    await replacePublicPageDomain(pageId, domain);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      throw new PublicPageRepositoryError('DOMAIN_CONFLICT');
    }
    throw error;
  }
  return { domain, verified: false, target: host };
}

const resolveAddresses = (host: string) => dns.resolve4(host).catch(() => [] as string[]);

/** The domain is ours to serve once it resolves to the same addresses as the Meetli host (CNAME or A record). */
export async function verifyPublicPageDomain(accountId: number, pageId: string): Promise<PublicPageDomain> {
  const current = await getPublicPageDomain(accountId, pageId);
  if (!current) throw new PublicPageRepositoryError('NOT_FOUND');
  if (current.verified) return current;
  const [domainAddresses, appAddresses] = await Promise.all([resolveAddresses(current.domain), resolveAddresses(current.target)]);
  if (!domainAddresses.some((address) => appAddresses.includes(address))) return current;
  await markPublicPageDomainVerified(pageId);
  return { ...current, verified: true };
}

export async function removePublicPageDomain(accountId: number, pageId: string): Promise<void> {
  await ownedPage(accountId, pageId);
  await deletePublicPageDomain(pageId);
}

export async function getPublishedPublicPageByDomain(domainInput: string): Promise<PublicPageDocument | null> {
  const domain = normalizePublicPageDomain(domainInput);
  return domain ? (await findPublishedPublicPageByDomain(domain))?.published_document ?? null : null;
}
