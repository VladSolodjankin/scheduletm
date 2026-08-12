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
  fontFamily: string;
  roundingStyle: 'rounded' | 'pill' | 'leaf' | 'square';
  linkStylePreset: 'primary-fill' | 'primary-shadow' | 'primary-strong' | 'primary-outline' | 'surface-fill' | 'surface-outline' | 'surface-shadow' | 'surface-strong';
  backgroundMediaId: string | null;
  backgroundPreset: string | null;
  backgroundFit: 'cover' | 'contain';
  backgroundPosition: string;
  styleDefaults: ThemeStyleDefaults;
};

export type TypographyStyle = {
  fontFamily: string | null;
  fontSize: number | null;
  fontWeight: number | null;
  fontStyle: 'normal' | 'italic' | null;
  color: string | null;
};

export type LinkStyle = {
  titleStyle: TypographyStyle;
  subtitleStyle: TypographyStyle;
  backgroundColor: string | null;
  backgroundOpacity: number | null;
  borderWidth: number | null;
  borderColor: string | null;
  shadow: boolean | null;
};

export type ResolvedTypographyStyle = {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  color: string;
};

export type ThemeStyleDefaults = {
  sectionBorderRadius: number;
  blockBorderRadius: number;
  headingStyle: ResolvedTypographyStyle;
  textStyle: ResolvedTypographyStyle;
  linkStyle: {
    titleStyle: ResolvedTypographyStyle;
    subtitleStyle: ResolvedTypographyStyle;
    backgroundColor: string;
    backgroundOpacity: number;
    borderWidth: number;
    borderColor: string;
    shadow: boolean;
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
  | 'avatar'
  | 'button'
  | 'links'
  | 'text'
  | 'image'
  | 'gallery'
  | 'services'
  | 'contacts'
  | 'social-button'
  | 'map'
  | 'divider'
  | 'faq';

export type BlockType = KnownBlockType | (string & {});

export type BlockDesign = {
  backgroundColor: string | null;
  textColor: string | null;
  backgroundMediaId: string | null;
  backgroundOverlay: number;
  backgroundFit: 'cover' | 'contain';
  backgroundPosition: string;
  paddingTop: number;
  paddingBottom: number;
  borderRadius: number | null;
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
  design: SectionDesign;
  blocks: PageBlock[];
};

export type SectionDesign = {
  variant: 'off' | 'custom' | 'primary' | 'secondary';
  backgroundColor: string | null;
  textColor: string | null;
  backgroundMediaId: string | null;
  backgroundOverlay: number;
  backgroundFit: 'cover' | 'contain';
  backgroundPosition: string;
  paddingTop: number;
  paddingBottom: number;
  horizontalMargin: boolean;
  borderRadius: number | null;
  borderWidth: number;
  borderColor: string | null;
  shadow: boolean;
  width: 'full' | 'contained';
  mobileVisible: boolean;
  headingStyle: TypographyStyle;
  textStyle: TypographyStyle;
  linkStyle: LinkStyle;
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
