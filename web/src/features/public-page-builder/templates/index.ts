import { PUBLIC_PAGE_SCHEMA_VERSION, type PageBlock, type PublicPageDocument } from '../types/publicPage';
import { PUBLIC_PAGE_THEMES } from '../config/themes';

export type PublicPageTemplate = {
  id: string;
  name: string;
  createDocument: (pageId: string, now?: string) => PublicPageDocument;
};

const design = () => ({ backgroundColor: null, textColor: null, backgroundMediaId: null,
  backgroundOverlay: 0, backgroundFit: 'cover' as const, backgroundPosition: '50% 50%' });
const block = (id: string, type: string, name: string, content: Record<string, unknown>): PageBlock => ({
  id, type, name, visible: true, content, design: design(),
});

function documentFor(
  id: string,
  name: string,
  themeIndex: number,
  blocks: PageBlock[],
  now = new Date().toISOString(),
): PublicPageDocument {
  return {
    schemaVersion: PUBLIC_PAGE_SCHEMA_VERSION,
    id,
    slug: `page-${id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`.slice(0, 40),
    status: 'draft',
    profile: { displayName: name, description: '', logoMediaId: null, avatarMediaId: null },
    theme: structuredClone(PUBLIC_PAGE_THEMES[themeIndex]),
    sections: blocks.length ? [{ id: `${id}-section-main`, name: 'Main', visible: true, layout: 'single', blocks }] : [],
    seo: { title: name, description: '', imageMediaId: null },
    media: [],
    createdAt: now,
    updatedAt: now,
  };
}

export const PUBLIC_PAGE_TEMPLATES: PublicPageTemplate[] = [
  { id: 'blank', name: 'Blank', createDocument: (id, now) => documentFor(id, 'New page', 0, [], now) },
  { id: 'link-in-bio', name: 'Link in bio', createDocument: (id, now) => documentFor(id, 'My links', 4, [
    block(`${id}-hero`, 'hero', 'Intro', { title: 'Your name', subtitle: 'Everything important in one place', imageUrl: '', imageAlt: '', ctaLabel: '', action: { type: 'url', url: '' } }),
    block(`${id}-links`, 'links', 'Links', { links: [{ id: `${id}-link-1`, label: 'My website', action: { type: 'url', url: 'https://example.com' } }] }),
    block(`${id}-socials`, 'socials', 'Social networks', { title: 'Follow me', links: [] }),
  ], now) },
  { id: 'beauty', name: 'Beauty', createDocument: (id, now) => documentFor(id, 'Beauty studio', 3, [
    block(`${id}-hero`, 'hero', 'Welcome', { title: 'Beauty studio', subtitle: 'Care made for you', imageUrl: '', imageAlt: '', ctaLabel: '' }),
    block(`${id}-services`, 'services', 'Services', { title: 'Services', services: [{ id: `${id}-service-1`, title: 'Signature treatment', description: 'Personalized care', price: '' }] }),
  ], now) },
  { id: 'specialist', name: 'Specialist', createDocument: (id, now) => documentFor(id, 'Specialist', 0, [
    block(`${id}-hero`, 'hero', 'Profile', { title: 'Your name', subtitle: 'Professional specialist', imageUrl: '', imageAlt: '', ctaLabel: 'Book a consultation', action: { type: 'url', url: 'https://example.com' } }),
    block(`${id}-text`, 'text', 'About', { title: 'About me', body: 'Describe your experience, approach, and who you help.' }),
    block(`${id}-services`, 'services', 'Services and prices', { title: 'Services and prices', services: [
      { id: `${id}-service-1`, title: 'Initial consultation', description: 'A focused session to understand your goals.', price: '$50' },
      { id: `${id}-service-2`, title: 'Follow-up session', description: 'Continue the work with a practical next step.', price: '$40' },
    ] }),
    block(`${id}-contacts`, 'contacts', 'Contacts', { title: 'Contact me', contacts: [
      { id: `${id}-phone`, label: 'Phone', url: 'tel:+10000000000' },
      { id: `${id}-email`, label: 'Email', url: 'mailto:hello@example.com' },
    ] }),
    block(`${id}-socials`, 'socials', 'Social networks', { title: 'Follow me', links: [{ id: `${id}-social-1`, label: 'Instagram', url: 'https://instagram.com/' }] }),
    block(`${id}-messengers`, 'messengers', 'Messengers', { title: 'Message me', links: [{ id: `${id}-messenger-1`, label: 'Telegram', url: 'https://t.me/' }] }),
    block(`${id}-faq`, 'faq', 'FAQ', { title: 'Frequently asked questions', items: [{ id: `${id}-faq-1`, title: 'How does it work?', description: 'Choose a service and a convenient time. I will confirm the appointment.' }] }),
  ], now) },
  { id: 'small-business', name: 'Small business', createDocument: (id, now) => documentFor(id, 'Our business', 2, [
    block(`${id}-hero`, 'hero', 'Welcome', { title: 'Our business', subtitle: 'Reliable service near you', imageUrl: '', imageAlt: '', ctaLabel: 'Contact us', action: { type: 'phone', phone: '+10000000000' } }),
    block(`${id}-services`, 'services', 'Services', { title: 'What we offer', services: [{ id: `${id}-service-1`, title: 'Main service', description: 'Describe your main service.', price: '' }] }),
    block(`${id}-contacts`, 'contacts', 'Contacts', { title: 'Contacts', contacts: [{ id: `${id}-contact-1`, label: 'Call us', url: 'tel:+10000000000' }] }),
    block(`${id}-map`, 'map', 'Address', { title: 'Find us', address: 'Your address', label: 'Open map', url: 'https://maps.google.com' }),
  ], now) },
];

export function getPublicPageTemplate(id: string): PublicPageTemplate | undefined {
  return PUBLIC_PAGE_TEMPLATES.find((template) => template.id === id);
}
