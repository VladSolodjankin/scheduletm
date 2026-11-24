import { PUBLIC_PAGE_SCHEMA_VERSION, type PageBlock, type PageSection, type PageTheme, type PublicPageDocument, type RichTextParagraph, type SectionDesign } from '../types/publicPage';
import { applyPublicPageThemeColors, PUBLIC_PAGE_THEMES } from '../config/themes';
import type { Locale } from '../../../shared/i18n/dictionaries';

/**
 * Designed starting points. Every look is built from the regular page settings (palette, fonts, section variants,
 * spacing), so the person can change any part of it afterwards in the editor.
 */

type Copy = Record<string, string>;
const SERIF = 'Georgia, "Times New Roman", serif';
const NO_STYLE = { fontFamily: null, fontSize: null, fontWeight: null, fontStyle: null, color: null };

const blockDesign = () => ({ linkStyle: null, animation: 'none' as const, backgroundColor: null, textColor: null, backgroundMediaId: null,
  backgroundOverlay: 0, backgroundFit: 'cover' as const, backgroundPosition: '50% 50%', paddingTop: 0, paddingBottom: 0, borderRadius: null });
const sectionDesign = (variant: SectionDesign['variant']): SectionDesign => ({
  variant, backgroundColor: null, textColor: null, backgroundMediaId: null, backgroundOverlay: 0, backgroundFit: 'cover', backgroundPosition: '50% 50%',
  paddingTop: variant === 'off' ? 0 : 26, paddingBottom: variant === 'off' ? 0 : 26, borderColor: null, borderWidth: 0, borderRadius: null,
  horizontalMargin: false, mobileVisible: true, width: 'full', shadow: false, textStyle: NO_STYLE, headingStyle: NO_STYLE,
  linkStyle: { titleStyle: NO_STYLE, subtitleStyle: NO_STYLE, backgroundColor: null, backgroundOpacity: null, borderWidth: null, borderColor: null, shadow: null, width: null, align: null },
});

const run = (size: RichTextParagraph['size'], alignment: RichTextParagraph['alignment'], text: string, bold = false): RichTextParagraph => ({
  size, fontFamily: null, alignment, runs: [{ text, ...(bold ? { marks: { bold: true } } : {}) }],
});
const richText = (...paragraphs: RichTextParagraph[]) => ({ document: { type: 'rich-text-v1', paragraphs } });
/** A heading followed by bold-lead / description pairs. */
const pairs = (title: string, items: ReadonlyArray<readonly [string, string]>) => richText(
  run('h2', 'left', title), ...items.flatMap(([lead, body]) => [run('medium', 'left', lead, true), run('medium', 'left', body)]),
);

type Builder = { id: string; copy: Copy; block: (key: string, type: string, name: string, content: Record<string, unknown>, size?: 'full' | 'half') => PageBlock };

function builder(id: string, copy: Copy): Builder {
  return {
    id, copy,
    block: (key, type, name, content, size = 'full') => ({
      id: `${id}-${key}`, type, name, visible: true, size, content, design: blockDesign(), schedule: { period: null, weekdays: null },
    }),
  };
}

const section = (id: string, key: string, name: string, variant: SectionDesign['variant'], blocks: PageBlock[]): PageSection => ({
  id: `${id}-section-${key}`, name, visible: true, size: 'full', design: sectionDesign(variant), blocks,
});

const serifHeadings = (theme: PageTheme): PageTheme => ({
  ...theme, id: 'custom', name: 'Custom',
  tokens: { ...theme.tokens, typography: {
    ...theme.tokens.typography,
    h1: { ...theme.tokens.typography.h1, fontFamily: SERIF, fontWeight: 500 }, h2: { ...theme.tokens.typography.h2, fontFamily: SERIF, fontWeight: 500 },
    h3: { ...theme.tokens.typography.h3, fontFamily: SERIF, fontWeight: 500 }, avatarTitle: { ...theme.tokens.typography.avatarTitle, fontFamily: SERIF, fontWeight: 500, fontSize: 42, lineHeight: 1.15 },
    avatarBio: { ...theme.tokens.typography.avatarBio, fontSize: 20, lineHeight: 1.4 },
  }, layout: { ...theme.tokens.layout, linkGap: 16 } },
  styleDefaults: { ...theme.styleDefaults, headingStyle: { ...theme.styleDefaults.headingStyle, fontFamily: SERIF, fontWeight: 500 } },
});

/** Blocks sit 16px apart and the profile name and bio use the large steps of the type scale. */
const spaced = (theme: PageTheme): PageTheme => ({ ...theme, id: 'custom', name: 'Custom', tokens: { ...theme.tokens,
  layout: { ...theme.tokens.layout, linkGap: 16 },
  typography: { ...theme.tokens.typography,
    avatarTitle: { ...theme.tokens.typography.avatarTitle, fontSize: 42, lineHeight: 1.15 },
    avatarBio: { ...theme.tokens.typography.avatarBio, fontSize: 20, lineHeight: 1.4 } } } });

function themeById(themeId: string, tweak: (theme: PageTheme) => PageTheme = (theme) => theme): PageTheme {
  const base = PUBLIC_PAGE_THEMES.find((theme) => theme.id === themeId) ?? PUBLIC_PAGE_THEMES[0];
  return tweak(structuredClone(base));
}

function documentOf(id: string, now: string, locale: Locale, title: string, theme: PageTheme, sections: PageSection[]): PublicPageDocument {
  return {
    schemaVersion: PUBLIC_PAGE_SCHEMA_VERSION, id, slug: `page-${id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`.slice(0, 40),
    status: 'draft', timezone: 'UTC', locale, archivedBlocks: [],
    theme, sections, seo: { title, description: '', imageMediaId: null }, media: [], createdAt: now, updatedAt: now,
  };
}

const avatar = (b: Builder, layout: 'centered' | 'cover-centered', coverColor: string | null) => b.block('avatar', 'avatar', b.copy.heroName, {
  heading: b.copy.heroName, subtitle: b.copy.heroRole, imageMediaId: null, imageAlt: '', layout, avatarSize: 150, coverColor, coverMediaId: null,
});
const social = (b: Builder, platform: 'telegram' | 'instagram' | 'whatsapp', label: string, url: string) =>
  b.block(platform, 'social-button', label, { platform, label, url }, 'half');
const services = (b: Builder, title: string, layout: 'carousel' | 'grid') =>
  b.block('services', 'services', title, { title, serviceIds: [], autoplayIntervalSeconds: null, showBookingButton: true, layout });
const contacts = (b: Builder, title: string) => b.block('contacts', 'contacts', title, { title, contacts: [
  { id: `${b.id}-contact-telegram`, label: 'Telegram', action: { type: 'url', url: 'https://t.me/username' } },
  { id: `${b.id}-contact-instagram`, label: 'Instagram', action: { type: 'url', url: 'https://www.instagram.com/username' } },
  { id: `${b.id}-contact-email`, label: b.copy.email, action: { type: 'email', email: 'hello@example.com' } },
] });
const footer = (b: Builder) => b.block('footer', 'text', b.copy.footer, richText(run('small', 'center', b.copy.footer)));

const therapistCopy: Record<string, Copy> = {
  en: {
    heroName: 'Your name', heroRole: 'Psychologist', lead: 'I help adults deal with anxiety, self-criticism and burnout. Gently, without judgement, at your pace.',
    online: 'Sessions online', aboutTitle: 'About me', about1: 'Describe your education, your approach and the people you work with.',
    about2: 'Say what a session feels like: calm, safe and confidential.', topicsTitle: 'What I work with',
    t1: 'Anxiety and panic', t1b: 'Understand what triggers it and learn to respond.', t2: 'Self-esteem', t2b: 'From self-criticism to a steadier support in yourself.',
    t3: 'Relationships and boundaries', t3b: 'Say what you need and respect what others need.', t4: 'Burnout and fatigue', t4b: 'Restore energy and balance duty with desire.',
    servicesTitle: 'Services and prices', howTitle: 'How it works', h1: 'The first session', h1b: 'We get acquainted, define the request and agree on the format.',
    h2: 'How long is a session?', h2b: 'About an hour, usually once a week.', h3: 'Is it confidential?', h3b: 'Yes. What you share stays between us.',
    credentials: 'Education and certificates', reviews: 'Reviews', contactTitle: 'Book a session', email: 'Email', footer: '© Your name. Psychologist.',
  },
  ru: {
    heroName: 'Ваше имя', heroRole: 'Психолог', lead: 'Помогаю взрослым людям справляться с тревогой, самокритикой и усталостью. Бережно, без оценок, в вашем темпе.',
    online: 'Принимаю онлайн', aboutTitle: 'Обо мне', about1: 'Расскажите об образовании, подходе и о том, с кем вы работаете.',
    about2: 'Опишите, как проходит встреча: спокойно, безопасно и конфиденциально.', topicsTitle: 'С чем я работаю',
    t1: 'Тревога и панические атаки', t1b: 'Разберёмся, что запускает тревогу, и научимся с ней обращаться.', t2: 'Самооценка', t2b: 'От самокритики к более устойчивой опоре на себя.',
    t3: 'Отношения и границы', t3b: 'Говорить о своих потребностях и бережно относиться к чужим.', t4: 'Выгорание и усталость', t4b: 'Возвращаем силы и находим баланс между «надо» и «хочу».',
    servicesTitle: 'Услуги и стоимость', howTitle: 'Как проходит работа', h1: 'Первая встреча', h1b: 'Знакомимся, формулируем запрос и договариваемся о формате.',
    h2: 'Сколько длится консультация?', h2b: 'Около часа, чаще всего раз в неделю.', h3: 'Это конфиденциально?', h3b: 'Да. Всё, что вы рассказываете, остаётся между нами.',
    credentials: 'Образование и сертификаты', reviews: 'Отзывы клиентов', contactTitle: 'Записаться на консультацию', email: 'Почта', footer: '© Ваше имя. Психолог.',
  },
};

function therapist(id: string, now: string, locale: Locale): PublicPageDocument {
  const c = therapistCopy[locale] ?? therapistCopy.en;
  const b = builder(id, c);
  const sections = [
    section(id, 'hero', c.heroName, 'off', [
      avatar(b, 'centered', null),
      b.block('lead', 'text', c.lead, richText(run('large', 'center', c.lead), run('small', 'center', c.online))),
      social(b, 'telegram', 'Telegram', 'https://t.me/username'), social(b, 'instagram', 'Instagram', 'https://www.instagram.com/username'),
    ]),
    section(id, 'about', c.aboutTitle, 'off', [b.block('about', 'text', c.aboutTitle, richText(run('h2', 'left', c.aboutTitle), run('medium', 'left', c.about1), run('medium', 'left', c.about2)))]),
    section(id, 'credentials', c.credentials, 'off', [b.block('credentials', 'credentials', c.credentials, { title: c.credentials, items: [] })]),
    section(id, 'topics', c.topicsTitle, 'off', [b.block('topics', 'text', c.topicsTitle, pairs(c.topicsTitle, [[c.t1, c.t1b], [c.t2, c.t2b], [c.t3, c.t3b], [c.t4, c.t4b]]))]),
    section(id, 'services', c.servicesTitle, 'off', [services(b, c.servicesTitle, 'carousel')]),
    section(id, 'how', c.howTitle, 'off', [b.block('how', 'text', c.howTitle, pairs(c.howTitle, [[c.h1, c.h1b], [c.h2, c.h2b], [c.h3, c.h3b]]))]),
    section(id, 'reviews', c.reviews, 'off', [b.block('reviews', 'reviews', c.reviews, { title: c.reviews, showSummary: true, autoplay: false })]),
    section(id, 'contacts', c.contactTitle, 'off', [contacts(b, c.contactTitle)]),
    section(id, 'footer', c.footer, 'off', [footer(b)]),
  ];
  return documentOf(id, now, locale, c.heroName, themeById('z101', (theme) => serifHeadings(applyPublicPageThemeColors(theme, { background: '#F5F1EA', primary: '#8B4F3A', surface: '#FBF8F3', text: '#2B2622' }))), sections);
}

const wellnessCopy: Record<string, Copy> = {
  en: {
    heroName: 'Studio name', heroRole: 'Massage, yoga and recovery', intro: 'A calm place to slow down. Book a visit in a minute.', book: 'Book a visit',
    whyTitle: 'Why people come back', w1: 'Personal approach', w1b: 'Every visit starts with a conversation about how you feel.',
    w2: 'Calm atmosphere', w2b: 'Quiet rooms, soft light and no rush.', w3: 'Experienced team', w3b: 'Certified specialists who keep learning.',
    servicesTitle: 'Services and prices', faqTitle: 'Questions', q1: 'How do I prepare?', a1: 'Nothing special: come comfortable and a few minutes early.',
    q2: 'Can I cancel?', a2: 'Yes, please let us know a day before.', reviews: 'Reviews', contactTitle: 'Find us', email: 'Email',
    mapTitle: 'Address', mapAddress: 'Your address', mapLabel: 'Open map', footer: '© Studio name',
  },
  ru: {
    heroName: 'Название студии', heroRole: 'Массаж, йога и восстановление', intro: 'Спокойное место, чтобы замедлиться. Запись занимает минуту.', book: 'Записаться',
    whyTitle: 'Почему к нам возвращаются', w1: 'Личный подход', w1b: 'Каждый визит начинается с разговора о том, как вы себя чувствуете.',
    w2: 'Спокойная атмосфера', w2b: 'Тихие кабинеты, мягкий свет и никакой спешки.', w3: 'Опытная команда', w3b: 'Сертифицированные специалисты, которые продолжают учиться.',
    servicesTitle: 'Услуги и стоимость', faqTitle: 'Вопросы', q1: 'Как подготовиться?', a1: 'Ничего особенного: приходите в удобной одежде и чуть раньше.',
    q2: 'Можно ли отменить запись?', a2: 'Да, предупредите нас за день.', reviews: 'Отзывы', contactTitle: 'Как нас найти', email: 'Почта',
    mapTitle: 'Адрес', mapAddress: 'Ваш адрес', mapLabel: 'Открыть карту', footer: '© Название студии',
  },
};

function wellness(id: string, now: string, locale: Locale): PublicPageDocument {
  const c = wellnessCopy[locale] ?? wellnessCopy.en;
  const b = builder(id, c);
  const sections = [
    section(id, 'hero', c.heroName, 'off', [
      avatar(b, 'cover-centered', '#C7D8C0'),
      b.block('intro', 'text', c.intro, richText(run('large', 'center', c.intro))),
      b.block('book', 'button', c.book, { label: c.book, icon: 'link', subtitle: '', openInNewTab: false, action: { type: 'url', url: 'https://example.com' } }),
    ]),
    section(id, 'why', c.whyTitle, 'secondary', [b.block('why', 'text', c.whyTitle, pairs(c.whyTitle, [[c.w1, c.w1b], [c.w2, c.w2b], [c.w3, c.w3b]]))]),
    section(id, 'services', c.servicesTitle, 'off', [services(b, c.servicesTitle, 'grid')]),
    section(id, 'faq', c.faqTitle, 'secondary', [b.block('faq', 'faq', c.faqTitle, { title: c.faqTitle, items: [
      { id: `${id}-faq-1`, title: c.q1, description: c.a1 }, { id: `${id}-faq-2`, title: c.q2, description: c.a2 }] })]),
    section(id, 'reviews', c.reviews, 'off', [b.block('reviews', 'reviews', c.reviews, { title: c.reviews, showSummary: true, autoplay: false })]),
    section(id, 'contacts', c.contactTitle, 'off', [
      contacts(b, c.contactTitle),
      b.block('map', 'map', c.mapTitle, { title: c.mapTitle, address: c.mapAddress, label: c.mapLabel, url: 'https://maps.google.com' }),
    ]),
    section(id, 'footer', c.footer, 'off', [footer(b)]),
  ];
  return documentOf(id, now, locale, c.heroName, themeById('z101', (theme) => spaced(applyPublicPageThemeColors(theme, { background: '#F1F5EF', primary: '#4F6B58', surface: '#FFFFFF', text: '#1F2A24' }))), sections);
}

const studioCopy: Record<string, Copy> = {
  en: {
    heroName: 'Studio name', heroRole: 'Craft, made to order', intro: 'Tell us your idea. We will turn it into something you will be proud of.', book: 'Book a consultation',
    servicesTitle: 'Services and prices', faqTitle: 'How it works', q1: 'How do we start?', a1: 'Book a consultation and describe your idea.',
    q2: 'How long does it take?', a2: 'We agree on the timing together after the consultation.', contactTitle: 'Contact us', email: 'Email', footer: '© Studio name',
  },
  ru: {
    heroName: 'Название студии', heroRole: 'Работа на заказ', intro: 'Расскажите свою идею. Мы превратим её в то, чем вы будете гордиться.', book: 'Записаться на консультацию',
    servicesTitle: 'Услуги и стоимость', faqTitle: 'Как всё устроено', q1: 'С чего начать?', a1: 'Запишитесь на консультацию и опишите идею.',
    q2: 'Сколько это занимает?', a2: 'Сроки обсудим вместе после консультации.', contactTitle: 'Связаться с нами', email: 'Почта', footer: '© Название студии',
  },
};

function studio(id: string, now: string, locale: Locale): PublicPageDocument {
  const c = studioCopy[locale] ?? studioCopy.en;
  const b = builder(id, c);
  const sections = [
    section(id, 'hero', c.heroName, 'off', [
      avatar(b, 'centered', null),
      b.block('intro', 'text', c.intro, richText(run('large', 'center', c.intro))),
      { ...b.block('book', 'button', c.book, { label: c.book, icon: 'link', subtitle: '', openInNewTab: false, action: { type: 'url', url: 'https://example.com' } }), design: { ...blockDesign(), animation: 'lift' as const } },
    ]),
    section(id, 'services', c.servicesTitle, 'primary', [services(b, c.servicesTitle, 'carousel')]),
    section(id, 'faq', c.faqTitle, 'off', [b.block('faq', 'faq', c.faqTitle, { title: c.faqTitle, items: [
      { id: `${id}-faq-1`, title: c.q1, description: c.a1 }, { id: `${id}-faq-2`, title: c.q2, description: c.a2 }] })]),
    section(id, 'contacts', c.contactTitle, 'secondary', [contacts(b, c.contactTitle)]),
    section(id, 'footer', c.footer, 'off', [footer(b)]),
  ];
  return documentOf(id, now, locale, c.heroName, themeById('z112', spaced), sections);
}

export const DESIGNED_TEMPLATES: ReadonlyArray<{
  id: string;
  name: string;
  names: Partial<Record<Locale, string>>;
  createDocument: (pageId: string, now?: string, locale?: Locale) => PublicPageDocument;
}> = [
  { id: 'therapist', name: 'Therapist', names: { en: 'Therapist', ru: 'Психолог' }, createDocument: (id, now = new Date().toISOString(), locale = 'en') => therapist(id, now, locale) },
  { id: 'wellness', name: 'Wellness studio', names: { en: 'Wellness studio', ru: 'Студия и клиника' }, createDocument: (id, now = new Date().toISOString(), locale = 'en') => wellness(id, now, locale) },
  { id: 'studio', name: 'Dark studio', names: { en: 'Dark studio', ru: 'Тёмная студия' }, createDocument: (id, now = new Date().toISOString(), locale = 'en') => studio(id, now, locale) },
];
