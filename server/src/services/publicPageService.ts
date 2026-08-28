import {
  isValidPublicPageSlug,
  normalizePublicPageSlug,
  PUBLIC_PAGE_SCHEMA_VERSION,
  publicPageDocumentSchema,
  type PublicPageDocument,
  type PublishIssue,
  validatePublicPageForPublish,
} from '../config/publicPageSchemas.js';
import {
  archivePublicPage,
  createPublicPage,
  deletePublicPage,
  findPublicPage,
  findPublishedPublicPageBySlug,
  isPublicPageSlugAvailable,
  listPublicPages,
  publishPublicPage,
  restorePublicPage,
  type PublicPageRecord,
  type PublicPageStatus,
  PublicPageRepositoryError,
  savePublicPageDraft,
} from '../repositories/publicPageRepository.js';
import { listServices } from '../repositories/serviceRepository.js';

const PUBLIC_PAGE_ACCOUNT_QUOTA = 10;

export type PublicPageDto = {
  id: string;
  status: PublicPageStatus;
  draft: PublicPageDocument;
  published: PublicPageDocument | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
};

export class PublicPageServiceError extends Error {
  constructor(
    public readonly code: 'INVALID_DOCUMENT' | 'INVALID_SLUG' | 'UNSUPPORTED_VERSION' | 'PUBLISH_VALIDATION_FAILED',
    public readonly issues?: PublishIssue[],
  ) {
    super(code);
  }
}

const iso = (value: Date | string): string => new Date(value).toISOString();
export const toPublicPageDto = (record: PublicPageRecord): PublicPageDto => ({
  id: record.id,
  status: record.status,
  draft: record.draft_document,
  published: record.published_document,
  revision: record.revision,
  createdAt: iso(record.created_at),
  updatedAt: iso(record.updated_at),
  publishedAt: record.published_at ? iso(record.published_at) : null,
  archivedAt: record.archived_at ? iso(record.archived_at) : null,
});

function parseDocument(input: unknown, pageId?: string): PublicPageDocument {
  if (typeof input === 'object' && input !== null && 'schemaVersion' in input
    && (input as { schemaVersion?: unknown }).schemaVersion !== PUBLIC_PAGE_SCHEMA_VERSION) {
    throw new PublicPageServiceError('UNSUPPORTED_VERSION');
  }
  const parsed = publicPageDocumentSchema.safeParse(input);
  if (!parsed.success || (pageId !== undefined && parsed.data.id !== pageId)) {
    throw new PublicPageServiceError('INVALID_DOCUMENT');
  }
  return { ...parsed.data, slug: normalizePublicPageSlug(parsed.data.slug) };
}

function parseDraftDocument(input: unknown, pageId?: string): PublicPageDocument {
  const document = parseDocument(input, pageId);
  if (!isValidPublicPageSlug(document.slug)) throw new PublicPageServiceError('INVALID_DOCUMENT');
  return document;
}

function serverDocument(
  document: PublicPageDocument,
  status: PublicPageStatus,
  createdAt: string,
  updatedAt: string,
): PublicPageDocument {
  return { ...document, status, createdAt, updatedAt };
}

async function validateOwnedServiceReferences(
  accountId: number,
  document: PublicPageDocument,
): Promise<PublishIssue[]> {
  const blocks = document.sections.flatMap((section) => section.blocks)
    .filter((block) => block.type === 'services');
  const requestedIds = [...new Set(blocks.flatMap((block) => block.content.serviceIds))];
  if (requestedIds.length === 0) return [];
  const ownedIds = new Set((await listServices(accountId)).map(({ id }) => id));
  return missingServiceReferenceIssues(document, new Set(requestedIds.filter((id) => !ownedIds.has(id))));
}

function missingServiceReferenceIssues(
  document: PublicPageDocument,
  missingServiceIds: ReadonlySet<number>,
): PublishIssue[] {
  return document.sections.flatMap((section) => section.blocks)
    .filter((block) => block.type === 'services')
    .flatMap((block) => block.content.serviceIds.some((id) => missingServiceIds.has(id))
    ? [{
      code: 'missing_service',
      path: `blocks.${block.id}.content.serviceIds`,
      blockId: block.id,
    } satisfies PublishIssue]
    : []);
}

export async function getPublicPages(
  accountId: number,
  status: 'active' | PublicPageStatus | 'all' = 'active',
): Promise<PublicPageDto[]> {
  return (await listPublicPages(accountId, status)).map(toPublicPageDto);
}

export async function getPublicPage(accountId: number, pageId: string): Promise<PublicPageDto | null> {
  const page = await findPublicPage(accountId, pageId);
  return page ? toPublicPageDto(page) : null;
}

export async function getPublicPageSlugAvailability(
  accountId: number,
  slugInput: string,
  pageId?: string,
): Promise<{ slug: string; available: boolean }> {
  const slug = normalizePublicPageSlug(slugInput);
  if (!isValidPublicPageSlug(slug)) throw new PublicPageServiceError('INVALID_SLUG');
  if (pageId) {
    const page = await findPublicPage(accountId, pageId);
    if (!page || page.status === 'archived') throw new PublicPageRepositoryError('NOT_FOUND');
  }
  return { slug, available: await isPublicPageSlugAvailable(slug, pageId) };
}

export async function createPublicPageForAccount(accountId: number, input: unknown): Promise<PublicPageDto> {
  const parsed = parseDraftDocument(input);
  if ((await validateOwnedServiceReferences(accountId, parsed)).length > 0) {
    throw new PublicPageServiceError('INVALID_DOCUMENT');
  }
  const now = new Date().toISOString();
  const document = serverDocument(parsed, 'draft', now, now);
  try {
    return toPublicPageDto(await createPublicPage({ accountId, document, quota: PUBLIC_PAGE_ACCOUNT_QUOTA }));
  } catch (error) {
    if (error instanceof PublicPageRepositoryError && error.code === 'MISSING_SERVICES') {
      throw new PublicPageServiceError('INVALID_DOCUMENT');
    }
    throw error;
  }
}

export async function putPublicPageDraft(input: {
  accountId: number;
  pageId: string;
  document: unknown;
  expectedRevision: number;
}): Promise<PublicPageDto> {
  const parsed = parseDraftDocument(input.document, input.pageId);
  if ((await validateOwnedServiceReferences(input.accountId, parsed)).length > 0) {
    throw new PublicPageServiceError('INVALID_DOCUMENT');
  }
  const current = await findPublicPage(input.accountId, input.pageId);
  if (!current || current.status === 'archived') throw new PublicPageRepositoryError('NOT_FOUND');
  if (current.revision !== input.expectedRevision) throw new PublicPageRepositoryError('REVISION_CONFLICT', current);
  const document = serverDocument(parsed, 'draft', iso(current.created_at), new Date().toISOString());
  try {
    return toPublicPageDto(await savePublicPageDraft({ ...input, document }));
  } catch (error) {
    if (error instanceof PublicPageRepositoryError && error.code === 'MISSING_SERVICES') {
      throw new PublicPageServiceError('INVALID_DOCUMENT');
    }
    throw error;
  }
}

export async function publishPublicPageForAccount(
  accountId: number,
  pageId: string,
  expectedRevision: number,
): Promise<PublicPageDto> {
  const page = await findPublicPage(accountId, pageId);
  if (!page || page.status === 'archived') throw new PublicPageRepositoryError('NOT_FOUND');
  if (page.revision !== expectedRevision) throw new PublicPageRepositoryError('REVISION_CONFLICT', page);
  const parsed = parseDocument(page.draft_document, pageId);
  const now = new Date().toISOString();
  const published = serverDocument(parsed, 'published', iso(page.created_at), now);
  const issues = [
    ...validatePublicPageForPublish(published),
    ...await validateOwnedServiceReferences(accountId, published),
  ];
  if (issues.length > 0) throw new PublicPageServiceError('PUBLISH_VALIDATION_FAILED', issues);
  try {
    return toPublicPageDto(await publishPublicPage(accountId, pageId, expectedRevision, published));
  } catch (error) {
    if (error instanceof PublicPageRepositoryError && error.code === 'MISSING_SERVICES') {
      const missingIds = new Set(error.missingServiceIds ?? []);
      throw new PublicPageServiceError(
        'PUBLISH_VALIDATION_FAILED',
        missingServiceReferenceIssues(published, missingIds),
      );
    }
    throw error;
  }
}

export async function archivePublicPageForAccount(
  accountId: number,
  pageId: string,
  expectedRevision: number,
): Promise<PublicPageDto> {
  return toPublicPageDto(await archivePublicPage(accountId, pageId, expectedRevision));
}

export async function restorePublicPageForAccount(
  accountId: number,
  pageId: string,
  expectedRevision: number,
): Promise<PublicPageDto> {
  return toPublicPageDto(await restorePublicPage(
    accountId,
    pageId,
    expectedRevision,
    PUBLIC_PAGE_ACCOUNT_QUOTA,
  ));
}

export async function deletePublicPageForAccount(
  accountId: number,
  pageId: string,
  expectedRevision: number,
): Promise<void> {
  await deletePublicPage(accountId, pageId, expectedRevision);
}

export async function getPublishedPublicPage(slugInput: string): Promise<PublicPageDocument | null> {
  if (!isValidPublicPageSlug(slugInput)) return null;
  const slug = normalizePublicPageSlug(slugInput);
  return (await findPublishedPublicPageBySlug(slug))?.published_document ?? null;
}
