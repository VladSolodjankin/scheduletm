import type { CtaAction, PageBlock, PublicPageDocument } from '../types/publicPage';
import { getBlockDefinition } from './blockRegistry';
import { isSafeCtaAction } from './cta';
import { validateDocument } from './validateDocument';
import { collectReferencedMediaIds, validateMediaReference } from './media';
import { validateSlug } from './slug';

export type PublishValidationCode =
  | 'invalid_document'
  | 'invalid_slug'
  | 'missing_visible_block'
  | 'unknown_block'
  | 'invalid_block'
  | 'invalid_cta'
  | 'invalid_media'
  | 'missing_media'
  | 'missing_alt'
  | 'missing_accessible_label'
  | 'missing_seo_title'
  | 'missing_seo_description';

export type PublishValidationIssue = {
  code: PublishValidationCode;
  path: string;
  sectionId?: string;
  blockId?: string;
  detail?: string;
};

export type PublishValidationResult = {
  valid: boolean;
  issues: PublishValidationIssue[];
};

export type PageSettingsFocusMarker =
  | 'profile.displayName'
  | 'profile.description'
  | 'profile.logoMediaId'
  | 'profile.avatarMediaId'
  | 'seo.title'
  | 'seo.description'
  | 'slug';

export type PublishIssueFocusTarget =
  | { type: 'add-block' }
  | { type: 'page-settings'; marker: string }
  | { type: 'design-panel'; marker: string }
  | { type: 'block-dialog'; sectionId: string; blockId: string; tab: 'content' | 'design' | 'settings' | 'section'; marker: string }
  | { type: 'validation-alert' };

type BlockLocation = {
  sectionId: string;
  blockId: string;
  block: PageBlock;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCtaAction(value: unknown): value is CtaAction {
  if (!isRecord(value) || typeof value.type !== 'string') {return false;}
  switch (value.type) {
    case 'url':
    case 'messenger':
      return typeof value.url === 'string';
    case 'phone':
      return typeof value.phone === 'string';
    case 'email':
      return typeof value.email === 'string';
    default:
      return false;
  }
}

function findBlockById(document: PublicPageDocument, blockId: string): BlockLocation | null {
  for (const section of document.sections) {
    const block = section.blocks.find((candidate) => candidate.id === blockId);
    if (block) {return { sectionId: section.id, blockId: block.id, block };}
  }
  return null;
}

function findIndexedBlock(
  document: PublicPageDocument,
  sectionIndex: number,
  blockIndex: number,
): BlockLocation | null {
  const section = document.sections[sectionIndex];
  const block = section?.blocks[blockIndex];
  return section && block ? { sectionId: section.id, blockId: block.id, block } : null;
}

function blockFocusTarget(
  location: BlockLocation,
  issue: PublishValidationIssue,
  relativePath: string,
): PublishIssueFocusTarget {
  if (issue.code === 'unknown_block') {return { type: 'validation-alert' };}
  if (!relativePath && issue.code === 'invalid_block') {
    return { type: 'block-dialog', sectionId: location.sectionId, blockId: location.blockId, tab: 'content', marker: 'block.content' };
  }
  if (relativePath === 'content' || relativePath.startsWith('content.')) {
    const hasEditableMedia = location.block.type === 'avatar'
      || location.block.type === 'image'
      || location.block.type === 'gallery';
    const marker = hasEditableMedia && /(?:^|\.)(?:imageMediaId|images(?:\.|$)|imageAlt|alt)(?:\.|$)/.test(relativePath)
      ? 'block.content.media'
      : 'block.content';
    return { type: 'block-dialog', sectionId: location.sectionId, blockId: location.blockId, tab: 'content', marker };
  }
  if (relativePath === 'design' || relativePath.startsWith('design.')) {
    const marker = relativePath === 'design.backgroundMediaId'
      ? 'block.design.backgroundMediaId'
      : 'block.design';
    return { type: 'block-dialog', sectionId: location.sectionId, blockId: location.blockId, tab: 'design', marker };
  }
  if (relativePath === 'name' || relativePath === 'visible') {
    return { type: 'block-dialog', sectionId: location.sectionId, blockId: location.blockId, tab: 'settings', marker: `block.${relativePath}` };
  }
  if (relativePath === 'section' || relativePath.startsWith('section.')) {
    return { type: 'block-dialog', sectionId: location.sectionId, blockId: location.blockId, tab: 'section', marker: 'section.design' };
  }
  return { type: 'validation-alert' };
}

function mediaOwnerFocusTarget(
  document: PublicPageDocument,
  mediaIndex: number,
  field: 'alt' | 'url',
): PublishIssueFocusTarget {
  const mediaId = document.media[mediaIndex]?.id;
  if (!mediaId) {return { type: 'validation-alert' };}
  const altMarker = `media:${mediaId}:alt`;

  if (document.profile.logoMediaId === mediaId) {
    return { type: 'page-settings', marker: field === 'alt' ? altMarker : 'profile.logoMediaId' };
  }
  if (document.profile.avatarMediaId === mediaId) {
    return { type: 'page-settings', marker: field === 'alt' ? altMarker : 'profile.avatarMediaId' };
  }

  for (const section of document.sections) {
    for (const block of section.blocks) {
      if (block.design.backgroundMediaId === mediaId) {
        return { type: 'block-dialog', sectionId: section.id, blockId: block.id, tab: 'design', marker: field === 'alt' ? altMarker : 'block.design.backgroundMediaId' };
      }
      if ((block.type === 'avatar' || block.type === 'image') && block.content.imageMediaId === mediaId) {
        return { type: 'block-dialog', sectionId: section.id, blockId: block.id, tab: 'content', marker: field === 'alt' ? altMarker : 'block.content.media' };
      }
      if (block.type === 'gallery' && Array.isArray(block.content.images)
        && block.content.images.some((item) => isRecord(item) && item.mediaId === mediaId)) {
        return { type: 'block-dialog', sectionId: section.id, blockId: block.id, tab: 'content', marker: field === 'alt' ? altMarker : 'block.content.media' };
      }
    }
  }

  for (const section of document.sections) {
    if (section.design.backgroundMediaId !== mediaId) {continue;}
    const block = section.blocks[0];
    return block
      ? { type: 'block-dialog', sectionId: section.id, blockId: block.id, tab: 'section', marker: field === 'alt' ? altMarker : 'section.design.backgroundMediaId' }
      : { type: 'validation-alert' };
  }

  if (document.theme.backgroundMediaId === mediaId) {
    return { type: 'design-panel', marker: field === 'alt' ? altMarker : 'theme.backgroundMediaId' };
  }
  return { type: 'validation-alert' };
}

export function isPublishValidationResultCurrent(
  startedAtLocalRevision: number,
  currentLocalRevision: number,
): boolean {
  return startedAtLocalRevision === currentLocalRevision;
}

/** Resolves only editor controls that exist for the current document. */
export function resolvePublishIssueFocusTarget(
  document: PublicPageDocument,
  issue: PublishValidationIssue,
): PublishIssueFocusTarget {
  if (issue.code === 'missing_visible_block' || issue.path === 'sections') {
    return { type: 'add-block' };
  }

  const pageMarkers = new Set<PageSettingsFocusMarker>([
    'profile.displayName',
    'profile.description',
    'profile.logoMediaId',
    'profile.avatarMediaId',
    'seo.title',
    'seo.description',
    'slug',
  ]);
  if (pageMarkers.has(issue.path as PageSettingsFocusMarker)) {
    return { type: 'page-settings', marker: issue.path as PageSettingsFocusMarker };
  }

  if (issue.blockId) {
    const explicit = findBlockById(document, issue.blockId);
    if (!explicit) {return { type: 'validation-alert' };}
    const indexedPath = issue.path.match(/^sections\.\d+\.blocks\.\d+(?:\.(.*))?$/);
    const serverPath = issue.path.match(/^blocks\.[^.]+(?:\.(.*))?$/);
    return blockFocusTarget(explicit, issue, indexedPath?.[1] ?? serverPath?.[1] ?? '');
  }

  const serverBlock = issue.path.match(/^blocks\.([^.]+)(?:\.(.*))?$/);
  if (serverBlock) {
    const location = findBlockById(document, serverBlock[1]);
    return location ? blockFocusTarget(location, issue, serverBlock[2] ?? '') : { type: 'validation-alert' };
  }

  const indexedBlock = issue.path.match(/^sections\.(\d+)\.blocks\.(\d+)(?:\.(.*))?$/);
  if (indexedBlock) {
    const location = findIndexedBlock(document, Number(indexedBlock[1]), Number(indexedBlock[2]));
    return location ? blockFocusTarget(location, issue, indexedBlock[3] ?? '') : { type: 'validation-alert' };
  }

  const indexedSection = issue.path.match(/^sections\.(\d+)\.design(?:\.|$)/);
  if (indexedSection) {
    const section = document.sections[Number(indexedSection[1])];
    const block = section?.blocks[0];
    return section && block
      ? { type: 'block-dialog', sectionId: section.id, blockId: block.id, tab: 'section', marker: 'section.design' }
      : { type: 'validation-alert' };
  }

  const mediaPath = issue.path.match(/^media\.(\d+)\.(alt|url)$/);
  if (mediaPath) {return mediaOwnerFocusTarget(document, Number(mediaPath[1]), mediaPath[2] as 'alt' | 'url');}

  return { type: 'validation-alert' };
}

function visitContent(
  value: unknown,
  path: string,
  visitor: (value: unknown, path: string) => void,
): void {
  visitor(value, path);
  if (Array.isArray(value)) {
    value.forEach((item, index) => visitContent(item, `${path}.${index}`, visitor));
  } else if (isRecord(value)) {
    Object.entries(value).forEach(([key, item]) => visitContent(item, `${path}.${key}`, visitor));
  }
}

function validateBlockContent(
  document: PublicPageDocument,
  block: PageBlock,
  sectionId: string,
  path: string,
  issues: PublishValidationIssue[],
): void {
  const definition = getBlockDefinition(block.type);
  if (!definition) {
    issues.push({ code: 'unknown_block', path, sectionId, blockId: block.id });
    return;
  }
  for (const detail of definition.validate?.(block) ?? []) {
    issues.push({ code: 'invalid_block', path, sectionId, blockId: block.id, detail });
  }

  visitContent(block.content, `${path}.content`, (value, contentPath) => {
    if (isCtaAction(value) && !isSafeCtaAction(value)) {
      issues.push({ code: 'invalid_cta', path: contentPath, sectionId, blockId: block.id });
    }
    if (isRecord(value) && typeof value.label === 'string' && isCtaAction(value.action)
      && !value.label.trim()) {
      issues.push({
        code: 'missing_accessible_label',
        path: `${contentPath}.label`,
        sectionId,
        blockId: block.id,
      });
    }

    for (const [key, item] of isRecord(value) ? Object.entries(value) : []) {
      if (key === 'action' && !isCtaAction(item)) {
        issues.push({
          code: 'invalid_cta',
          path: `${contentPath}.${key}`,
          sectionId,
          blockId: block.id,
        });
      }
      if (!/mediaId$/i.test(key) || item === null) {continue;}
      if (typeof item !== 'string' || !document.media.some((media) => media.id === item)) {
        issues.push({
          code: 'missing_media',
          path: `${contentPath}.${key}`,
          sectionId,
          blockId: block.id,
        });
      }
    }
  });
}

export function validateForPublish(document: PublicPageDocument): PublishValidationResult {
  const issues: PublishValidationIssue[] = [];
  const structural = validateDocument(document);
  structural.errors.forEach((error) => {
    issues.push({ code: 'invalid_document', path: error.path, detail: error.code });
  });

  const slugError = validateSlug(document.slug);
  if (slugError) {issues.push({ code: 'invalid_slug', path: 'slug', detail: slugError });}
  if (!document.seo.title.trim()) {issues.push({ code: 'missing_seo_title', path: 'seo.title' });}
  if (!document.seo.description.trim()) {
    issues.push({ code: 'missing_seo_description', path: 'seo.description' });
  }
  for (const [path, mediaId] of [
    ['profile.logoMediaId', document.profile.logoMediaId],
    ['profile.avatarMediaId', document.profile.avatarMediaId],
    ['seo.imageMediaId', document.seo.imageMediaId],
  ] as const) {
    if (mediaId !== null && (typeof mediaId !== 'string' || !document.media.some((media) => media.id === mediaId))) {
      issues.push({ code: 'missing_media', path });
    }
  }

  const visibleBlocks = document.sections
    .filter((section) => section.visible)
    .flatMap((section) => section.blocks.filter((block) => block.visible));
  if (visibleBlocks.length === 0) {
    issues.push({ code: 'missing_visible_block', path: 'sections' });
  }

  const archivedMedia = new Set(collectReferencedMediaIds(document.archivedBlocks));
  const activeMedia = new Set(collectReferencedMediaIds({ profile: document.profile, theme: document.theme, seo: document.seo, sections: document.sections }));
  document.media.forEach((media, index) => {
    if (archivedMedia.has(media.id) && !activeMedia.has(media.id)) {return;}
    const mediaError = validateMediaReference(media);
    if (mediaError) {
      issues.push({ code: 'invalid_media', path: `media.${index}.url`, detail: mediaError });
    }
    if (!media.alt.trim()) {issues.push({ code: 'missing_alt', path: `media.${index}.alt` });}
  });

  document.sections.forEach((section, sectionIndex) => {
    if (!section.visible) {return;}
    section.blocks.forEach((block, blockIndex) => {
      if (!block.visible) {return;}
      validateBlockContent(
        document,
        block,
        section.id,
        `sections.${sectionIndex}.blocks.${blockIndex}`,
        issues,
      );
    });
  });

  return { valid: issues.length === 0, issues };
}
