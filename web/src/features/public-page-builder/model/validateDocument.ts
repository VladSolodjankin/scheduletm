import { isScheduleTimezone } from './schedule';
import {
  PUBLIC_PAGE_SCHEMA_VERSION,
  type MediaReference,
  type PublicPageDocument,
  type PublicPageStatus,
  type SectionLayout,
} from '../types/publicPage';
import { SOCIAL_PLATFORMS, type SocialPlatform } from './socialPlatforms';
import { parseAvatarPosition } from './avatarPosition';

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
const knownBlockTypes = new Set([
  'avatar', 'button', 'links', 'text', 'image', 'gallery', 'services',
  'contacts', 'social-button', 'map', 'divider', 'faq',
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
  validateExactKeys(value, ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'color'], path, errors);
  for (const field of ['fontFamily', 'color'] as const) {
    if (!(nullable ? isNullableString(value[field]) : isNonEmptyString(value[field]))) {addError(errors, 'invalid_type', `${path}.${field}`);}
  }
  if (!isBoundedNumber(value.fontSize, 8, 96, nullable)) {addError(errors, 'invalid_value', `${path}.fontSize`);}
  if (!isBoundedNumber(value.fontWeight, 100, 900, nullable) || (value.fontWeight !== null && !Number.isInteger(value.fontWeight))) {addError(errors, 'invalid_value', `${path}.fontWeight`);}
  if (!(value.fontStyle === 'normal' || value.fontStyle === 'italic' || (nullable && value.fontStyle === null))) {addError(errors, 'invalid_value', `${path}.fontStyle`);}
}

function validateLinkStyle(value: unknown, path: string, errors: DocumentValidationError[], nullable: boolean): void {
  if (!isRecord(value)) { addError(errors, 'invalid_type', path); return; }
  validateExactKeys(value, ['titleStyle', 'subtitleStyle', 'backgroundColor', 'backgroundOpacity', 'borderWidth', 'borderColor', 'shadow'], path, errors);
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
  if (!parseAvatarPosition(value.avatarPosition)) {
    addError(errors, 'invalid_value', 'profile.avatarPosition');
  }
  validateExactKeys(value, ['displayName', 'description', 'logoMediaId', 'avatarMediaId', 'avatarPosition'], 'profile', errors);
}

function validateTheme(value: unknown, errors: DocumentValidationError[]): void {
  if (!isRecord(value)) {
    addError(errors, 'invalid_type', 'theme');
    return;
  }

  validateRequiredString(value.id, 'theme.id', errors);
  validateRequiredString(value.name, 'theme.name', errors);

  if (!Array.isArray(value.swatches) || value.swatches.length !== 4) {
    addError(errors, 'invalid_type', 'theme.swatches');
  } else {
    value.swatches.forEach((swatch, index) => validateRequiredString(swatch, `theme.swatches.${index}`, errors));
  }
  validateExactKeys(value, ['id', 'name', 'swatches', 'colors', 'tokens', 'fontFamily', 'roundingStyle', 'linkStylePreset', 'backgroundMediaId', 'backgroundPreset', 'backgroundFit', 'backgroundPosition', 'styleDefaults'], 'theme', errors);
  if (!isRecord(value.colors)) {
    addError(errors, 'invalid_type', 'theme.colors');
    return;
  }

  for (const color of ['background', 'surface', 'text', 'primary']) {
    validateRequiredString(value.colors[color], `theme.colors.${color}`, errors);
  }
  validateExactKeys(value.colors, ['background', 'surface', 'text', 'primary'], 'theme.colors', errors);
  validateThemeTokens(value.tokens, errors);
  validateRequiredString(value.fontFamily, 'theme.fontFamily', errors);
  if (!isNullableString(value.backgroundMediaId)) {addError(errors, 'invalid_type', 'theme.backgroundMediaId');}
  if (!isNullableString(value.backgroundPreset)) {addError(errors, 'invalid_type', 'theme.backgroundPreset');}
  if (value.backgroundFit !== 'cover' && value.backgroundFit !== 'contain') {addError(errors, 'invalid_value', 'theme.backgroundFit');}
  validateRequiredString(value.backgroundPosition, 'theme.backgroundPosition', errors);
  if (!['rounded', 'pill', 'leaf', 'square'].includes(String(value.roundingStyle))) {addError(errors, 'invalid_value', 'theme.roundingStyle');}
  if (!['primary-fill', 'primary-shadow', 'primary-strong', 'primary-outline', 'surface-fill', 'surface-outline', 'surface-shadow', 'surface-strong'].includes(String(value.linkStylePreset))) {addError(errors, 'invalid_value', 'theme.linkStylePreset');}
  if (!isRecord(value.styleDefaults)) { addError(errors, 'invalid_type', 'theme.styleDefaults'); }
  else {
    validateExactKeys(value.styleDefaults, ['sectionBorderRadius', 'blockBorderRadius', 'headingStyle', 'textStyle', 'linkStyle'], 'theme.styleDefaults', errors);
    if (!isBoundedNumber(value.styleDefaults.sectionBorderRadius, 0, 100)) {addError(errors, 'invalid_value', 'theme.styleDefaults.sectionBorderRadius');}
    if (!isBoundedNumber(value.styleDefaults.blockBorderRadius, 0, 100)) {addError(errors, 'invalid_value', 'theme.styleDefaults.blockBorderRadius');}
    validateTypography(value.styleDefaults.headingStyle, 'theme.styleDefaults.headingStyle', errors, false);
    validateTypography(value.styleDefaults.textStyle, 'theme.styleDefaults.textStyle', errors, false);
    validateLinkStyle(value.styleDefaults.linkStyle, 'theme.styleDefaults.linkStyle', errors, false);
  }
}

function validateExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  errors: DocumentValidationError[],
): void {
  const allowedKeys = new Set(allowed);
  Object.keys(value).forEach((key) => {
    if (!allowedKeys.has(key)) {addError(errors, 'invalid_value', path ? `${path}.${key}` : key);}
  });
}

function validateNullableString(value: unknown, path: string, errors: DocumentValidationError[]): void {
  if (!isNullableString(value)) {addError(errors, 'invalid_type', path);}
}

function validateCtaAction(value: unknown, path: string, errors: DocumentValidationError[]): void {
  if (!isRecord(value)) {addError(errors, 'invalid_type', path); return;}
  switch (value.type) {
    case 'url':
    case 'messenger':
      validateExactKeys(value, ['type', 'url'], path, errors);
      validateString(value.url, `${path}.url`, errors);
      break;
    case 'phone':
      validateExactKeys(value, ['type', 'phone'], path, errors);
      validateString(value.phone, `${path}.phone`, errors);
      break;
    case 'email':
      validateExactKeys(value, ['type', 'email'], path, errors);
      validateString(value.email, `${path}.email`, errors);
      break;
    default:
      addError(errors, 'invalid_value', `${path}.type`);
  }
}

function validateRichTextDocument(value: unknown, path: string, errors: DocumentValidationError[]): void {
  if (!isRecord(value)) {addError(errors, 'invalid_type', path); return;}
  validateExactKeys(value, ['type', 'paragraphs'], path, errors);
  if (value.type !== 'rich-text-v1') {addError(errors, 'invalid_value', `${path}.type`);}
  if (!Array.isArray(value.paragraphs) || value.paragraphs.length === 0) {
    addError(errors, 'invalid_value', `${path}.paragraphs`);
    return;
  }
  value.paragraphs.forEach((paragraph, paragraphIndex) => {
    const paragraphPath = `${path}.paragraphs.${paragraphIndex}`;
    if (!isRecord(paragraph)) {addError(errors, 'invalid_type', paragraphPath); return;}
    validateExactKeys(paragraph, ['size', 'fontFamily', 'alignment', 'runs'], paragraphPath, errors);
    if (!['small', 'medium', 'large', 'h1', 'h2', 'h3'].includes(String(paragraph.size))) {addError(errors, 'invalid_value', `${paragraphPath}.size`);}
    validateNullableString(paragraph.fontFamily, `${paragraphPath}.fontFamily`, errors);
    if (!['left', 'center', 'right', 'justify'].includes(String(paragraph.alignment))) {addError(errors, 'invalid_value', `${paragraphPath}.alignment`);}
    if (!Array.isArray(paragraph.runs) || paragraph.runs.length === 0) {
      addError(errors, 'invalid_value', `${paragraphPath}.runs`);
      return;
    }
    paragraph.runs.forEach((run, runIndex) => {
      const runPath = `${paragraphPath}.runs.${runIndex}`;
      if (!isRecord(run)) {addError(errors, 'invalid_type', runPath); return;}
      validateExactKeys(run, ['text', 'marks'], runPath, errors);
      validateString(run.text, `${runPath}.text`, errors);
      if (run.marks === undefined) {return;}
      if (!isRecord(run.marks)) {addError(errors, 'invalid_type', `${runPath}.marks`); return;}
      validateExactKeys(run.marks, ['bold', 'italic', 'underline', 'strike', 'color'], `${runPath}.marks`, errors);
      for (const mark of ['bold', 'italic', 'underline', 'strike']) {
        if (run.marks[mark] !== undefined && run.marks[mark] !== true) {addError(errors, 'invalid_value', `${runPath}.marks.${mark}`);}
      }
      if (run.marks.color !== undefined && !isNonEmptyString(run.marks.color)) {addError(errors, 'invalid_value', `${runPath}.marks.color`);}
    });
  });
}

function validateBlockContent(type: unknown, value: unknown, path: string, errors: DocumentValidationError[]): void {
  if (!isRecord(value)) {addError(errors, 'invalid_type', path); return;}
  const stringFields = (fields: readonly string[]) => fields.forEach((field) => validateString(value[field], `${path}.${field}`, errors));
  const rows = (field: string, validateRow: (row: Record<string, unknown>, rowPath: string) => void) => {
    if (!Array.isArray(value[field])) {addError(errors, 'invalid_type', `${path}.${field}`); return;}
    value[field].forEach((row, index) => {
      const rowPath = `${path}.${field}.${index}`;
      if (!isRecord(row)) {addError(errors, 'invalid_type', rowPath); return;}
      validateRow(row, rowPath);
    });
  };

  switch (type) {
    case 'avatar':
      validateExactKeys(value, ['heading', 'subtitle', 'imageMediaId', 'imageAlt', 'layout', 'avatarSize', 'coverColor', 'coverMediaId'], path, errors);
      stringFields(['heading', 'subtitle', 'imageAlt']);
      validateNullableString(value.imageMediaId, `${path}.imageMediaId`, errors);
      validateNullableString(value.coverColor, `${path}.coverColor`, errors);
      validateNullableString(value.coverMediaId, `${path}.coverMediaId`, errors);
      if (!['centered', 'cover-centered', 'cover-left', 'image-cover'].includes(String(value.layout))) {addError(errors, 'invalid_value', `${path}.layout`);}
      if (![65, 95, 125, 150].includes(Number(value.avatarSize))) {addError(errors, 'invalid_value', `${path}.avatarSize`);}
      return;
    case 'button':
      validateExactKeys(value, ['label', 'subtitle', 'openInNewTab', 'icon', 'action'], path, errors);
      stringFields(['label', 'subtitle']);
      if (!['link', 'phone', 'email', 'message'].includes(String(value.icon))) {addError(errors, 'invalid_value', `${path}.icon`);}
      if (typeof value.openInNewTab !== 'boolean') {addError(errors, 'invalid_type', `${path}.openInNewTab`);}
      validateCtaAction(value.action, `${path}.action`, errors);
      return;
    case 'links':
      validateExactKeys(value, ['links'], path, errors);
      rows('links', (row, rowPath) => {
        validateExactKeys(row, ['id', 'label', 'action'], rowPath, errors);
        validateRequiredString(row.id, `${rowPath}.id`, errors);
        validateString(row.label, `${rowPath}.label`, errors);
        validateCtaAction(row.action, `${rowPath}.action`, errors);
      });
      return;
    case 'text':
      validateExactKeys(value, ['document'], path, errors);
      validateRichTextDocument(value.document, `${path}.document`, errors);
      return;
    case 'image':
      validateExactKeys(value, ['imageMediaId', 'alt'], path, errors);
      validateNullableString(value.imageMediaId, `${path}.imageMediaId`, errors);
      validateString(value.alt, `${path}.alt`, errors);
      return;
    case 'gallery':
      validateExactKeys(value, ['images'], path, errors);
      rows('images', (row, rowPath) => {
        validateExactKeys(row, ['mediaId', 'alt'], rowPath, errors);
        validateRequiredString(row.mediaId, `${rowPath}.mediaId`, errors);
        validateString(row.alt, `${rowPath}.alt`, errors);
      });
      return;
    case 'services': {
      validateExactKeys(value, ['title', 'serviceIds', 'autoplayIntervalSeconds', 'showBookingButton'], path, errors);
      validateString(value.title, `${path}.title`, errors);
      if (!Array.isArray(value.serviceIds) || value.serviceIds.length > 12) {addError(errors, 'invalid_value', `${path}.serviceIds`);}
      else if (value.serviceIds.some((id) => !Number.isInteger(id) || Number(id) <= 0)
        || new Set(value.serviceIds).size !== value.serviceIds.length) {addError(errors, 'invalid_value', `${path}.serviceIds`);}
      if (!(value.autoplayIntervalSeconds === null || (Number.isInteger(value.autoplayIntervalSeconds)
        && Number(value.autoplayIntervalSeconds) >= 3 && Number(value.autoplayIntervalSeconds) <= 30))) {
        addError(errors, 'invalid_value', `${path}.autoplayIntervalSeconds`);
      }
      if (typeof value.showBookingButton !== 'boolean') {addError(errors, 'invalid_type', `${path}.showBookingButton`);}
      return;
    }
    case 'contacts':
      validateExactKeys(value, ['title', 'contacts'], path, errors);
      validateString(value.title, `${path}.title`, errors);
      rows('contacts', (row, rowPath) => {
        validateExactKeys(row, ['id', 'label', 'action'], rowPath, errors);
        validateRequiredString(row.id, `${rowPath}.id`, errors);
        validateString(row.label, `${rowPath}.label`, errors);
        validateCtaAction(row.action, `${rowPath}.action`, errors);
      });
      return;
    case 'social-button':
      validateExactKeys(value, ['platform', 'label', 'url'], path, errors);
      if (!SOCIAL_PLATFORMS.includes(value.platform as SocialPlatform)) {addError(errors, 'invalid_value', `${path}.platform`);}
      validateRequiredString(value.label, `${path}.label`, errors);
      validateRequiredString(value.url, `${path}.url`, errors);
      if (typeof value.url === 'string') {
        try { if (!['http:', 'https:'].includes(new URL(value.url).protocol)) {addError(errors, 'invalid_value', `${path}.url`);} }
        catch {addError(errors, 'invalid_value', `${path}.url`);}
      }
      return;
    case 'map':
      validateExactKeys(value, ['title', 'address', 'label', 'url'], path, errors);
      stringFields(['title', 'address', 'label', 'url']);
      return;
    case 'divider':
      validateExactKeys(value, [], path, errors);
      return;
    case 'faq':
      validateExactKeys(value, ['title', 'items'], path, errors);
      validateString(value.title, `${path}.title`, errors);
      rows('items', (row, rowPath) => {
        validateExactKeys(row, ['id', 'title', 'description'], rowPath, errors);
        validateRequiredString(row.id, `${rowPath}.id`, errors);
        validateString(row.title, `${rowPath}.title`, errors);
        validateString(row.description, `${rowPath}.description`, errors);
      });
      return;
    default:
      addError(errors, 'invalid_value', path.replace(/\.content$/, '.type'));
  }
}

function validateThemeTypographyToken(value: unknown, path: string, errors: DocumentValidationError[]): void {
  if (!isRecord(value)) {addError(errors, 'invalid_type', path); return;}
  validateExactKeys(value, ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'], path, errors);
  validateRequiredString(value.fontFamily, `${path}.fontFamily`, errors);
  if (!isBoundedNumber(value.fontSize, 8, 96)) {addError(errors, 'invalid_value', `${path}.fontSize`);}
  if (!isBoundedNumber(value.fontWeight, 100, 900) || !Number.isInteger(value.fontWeight)) {addError(errors, 'invalid_value', `${path}.fontWeight`);}
  if (!isBoundedNumber(value.lineHeight, 0.5, 3)) {addError(errors, 'invalid_value', `${path}.lineHeight`);}
  if (!isBoundedNumber(value.letterSpacing, -10, 20)) {addError(errors, 'invalid_value', `${path}.letterSpacing`);}
}

function validateThemeTokens(value: unknown, errors: DocumentValidationError[]): void {
  if (!isRecord(value)) {addError(errors, 'invalid_type', 'theme.tokens'); return;}
  validateExactKeys(value, ['colors', 'typography', 'layout'], 'theme.tokens', errors);
  if (!isRecord(value.colors)) {addError(errors, 'invalid_type', 'theme.tokens.colors');}
  else {
    validateExactKeys(value.colors, ['contrast', 'linkTitle', 'linkSubtitle', 'linkShadow', 'linkBorder', 'focus', 'checkboxBackground'], 'theme.tokens.colors', errors);
    for (const color of ['contrast', 'linkTitle', 'linkSubtitle', 'linkShadow', 'linkBorder', 'focus', 'checkboxBackground']) {
      validateRequiredString(value.colors[color], `theme.tokens.colors.${color}`, errors);
    }
  }
  if (!isRecord(value.typography)) {addError(errors, 'invalid_type', 'theme.tokens.typography');}
  else {
    validateExactKeys(value.typography, ['fontFamily', 'fontWeight', 'boldFontWeight', 'headingColor', 'avatarTitle', 'avatarBio', 'linkTitle', 'linkSubtitle', 'h1', 'h2', 'h3', 'textLarge', 'textMedium', 'textSmall'], 'theme.tokens.typography', errors);
    validateRequiredString(value.typography.fontFamily, 'theme.tokens.typography.fontFamily', errors);
    validateRequiredString(value.typography.headingColor, 'theme.tokens.typography.headingColor', errors);
    for (const weight of ['fontWeight', 'boldFontWeight']) {
      if (!isBoundedNumber(value.typography[weight], 100, 900) || !Number.isInteger(value.typography[weight])) {
        addError(errors, 'invalid_value', `theme.tokens.typography.${weight}`);
      }
    }
    for (const token of ['avatarTitle', 'avatarBio', 'linkTitle', 'linkSubtitle', 'h1', 'h2', 'h3', 'textLarge', 'textMedium', 'textSmall']) {
      validateThemeTypographyToken(value.typography[token], `theme.tokens.typography.${token}`, errors);
    }
  }
  if (!isRecord(value.layout)) {addError(errors, 'invalid_type', 'theme.tokens.layout');}
  else {
    validateExactKeys(value.layout, ['blockRadius', 'linkRadius', 'linkGap'], 'theme.tokens.layout', errors);
    for (const token of ['blockRadius', 'linkRadius', 'linkGap']) {
      if (!isBoundedNumber(value.layout[token], 0, 100)) {addError(errors, 'invalid_value', `theme.tokens.layout.${token}`);}
    }
  }
}

function validateSeo(value: unknown, errors: DocumentValidationError[]): void {
  if (!isRecord(value)) {
    addError(errors, 'invalid_type', 'seo');
    return;
  }
  validateExactKeys(value, ['title', 'description', 'imageMediaId'], 'seo', errors);

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
    validateExactKeys(section, ['id', 'name', 'visible', 'layout', 'design', 'blocks'], path, errors);
    if (!isRecord(section.design)) {
      addError(errors, 'invalid_type', `${path}.design`);
    } else {
      validateExactKeys(section.design, ['variant', 'backgroundColor', 'textColor', 'backgroundMediaId', 'backgroundOverlay', 'backgroundFit', 'backgroundPosition', 'paddingTop', 'paddingBottom', 'horizontalMargin', 'borderRadius', 'borderWidth', 'borderColor', 'shadow', 'width', 'mobileVisible', 'headingStyle', 'textStyle', 'linkStyle'], `${path}.design`, errors);
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
    validateExactKeys(block, ['id', 'type', 'name', 'visible', 'content', 'design', 'schedule'], blockPath, errors);

    validateSchedule(block.schedule, `${blockPath}.schedule`, errors);
    validateEntityId(block.id, `${blockPath}.id`, errors, ids);
    validateRequiredString(block.type, `${blockPath}.type`, errors);
    validateString(block.name, `${blockPath}.name`, errors);

    if (typeof block.visible !== 'boolean') {
      addError(errors, 'invalid_type', `${blockPath}.visible`);
    }
    if (!knownBlockTypes.has(String(block.type))) {addError(errors, 'invalid_value', `${blockPath}.type`);}
    else {validateBlockContent(block.type, block.content, `${blockPath}.content`, errors);}
    if (!isRecord(block.design)) {
      addError(errors, 'invalid_type', `${blockPath}.design`);
    } else {
      validateExactKeys(block.design, ['backgroundColor', 'textColor', 'backgroundMediaId', 'backgroundOverlay', 'backgroundFit', 'backgroundPosition', 'paddingTop', 'paddingBottom', 'borderRadius', 'linkStyle', 'animation'], `${blockPath}.design`, errors);
      if (block.design.linkStyle !== null) {validateLinkStyle(block.design.linkStyle, `${blockPath}.design.linkStyle`, errors, true);}
      if (!['none', 'pulse', 'lift'].includes(String(block.design.animation))) {addError(errors, 'invalid_value', `${blockPath}.design.animation`);}
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
    validateExactKeys(media, ['id', 'url', 'mimeType', 'alt', 'width', 'height'], path, errors);

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
  validateExactKeys(input, ['schemaVersion', 'id', 'slug', 'status', 'profile', 'theme', 'sections', 'seo', 'media', 'createdAt', 'updatedAt', 'timezone', 'archivedBlocks'], '', errors);

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
  if (!isScheduleTimezone(input.timezone)) {addError(errors, 'invalid_value', 'timezone');}
  if (!Array.isArray(input.archivedBlocks)) {addError(errors, 'invalid_type', 'archivedBlocks');}
  else {input.archivedBlocks.forEach((entry, index) => {
    const path = `archivedBlocks.${index}`;
    if (!isRecord(entry)) {addError(errors, 'invalid_type', path); return;}
    validateExactKeys(entry, ['block', 'sourceSectionId'], path, errors);
    validateRequiredString(entry.sourceSectionId, `${path}.sourceSectionId`, errors);
    validateBlocks([entry.block], `${path}.block`, errors, ids);
  });}
  validateSeo(input.seo, errors);
  validateMedia(input.media, errors, ids);
  validateRequiredString(input.createdAt, 'createdAt', errors);
  validateRequiredString(input.updatedAt, 'updatedAt', errors);

  return { valid: errors.length === 0, errors };
}

export function isPublicPageDocument(input: unknown): input is PublicPageDocument {
  return validateDocument(input).valid;
}

function validateSchedule(value: unknown, path: string, errors: DocumentValidationError[]): void {
  if (!isRecord(value)) {addError(errors, 'invalid_type', path); return;}
  validateExactKeys(value, ['period', 'weekdays'], path, errors);
  if (value.period !== null) {
    if (!isRecord(value.period)) {addError(errors, 'invalid_type', `${path}.period`);}
    else {
      validateExactKeys(value.period, ['startAt', 'endAt'], `${path}.period`, errors);
      const validUtc = (date: unknown): date is string => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 19) === date.slice(0, 19);
      if (!validUtc(value.period.startAt) || !validUtc(value.period.endAt) || Date.parse(value.period.startAt) >= Date.parse(value.period.endAt)) {addError(errors, 'invalid_value', `${path}.period`);}
    }
  }
  if (value.weekdays !== null && (!Array.isArray(value.weekdays) || !value.weekdays.length || value.weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7) || new Set(value.weekdays).size !== value.weekdays.length)) {addError(errors, 'invalid_value', `${path}.weekdays`);}
}
