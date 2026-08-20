import {
  ContactsBlock,
  AvatarBlock,
  ButtonBlock,
  DividerBlock,
  FaqBlock,
  GalleryBlock,
  SpecializedBlockEditor,
  HeroBlock,
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

function validateSafeItemUrls(content: BlockContent, key: string, kind: 'contact' | 'web'): string[] {
  const value = content[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') {
      return [];
    }
    const url = (item as Record<string, unknown>).url;
    return normalizeSafeHref(url, kind) ? [] : [`${key}.${index}.url is unsafe`];
  });
}

function validateSafeUrl(content: BlockContent, key: string): string[] {
  return normalizeSafeHref(content[key], 'web') ? [] : [`${key} is unsafe`];
}

const definitions: BlockDefinition[] = [
  { type: 'hero', name: 'Hero', createContent: () => ({ title: 'Your name', subtitle: 'A short introduction', imageUrl: '', imageAlt: '', ctaLabel: '' }), Renderer: HeroBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => required(content, 'title') },
  { type: 'avatar', name: 'Avatar', createContent: () => ({ heading: 'Your name', subtitle: 'A short introduction', imageMediaId: null, imageAlt: '',
    layout: 'centered', avatarSize: 150, coverColor: null, coverMediaId: null }), Renderer: AvatarBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => [
    ...required(content, 'heading'),
    ...(!content.imageMediaId ? ['imageMediaId is required'] : []),
  ] },
  { type: 'button', name: 'Button', createContent: () => ({ label: 'Learn more', icon: 'link', color: '', textColor: '', radius: 12, action: { type: 'url', url: 'https://example.com' } }), Renderer: ButtonBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => required(content, 'label') },
  { type: 'links', name: 'Links', createContent: () => ({ links: [{ id: 'link-1', label: 'Learn more', action: { type: 'url', url: 'https://example.com' } }] }), Renderer: LinksBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => validItems(content, 'links', ['label', 'action']) },
  { type: 'text', name: 'Text', createContent: () => ({ document: { type: 'rich-text-v1', paragraphs: [{ size: 'medium', fontFamily: null, alignment: 'left', runs: [{ text: '' }] }] } }), Renderer: TextBlock, Editor: SpecializedBlockEditor,
    validate: ({ content }) => hasRichTextContent(content.document) ? [] : ['document is required'] },
  { type: 'image', name: 'Image', createContent: () => ({ imageMediaId: null, alt: '' }), Renderer: ImageBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => required(content, 'imageMediaId', 'alt') },
  { type: 'gallery', name: 'Gallery', createContent: () => ({ images: [] }), Renderer: GalleryBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => validItems(content, 'images', ['mediaId', 'alt']) },
  { type: 'services', name: 'Services', createContent: () => ({ title: 'Services', services: [{ id: 'service-1', title: 'Consultation', description: 'Personal consultation', price: '' }] }), Renderer: ServicesBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => validItems(content, 'services', ['title']) },
  { type: 'contacts', name: 'Contacts', createContent: () => ({ title: 'Contacts', contacts: [{ id: 'contact-1', label: 'Email', url: 'mailto:hello@example.com' }] }), Renderer: ContactsBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => [...validItems(content, 'contacts', ['label', 'url']), ...validateSafeItemUrls(content, 'contacts', 'contact')] },
  { type: 'social-button', name: 'Social button', createContent: () => ({ platform: 'telegram', label: 'Telegram', url: 'https://t.me/' }), Renderer: SocialButtonBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => [...required(content, 'label', 'url'), ...validateSafeUrl(content, 'url'), ...validateSocialPlatforms(content)] },
  { type: 'map', name: 'Map', createContent: () => ({ title: 'Find us', address: '', label: 'Open map', url: '' }), Renderer: MapBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => [...required(content, 'address', 'url'), ...validateSafeUrl(content, 'url')] },
  { type: 'divider', name: 'Divider', createContent: () => ({}), Renderer: DividerBlock, Editor: SpecializedBlockEditor, validate: () => [] },
  { type: 'faq', name: 'FAQ', createContent: () => ({ title: 'Frequently asked questions', items: [{ id: 'faq-1', title: 'What should visitors know?', description: 'Share a concise answer to a common question.' }] }), Renderer: FaqBlock, Editor: SpecializedBlockEditor, validate: ({ content }) => validItems(content, 'items', ['title', 'description']) },
];

export function registerPublicPageBlocks(): void {
  definitions.forEach((definition) => {
    if (!getBlockDefinition(definition.type)) {
      registerBlock(definition);
    }
  });
}

export const publicPageBlockDefinitions = definitions;
