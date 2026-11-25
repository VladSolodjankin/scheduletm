import { describe, expect, it } from 'vitest';
import { KNOWN_PUBLIC_PAGE_BLOCKS } from '@meetli/shared/public-page';
import { registerPublicPageBlocks } from '../../src/features/public-page-builder/config/registerBlocks';
import { createBlock, getBlockDefinition } from '../../src/features/public-page-builder/model/blockRegistry';
import { createEmptyPageSection } from '../../src/features/public-page-builder/model/emptySection';
import { getPublicPageTemplate } from '../../src/features/public-page-builder/templates';
import { documentIssues } from './support/validity';

registerPublicPageBlocks();

describe('block registry matches the shared document schema', () => {
  it.each([...KNOWN_PUBLIC_PAGE_BLOCKS])('registers %s and creates content the schema accepts in every language', (type) => {
    expect(getBlockDefinition(type), `${type} is not registered`).toBeDefined();
    for (const locale of ['ru', 'en'] as const) {
      const document = getPublicPageTemplate('blank')!.createDocument('registry-check', undefined, locale);
      const section = createEmptyPageSection();
      section.blocks = [createBlock(type, locale)];
      document.sections = [section];
      expect(documentIssues(document)).toEqual([]);
    }
  });
});
