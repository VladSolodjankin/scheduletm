import {
  ContactsBlock,
  DividerBlock,
  FaqBlock,
  GalleryBlock,
  GenericBlockEditor,
  HeroBlock,
  ImageBlock,
  LinksBlock,
  MapBlock,
  MessengersBlock,
  normalizeSafeHref,
  required,
  ServicesBlock,
  SocialsBlock,
  TextBlock,
  validItems,
} from '../../../components/public-page-blocks/blocks';
import { getBlockDefinition, registerBlock, type BlockDefinition } from '../model/blockRegistry';
import type { BlockContent } from '../types/publicPage';

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
  { type: 'hero', name: 'Hero', createContent: () => ({ title: 'Your name', subtitle: 'A short introduction', imageUrl: '', imageAlt: '', ctaLabel: '' }), Renderer: HeroBlock, Editor: GenericBlockEditor, validate: ({ content }) => required(content, 'title') },
  { type: 'links', name: 'Links', createContent: () => ({ links: [{ id: 'link-1', label: 'Learn more', action: { type: 'url', url: 'https://example.com' } }] }), Renderer: LinksBlock, Editor: GenericBlockEditor, validate: ({ content }) => validItems(content, 'links', ['label', 'action']) },
  { type: 'text', name: 'Text', createContent: () => ({ title: 'About', body: 'Tell visitors about yourself.' }), Renderer: TextBlock, Editor: GenericBlockEditor, validate: ({ content }) => required(content, 'body') },
  { type: 'image', name: 'Image', createContent: () => ({ url: '', alt: '' }), Renderer: ImageBlock, Editor: GenericBlockEditor, validate: ({ content }) => required(content, 'url', 'alt') },
  { type: 'gallery', name: 'Gallery', createContent: () => ({ images: [] }), Renderer: GalleryBlock, Editor: GenericBlockEditor, validate: ({ content }) => validItems(content, 'images', ['url', 'alt']) },
  { type: 'services', name: 'Services', createContent: () => ({ title: 'Services', services: [{ id: 'service-1', title: 'Consultation', description: 'Personal consultation', price: '' }] }), Renderer: ServicesBlock, Editor: GenericBlockEditor, validate: ({ content }) => validItems(content, 'services', ['title']) },
  { type: 'contacts', name: 'Contacts', createContent: () => ({ title: 'Contacts', contacts: [{ id: 'contact-1', label: 'Email', url: 'mailto:hello@example.com' }] }), Renderer: ContactsBlock, Editor: GenericBlockEditor, validate: ({ content }) => [...validItems(content, 'contacts', ['label', 'url']), ...validateSafeItemUrls(content, 'contacts', 'contact')] },
  { type: 'socials', name: 'Social networks', createContent: () => ({ title: 'Follow me', links: [] }), Renderer: SocialsBlock, Editor: GenericBlockEditor, validate: ({ content }) => [...validItems(content, 'links', ['label', 'url']), ...validateSafeItemUrls(content, 'links', 'web')] },
  { type: 'messengers', name: 'Messaging apps', createContent: () => ({ title: 'Message me', links: [] }), Renderer: MessengersBlock, Editor: GenericBlockEditor, validate: ({ content }) => [...validItems(content, 'links', ['label', 'url']), ...validateSafeItemUrls(content, 'links', 'web')] },
  { type: 'map', name: 'Map', createContent: () => ({ title: 'Find us', address: '', label: 'Open map', url: '' }), Renderer: MapBlock, Editor: GenericBlockEditor, validate: ({ content }) => [...required(content, 'address', 'url'), ...validateSafeUrl(content, 'url')] },
  { type: 'divider', name: 'Divider', createContent: () => ({}), Renderer: DividerBlock, Editor: GenericBlockEditor, validate: () => [] },
  { type: 'faq', name: 'FAQ', createContent: () => ({ title: 'Frequently asked questions', items: [{ id: 'faq-1', title: 'What should visitors know?', description: 'Share a concise answer to a common question.' }] }), Renderer: FaqBlock, Editor: GenericBlockEditor, validate: ({ content }) => validItems(content, 'items', ['title', 'description']) },
];

export function registerPublicPageBlocks(): void {
  definitions.forEach((definition) => {
    if (!getBlockDefinition(definition.type)) {
      registerBlock(definition);
    }
  });
}

export const publicPageBlockDefinitions = definitions;
