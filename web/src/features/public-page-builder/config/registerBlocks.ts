import { CredentialsBlock } from '../../../components/public-page-blocks/CredentialsBlock';
import { ReviewsBlock } from '../../../components/public-page-blocks/ReviewsBlock';
import {
  ContactsBlock,
  AvatarBlock,
  ButtonBlock,
  DividerBlock,
  FaqBlock,
  GalleryBlock,
  HoursBlock,
  PriceListBlock,
  StatsBlock,
  StepsBlock,
  VideoBlock,
  SpecializedBlockEditor,
  ImageBlock,
  LinksBlock,
  MapBlock,
  normalizeSafeHref,
  required,
  ServicesBlock,
  SocialButtonBlock,
  TextBlock,
  validItems,
} from '../../../components/public-page-blocks/blocks';
import { parsePublicPageVideoUrl } from '@meetli/shared/public-page';
import { getBlockDefinition, registerBlock, type BlockDefinition } from '../model/blockRegistry';
import type { BlockContent } from '../types/publicPage';
import { validateSocialPlatforms } from '../model/socialPlatforms';
import { hasRichTextContent } from '../model/richText';
import { validateServicesBlockContent } from '../model/services';
import { validateContacts } from '../model/cta';
import { validateCredentialsContent } from '../model/credentials';
import { validateReviewsContent } from '../model/reviews';
import { translate } from '../../../shared/i18n/translate';
import type { PublicPageBuilderKey } from '../../../shared/i18n/dictionaries';

function validateSafeUrl(content: BlockContent, key: string): string[] {
  return normalizeSafeHref(content[key]) ? [] : [`${key} is unsafe`];
}

function localized(key: PublicPageBuilderKey): Pick<BlockDefinition, 'localizedName'> {
  return { localizedName: (locale) => translate(locale, `publicPageBuilder.${key}`) };
}

const definitions: BlockDefinition[] = [
  { type: 'avatar', name: 'Avatar', ...localized('blockTypeAvatar'), createContent: (locale) => ({ heading: translate(locale, 'publicPageBuilder.defaultAvatarHeading'), subtitle: translate(locale, 'publicPageBuilder.defaultAvatarSubtitle'), imageMediaId: null, imageAlt: '',
    layout: 'centered', avatarSize: 150, coverColor: null, coverMediaId: null }), Renderer: AvatarBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => [
    ...required(content, 'heading'),
    ...(!content.imageMediaId ? ['imageMediaId is required'] : []),
  ] },
  { type: 'button', name: 'Button', ...localized('blockTypeButton'), createContent: (locale) => ({ label: translate(locale, 'publicPageBuilder.defaultLearnMore'), icon: 'link', subtitle: '', openInNewTab: false, action: { type: 'url', url: 'https://example.com' } }), Renderer: ButtonBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => required(content, 'label') },
  { type: 'links', name: 'Links', ...localized('blockTypeLinks'), createContent: (locale) => ({ links: [{ id: 'link-1', label: translate(locale, 'publicPageBuilder.defaultLearnMore'), action: { type: 'url', url: 'https://example.com' } }] }), Renderer: LinksBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => validItems(content, 'links', ['label', 'action']) },
  { type: 'text', name: 'Text', ...localized('blockTypeText'), createContent: () => ({ document: { type: 'rich-text-v1', paragraphs: [{ size: 'medium', fontFamily: null, alignment: 'left', runs: [{ text: '' }] }] } }), Renderer: TextBlock, Editor: SpecializedBlockEditor,
    validate: ({ content }) => hasRichTextContent(content.document) ? [] : ['document is required'] },
  { type: 'image', name: 'Image', ...localized('blockTypeImage'), createContent: () => ({ imageMediaId: null, alt: '' }), Renderer: ImageBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => required(content, 'imageMediaId', 'alt') },
  { type: 'gallery', name: 'Gallery', ...localized('blockTypeGallery'), createContent: () => ({ images: [] }), Renderer: GalleryBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => validItems(content, 'images', ['mediaId', 'alt']) },
  { type: 'services', name: 'Services', ...localized('blockTypeServices'), createContent: (locale) => ({ title: translate(locale, 'publicPageBuilder.blockTypeServices'), serviceIds: [], autoplayIntervalSeconds: null, showBookingButton: true, layout: 'carousel' }), Renderer: ServicesBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => validateServicesBlockContent(content) },
  { type: 'contacts', name: 'Contacts', ...localized('blockTypeContacts'), createContent: (locale) => ({ title: translate(locale, 'publicPageBuilder.blockTypeContacts'), contacts: [{ id: 'contact-1', label: translate(locale, 'publicPageBuilder.defaultContactLabel'), action: { type: 'email', email: 'hello@example.com' } }] }), Renderer: ContactsBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => validateContacts(content.contacts) },
  { type: 'social-button', name: 'Social button', ...localized('blockTypeSocialButton'), createContent: () => ({ platform: 'telegram', label: 'Telegram', url: 'https://t.me/' }), Renderer: SocialButtonBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => [...required(content, 'label', 'url'), ...validateSafeUrl(content, 'url'), ...validateSocialPlatforms(content)] },
  { type: 'map', name: 'Map', ...localized('blockTypeMap'), createContent: (locale) => ({ title: translate(locale, 'publicPageBuilder.defaultMapTitle'), address: '', label: translate(locale, 'publicPageBuilder.defaultMapLabel'), url: '' }), Renderer: MapBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => [...required(content, 'address', 'url'), ...validateSafeUrl(content, 'url')] },
  { type: 'divider', name: 'Divider', ...localized('blockTypeDivider'), createContent: () => ({}), Renderer: DividerBlock, Editor: SpecializedBlockEditor, validate: () => [] },
  { type: 'faq', name: 'FAQ', ...localized('blockTypeFaq'), createContent: (locale) => ({ title: translate(locale, 'publicPageBuilder.defaultFaqTitle'), items: [{ id: 'faq-1', title: translate(locale, 'publicPageBuilder.defaultFaqQuestion'), description: translate(locale, 'publicPageBuilder.defaultFaqAnswer') }] }), Renderer: FaqBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => validItems(content, 'items', ['title', 'description']) },
  { type: 'credentials', name: 'Credentials', ...localized('blockTypeCredentials'), createContent: (locale) => ({ title: translate(locale, 'publicPageBuilder.credentialsDefaultTitle'), items: [] }), Renderer: CredentialsBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => validateCredentialsContent(content) },
  { type: 'reviews', name: 'Reviews', ...localized('blockTypeReviews'), createContent: (locale) => ({ title: translate(locale, 'publicPageBuilder.reviewsDefaultTitle'), showSummary: true, autoplay: false }), Renderer: ReviewsBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => validateReviewsContent(content) },
  { type: 'price-list', name: 'Price list', ...localized('blockTypePriceList'), createContent: (locale) => ({ title: translate(locale, 'publicPageBuilder.defaultPriceListTitle'), items: [{ id: 'price-1', title: translate(locale, 'publicPageBuilder.defaultPriceListItem'), description: '', price: '' }] }), Renderer: PriceListBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => validItems(content, 'items', ['title']) },
  { type: 'steps', name: 'Steps', ...localized('blockTypeSteps'), createContent: (locale) => ({ title: translate(locale, 'publicPageBuilder.defaultStepsTitle'), items: [{ id: 'step-1', title: translate(locale, 'publicPageBuilder.defaultStepTitle'), description: translate(locale, 'publicPageBuilder.defaultStepDescription') }] }), Renderer: StepsBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => validItems(content, 'items', ['title']) },
  { type: 'stats', name: 'Numbers', ...localized('blockTypeStats'), createContent: (locale) => ({ title: '', items: [{ id: 'stat-1', value: translate(locale, 'publicPageBuilder.defaultStatValue'), description: translate(locale, 'publicPageBuilder.defaultStatDescription') }] }), Renderer: StatsBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => validItems(content, 'items', ['value']) },
  { type: 'hours', name: 'Working hours', ...localized('blockTypeHours'), createContent: (locale) => ({ title: translate(locale, 'publicPageBuilder.defaultHoursTitle'), items: [{ id: 'hours-1', days: translate(locale, 'publicPageBuilder.defaultHoursDays'), hours: translate(locale, 'publicPageBuilder.defaultHoursTime') }] }), Renderer: HoursBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => validItems(content, 'items', ['days', 'hours']) },
  { type: 'video', name: 'Video', ...localized('blockTypeVideo'), createContent: () => ({ title: '', url: '' }), Renderer: VideoBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => parsePublicPageVideoUrl(typeof content.url === 'string' ? content.url : '') ? [] : ['url is not a YouTube or Vimeo video'] },
];

export function registerPublicPageBlocks(): void {
  definitions.forEach((definition) => {
    if (!getBlockDefinition(definition.type)) {
      registerBlock(definition);
    }
  });
}
