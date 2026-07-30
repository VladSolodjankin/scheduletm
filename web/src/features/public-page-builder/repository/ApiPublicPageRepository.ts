import axios from 'axios';
import { apiClient, authHeaders } from '../../../shared/api/client';
import { migrateDocument, UnsupportedDocumentVersionError } from '../model/migrateDocument';
import type { PublishValidationIssue } from '../model/publishValidation';
import type { PublicPageDocument, PublicPageStatus } from '../types/publicPage';
import {
  PublicPageRepositoryError,
  type PublicPageRecord,
  type PublicPageRepository,
} from './PublicPageRepository';

type ApiRecord = {
  id: string;
  draft: unknown;
  published: unknown | null;
  status: PublicPageStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
};

function readDocument(value: unknown): PublicPageDocument {
  try {
    return migrateDocument(value);
  } catch (error) {
    throw new PublicPageRepositoryError(
      error instanceof UnsupportedDocumentVersionError ? 'unsupported_version' : 'invalid_document',
      undefined,
      { cause: error },
    );
  }
}

function readRecord(value: ApiRecord): PublicPageRecord {
  return {
    id: value.id,
    draft: readDocument(value.draft),
    published: value.published === null ? null : readDocument(value.published),
    status: value.status,
    revision: value.revision,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    publishedAt: value.publishedAt,
    archivedAt: value.archivedAt,
  };
}

function mapError(error: unknown): never {
  if (!axios.isAxiosError(error)) {
    throw error;
  }
  const data = error.response?.data && typeof error.response.data === 'object'
    ? error.response.data as { code?: unknown; current?: unknown; issues?: unknown }
    : undefined;
  const code = data?.code;
  if (code === 'revision_conflict') {
    let current: PublicPageRecord | undefined;
    try {
      if (data?.current && typeof data.current === 'object') {
        current = readRecord(data.current as ApiRecord);
      }
    } catch {
      // A malformed current record must not make a stale editor retry the write.
    }
    throw new PublicPageRepositoryError('revision_conflict', undefined, { cause: error }, current);
  }
  if (code === 'publish_validation_failed') {
    const issues: PublishValidationIssue[] = Array.isArray(data?.issues)
      ? data.issues.flatMap((issue) => {
          if (!issue || typeof issue !== 'object') {return [];}
          const value = issue as Record<string, unknown>;
          if (typeof value.code !== 'string' || typeof value.path !== 'string') {return [];}
          return [{
            code: value.code as PublishValidationIssue['code'],
            path: value.path,
            ...(typeof value.detail === 'string' ? { detail: value.detail } : {}),
            ...(typeof value.blockId === 'string' ? { blockId: value.blockId } : {}),
            ...(typeof value.sectionId === 'string' ? { sectionId: value.sectionId } : {}),
          }];
        })
      : [];
    throw new PublicPageRepositoryError(
      'publish_validation_failed',
      undefined,
      { cause: error },
      undefined,
      issues,
    );
  }
  const mapped = {
    not_found: 'not_found',
    invalid_document: 'invalid_document',
    unsupported_version: 'unsupported_version',
    revision_conflict: 'revision_conflict',
    slug_conflict: 'slug_conflict',
    quota_exceeded: 'quota_exceeded',
    page_not_archived: 'page_not_archived',
  }[String(code)] as ConstructorParameters<typeof PublicPageRepositoryError>[0] | undefined;
  throw new PublicPageRepositoryError(mapped ?? 'storage_unavailable', undefined, { cause: error });
}

export class ApiPublicPageRepository implements PublicPageRepository {
  public constructor(private readonly accessToken: string) {}

  private get headers() {
    return authHeaders(this.accessToken);
  }

  public async list(): Promise<PublicPageRecord[]> {
    try {
      const response = await apiClient.get<ApiRecord[]>('/api/public-pages', {
        headers: this.headers,
        params: { status: 'all' },
      });
      return response.data.map(readRecord);
    } catch (error) { return mapError(error); }
  }

  public async get(pageId: string): Promise<PublicPageRecord> {
    try {
      const response = await apiClient.get<ApiRecord>(`/api/public-pages/${encodeURIComponent(pageId)}`, { headers: this.headers });
      return readRecord(response.data);
    } catch (error) { return mapError(error); }
  }

  public async create(document: PublicPageDocument): Promise<PublicPageRecord> {
    try {
      const response = await apiClient.post<ApiRecord>('/api/public-pages', { document }, { headers: this.headers });
      return readRecord(response.data);
    } catch (error) { return mapError(error); }
  }

  public async saveDraft(document: PublicPageDocument, expectedRevision: number): Promise<PublicPageRecord> {
    try {
      const response = await apiClient.put<ApiRecord>(
        `/api/public-pages/${encodeURIComponent(document.id)}/draft`,
        { document, expectedRevision },
        { headers: this.headers },
      );
      return readRecord(response.data);
    } catch (error) { return mapError(error); }
  }

  public async publish(pageId: string, expectedRevision: number): Promise<PublicPageRecord> {
    try {
      const response = await apiClient.post<ApiRecord>(
        `/api/public-pages/${encodeURIComponent(pageId)}/publish`,
        { expectedRevision },
        { headers: this.headers },
      );
      return readRecord(response.data);
    } catch (error) { return mapError(error); }
  }

  public async archive(pageId: string, expectedRevision: number): Promise<PublicPageRecord> {
    try {
      const response = await apiClient.post<ApiRecord>(
        `/api/public-pages/${encodeURIComponent(pageId)}/archive`,
        { expectedRevision },
        { headers: this.headers },
      );
      return readRecord(response.data);
    } catch (error) { return mapError(error); }
  }

  public async delete(pageId: string, expectedRevision: number): Promise<void> {
    try {
      await apiClient.delete(`/api/public-pages/${encodeURIComponent(pageId)}`, {
        headers: this.headers,
        data: { expectedRevision },
      });
    } catch (error) { mapError(error); }
  }

  public async getBySlug(slug: string): Promise<PublicPageDocument> {
    try {
      const response = await apiClient.get<unknown>(`/api/public-pages/by-slug/${encodeURIComponent(slug)}`);
      return readDocument(response.data);
    } catch (error) { return mapError(error); }
  }
}
