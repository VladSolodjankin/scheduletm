import {
  PUBLIC_PAGE_SCHEMA_VERSION,
  type PublicPageDocument,
} from '../../features/public-page-builder/types/publicPage';
import { createStableId } from '../../features/public-page-builder/utils/createStableId';
import { DEFAULT_PUBLIC_PAGE_THEME } from '../../features/public-page-builder/config/themes';
import { createEmptyPageSection } from '../../features/public-page-builder/model/normalizeDocument';

export function createBlankPublicPageDocument(): PublicPageDocument {
  const now = new Date().toISOString();
  const id = createStableId();
  return {
    schemaVersion: PUBLIC_PAGE_SCHEMA_VERSION,
    id,
    slug: `page-${id.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 8)}`,
    status: 'draft',
    profile: { displayName: '', description: '', logoMediaId: null, avatarMediaId: null },
    theme: structuredClone(DEFAULT_PUBLIC_PAGE_THEME),
    sections: [createEmptyPageSection()],
    seo: { title: '', description: '', imageMediaId: null },
    media: [],
    createdAt: now,
    updatedAt: now,
  };
}
