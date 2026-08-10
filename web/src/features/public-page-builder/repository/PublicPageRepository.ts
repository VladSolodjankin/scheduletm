import type { PublicPageDocument } from '../types/publicPage';
import type { PublishValidationIssue } from '../model/publishValidation';

export type PublicPageRepositoryErrorCode =
  | 'not_found'
  | 'invalid_document'
  | 'publish_validation_failed'
  | 'revision_conflict'
  | 'corrupt_storage'
  | 'unsupported_version'
  | 'slug_conflict'
  | 'storage_unavailable'
  | 'media_in_use'
  | 'quota_exceeded'
  | 'page_not_archived';

export class PublicPageRepositoryError extends Error {
  public constructor(
    public readonly code: PublicPageRepositoryErrorCode,
    message?: string,
    options?: ErrorOptions,
    public readonly current?: PublicPageRecord,
    public readonly issues?: PublishValidationIssue[],
  ) {
    super(message ?? code, options);
    this.name = 'PublicPageRepositoryError';
  }
}

export type PublicPageRecord = {
  id: string;
  draft: PublicPageDocument;
  published: PublicPageDocument | null;
  status: PublicPageDocument['status'];
  revision: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
};

export interface PublicPageRepository {
  list(): Promise<PublicPageRecord[]>;
  get(pageId: string): Promise<PublicPageRecord>;
  create(document: PublicPageDocument): Promise<PublicPageRecord>;
  saveDraft(document: PublicPageDocument, expectedRevision: number): Promise<PublicPageRecord>;
  archive(pageId: string, expectedRevision: number): Promise<PublicPageRecord>;
  delete(pageId: string, expectedRevision: number): Promise<void>;
  publish(pageId: string, expectedRevision: number): Promise<PublicPageRecord>;
  getBySlug(slug: string): Promise<PublicPageDocument>;
}
