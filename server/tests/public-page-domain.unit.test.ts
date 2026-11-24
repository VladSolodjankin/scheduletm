import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizePublicPageDomain } from '@scheduletm/shared/public-page-domain';

const mocks = vi.hoisted(() => ({
  findPublicPage: vi.fn(),
  findPublicPageDomain: vi.fn(),
  replacePublicPageDomain: vi.fn(),
  markPublicPageDomainVerified: vi.fn(),
  deletePublicPageDomain: vi.fn(),
  findPublishedPublicPageByDomain: vi.fn(),
  resolve4: vi.fn(),
}));
vi.mock('node:dns', () => ({ promises: { resolve4: mocks.resolve4 } }));
vi.mock('../src/repositories/publicPageRepository.js', () => ({
  findPublicPage: mocks.findPublicPage,
  PublicPageRepositoryError: class extends Error { constructor(public readonly code: string) { super(code); } },
}));
vi.mock('../src/services/publicPageService.js', () => ({
  PublicPageServiceError: class extends Error { constructor(public readonly code: string) { super(code); } },
}));
vi.mock('../src/repositories/publicPageDomainRepository.js', () => ({
  findPublicPageDomain: mocks.findPublicPageDomain,
  replacePublicPageDomain: mocks.replacePublicPageDomain,
  markPublicPageDomainVerified: mocks.markPublicPageDomainVerified,
  deletePublicPageDomain: mocks.deletePublicPageDomain,
  findPublishedPublicPageByDomain: mocks.findPublishedPublicPageByDomain,
}));

const service = await import('../src/services/publicPageDomainService.js');
const { env } = await import('../src/config/env.js');
const appHost = new URL(env.APP_URL).hostname;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findPublicPage.mockResolvedValue({ id: 'page-1' });
});

describe('page domains', () => {
  it('accepts plain host names only', () => {
    expect(normalizePublicPageDomain(' Example.COM. ')).toBe('example.com');
    expect(normalizePublicPageDomain('www.my-site.co.uk')).toBe('www.my-site.co.uk');
    for (const rejected of ['', 'localhost', 'https://example.com', 'example.com/page', 'exa mple.com', '-a.com', 'a_b.com', '192.168.0.1', `${'a'.repeat(64)}.com`]) {
      expect(normalizePublicPageDomain(rejected), rejected).toBeNull();
    }
  });

  it('refuses our own host and its subdomains, and domains that are not host names', async () => {
    await expect(service.setPublicPageDomain(1, 'page-1', appHost)).rejects.toMatchObject({ code: 'INVALID_DOMAIN' });
    await expect(service.setPublicPageDomain(1, 'page-1', `evil.${appHost}`)).rejects.toMatchObject({ code: 'INVALID_DOMAIN' });
    await expect(service.setPublicPageDomain(1, 'page-1', 'not a domain')).rejects.toMatchObject({ code: 'INVALID_DOMAIN' });
    expect(mocks.replacePublicPageDomain).not.toHaveBeenCalled();
  });

  it('stores a new domain as unverified and reports a domain another page owns as a conflict', async () => {
    await expect(service.setPublicPageDomain(1, 'page-1', 'Studio.Example.com')).resolves.toEqual({ domain: 'studio.example.com', verified: false, target: appHost });
    expect(mocks.replacePublicPageDomain).toHaveBeenCalledWith('page-1', 'studio.example.com');
    mocks.replacePublicPageDomain.mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: '23505' }));
    await expect(service.setPublicPageDomain(1, 'page-1', 'taken.example.com')).rejects.toMatchObject({ code: 'DOMAIN_CONFLICT' });
  });

  it('never touches the pages of other accounts', async () => {
    mocks.findPublicPage.mockResolvedValue(null);
    await expect(service.setPublicPageDomain(2, 'page-1', 'studio.example.com')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.removePublicPageDomain(2, 'page-1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(mocks.replacePublicPageDomain).not.toHaveBeenCalled();
    expect(mocks.deletePublicPageDomain).not.toHaveBeenCalled();
  });

  it('verifies a domain once it resolves to the addresses of our host', async () => {
    mocks.findPublicPageDomain.mockResolvedValue({ domain: 'studio.example.com', verified_at: null });
    mocks.resolve4.mockImplementation(async (host: string) => (host === appHost ? ['10.0.0.1', '10.0.0.2'] : ['10.0.0.9']));
    await expect(service.verifyPublicPageDomain(1, 'page-1')).resolves.toMatchObject({ verified: false });
    expect(mocks.markPublicPageDomainVerified).not.toHaveBeenCalled();

    mocks.resolve4.mockImplementation(async (host: string) => (host === appHost ? ['10.0.0.1'] : ['10.0.0.1']));
    await expect(service.verifyPublicPageDomain(1, 'page-1')).resolves.toMatchObject({ verified: true });
    expect(mocks.markPublicPageDomainVerified).toHaveBeenCalledWith('page-1');
  });

  it('keeps a domain unverified while its DNS does not resolve at all', async () => {
    mocks.findPublicPageDomain.mockResolvedValue({ domain: 'studio.example.com', verified_at: null });
    mocks.resolve4.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(service.verifyPublicPageDomain(1, 'page-1')).resolves.toMatchObject({ verified: false });
  });

  it('serves only verified domains of published pages', async () => {
    mocks.findPublishedPublicPageByDomain.mockResolvedValue({ published_document: { slug: 'studio' } });
    await expect(service.getPublishedPublicPageByDomain('Studio.Example.com')).resolves.toEqual({ slug: 'studio' });
    expect(mocks.findPublishedPublicPageByDomain).toHaveBeenCalledWith('studio.example.com');
    await expect(service.getPublishedPublicPageByDomain('nonsense')).resolves.toBeNull();
  });
});
