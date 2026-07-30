export const PUBLIC_PAGE_SCHEMA_VERSION = 1 as const;

export type PublicPageStatus = 'draft' | 'published' | 'archived';

export type PageProfile = {
  displayName: string;
  description: string;
  logoMediaId: string | null;
  avatarMediaId: string | null;
};

export type PageTheme = {
  id: string;
  name: string;
  colors: {
    background: string;
    surface: string;
    text: string;
    primary: string;
  };
};

export type PageSeo = {
  title: string;
  description: string;
  imageMediaId: string | null;
};

export type MediaReference = {
  id: string;
  url: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  alt: string;
  width: number;
  height: number;
};

export type CtaAction =
  | { type: 'url'; url: string }
  | { type: 'phone'; phone: string }
  | { type: 'email'; email: string }
  | { type: 'messenger'; url: string };

export type SectionLayout =
  | 'single'
  | 'two-equal'
  | 'one-third-two-thirds'
  | 'two-thirds-one-third'
  | 'three-equal'
  | 'stack'
  | 'hero-overlay';

export type KnownBlockType =
  | 'hero'
  | 'links'
  | 'text'
  | 'image'
  | 'gallery'
  | 'services'
  | 'contacts'
  | 'socials'
  | 'messengers'
  | 'map'
  | 'divider'
  | 'faq';

export type BlockType = KnownBlockType | (string & {});

export type BlockDesign = {
  backgroundColor: string | null;
  textColor: string | null;
};

export type BlockContent = Record<string, unknown>;

export type PageBlock<TContent extends BlockContent = BlockContent> = {
  id: string;
  type: BlockType;
  name: string;
  visible: boolean;
  content: TContent;
  design: BlockDesign;
};

export type PageSection = {
  id: string;
  name: string;
  visible: boolean;
  layout: SectionLayout;
  blocks: PageBlock[];
};

export type PublicPageDocument = {
  schemaVersion: typeof PUBLIC_PAGE_SCHEMA_VERSION;
  id: string;
  slug: string;
  status: PublicPageStatus;
  profile: PageProfile;
  theme: PageTheme;
  sections: PageSection[];
  seo: PageSeo;
  media: MediaReference[];
  createdAt: string;
  updatedAt: string;
};
