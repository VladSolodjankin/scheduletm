import type { Locale } from '../../shared/i18n/dictionaries';
import { publicPageText, type PublicPageUiKey } from './uiText';

/** Block fields the owner fills in, by the name block validators report them under. */
const fieldKeys: Record<string, PublicPageUiKey> = {
  heading: 'fieldHeadline', subtitle: 'fieldSubtitle', label: 'fieldLabel', title: 'fieldTitle', description: 'fieldDescription',
  value: 'fieldValue', days: 'fieldDays', hours: 'fieldHours', price: 'fieldPrice', url: 'fieldUrl', address: 'fieldAddress',
  email: 'fieldEmail', phone: 'fieldPhone', document: 'fieldBody', imageMediaId: 'fieldImage', mediaId: 'fieldImage', alt: 'fieldAlt',
};

/** Names the fields a block still needs ("Fill in: Photo, Headline."), so the owner is not left guessing why Save is off. */
export function blockIssueText(locale: Locale, issues: readonly string[]): string {
  const labels = new Set<string>();
  for (const issue of issues) {
    const field = issue.split(' ')[0].split('.').filter((part) => !/^\d+$/.test(part)).pop() ?? '';
    const key = fieldKeys[field];
    if (key) {labels.add(publicPageText(locale, key));}
  }
  return labels.size === 0
    ? publicPageText(locale, 'publishInvalidBlock')
    : publicPageText(locale, 'blockIssueFields').replace('{fields}', [...labels].join(', '));
}
