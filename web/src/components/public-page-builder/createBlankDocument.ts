import {
  PUBLIC_PAGE_SCHEMA_VERSION,
  type PublicPageDocument,
} from '../../features/public-page-builder/types/publicPage';
import { createStableId } from '../../features/public-page-builder/utils/createStableId';

export function createBlankPublicPageDocument(): PublicPageDocument {
  const now = new Date().toISOString();
  const id = createStableId();
  return {
    schemaVersion: PUBLIC_PAGE_SCHEMA_VERSION,
    id,
    slug: `page-${id.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 8)}`,
    status: 'draft',
    profile: { displayName: '', description: '', logoMediaId: null, avatarMediaId: null },
    theme: {
      id: 'minimal-light',
      name: 'Minimal Light',
      colors: { background: '#f7f7f5', surface: '#ffffff', text: '#171717', primary: '#5b5bd6' },
      fontFamily: 'Inter, system-ui, sans-serif',
      backgroundMediaId: null,
      backgroundPreset: null,
      backgroundFit: 'cover',
      backgroundPosition: '50% 50%',
    },
    sections: [],
    seo: { title: '', description: '', imageMediaId: null },
    media: [],
    createdAt: now,
    updatedAt: now,
  };
}
