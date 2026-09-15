import type { PublishValidationCode, PublishValidationIssue } from '../../features/public-page-builder/model/publishValidation';
import type { Locale } from '../../shared/i18n/dictionaries';
import { publicPageText, type PublicPageUiKey } from './uiText';

const issueKeys = {
  invalid_document: 'publishInvalidDocument',
  invalid_slug: 'invalidSlug',
  missing_visible_block: 'publishMissingBlock',
  unknown_block: 'publishInvalidBlock',
  invalid_block: 'publishInvalidBlock',
  invalid_cta: 'publishInvalidLink',
  invalid_media: 'publishInvalidMedia',
  missing_media: 'publishInvalidMedia',
  missing_alt: 'publishMissingAlt',
  missing_accessible_label: 'publishMissingLabel',
  missing_seo_title: 'publishMissingTitle',
  missing_seo_description: 'publishMissingDescription',
} satisfies Record<PublishValidationCode, PublicPageUiKey>;

export function publishIssueText(locale: Locale, issue: PublishValidationIssue): string {
  return publicPageText(locale, issueKeys[issue.code] ?? 'publishInvalidDocument');
}
