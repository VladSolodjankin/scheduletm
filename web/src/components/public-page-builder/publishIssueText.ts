import type { PublishValidationCode, PublishValidationIssue } from '../../features/public-page-builder/model/publishValidation';
import type { Locale } from '../../shared/i18n/dictionaries';
import { translate } from '../../shared/i18n/translate';
import type { PublicPageBuilderKey } from '../../shared/i18n/dictionaries';

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
  placeholder_link: 'publishPlaceholderLink',
} satisfies Record<PublishValidationCode, PublicPageBuilderKey>;

export function publishIssueText(locale: Locale, issue: PublishValidationIssue): string {
  return translate(locale, `publicPageBuilder.${issueKeys[issue.code] ?? 'publishInvalidDocument'}`);
}
