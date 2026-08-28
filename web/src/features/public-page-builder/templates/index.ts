import { PUBLIC_PAGE_SCHEMA_VERSION, type PageBlock, type PublicPageDocument, type SectionDesign } from '../types/publicPage';
import { PUBLIC_PAGE_THEMES } from '../config/themes';

export type PublicPageTemplate = {
  id: string;
  name: string;
  createDocument: (pageId: string, now?: string) => PublicPageDocument;
};

const design = () => ({ backgroundColor: null, textColor: null, backgroundMediaId: null,
  backgroundOverlay: 0, backgroundFit: 'cover' as const, backgroundPosition: '50% 50%', paddingTop: 0, paddingBottom: 0, borderRadius: null });
const block = (id: string, type: string, name: string, content: Record<string, unknown>): PageBlock => ({
  id, type, name, visible: true, content, design: design(),
});
const sectionDesign = (): SectionDesign => ({ variant: 'custom', backgroundColor: null, textColor: null, paddingTop: 24, paddingBottom: 24,
  backgroundMediaId: null, backgroundOverlay: 0, backgroundFit: 'cover', backgroundPosition: '50% 50%',
  horizontalMargin: false, borderRadius: null, borderWidth: 0, borderColor: null, shadow: false, width: 'full', mobileVisible: true,
  headingStyle: { fontFamily: null, fontSize: null, fontWeight: null, fontStyle: null, color: null },
  textStyle: { fontFamily: null, fontSize: null, fontWeight: null, fontStyle: null, color: null },
  linkStyle: { titleStyle: { fontFamily: null, fontSize: null, fontWeight: null, fontStyle: null, color: null },
    subtitleStyle: { fontFamily: null, fontSize: null, fontWeight: null, fontStyle: null, color: null },
    backgroundColor: null, backgroundOpacity: null, borderWidth: null, borderColor: null, shadow: null } });

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
    profile: { displayName: blocks.length ? '' : name, description: '', logoMediaId: null, avatarMediaId: null },
    theme: structuredClone(PUBLIC_PAGE_THEMES[themeIndex]),
    sections: blocks.map((pageBlock, index) => ({
      id: `${id}-section-${index + 1}`,
      name: pageBlock.name,
      visible: true,
      layout: 'single',
      design: sectionDesign(),
      blocks: [pageBlock],
    })),
    seo: { title: name, description: '', imageMediaId: null },
    media: [],
    createdAt: now,
    updatedAt: now,
  };
}

export const PUBLIC_PAGE_TEMPLATES: PublicPageTemplate[] = [
  { id: 'blank', name: 'Blank', createDocument: (id, now) => documentFor(id, 'New page', 0, [], now) },
  { id: 'link-in-bio', name: 'Link in bio', createDocument: (id, now) => documentFor(id, 'My links', 4, [
    block(`${id}-avatar`, 'avatar', 'Intro', { heading: 'Your name', subtitle: 'Everything important in one place', imageMediaId: null, imageAlt: '', layout: 'centered', avatarSize: 150, coverColor: null, coverMediaId: null }),
    block(`${id}-links`, 'links', 'Links', { links: [{ id: `${id}-link-1`, label: 'My website', action: { type: 'url', url: 'https://example.com' } }] }),
  ], now) },
  { id: 'beauty', name: 'Beauty', createDocument: (id, now) => documentFor(id, 'Beauty studio', 3, [
    block(`${id}-avatar`, 'avatar', 'Welcome', { heading: 'Beauty studio', subtitle: 'Care made for you', imageMediaId: null, imageAlt: '', layout: 'centered', avatarSize: 150, coverColor: null, coverMediaId: null }),
    block(`${id}-services`, 'services', 'Services', { title: 'Services', serviceIds: [], autoplayIntervalSeconds: null, showBookingButton: true }),
  ], now) },
  { id: 'specialist', name: 'Specialist', createDocument: (id, now) => documentFor(id, 'Specialist', 0, [
    block(`${id}-avatar`, 'avatar', 'Profile', { heading: 'Your name', subtitle: 'Professional specialist', imageMediaId: null, imageAlt: '', layout: 'centered', avatarSize: 150, coverColor: null, coverMediaId: null }),
    block(`${id}-button`, 'button', 'Book a consultation', { label: 'Book a consultation', icon: 'link', color: '', textColor: '', radius: 12, action: { type: 'url', url: 'https://example.com' } }),
    block(`${id}-text`, 'text', 'About', { document: { type: 'rich-text-v1', paragraphs: [
      { size: 'large', fontFamily: null, alignment: 'left', runs: [{ text: 'About me', marks: { bold: true } }] },
      { size: 'medium', fontFamily: null, alignment: 'left', runs: [{ text: 'Describe your experience, approach, and who you help.' }] },
    ] } }),
    block(`${id}-services`, 'services', 'Services and prices', { title: 'Services and prices', serviceIds: [], autoplayIntervalSeconds: null, showBookingButton: true }),
    block(`${id}-contacts`, 'contacts', 'Contacts', { title: 'Contact me', contacts: [
      { id: `${id}-phone`, label: 'Phone', action: { type: 'phone', phone: '+10000000000' } },
      { id: `${id}-email`, label: 'Email', action: { type: 'email', email: 'hello@example.com' } },
    ] }),
    block(`${id}-instagram`, 'social-button', 'Instagram', { platform: 'instagram', label: 'Instagram', url: 'https://instagram.com/' }),
    block(`${id}-telegram`, 'social-button', 'Telegram', { platform: 'telegram', label: 'Telegram', url: 'https://t.me/' }),
    block(`${id}-faq`, 'faq', 'FAQ', { title: 'Frequently asked questions', items: [{ id: `${id}-faq-1`, title: 'How does it work?', description: 'Choose a service and a convenient time. I will confirm the appointment.' }] }),
  ], now) },
  { id: 'small-business', name: 'Small business', createDocument: (id, now) => documentFor(id, 'Our business', 2, [
    block(`${id}-avatar`, 'avatar', 'Welcome', { heading: 'Our business', subtitle: 'Reliable service near you', imageMediaId: null, imageAlt: '', layout: 'centered', avatarSize: 150, coverColor: null, coverMediaId: null }),
    block(`${id}-button`, 'button', 'Contact us', { label: 'Contact us', icon: 'phone', color: '', textColor: '', radius: 12, action: { type: 'phone', phone: '+10000000000' } }),
    block(`${id}-services`, 'services', 'Services', { title: 'What we offer', serviceIds: [], autoplayIntervalSeconds: null, showBookingButton: true }),
    block(`${id}-contacts`, 'contacts', 'Contacts', { title: 'Contacts', contacts: [{ id: `${id}-contact-1`, label: 'Call us', action: { type: 'phone', phone: '+10000000000' } }] }),
    block(`${id}-map`, 'map', 'Address', { title: 'Find us', address: 'Your address', label: 'Open map', url: 'https://maps.google.com' }),
  ], now) },
];

export function getPublicPageTemplate(id: string): PublicPageTemplate | undefined {
  return PUBLIC_PAGE_TEMPLATES.find((template) => template.id === id);
}
