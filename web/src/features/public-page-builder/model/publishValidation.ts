import type { CtaAction, PageBlock, PublicPageDocument } from '../types/publicPage';
import { getBlockDefinition } from './blockRegistry';
import { isSafeCtaAction } from './cta';
import { validateDocument } from './validateDocument';
import { validateMediaReference } from './media';
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

  const visibleBlocks = document.sections
    .filter((section) => section.visible)
    .flatMap((section) => section.blocks.filter((block) => block.visible));
  if (visibleBlocks.length === 0) {
    issues.push({ code: 'missing_visible_block', path: 'sections' });
  }

  document.media.forEach((media, index) => {
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
