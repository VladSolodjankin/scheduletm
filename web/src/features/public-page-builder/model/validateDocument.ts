import {
  PUBLIC_PAGE_SCHEMA_VERSION,
  type MediaReference,
  type PublicPageDocument,
  type PublicPageStatus,
  type SectionLayout,
} from '../types/publicPage';
import { SOCIAL_PLATFORMS, type SocialPlatform } from './socialPlatforms';

export type DocumentValidationErrorCode =
  | 'invalid_type'
  | 'invalid_value'
  | 'required'
  | 'duplicate_id'
  | 'unsupported_schema_version';

export type DocumentValidationError = {
  code: DocumentValidationErrorCode;
  path: string;
};

export type DocumentValidationResult = {
  valid: boolean;
  errors: DocumentValidationError[];
};

const statuses = new Set<PublicPageStatus>(['draft', 'published', 'archived']);
const layouts = new Set<SectionLayout>([
  'single',
  'two-equal',
  'one-third-two-thirds',
  'two-thirds-one-third',
  'three-equal',
  'stack',
  'hero-overlay',
]);
const imageMimeTypes = new Set<MediaReference['mimeType']>([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === 'string';
}

function isBoundedNumber(value: unknown, minimum: number, maximum: number, nullable = false): boolean {
  return (nullable && value === null) || (typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum);
}

function validateTypography(value: unknown, path: string, errors: DocumentValidationError[], nullable: boolean): void {
  if (!isRecord(value)) { addError(errors, 'invalid_type', path); return; }
  for (const field of ['fontFamily', 'color'] as const) {
    if (!(nullable ? isNullableString(value[field]) : isNonEmptyString(value[field]))) {addError(errors, 'invalid_type', `${path}.${field}`);}
  }
  if (!isBoundedNumber(value.fontSize, 8, 96, nullable)) {addError(errors, 'invalid_value', `${path}.fontSize`);}
  if (!isBoundedNumber(value.fontWeight, 100, 900, nullable) || (value.fontWeight !== null && !Number.isInteger(value.fontWeight))) {addError(errors, 'invalid_value', `${path}.fontWeight`);}
  if (!(value.fontStyle === 'normal' || value.fontStyle === 'italic' || (nullable && value.fontStyle === null))) {addError(errors, 'invalid_value', `${path}.fontStyle`);}
}

function validateLinkStyle(value: unknown, path: string, errors: DocumentValidationError[], nullable: boolean): void {
  if (!isRecord(value)) { addError(errors, 'invalid_type', path); return; }
  validateTypography(value.titleStyle, `${path}.titleStyle`, errors, nullable); validateTypography(value.subtitleStyle, `${path}.subtitleStyle`, errors, nullable);
  for (const field of ['backgroundColor', 'borderColor'] as const) {
    if (!(nullable ? isNullableString(value[field]) : isNonEmptyString(value[field]))) {addError(errors, 'invalid_type', `${path}.${field}`);}
  }
  if (!isBoundedNumber(value.backgroundOpacity, 0, 1, nullable)) {addError(errors, 'invalid_value', `${path}.backgroundOpacity`);}
  if (!isBoundedNumber(value.borderWidth, 0, 16, nullable)) {addError(errors, 'invalid_value', `${path}.borderWidth`);}
  if (!(typeof value.shadow === 'boolean' || (nullable && value.shadow === null))) {addError(errors, 'invalid_type', `${path}.shadow`);}
}

function addError(
  errors: DocumentValidationError[],
  code: DocumentValidationErrorCode,
  path: string,
): void {
  errors.push({ code, path });
}

function validateRequiredString(
  value: unknown,
  path: string,
  errors: DocumentValidationError[],
): void {
  if (!isNonEmptyString(value)) {
    addError(errors, 'required', path);
  }
}

function validateString(value: unknown, path: string, errors: DocumentValidationError[]): void {
  if (typeof value !== 'string') {
    addError(errors, 'invalid_type', path);
  }
}

function validateProfile(value: unknown, errors: DocumentValidationError[]): void {
  if (!isRecord(value)) {
    addError(errors, 'invalid_type', 'profile');
    return;
  }

  validateString(value.displayName, 'profile.displayName', errors);
  validateString(value.description, 'profile.description', errors);

  if (!isNullableString(value.logoMediaId)) {
    addError(errors, 'invalid_type', 'profile.logoMediaId');
  }
  if (!isNullableString(value.avatarMediaId)) {
    addError(errors, 'invalid_type', 'profile.avatarMediaId');
  }
}

function validateTheme(value: unknown, errors: DocumentValidationError[]): void {
  if (!isRecord(value)) {
    addError(errors, 'invalid_type', 'theme');
    return;
  }

  validateRequiredString(value.id, 'theme.id', errors);
  validateRequiredString(value.name, 'theme.name', errors);

  if (!isRecord(value.colors)) {
    addError(errors, 'invalid_type', 'theme.colors');
    return;
  }

  for (const color of ['background', 'surface', 'text', 'primary']) {
    validateRequiredString(value.colors[color], `theme.colors.${color}`, errors);
  }
  validateRequiredString(value.fontFamily, 'theme.fontFamily', errors);
  if (!isNullableString(value.backgroundMediaId)) {addError(errors, 'invalid_type', 'theme.backgroundMediaId');}
  if (!isNullableString(value.backgroundPreset)) {addError(errors, 'invalid_type', 'theme.backgroundPreset');}
  if (value.backgroundFit !== 'cover' && value.backgroundFit !== 'contain') {addError(errors, 'invalid_value', 'theme.backgroundFit');}
  validateRequiredString(value.backgroundPosition, 'theme.backgroundPosition', errors);
  if (!['rounded', 'pill', 'leaf', 'square'].includes(String(value.roundingStyle))) {addError(errors, 'invalid_value', 'theme.roundingStyle');}
  if (!['primary-fill', 'primary-shadow', 'primary-strong', 'primary-outline', 'surface-fill', 'surface-outline', 'surface-shadow', 'surface-strong'].includes(String(value.linkStylePreset))) {addError(errors, 'invalid_value', 'theme.linkStylePreset');}
  if (!isRecord(value.styleDefaults)) { addError(errors, 'invalid_type', 'theme.styleDefaults'); }
  else {
    if (!isBoundedNumber(value.styleDefaults.sectionBorderRadius, 0, 100)) {addError(errors, 'invalid_value', 'theme.styleDefaults.sectionBorderRadius');}
    if (!isBoundedNumber(value.styleDefaults.blockBorderRadius, 0, 100)) {addError(errors, 'invalid_value', 'theme.styleDefaults.blockBorderRadius');}
    validateTypography(value.styleDefaults.headingStyle, 'theme.styleDefaults.headingStyle', errors, false);
    validateTypography(value.styleDefaults.textStyle, 'theme.styleDefaults.textStyle', errors, false);
    validateLinkStyle(value.styleDefaults.linkStyle, 'theme.styleDefaults.linkStyle', errors, false);
  }
}

function validateSeo(value: unknown, errors: DocumentValidationError[]): void {
  if (!isRecord(value)) {
    addError(errors, 'invalid_type', 'seo');
    return;
  }

  validateString(value.title, 'seo.title', errors);
  validateString(value.description, 'seo.description', errors);

  if (!isNullableString(value.imageMediaId)) {
    addError(errors, 'invalid_type', 'seo.imageMediaId');
  }
}

function validateSections(value: unknown, errors: DocumentValidationError[], ids: Set<string>): void {
  if (!Array.isArray(value)) {
    addError(errors, 'invalid_type', 'sections');
    return;
  }

  value.forEach((section, sectionIndex) => {
    const path = `sections.${sectionIndex}`;
    if (!isRecord(section)) {
      addError(errors, 'invalid_type', path);
      return;
    }

    validateEntityId(section.id, `${path}.id`, errors, ids);
    validateString(section.name, `${path}.name`, errors);

    if (typeof section.visible !== 'boolean') {
      addError(errors, 'invalid_type', `${path}.visible`);
    }
    if (!layouts.has(section.layout as SectionLayout)) {
      addError(errors, 'invalid_value', `${path}.layout`);
    }
    if (!isRecord(section.design)) {
      addError(errors, 'invalid_type', `${path}.design`);
    } else {
      if (!['off', 'custom', 'primary', 'secondary'].includes(String(section.design.variant))) {addError(errors, 'invalid_value', `${path}.design.variant`);}
      for (const color of ['backgroundColor', 'textColor', 'borderColor']) {
        if (!isNullableString(section.design[color])) {addError(errors, 'invalid_type', `${path}.design.${color}`);}
      }
      if (!isNullableString(section.design.backgroundMediaId)) {addError(errors, 'invalid_type', `${path}.design.backgroundMediaId`);}
      if (typeof section.design.backgroundOverlay !== 'number' || !Number.isFinite(section.design.backgroundOverlay)
        || section.design.backgroundOverlay < 0 || section.design.backgroundOverlay > 1) {addError(errors, 'invalid_value', `${path}.design.backgroundOverlay`);}
      if (!['cover', 'contain'].includes(String(section.design.backgroundFit))) {addError(errors, 'invalid_value', `${path}.design.backgroundFit`);}
      if (typeof section.design.backgroundPosition !== 'string') {addError(errors, 'invalid_type', `${path}.design.backgroundPosition`);}
      const maximums = { paddingTop: 160, paddingBottom: 160, borderWidth: 16 } as const;
      for (const field of Object.keys(maximums) as Array<keyof typeof maximums>) {
        const fieldValue = section.design[field];
        if (typeof fieldValue !== 'number' || !Number.isFinite(fieldValue) || fieldValue < 0 || fieldValue > maximums[field]) {addError(errors, 'invalid_value', `${path}.design.${field}`);}
      }
      if (!isBoundedNumber(section.design.borderRadius, 0, 100, true)) {addError(errors, 'invalid_value', `${path}.design.borderRadius`);}
      validateTypography(section.design.headingStyle, `${path}.design.headingStyle`, errors, true);
      validateTypography(section.design.textStyle, `${path}.design.textStyle`, errors, true);
      validateLinkStyle(section.design.linkStyle, `${path}.design.linkStyle`, errors, true);
      if (typeof section.design.horizontalMargin !== 'boolean') {addError(errors, 'invalid_type', `${path}.design.horizontalMargin`);}
      if (typeof section.design.shadow !== 'boolean') {addError(errors, 'invalid_type', `${path}.design.shadow`);}
      if (!['full', 'contained'].includes(String(section.design.width))) {addError(errors, 'invalid_value', `${path}.design.width`);}
      if (typeof section.design.mobileVisible !== 'boolean') {addError(errors, 'invalid_type', `${path}.design.mobileVisible`);}
    }
    validateBlocks(section.blocks, `${path}.blocks`, errors, ids);
  });
}

function validateBlocks(
  value: unknown,
  path: string,
  errors: DocumentValidationError[],
  ids: Set<string>,
): void {
  if (!Array.isArray(value)) {
    addError(errors, 'invalid_type', path);
    return;
  }

  value.forEach((block, blockIndex) => {
    const blockPath = `${path}.${blockIndex}`;
    if (!isRecord(block)) {
      addError(errors, 'invalid_type', blockPath);
      return;
    }

    validateEntityId(block.id, `${blockPath}.id`, errors, ids);
    validateRequiredString(block.type, `${blockPath}.type`, errors);
    validateString(block.name, `${blockPath}.name`, errors);

    if (typeof block.visible !== 'boolean') {
      addError(errors, 'invalid_type', `${blockPath}.visible`);
    }
    if (!isRecord(block.content)) {
      addError(errors, 'invalid_type', `${blockPath}.content`);
    }
    if (!isRecord(block.design)) {
      addError(errors, 'invalid_type', `${blockPath}.design`);
    } else {
      if (!isNullableString(block.design.backgroundColor)) {
        addError(errors, 'invalid_type', `${blockPath}.design.backgroundColor`);
      }
      if (!isNullableString(block.design.textColor)) {
        addError(errors, 'invalid_type', `${blockPath}.design.textColor`);
      }
      if (!isNullableString(block.design.backgroundMediaId)) {addError(errors, 'invalid_type', `${blockPath}.design.backgroundMediaId`);}
      for (const field of ['paddingTop', 'paddingBottom'] as const) {
        const fieldValue = block.design[field];
        if (typeof fieldValue !== 'number' || !Number.isFinite(fieldValue) || fieldValue < 0 || fieldValue > 160) {addError(errors, 'invalid_value', `${blockPath}.design.${field}`);}
      }
      if (!isBoundedNumber(block.design.borderRadius, 0, 100, true)) {addError(errors, 'invalid_value', `${blockPath}.design.borderRadius`);}
      if (typeof block.design.backgroundOverlay !== 'number' || block.design.backgroundOverlay < 0 || block.design.backgroundOverlay > 1) {
        addError(errors, 'invalid_value', `${blockPath}.design.backgroundOverlay`);
      }
      if (block.design.backgroundFit !== 'cover' && block.design.backgroundFit !== 'contain') {addError(errors, 'invalid_value', `${blockPath}.design.backgroundFit`);}
      validateRequiredString(block.design.backgroundPosition, `${blockPath}.design.backgroundPosition`, errors);
    }
  });
}

function validateMedia(value: unknown, errors: DocumentValidationError[], ids: Set<string>): void {
  if (!Array.isArray(value)) {
    addError(errors, 'invalid_type', 'media');
    return;
  }

  value.forEach((media, mediaIndex) => {
    const path = `media.${mediaIndex}`;
    if (!isRecord(media)) {
      addError(errors, 'invalid_type', path);
      return;
    }

    validateEntityId(media.id, `${path}.id`, errors, ids);
    validateRequiredString(media.url, `${path}.url`, errors);
    validateString(media.alt, `${path}.alt`, errors);

    if (!imageMimeTypes.has(media.mimeType as MediaReference['mimeType'])) {
      addError(errors, 'invalid_value', `${path}.mimeType`);
    }
    for (const dimension of ['width', 'height']) {
      const dimensionValue = media[dimension];
      if (typeof dimensionValue !== 'number' || dimensionValue < 0) {
        addError(errors, 'invalid_value', `${path}.${dimension}`);
      }
    }
  });
}

function validateSocialButtons(value: unknown, errors: DocumentValidationError[]): void {
  if (!Array.isArray(value)) {return;}
  const seen = new Set<SocialPlatform>();
  value.forEach((section, sectionIndex) => {
    if (!isRecord(section) || !Array.isArray(section.blocks)) {return;}
    section.blocks.forEach((block, blockIndex) => {
      if (!isRecord(block) || block.type !== 'social-button') {return;}
      const path = `sections.${sectionIndex}.blocks.${blockIndex}.content`;
      if (!isRecord(block.content)) {return;}
      const platform = block.content.platform;
      if (typeof platform !== 'string' || !SOCIAL_PLATFORMS.includes(platform as SocialPlatform)) {
        addError(errors, 'invalid_value', `${path}.platform`);
      } else if (seen.has(platform as SocialPlatform)) {
        addError(errors, 'invalid_value', `${path}.platform`);
      } else {seen.add(platform as SocialPlatform);}
      validateRequiredString(block.content.label, `${path}.label`, errors);
      validateRequiredString(block.content.url, `${path}.url`, errors);
      if (typeof block.content.url === 'string') {
        try {
          const url = new URL(block.content.url);
          if (url.protocol !== 'http:' && url.protocol !== 'https:') {addError(errors, 'invalid_value', `${path}.url`);}
        } catch {addError(errors, 'invalid_value', `${path}.url`);}
      }
    });
  });
}

function validateEntityId(
  value: unknown,
  path: string,
  errors: DocumentValidationError[],
  ids: Set<string>,
): void {
  if (!isNonEmptyString(value)) {
    addError(errors, 'required', path);
    return;
  }

  if (ids.has(value)) {
    addError(errors, 'duplicate_id', path);
    return;
  }

  ids.add(value);
}

export function validateDocument(input: unknown): DocumentValidationResult {
  const errors: DocumentValidationError[] = [];
  if (!isRecord(input)) {
    return { valid: false, errors: [{ code: 'invalid_type', path: '' }] };
  }

  if (input.schemaVersion !== PUBLIC_PAGE_SCHEMA_VERSION) {
    addError(errors, 'unsupported_schema_version', 'schemaVersion');
  }

  const ids = new Set<string>();
  validateEntityId(input.id, 'id', errors, ids);
  validateString(input.slug, 'slug', errors);

  if (!statuses.has(input.status as PublicPageStatus)) {
    addError(errors, 'invalid_value', 'status');
  }

  validateProfile(input.profile, errors);
  validateTheme(input.theme, errors);
  validateSections(input.sections, errors, ids);
  validateSocialButtons(input.sections, errors);
  validateSeo(input.seo, errors);
  validateMedia(input.media, errors, ids);
  validateRequiredString(input.createdAt, 'createdAt', errors);
  validateRequiredString(input.updatedAt, 'updatedAt', errors);

  return { valid: errors.length === 0, errors };
}

export function isPublicPageDocument(input: unknown): input is PublicPageDocument {
  return validateDocument(input).valid;
}
