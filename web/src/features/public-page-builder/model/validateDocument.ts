import {
  PUBLIC_PAGE_SCHEMA_VERSION,
  type MediaReference,
  type PublicPageDocument,
  type PublicPageStatus,
  type SectionLayout,
} from '../types/publicPage';

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
  validateSeo(input.seo, errors);
  validateMedia(input.media, errors, ids);
  validateRequiredString(input.createdAt, 'createdAt', errors);
  validateRequiredString(input.updatedAt, 'updatedAt', errors);

  return { valid: errors.length === 0, errors };
}

export function isPublicPageDocument(input: unknown): input is PublicPageDocument {
  return validateDocument(input).valid;
}
