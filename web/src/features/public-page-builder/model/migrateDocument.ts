import { PUBLIC_PAGE_SCHEMA_VERSION, type PublicPageDocument } from '../types/publicPage';
import { normalizeDocument } from './normalizeDocument';

export class UnsupportedDocumentVersionError extends Error {
  public constructor(version: number) {
    super(`Unsupported public page schema version: ${version}`);
    this.name = 'UnsupportedDocumentVersionError';
  }
}

function readSchemaVersion(input: unknown): number {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return 0;
  }

  const version = (input as Record<string, unknown>).schemaVersion;
  return typeof version === 'number' && Number.isInteger(version) ? version : 0;
}

export function migrateDocument(input: unknown): PublicPageDocument {
  const version = readSchemaVersion(input);

  if (version > PUBLIC_PAGE_SCHEMA_VERSION) {
    throw new UnsupportedDocumentVersionError(version);
  }

  return normalizeDocument(input);
}
