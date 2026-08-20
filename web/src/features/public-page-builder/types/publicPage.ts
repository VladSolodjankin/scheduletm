export const PUBLIC_PAGE_SCHEMA_VERSION = 1 as const;

export type PublicPageStatus = 'draft' | 'published' | 'archived';

export type PageProfile = {
  displayName: string;
  description: string;
  logoMediaId: string | null;
  avatarMediaId: string | null;
};

export type ThemeSwatches = readonly [string, string, string, string];

export type ThemeTypographyToken = {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
};

export type PageThemeTokens = {
  colors: {
    contrast: string;
    linkTitle: string;
    linkSubtitle: string;
    linkShadow: string;
    linkBorder: string;
    focus: string;
    checkboxBackground: string;
  };
  typography: {
    fontFamily: string;
    fontWeight: number;
    boldFontWeight: number;
    headingColor: string;
    avatarTitle: ThemeTypographyToken;
    avatarBio: ThemeTypographyToken;
    linkTitle: ThemeTypographyToken;
    linkSubtitle: ThemeTypographyToken;
    h1: ThemeTypographyToken;
    h2: ThemeTypographyToken;
    h3: ThemeTypographyToken;
    textLarge: ThemeTypographyToken;
    textMedium: ThemeTypographyToken;
    textSmall: ThemeTypographyToken;
  };
  layout: {
    blockRadius: number;
    linkRadius: number;
    linkGap: number;
  };
};

export type PageTheme = {
  id: string;
  name: string;
  swatches: ThemeSwatches;
  colors: {
    background: string;
    surface: string;
    text: string;
    primary: string;
  };
  tokens: PageThemeTokens;
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

export type RichTextSize = 'small' | 'medium' | 'large' | 'h1' | 'h2' | 'h3';
export type RichTextAlignment = 'left' | 'center' | 'right' | 'justify';
export type RichTextMarks = {
  bold?: true;
  italic?: true;
  underline?: true;
  strike?: true;
  color?: string;
};
export type RichTextRun = { text: string; marks?: RichTextMarks };
export type RichTextParagraph = {
  size: RichTextSize;
  fontFamily: string | null;
  alignment: RichTextAlignment;
  runs: RichTextRun[];
};
export type RichTextDocument = {
  type: 'rich-text-v1';
  paragraphs: RichTextParagraph[];
};
export type RichTextBlockContent = BlockContent & { document: RichTextDocument };

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
