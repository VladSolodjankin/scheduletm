import { publicPageDocumentSchema } from '@meetli/shared/public-page';

/** Issues of the shared document schema as `{ path, message }`; empty when the document is valid. */
export function documentIssues(document: unknown): { path: string; message: string; code: string }[] {
  const result = publicPageDocumentSchema.safeParse(document);
  return result.success ? [] : result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message, code: issue.code }));
}

export const isValidDocument = (document: unknown): boolean => documentIssues(document).length === 0;
