import { CredentialsBlock } from '../../../components/public-page-blocks/CredentialsBlock';
import { ReviewsBlock } from '../../../components/public-page-blocks/ReviewsBlock';
import { publicPageText, type PublicPageUiKey } from '../../../components/public-page-builder/uiText';
import {
  ContactsBlock,
  AvatarBlock,
  ButtonBlock,
  DividerBlock,
  FaqBlock,
  GalleryBlock,
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
import { getBlockDefinition, registerBlock, type BlockDefinition } from '../model/blockRegistry';
import type { BlockContent } from '../types/publicPage';
import { validateSocialPlatforms } from '../model/socialPlatforms';
import { hasRichTextContent } from '../model/richText';
import { validateServicesBlockContent } from '../model/services';
import { validateContacts } from '../model/cta';
import { validateCredentialsContent } from '../model/credentials';
import { validateReviewsContent } from '../model/reviews';

function validateSafeUrl(content: BlockContent, key: string): string[] {
  return normalizeSafeHref(content[key]) ? [] : [`${key} is unsafe`];
}

function localized(key: PublicPageUiKey): Pick<BlockDefinition, 'localizedName'> {
  return { localizedName: (locale) => publicPageText(locale, key) };
}

const definitions: BlockDefinition[] = [
  { type: 'avatar', name: 'Avatar', ...localized('blockTypeAvatar'), createContent: (locale) => ({ heading: publicPageText(locale, 'defaultAvatarHeading'), subtitle: publicPageText(locale, 'defaultAvatarSubtitle'), imageMediaId: null, imageAlt: '',
    layout: 'centered', avatarSize: 150, coverColor: null, coverMediaId: null }), Renderer: AvatarBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => [
    ...required(content, 'heading'),
    ...(!content.imageMediaId ? ['imageMediaId is required'] : []),
  ] },
  { type: 'button', name: 'Button', ...localized('blockTypeButton'), createContent: (locale) => ({ label: publicPageText(locale, 'defaultLearnMore'), icon: 'link', subtitle: '', openInNewTab: false, action: { type: 'url', url: 'https://example.com' } }), Renderer: ButtonBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => required(content, 'label') },
  { type: 'links', name: 'Links', ...localized('blockTypeLinks'), createContent: (locale) => ({ links: [{ id: 'link-1', label: publicPageText(locale, 'defaultLearnMore'), action: { type: 'url', url: 'https://example.com' } }] }), Renderer: LinksBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => validItems(content, 'links', ['label', 'action']) },
  { type: 'text', name: 'Text', ...localized('blockTypeText'), createContent: () => ({ document: { type: 'rich-text-v1', paragraphs: [{ size: 'medium', fontFamily: null, alignment: 'left', runs: [{ text: '' }] }] } }), Renderer: TextBlock, Editor: SpecializedBlockEditor,
    validate: ({ content }) => hasRichTextContent(content.document) ? [] : ['document is required'] },
  { type: 'image', name: 'Image', ...localized('blockTypeImage'), createContent: () => ({ imageMediaId: null, alt: '' }), Renderer: ImageBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => required(content, 'imageMediaId', 'alt') },
  { type: 'gallery', name: 'Gallery', ...localized('blockTypeGallery'), createContent: () => ({ images: [] }), Renderer: GalleryBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => validItems(content, 'images', ['mediaId', 'alt']) },
  { type: 'services', name: 'Services', ...localized('blockTypeServices'), createContent: (locale) => ({ title: publicPageText(locale, 'blockTypeServices'), serviceIds: [], autoplayIntervalSeconds: null, showBookingButton: true }), Renderer: ServicesBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => validateServicesBlockContent(content) },
  { type: 'contacts', name: 'Contacts', ...localized('blockTypeContacts'), createContent: (locale) => ({ title: publicPageText(locale, 'blockTypeContacts'), contacts: [{ id: 'contact-1', label: publicPageText(locale, 'defaultContactLabel'), action: { type: 'email', email: 'hello@example.com' } }] }), Renderer: ContactsBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => validateContacts(content.contacts) },
  { type: 'social-button', name: 'Social button', ...localized('blockTypeSocialButton'), createContent: () => ({ platform: 'telegram', label: 'Telegram', url: 'https://t.me/' }), Renderer: SocialButtonBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => [...required(content, 'label', 'url'), ...validateSafeUrl(content, 'url'), ...validateSocialPlatforms(content)] },
  { type: 'map', name: 'Map', ...localized('blockTypeMap'), createContent: (locale) => ({ title: publicPageText(locale, 'defaultMapTitle'), address: '', label: publicPageText(locale, 'defaultMapLabel'), url: '' }), Renderer: MapBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => [...required(content, 'address', 'url'), ...validateSafeUrl(content, 'url')] },
  { type: 'divider', name: 'Divider', ...localized('blockTypeDivider'), createContent: () => ({}), Renderer: DividerBlock, Editor: SpecializedBlockEditor, validate: () => [] },
  { type: 'faq', name: 'FAQ', ...localized('blockTypeFaq'), createContent: (locale) => ({ title: publicPageText(locale, 'defaultFaqTitle'), items: [{ id: 'faq-1', title: publicPageText(locale, 'defaultFaqQuestion'), description: publicPageText(locale, 'defaultFaqAnswer') }] }), Renderer: FaqBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => validItems(content, 'items', ['title', 'description']) },
  { type: 'credentials', name: 'Credentials', ...localized('blockTypeCredentials'), createContent: (locale) => ({ title: publicPageText(locale, 'credentialsDefaultTitle'), items: [] }), Renderer: CredentialsBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => validateCredentialsContent(content) },
  { type: 'reviews', name: 'Reviews', ...localized('blockTypeReviews'), createContent: (locale) => ({ title: publicPageText(locale, 'reviewsDefaultTitle'), showSummary: true, autoplay: false }), Renderer: ReviewsBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => validateReviewsContent(content) },
];

export function registerPublicPageBlocks(): void {
  definitions.forEach((definition) => {
    if (!getBlockDefinition(definition.type)) {
      registerBlock(definition);
    }
  });
}
