import { parsePublicPageVideoUrl, publicPageVideoEmbedUrl } from '@meetli/shared/public-page';
import {
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  Divider,
  IconButton,
  MenuItem,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Add from '@mui/icons-material/Add';
import ChatBubbleOutlined from '@mui/icons-material/ChatBubbleOutlined';
import Delete from '@mui/icons-material/Delete';
import EmailOutlined from '@mui/icons-material/EmailOutlined';
import Facebook from '@mui/icons-material/Facebook';
import Instagram from '@mui/icons-material/Instagram';
import LinkIcon from '@mui/icons-material/Link';
import Pause from '@mui/icons-material/Pause';
import PlaceOutlined from '@mui/icons-material/PlaceOutlined';
import { PublicAvatarImage } from './PublicAvatarImage';
import { applyAvatarFraming, AVATAR_ZOOM_MAX, AVATAR_ZOOM_MIN, resolveAvatarFraming, type AvatarFraming } from './avatarFraming';
import { AVATAR_DRAG_SX, useAvatarFramingDrag } from './useAvatarFramingDrag';
import PhoneOutlined from '@mui/icons-material/PhoneOutlined';
import PlayArrow from '@mui/icons-material/PlayArrow';
import Telegram from '@mui/icons-material/Telegram';
import WhatsApp from '@mui/icons-material/WhatsApp';
import { SvgIcon, type SvgIconProps } from '@mui/material';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import type {
  BlockContent,
  CtaAction,
  PageBlock,
  PageSection,
  PageTheme,
  RichTextDocument,
  RichTextMarks,
  RichTextSize,
} from '../../features/public-page-builder/types/publicPage';
import { normalizeRichTextDocument } from '../../features/public-page-builder/model/normalizeRichText';
import {
  contactHref,
  ctaActionToHref,
} from '../../features/public-page-builder/model/cta';
import { useI18n } from '../../shared/i18n/I18nContext';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '../../features/public-page-builder/model/socialPlatforms';
import {
  AVATAR_LAYOUTS,
  AVATAR_SIZES,
  AVATAR_COVER_REFERENCE,
  AVATAR_HERO_REFERENCE,
  AVATAR_PREVIEW_REFERENCE,
  normalizeAvatarLayout,
  normalizeAvatarSize,
  resolveAvatarCoverCenteredGeometry,
  resolveAvatarCoverLeftGeometry,
  resolveAvatarPresentation,
  resolveAvatarSizeChange,
  type AvatarLayout,
} from './avatarPresentation';
import { resolvePublicPageThemeVariables } from './publicPageThemeVariables';
import { PublicBookingDialog } from './PublicBookingDialog';
import type { PublicBookingService } from '../../shared/types/api';
import { translate } from '../../shared/i18n/translate';
import type { PublicPageBuilderKey } from '../../shared/i18n/dictionaries';
import { formatMoney } from '../../shared/utils/money';

export { normalizeAvatarLayout, normalizeAvatarSize, resolveAvatarPresentation } from './avatarPresentation';

export type Item = Record<string, unknown>;

export const text = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;
export const items = (value: unknown): Item[] =>
  Array.isArray(value) ? value.filter((item): item is Item => Boolean(item) && typeof item === 'object') : [];
export const required = (content: BlockContent, ...keys: string[]): string[] =>
  keys.filter((key) => !text(content[key]).trim()).map((key) => `${key} is required`);
const hasValue = (value: unknown): boolean =>
  typeof value === 'string' ? Boolean(value.trim()) : value !== null && value !== undefined;
export const wrappingTextSx = { maxWidth: '100%', minWidth: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } as const;
export const validItems = (content: BlockContent, key: string, fields: string[]): string[] =>
  items(content[key]).flatMap((item, index) =>
    fields.filter((field) => !hasValue(item[field])).map((field) => `${key}.${index}.${field} is required`),
  );

/** Rejects single-label hosts (e.g. punycode from typed placeholder text like "https://тест"). */
function hasPlausibleHostname(hostname: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes('.');
}

export function normalizeSafeHref(value: unknown): string | null {
  const href = text(value).trim();
  if (!href) {
    return null;
  }
  if (/^https?:\/\//i.test(href)) {
    try {
      const url = new URL(href);
      return (url.protocol === 'http:' || url.protocol === 'https:') && hasPlausibleHostname(url.hostname)
        ? url.toString()
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** A block title belongs to the content under it: it sits one scale step closer than the gap between items. */
export const bindTitleSx = { '& > h2:first-of-type': { mb: 'calc(var(--page-space-1) - var(--app-space-m))' } } as const;

export function Surface({ children }: { block: PageBlock; children: ReactNode }) {
  return (
    <Box
      sx={{
        minWidth: 0,
      }}
    >
      {children}
    </Box>
  );
}

function hrefFor(action: unknown): string | null {
  if (!action || typeof action !== 'object') {
    return null;
  }
  const cta = action as Partial<CtaAction>;
  if ((cta.type === 'url' && typeof cta.url === 'string')
    || (cta.type === 'messenger' && typeof cta.url === 'string')
    || (cta.type === 'phone' && typeof cta.phone === 'string')
    || (cta.type === 'email' && typeof cta.email === 'string')) {
    return ctaActionToHref(cta as CtaAction);
  }
  return null;
}

export const ordinaryPublicPageLinkSx = {
  fontFamily: 'var(--theme-link-title-font-family)', fontSize: 'var(--theme-link-title-fontsize)',
  fontWeight: 'var(--theme-link-title-font-weight)', fontStyle: 'var(--theme-link-title-font-style)',
  color: 'var(--theme-link-title-color)',
  backgroundColor: 'color-mix(in srgb, var(--theme-link-background) var(--theme-link-background-opacity), transparent)',
  justifyContent: 'var(--theme-link-justify)', textAlign: 'var(--theme-link-text-align)',
  lineHeight: 'var(--theme-link-title-lineheight)', letterSpacing: 'var(--theme-link-title-letterspacing)',
  borderWidth: 'var(--theme-link-border-width)', borderStyle: 'solid', borderColor: 'var(--theme-link-border-color)',
  boxShadow: 'var(--theme-link-shadow-params)', borderRadius: 'var(--theme-link-border-radius)',
  '& .MuiTypography-root, & small': {
    fontFamily: 'var(--theme-link-subtitle-font-family)', fontSize: 'var(--theme-link-subtitle-fontsize)',
    fontWeight: 'var(--theme-link-subtitle-font-weight)', fontStyle: 'var(--theme-link-subtitle-font-style)',
    lineHeight: 'var(--theme-link-subtitle-lineheight)', letterSpacing: 'var(--theme-link-subtitle-letterspacing)',
    color: 'var(--theme-link-subtitle-color)',
  },
} as const;

/** Button size and placement: the page, section or block decides how wide link buttons are and where they sit. */
export const linkLayoutSx = {
  display: 'flex', width: 'var(--theme-link-width)', maxWidth: '100%',
  ml: 'var(--theme-link-margin-left)', mr: 'var(--theme-link-margin-right)',
} as const;

export function CtaButton({ label, action }: { label: string; action: unknown }) {
  const href = hrefFor(action);
  if (!href) {
    return null;
  }
  const external = /^https?:\/\//i.test(href);
  return (
    <Button
      component="a"
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      variant="contained"
      sx={{ ...ordinaryPublicPageLinkSx, ...linkLayoutSx, minHeight: 'var(--app-control-l)', textTransform: 'none' }}
    >
      {label}
    </Button>
  );
}

/** Brand identities, tuned so the white label keeps at least 4.5:1 contrast on every colour of the button. */
export const socialPlatformStyles: Record<SocialPlatform, { background: string; color: string; iconColor: string }> = {
  'facebook-messenger': { background: 'linear-gradient(135deg, #0A66D6, #8F2BF0, #C8286B)', color: '#fff', iconColor: '#fff' },
  vk: { background: '#0A64D6', color: '#fff', iconColor: '#fff' }, whatsapp: { background: '#25D366', color: '#071B0D', iconColor: '#071B0D' },
  viber: { background: '#6A56E6', color: '#fff', iconColor: '#fff' }, telegram: { background: '#1778AD', color: '#fff', iconColor: '#fff' },
  facebook: { background: '#166FE5', color: '#fff', iconColor: '#fff' }, threads: { background: '#000', color: '#fff', iconColor: '#fff' },
  instagram: { background: 'linear-gradient(135deg, #833AB4, #C13584, #E0245E)', color: '#fff', iconColor: '#fff' },
  tiktok: { background: '#000', color: '#fff', iconColor: '#fff' },
};

function TikTokIcon(props: SvgIconProps) {
  return <SvgIcon {...props}><path d="M19.6 7.1a6.8 6.8 0 0 1-4-1.3v8.1a6.4 6.4 0 1 1-5.5-6.3v3.3a3.2 3.2 0 1 0 2.3 3V2h3.2a3.7 3.7 0 0 0 4 3.7v1.4Z" /></SvgIcon>;
}

function MessengerIcon(props: SvgIconProps) { return <SvgIcon {...props}><path d="M12 2C6.48 2 2 6.15 2 11.27c0 2.91 1.45 5.5 3.72 7.2V22l3.4-1.87c.91.25 1.88.39 2.88.39 5.52 0 10-4.15 10-9.25S17.52 2 12 2Zm1 12.48-2.55-2.72-4.98 2.72 5.48-5.82 2.61 2.72 4.93-2.72L13 14.48Z" /></SvgIcon>; }
function VkIcon(props: SvgIconProps) { return <SvgIcon {...props}><path d="M3.4 6.5h3.3c.2 0 .4.2.5.5.7 2.1 1.8 3.9 2.7 4.1.4.1.5-.3.5-.8V7c0-.4-.2-.7-.6-.8V5.8h5.1c.4 0 .6.2.6.6v4.1c0 .4.2.7.5.6.9-.2 2-2 2.7-4.1.1-.3.3-.5.7-.5h3.2c.5 0 .7.3.5.8-.5 1.5-1.7 3.6-3.1 5.1-.3.3-.3.6 0 .9 1.4 1.3 2.7 2.8 3.3 4.1.2.5 0 .8-.5.8h-3.6c-.4 0-.6-.1-.9-.5-.8-1.1-1.7-2.1-2.3-2.1-.4 0-.5.3-.5.8v1.2c0 .4-.2.6-.6.6h-1.7C8.2 18.2 4.5 14.9 2.8 7.3c-.1-.5.1-.8.6-.8Z" /></SvgIcon>; }
function ViberIcon(props: SvgIconProps) { return <SvgIcon {...props}><path d="M12 3C6.6 3 3.5 5.7 3.5 10.6c0 2.8 1.2 4.9 3.4 6.2v3.1l3-2.2c.7.1 1.4.2 2.1.2 5.4 0 8.5-2.7 8.5-7.3S17.4 3 12 3Zm4.2 11.2-.9.9c-.5.5-1.7.1-3.1-.8-1.5-.9-2.8-2.2-3.7-3.7-.8-1.4-1.2-2.6-.7-3.1l.9-.9c.3-.3.8-.2 1 .2l1 1.8c.2.3.1.7-.2.9l-.5.4c.6 1.2 1.7 2.3 2.9 2.9l.4-.5c.2-.3.6-.4.9-.2l1.8 1c.4.3.5.8.2 1.1Zm.8-3h-1.2c0-2.1-1.1-3.2-3.2-3.2V6.8c2.8 0 4.4 1.6 4.4 4.4Z" /></SvgIcon>; }
function ThreadsIcon(props: SvgIconProps) { return <SvgIcon {...props}><path d="M12.2 2C6.4 2 3 5.6 3 11.9 3 18.1 6.5 22 12.3 22c5.1 0 8.4-2.7 8.4-7 0-3-1.6-5-4.3-5.8-.4-3-2.2-4.7-5.1-4.7-2.3 0-4.1 1-5.1 2.9l1.8.9c.7-1.3 1.7-1.9 3.3-1.9 1.7 0 2.7.8 3 2.4-.7-.1-1.4-.1-2.1-.1-3.5 0-5.7 1.8-5.7 4.6 0 2.4 1.9 4.1 4.6 4.1 3.1 0 5-1.8 5.3-5.2 1.4.6 2.1 1.6 2.1 3 0 3.1-2.3 4.9-6.3 4.9-4.6 0-7.1-3-7.1-8.1 0-5.2 2.5-8 7.1-8 3.8 0 6.2 2 6.8 5.6l2-.4C20.2 4.6 17 2 12.2 2Zm-1 13.4c-1.5 0-2.5-.8-2.5-2.1 0-1.6 1.3-2.6 3.6-2.6.7 0 1.4.1 2.1.2-.1 2.9-1.2 4.5-3.2 4.5Z" /></SvgIcon>; }

export function SocialPlatformIcon({ platform, ...props }: { platform: SocialPlatform } & SvgIconProps) {
  const Icon = { 'facebook-messenger': MessengerIcon, vk: VkIcon, whatsapp: WhatsApp, viber: ViberIcon,
    telegram: Telegram, facebook: Facebook, threads: ThreadsIcon, instagram: Instagram, tiktok: TikTokIcon }[platform];
  return <Icon {...props} />;
}

const fieldKeys: Record<string, PublicPageBuilderKey> = {
  title: 'fieldTitle', heading: 'fieldHeadline', subtitle: 'fieldSubtitle', body: 'fieldBody', description: 'fieldDescription',
  label: 'fieldLabel', url: 'fieldUrl', alt: 'imageAlt', imageAlt: 'imageAlt',
  address: 'fieldAddress', price: 'fieldPrice', platform: 'fieldPlatform', days: 'fieldDays', hours: 'fieldHours',
};

function Field({ field, value, onChange }: { field: string; value: unknown; onChange: (value: string) => void }) {
  const { locale } = useI18n();
  return <TextField size="small" fullWidth label={translate(locale, `publicPageBuilder.${fieldKeys[field] ?? 'fieldValue'}`)}
    value={text(value)} multiline={field === 'body' || field === 'description'}
    minRows={field === 'body' || field === 'description' ? 3 : undefined}
    onChange={(event) => onChange(event.target.value)} />;
}

function ActionEditor({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const { locale } = useI18n();
  const type = typeof value.type === 'string' ? value.type : 'url';
  const field = type === 'phone' ? 'phone' : type === 'email' ? 'email' : 'url';
  return (
    <Stack direction="row" spacing={1}>
      <TextField select size="small" label={translate(locale, 'publicPageBuilder.fieldAction')} value={type}
        onChange={(event) => onChange({ type: event.target.value, [event.target.value === 'phone' ? 'phone' : event.target.value === 'email' ? 'email' : 'url']: '' })}>
        {['url', 'phone', 'email', 'messenger'].map((option) => <MenuItem key={option} value={option}>{translate(locale, `publicPageBuilder.${`action${option[0].toUpperCase()}${option.slice(1)}` as PublicPageBuilderKey}`)}</MenuItem>)}
      </TextField>
      <TextField size="small" fullWidth label={translate(locale, `publicPageBuilder.${field === 'phone' ? 'fieldPhone' : field === 'email' ? 'fieldEmail' : 'fieldUrl'}`)} value={text(value[field])}
        onChange={(event) => onChange({ ...value, [field]: event.target.value })} />
    </Stack>
  );
}

const editorShape: Record<string, { fields?: string[]; list?: { key: string; fields: string[] } }> = {
  avatar: {},
  button: { fields: ['label', 'subtitle'] },
  links: { list: { key: 'links', fields: ['label'] } },
  text: {},
  image: {},
  services: { fields: ['title'] },
  credentials: { fields: ['title'] },
  reviews: { fields: ['title'] },
  contacts: { fields: ['title'], list: { key: 'contacts', fields: ['label'] } },
  'social-button': { fields: ['label', 'url'] },
  map: { fields: ['title', 'address', 'label', 'url'] },
  faq: { fields: ['title'], list: { key: 'items', fields: ['title', 'description'] } }, divider: {},
  'price-list': { fields: ['title'], list: { key: 'items', fields: ['title', 'description', 'price'] } },
  steps: { fields: ['title'], list: { key: 'items', fields: ['title', 'description'] } },
  stats: { fields: ['title'], list: { key: 'items', fields: ['value', 'description'] } },
  hours: { fields: ['title'], list: { key: 'items', fields: ['days', 'hours'] } },
  video: { fields: ['title', 'url'] },
};

export const avatarLayouts = AVATAR_LAYOUTS;
const avatarSizes = AVATAR_SIZES;
export const AVATAR_EDITOR_PLACEHOLDER_URL = '/public-page-placeholders/avatar-default.svg';

function selectAvatarLayoutWithKeyboard(
  event: KeyboardEvent<HTMLElement>,
  layout: typeof avatarLayouts[number],
  select: (layout: typeof avatarLayouts[number]) => void,
) {
  const currentIndex = avatarLayouts.indexOf(layout);
  const nextIndex = event.key === 'Home' ? 0
    : event.key === 'End' ? avatarLayouts.length - 1
      : event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (currentIndex + 1) % avatarLayouts.length
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (currentIndex - 1 + avatarLayouts.length) % avatarLayouts.length
          : null;
  if (nextIndex === null) {return;}
  event.preventDefault();
  select(avatarLayouts[nextIndex]);
  const radios = event.currentTarget.closest('[role="radiogroup"]')?.querySelectorAll<HTMLElement>('[role="radio"]');
  radios?.[nextIndex]?.focus();
}

function selectAvatarSizeWithKeyboard(
  event: KeyboardEvent<HTMLElement>,
  size: typeof avatarSizes[number],
  select: (size: typeof avatarSizes[number]) => void,
) {
  const currentIndex = avatarSizes.indexOf(size);
  const nextIndex = event.key === 'Home' ? 0
    : event.key === 'End' ? avatarSizes.length - 1
      : event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (currentIndex + 1) % avatarSizes.length
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (currentIndex - 1 + avatarSizes.length) % avatarSizes.length
          : null;
  if (nextIndex === null) {return;}
  event.preventDefault();
  select(avatarSizes[nextIndex]);
  const radios = event.currentTarget.closest('[role="radiogroup"]')?.querySelectorAll<HTMLElement>('[role="radio"]');
  radios?.[nextIndex]?.focus();
}

const avatarSizeLabel = (size: number) => `${size}\u00d7${size} px`;

function AvatarLayoutPreview({ layout }: { layout: AvatarLayout }) {
  const avatar = <Box component="img" src={AVATAR_EDITOR_PLACEHOLDER_URL} alt="" sx={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flex: '0 0 auto', border: '2px solid', borderColor: 'background.paper' }} />;
  const copy = <Stack spacing={0.4} sx={{ alignItems: layout === 'cover-left' ? 'flex-start' : 'center', flex: 1 }}>
    <Box sx={{ height: 4, width: layout === 'cover-left' ? '70%' : '48%', borderRadius: 1, bgcolor: 'text.secondary' }} />
    <Box sx={{ height: 3, width: layout === 'cover-left' ? '88%' : '64%', borderRadius: 1, bgcolor: 'text.disabled' }} />
  </Stack>;
  if (layout === 'centered') {return <Stack spacing={0.5} sx={{ alignItems: 'center', width: '100%' }}>{avatar}{copy}</Stack>;}
  if (layout === 'image-cover') {return <Box sx={{ width: '100%', height: 48, borderRadius: 1, bgcolor: 'action.hover', overflow: 'hidden' }}>
    <Box component="img" src={AVATAR_EDITOR_PLACEHOLDER_URL} alt="" sx={{ display: 'block', width: '100%', height: 31, objectFit: 'cover' }} />
    <Box sx={{ height: 17, px: 0.75, display: 'flex', alignItems: 'center' }}>{copy}</Box>
  </Box>;}
  return <Box sx={{ position: 'relative', width: '100%', height: 48, pt: 2.5, boxSizing: 'border-box' }}>
    <Box sx={{ position: 'absolute', inset: '0 0 auto', height: 22, borderRadius: 0.75, bgcolor: 'action.hover' }} />
    <Box sx={{ position: 'absolute', top: 10, left: layout === 'cover-left' ? 5 : '50%', transform: layout === 'cover-left' ? undefined : 'translateX(-50%)' }}>
      {avatar}
    </Box>
    <Box sx={{ position: 'absolute', top: 36, left: layout === 'cover-left' ? 34 : 6, right: 6 }}>{copy}</Box>
  </Box>;
}

function avatarLayoutLabelKey(layout: AvatarLayout): PublicPageBuilderKey {
  const keys = { centered: 'avatarLayoutCentered', 'cover-centered': 'avatarLayoutCoverCentered',
    'cover-left': 'avatarLayoutCoverLeft', 'image-cover': 'avatarLayoutImageCover' } as const;
  return keys[layout];
}

export function SpecializedBlockEditor({
  block,
  onContentChange,
  mediaUrlFor,
  avatarMediaControl,
  avatarCoverControl,
  pageTheme,
  pageSection,
}: {
  block: PageBlock;
  onContentChange?: (content: BlockContent) => void;
  mediaUrlFor?: (mediaId: string) => string | undefined;
  avatarMediaControl?: ReactNode;
  avatarCoverControl?: ReactNode;
  pageTheme?: PageTheme;
  pageSection?: PageSection;
}) {
  const { locale } = useI18n();
  const update = onContentChange ?? (() => undefined);
  const shape = editorShape[block.type] ?? {};
  const list = shape.list;
  const rows = list ? items(block.content[list.key]) : [];
  const hasAvatarPhoto = block.type === 'avatar' && Boolean(text(block.content.imageMediaId));
  const avatarFraming = resolveAvatarFraming(block.content);
  const avatarFramingChanged = avatarFraming.focusX !== 50 || avatarFraming.focusY !== 50 || avatarFraming.zoom !== 1;
  const addRow = (preset?: SocialPlatform) => {
    const fields = list?.fields ?? [];
    const row = Object.fromEntries(fields.map((field) => [field, '']));
    update({ ...block.content, [list!.key]: [...rows, {
      id: crypto.randomUUID(), ...row,
      ...(list!.key === 'links' && block.type === 'links' ? { action: { type: 'url', url: '' } } : {}),
      ...(list!.key === 'contacts' && block.type === 'contacts' ? { action: { type: 'url', url: '' } } : {}),
      ...(preset ? { platform: preset, label: translate(locale, `publicPageBuilder.${`platform${preset[0].toUpperCase()}${preset.slice(1)}` as PublicPageBuilderKey}`), url: 'https://' } : {}),
    }] });
  };
  return (
    <Stack spacing={1.5}>
      {shape.fields?.map((field) => <Field key={field} field={field} value={block.content[field]}
        onChange={(value) => update({ ...block.content, [field]: value })} />)}
      {block.type === 'button' && block.content.action && typeof block.content.action === 'object' && !Array.isArray(block.content.action)
        ? <><ActionEditor value={block.content.action as Record<string, unknown>} onChange={(action) => update({ ...block.content, action })} />
          <TextField select size="small" label={translate(locale, 'publicPageBuilder.buttonIcon')} value={text(block.content.icon)} onChange={(event) => update({ ...block.content, icon: event.target.value })}>
            <MenuItem value="">{translate(locale, 'publicPageBuilder.none')}</MenuItem>{(['link', 'phone', 'email', 'message'] as const).map((icon) => <MenuItem key={icon} value={icon}>{translate(locale, `publicPageBuilder.${`buttonIcon${icon[0].toUpperCase()}${icon.slice(1)}` as PublicPageBuilderKey}`)}</MenuItem>)}</TextField>
          <TextField size="small" label={translate(locale, 'publicPageBuilder.buttonColor')} value={text(block.content.color)} onChange={(event) => update({ ...block.content, color: event.target.value })} />
          <TextField size="small" label={translate(locale, 'publicPageBuilder.buttonTextColor')} value={text(block.content.textColor)} onChange={(event) => update({ ...block.content, textColor: event.target.value })} /></> : null}
      {block.type === 'avatar' ? <Stack spacing={2}>
        <Box data-avatar-preview-stage sx={{ position: 'relative', height: 300, overflow: 'hidden', display: 'grid', placeItems: 'start center', pt: 2,
          ...(pageTheme ? resolvePublicPageThemeVariables(pageTheme, pageSection, {
            avatarSize: normalizeAvatarSize(block.content.avatarSize),
            coverColor: text(block.content.coverColor) || null,
          }) : {}),
          '&::after': { content: '""', position: 'absolute', zIndex: 2, inset: 'auto 0 0', height: 72, pointerEvents: 'none',
            background: (theme) => `linear-gradient(to bottom, transparent, ${theme.palette.background.paper})` } }}>
          <FitToWidth width={AVATAR_PREVIEW_REFERENCE.deviceWidth}><Box data-avatar-preview-device sx={{ width: AVATAR_PREVIEW_REFERENCE.deviceWidth,
            bgcolor: '#fff', borderRadius: '33px 33px 0 0',
            boxShadow: '0 7px 28px 7px rgba(0,0,0,.1)', overflow: 'hidden' }}>
            <Box data-avatar-preview-screen sx={{ width: AVATAR_PREVIEW_REFERENCE.screenWidth,
              maxWidth: `calc(100% - ${AVATAR_PREVIEW_REFERENCE.screenMargin * 2}px)`,
              m: '10px 10px 0', borderRadius: '25px 25px 0 0',
              overflow: 'hidden', bgcolor: 'var(--page-background)' }}>
              <Box sx={{ p: `${AVATAR_PREVIEW_REFERENCE.sectionPadding}px`, boxSizing: 'border-box', bgcolor: 'var(--page-section-background)',
                '--avatar-leading-section-radius': '25px' }}>
                <AvatarBlock block={block} mediaUrlFor={mediaUrlFor} preview
                  onFramingChange={hasAvatarPhoto && onContentChange
                    ? (framing) => update(applyAvatarFraming(block.content, framing)) : undefined} />
              </Box>
            </Box>
          </Box></FitToWidth>
        </Box>
        <Typography variant="subtitle2" id={`avatar-layout-${block.id}`}>{translate(locale, 'publicPageBuilder.fieldLayout')}</Typography>
        <Box role="radiogroup" aria-labelledby={`avatar-layout-${block.id}`} sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1 }}>
          {avatarLayouts.map((layout) => {
            const selected = normalizeAvatarLayout(block.content.layout) === layout;
            const label = translate(locale, `publicPageBuilder.${avatarLayoutLabelKey(layout)}`);
            return <ButtonBase key={layout} role="radio" aria-checked={selected} aria-label={label}
              tabIndex={selected ? 0 : -1}
              onClick={() => update({ ...block.content, layout })}
              onKeyDown={(event) => selectAvatarLayoutWithKeyboard(event, layout, (nextLayout) => update({ ...block.content, layout: nextLayout }))}
              sx={{ display: 'block', borderRadius: 2, textAlign: 'left', outline: '2px solid transparent',
                '&:focus-visible': { outlineColor: 'primary.main', outlineOffset: 2 } }}>
              <Card variant="outlined" sx={{ height: '100%', borderColor: selected ? 'primary.main' : 'divider', borderWidth: selected ? 2 : 1,
                bgcolor: selected ? 'action.selected' : 'background.paper' }}>
                <CardContent sx={{ display: 'grid', gap: 1, p: 1.25, '&:last-child': { pb: 1.25 } }}>
                  <Box sx={{ height: 48, display: 'flex', alignItems: 'center' }}><AvatarLayoutPreview layout={layout} /></Box>
                  <Typography variant="caption" sx={{ fontWeight: selected ? 700 : 500 }}>{label}</Typography>
                </CardContent>
              </Card>
            </ButtonBase>;
          })}
        </Box>
        {avatarMediaControl}
        {hasAvatarPhoto ? <Stack spacing={0.5}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Typography variant="subtitle2" id={`avatar-zoom-${block.id}`}>{translate(locale, 'publicPageBuilder.avatarZoom')}</Typography>
            <Button size="small" disabled={!avatarFramingChanged} onClick={() => update(applyAvatarFraming(block.content, { focusX: 50, focusY: 50, zoom: 1 }))}>
              {translate(locale, 'publicPageBuilder.avatarFramingReset')}
            </Button>
          </Stack>
          {normalizeAvatarLayout(block.content.layout) !== 'image-cover' ? <Slider aria-labelledby={`avatar-zoom-${block.id}`}
            min={AVATAR_ZOOM_MIN} max={AVATAR_ZOOM_MAX} step={0.05} value={avatarFraming.zoom}
            valueLabelDisplay="auto" valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
            onChange={(_event, value) => update(applyAvatarFraming(block.content, { ...avatarFraming, zoom: Array.isArray(value) ? value[0] : value }))} /> : null}
          <Typography variant="caption" color="text.secondary">{translate(locale, 'publicPageBuilder.avatarFramingHint')}</Typography>
        </Stack> : null}
        {(normalizeAvatarLayout(block.content.layout) === 'cover-centered' || normalizeAvatarLayout(block.content.layout) === 'cover-left') ? avatarCoverControl : null}
        {normalizeAvatarLayout(block.content.layout) !== 'image-cover' ? <Stack spacing={0.75}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Typography variant="subtitle2" id={`avatar-size-${block.id}`}>{translate(locale, 'publicPageBuilder.avatarSize')}</Typography>
            <Typography variant="body2" color="text.secondary">{avatarSizeLabel(normalizeAvatarSize(block.content.avatarSize))}</Typography>
          </Stack>
          <Box role="radiogroup" aria-labelledby={`avatar-size-${block.id}`} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.75 }}>
            {avatarSizes.map((size) => {
              const selected = normalizeAvatarSize(block.content.avatarSize) === size;
              return <ButtonBase key={size} role="radio" aria-checked={selected} aria-label={avatarSizeLabel(size)} tabIndex={selected ? 0 : -1}
                onClick={() => update({ ...block.content, ...resolveAvatarSizeChange(block.content.layout, size) })}
                onKeyDown={(event) => selectAvatarSizeWithKeyboard(event, size, (nextSize) => update({
                  ...block.content, ...resolveAvatarSizeChange(block.content.layout, nextSize),
                }))}
                sx={{ width: 42, height: 42, borderRadius: 1, outline: '2px solid transparent', bgcolor: selected ? 'background.paper' : 'action.hover',
                  boxShadow: selected ? 2 : 0, '&:focus-visible': { outlineColor: 'primary.main', outlineOffset: 2 } }}>
                <Box sx={{ width: Math.round(size / 6), height: Math.round(size / 6), borderRadius: '50%', bgcolor: 'text.disabled' }} />
              </ButtonBase>;
            })}
          </Box>
        </Stack> : null}
        {['heading', 'subtitle'].map((field) => <Field key={field} field={field} value={block.content[field]}
          onChange={(value) => update({ ...block.content, [field]: value })} />)}
      </Stack> : null}
      {list ? <Stack spacing={1}>
            <Typography variant="subtitle2">{translate(locale, 'publicPageBuilder.items')}</Typography>
            {rows.map((row, index) => (
              <Stack key={text(row.id, String(index))} spacing={1}
                sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
                {row.platform && SOCIAL_PLATFORMS.includes(row.platform as SocialPlatform) ? <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <SocialPlatformIcon platform={row.platform as SocialPlatform} />
                  <Typography variant="subtitle2">{text(row.label)}</Typography>
                </Stack> : null}
                {list.fields.map((field) => <Field key={field} field={field} value={row[field]} onChange={(value) => update({
                  ...block.content, [list.key]: rows.map((candidate, rowIndex) => rowIndex === index ? { ...candidate, [field]: value } : candidate),
                })} />)}
                {row.action && typeof row.action === 'object' && !Array.isArray(row.action) ? (
                  <ActionEditor value={row.action as Record<string, unknown>} onChange={(action) => update({
                    ...block.content,
                    [list.key]: rows.map((candidate, rowIndex) => rowIndex === index
                      ? { ...candidate, action }
                      : candidate),
                  })} />
                ) : null}
                <IconButton size="small" aria-label={translate(locale, 'publicPageBuilder.removeItem')}
                  onClick={() => update({ ...block.content, [list.key]: rows.filter((_, rowIndex) => rowIndex !== index) })}>
                  <Delete fontSize="small" />
                </IconButton>
              </Stack>
            ))}
            <Button size="small" startIcon={<Add />} onClick={() => addRow()}>{translate(locale, 'publicPageBuilder.addItem')}</Button>
          </Stack> : null}
    </Stack>
  );
}

/** Shrinks fixed-width content to fit a narrower container, so a device-sized preview is never cut off on a phone. */
function FitToWidth({ width, children }: { width: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const element = ref.current;
    if (!element) {return undefined;}
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [width]);
  return <Box ref={ref} sx={{ width: '100%', minWidth: 0 }}>
    <Box sx={{ width, mx: 'auto', transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</Box>
  </Box>;
}

export function AvatarBlock({ block, mediaUrlFor, preview = false, onFramingChange }: {
  block: PageBlock;
  mediaUrlFor?: (mediaId: string) => string | undefined;
  preview?: boolean;
  /** Editor only: lets the photo be dragged inside its frame. */
  onFramingChange?: (framing: AvatarFraming) => void;
}) {
  const presentation = resolveAvatarPresentation(block.content.layout, block.content.avatarSize);
  const framing = resolveAvatarFraming(block.content);
  const heroDragHandlers = useAvatarFramingDrag(framing, onFramingChange);
  const layout = presentation.renderLayout;
  const imageMediaId = text(block.content.imageMediaId);
  const imageUrl = (imageMediaId ? mediaUrlFor?.(imageMediaId) : undefined) || (preview ? AVATAR_EDITOR_PLACEHOLDER_URL : '');
  const coverMediaId = text(block.content.coverMediaId);
  const coverUrl = coverMediaId ? mediaUrlFor?.(coverMediaId) : undefined;
  const coverBackground = coverUrl ? `url("${coverUrl}")` : undefined;
  const copy = <Box sx={{ maxWidth: '100%', minWidth: 0 }}><Typography component="h1" variant="h4" sx={{ ...wrappingTextSx,
    '&&': { fontFamily: 'var(--avatar-title-font-family)', fontSize: 'var(--avatar-title-size)', fontWeight: 'var(--avatar-title-weight)',
      fontStyle: 'var(--avatar-title-style)', lineHeight: 'var(--avatar-title-line-height)', color: 'var(--avatar-title-color)' } }}>{text(block.content.heading)}</Typography>
    {text(block.content.subtitle) ? <Typography sx={{ ...wrappingTextSx,
      '&&': { fontFamily: 'var(--avatar-bio-font-family)', fontSize: 'var(--avatar-bio-size)', fontWeight: 'var(--avatar-bio-weight)',
        fontStyle: 'var(--avatar-bio-style)', lineHeight: 'var(--avatar-bio-line-height)', color: 'var(--avatar-bio-color)' } }}>{text(block.content.subtitle)}</Typography> : null}</Box>;
  if (layout === 'image-cover') {
    const imageAlt = text(block.content.imageAlt).trim();
    return <Box sx={{ position: 'relative', width: '100%', mb: `${AVATAR_PREVIEW_REFERENCE.contentMarginBottom}px`,
      minWidth: 0, maxWidth: '100%', bgcolor: 'transparent' }}>
      <Box className="public-page-avatar-cover-bleed" role={imageUrl && imageAlt ? 'img' : undefined} aria-label={imageUrl && imageAlt ? imageAlt : undefined}
        {...heroDragHandlers} sx={{
          width: `calc(100% + ${AVATAR_PREVIEW_REFERENCE.sectionPadding * 2}px)`,
          aspectRatio: `${AVATAR_HERO_REFERENCE.imageWidth} / ${AVATAR_HERO_REFERENCE.imageHeight}`,
          borderRadius: 'var(--avatar-leading-section-radius) var(--avatar-leading-section-radius) 0 0',
          backgroundImage: imageUrl ? `url("${imageUrl}")` : undefined,
          backgroundSize: 'cover', backgroundPosition: `${framing.focusX}% ${framing.focusY}%`, backgroundRepeat: 'no-repeat',
          ...(onFramingChange ? AVATAR_DRAG_SX : {}),
        }} />
      <Box sx={{ width: '100%', mt: `${AVATAR_PREVIEW_REFERENCE.copyMarginTop}px`, textAlign: 'center' }}>{copy}</Box>
    </Box>;
  }
  const avatarSize = presentation.avatarSize ?? 150;
  const avatarVariables = {
    '--avatar-size': `${avatarSize}px`,
    ...(text(block.content.coverColor) ? { '--avatar-cover-background': text(block.content.coverColor) } : {}),
  } as CSSProperties;
  if (layout === 'centered') {
    return <Box style={avatarVariables} sx={{ width: '100%', minWidth: 0, maxWidth: '100%',
      mb: `${AVATAR_PREVIEW_REFERENCE.contentMarginBottom}px`, textAlign: 'center' }}>
      <Box sx={{ width: '100%', height: avatarSize, display: 'grid', placeItems: 'center' }}>
        <PublicAvatarImage src={imageUrl} alt={text(block.content.imageAlt)} size={avatarSize} framing={framing} onFramingChange={onFramingChange} />
      </Box>
      <Box sx={{ width: '100%', mt: `${AVATAR_PREVIEW_REFERENCE.copyMarginTop}px` }}>{copy}</Box>
    </Box>;
  }
  const coverSx = {
    width: `calc(100% + ${AVATAR_PREVIEW_REFERENCE.sectionPadding * 2}px)`,
    aspectRatio: `${AVATAR_COVER_REFERENCE.width} / ${AVATAR_COVER_REFERENCE.height}`,
    borderRadius: 'var(--avatar-leading-section-radius) var(--avatar-leading-section-radius) 0 0',
    bgcolor: text(block.content.coverColor) || 'var(--avatar-cover-background)',
    backgroundImage: coverBackground,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    position: 'relative',
    overflow: 'visible',
  } as const;
  if (layout === 'cover-left') {
    const geometry = resolveAvatarCoverLeftGeometry(avatarSize);
    return <Box style={avatarVariables} sx={{ position: 'relative', width: '100%',
      mb: `${AVATAR_PREVIEW_REFERENCE.contentMarginBottom}px`, minWidth: 0, maxWidth: '100%', bgcolor: 'transparent' }}>
      <Box className="public-page-avatar-cover-bleed" sx={coverSx}>
        <PublicAvatarImage src={imageUrl} alt={text(block.content.imageAlt)} size={avatarSize} framing={framing} onFramingChange={onFramingChange} sx={{ position: 'absolute', zIndex: 1,
          bottom: 0, left: 0, transform: `translate(${geometry.avatarTranslateX}px, ${geometry.avatarTranslateY}px)` }} />
      </Box>
      <Box sx={{ width: `calc(100% - ${geometry.copyMarginLeft}px)`, mt: `${AVATAR_PREVIEW_REFERENCE.copyMarginTop}px`, ml: `${geometry.copyMarginLeft}px`, textAlign: 'left' }}>{copy}</Box>
    </Box>;
  }
  if (layout === 'cover-centered') {
    const geometry = resolveAvatarCoverCenteredGeometry(avatarSize);
    return <Box style={avatarVariables} sx={{ position: 'relative', width: '100%',
      mb: `${AVATAR_PREVIEW_REFERENCE.contentMarginBottom}px`, minWidth: 0, maxWidth: '100%', textAlign: 'center' }}>
      <Box className="public-page-avatar-cover-bleed" sx={coverSx}>
        <PublicAvatarImage src={imageUrl} alt={text(block.content.imageAlt)} size={avatarSize} framing={framing} onFramingChange={onFramingChange} sx={{ position: 'absolute', zIndex: 1,
          bottom: 0, left: '50%',
          transform: `translate(${geometry.avatarTranslateX}px, ${geometry.avatarTranslateY}px)` }} />
      </Box>
      <Box sx={{ width: '100%', mt: `${AVATAR_PREVIEW_REFERENCE.copyMarginTop}px`, pt: `${geometry.copyPaddingTop}px` }}>{copy}</Box>
    </Box>;
  }
  return null;
}

export function ButtonBlock({ block }: { block: PageBlock }) {
  const href = hrefFor(block.content.action);
  if (!href) {return null;}
  const external = /^https?:\/\//i.test(href) && block.content.openInNewTab === true;
  const icons = { link: <LinkIcon />, phone: <PhoneOutlined />, email: <EmailOutlined />, message: <ChatBubbleOutlined /> } as const;
  const icon = text(block.content.icon) as keyof typeof icons;
  const subtitle = text(block.content.subtitle).trim();
  const animation = block.design.animation;
  return <Button component="a" href={href} target={external ? '_blank' : undefined} startIcon={icons[icon]}
    rel={external ? 'noopener noreferrer' : undefined} variant="contained"
    data-meetli-animation={animation}
    sx={{ ...ordinaryPublicPageLinkSx, ...linkLayoutSx, minHeight: 'var(--app-control-l)', textTransform: 'none',
      '--meetli-motion-duration': '700ms', '--meetli-motion-lift': '-3px', '--meetli-motion-scale': 1.025,
      '@keyframes meetliPulse': { '0%, 100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(var(--meetli-motion-scale))' } },
      '@keyframes meetliLift': { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(var(--meetli-motion-lift))' } },
      animation: animation === 'none' ? 'none' : `${animation === 'pulse' ? 'meetliPulse' : 'meetliLift'} var(--meetli-motion-duration) ease-in-out 2`,
      '@media (prefers-reduced-motion: reduce)': { animation: 'none', transform: 'none' },
    }}><Box component="span" sx={{ display: 'grid', gap: '0.25rem', minWidth: 0 }}>
      <Box component="span">{text(block.content.label)}</Box>
      {subtitle ? <Box component="span" sx={{ fontFamily: 'var(--theme-link-subtitle-font-family)', fontSize: 'var(--theme-link-subtitle-fontsize)',
        fontWeight: 'var(--theme-link-subtitle-font-weight)', fontStyle: 'var(--theme-link-subtitle-font-style)',
        lineHeight: 'var(--theme-link-subtitle-lineheight)', color: 'var(--theme-link-subtitle-color)' }}>{subtitle}</Box> : null}
    </Box></Button>;
}

export function LinksBlock({ block }: { block: PageBlock }) {
  return <Surface block={block}><Stack sx={{ gap: 'var(--theme-link-offset)' }}>{items(block.content.links).map((item, index) =>
    <CtaButton key={text(item.id, String(index))} label={text(item.label)} action={item.action} />,
  )}</Stack></Surface>;
}

const richTextSizeVariables: Record<RichTextSize, { fontFamily: string; fontSize: string; fontWeight: string; lineHeight: string; letterSpacing: string }> = {
  small: { fontFamily: 'var(--theme-text-sm-font-family)', fontSize: 'var(--theme-text-sm-fontsize)', fontWeight: 'var(--theme-text-sm-font-weight)', lineHeight: 'var(--theme-text-sm-lineheight)', letterSpacing: 'var(--theme-text-sm-letterspacing)' },
  medium: { fontFamily: 'var(--theme-text-md-font-family)', fontSize: 'var(--theme-text-md-fontsize)', fontWeight: 'var(--theme-text-md-font-weight)', lineHeight: 'var(--theme-text-md-lineheight)', letterSpacing: 'var(--theme-text-md-letterspacing)' },
  large: { fontFamily: 'var(--theme-text-lg-font-family)', fontSize: 'var(--theme-text-lg-fontsize)', fontWeight: 'var(--theme-text-lg-font-weight)', lineHeight: 'var(--theme-text-lg-lineheight)', letterSpacing: 'var(--theme-text-lg-letterspacing)' },
  h1: { fontFamily: 'var(--theme-h1-font-family)', fontSize: 'var(--theme-h1-fontsize)', fontWeight: 'var(--theme-h1-font-weight)', lineHeight: 'var(--theme-h1-lineheight)', letterSpacing: 'var(--theme-h1-letterspacing)' },
  h2: { fontFamily: 'var(--theme-h2-font-family)', fontSize: 'var(--theme-h2-fontsize)', fontWeight: 'var(--theme-h2-font-weight)', lineHeight: 'var(--theme-h2-lineheight)', letterSpacing: 'var(--theme-h2-letterspacing)' },
  h3: { fontFamily: 'var(--theme-h3-font-family)', fontSize: 'var(--theme-h3-fontsize)', fontWeight: 'var(--theme-h3-font-weight)', lineHeight: 'var(--theme-h3-lineheight)', letterSpacing: 'var(--theme-h3-letterspacing)' },
};

function RichTextRun({ value }: { value: { text: string; marks?: RichTextMarks } }) {
  const textDecoration = [value.marks?.underline ? 'underline' : '', value.marks?.strike ? 'line-through' : '']
    .filter(Boolean)
    .join(' ') || 'none';
  return <Box component="span" sx={{
    fontWeight: value.marks?.bold ? 'var(--theme-font-weight-bold)' : 'inherit',
    fontStyle: value.marks?.italic ? 'italic' : 'inherit',
    textDecoration,
    color: value.marks?.color ?? 'inherit',
  }}>{value.text}</Box>;
}

export function RichTextContent({ document }: { document: RichTextDocument }) {
  return <Stack sx={{ gap: 'var(--page-space-2)', maxWidth: '100%', minWidth: 0 }}>
    {document.paragraphs.map((paragraph, paragraphIndex) => {
      const sizeStyle = richTextSizeVariables[paragraph.size];
      const heading = paragraph.size.startsWith('h');
      // A heading or a bold lead-in line belongs to the paragraph after it, so it sits one scale step closer to it.
      const binds = paragraphIndex < document.paragraphs.length - 1
        && (heading || (paragraph.runs.length > 0 && paragraph.runs.every((run) => run.marks?.bold)));
      return <Box key={paragraphIndex} component="p" data-public-page-richtext-size={paragraph.size} sx={{
      ...wrappingTextSx,
      m: 0,
      ...(binds ? { mb: 'calc(var(--page-space-1) - var(--page-space-2))' } : {}),
      textAlign: paragraph.alignment,
      fontFamily: paragraph.fontFamily ?? sizeStyle.fontFamily,
      fontSize: sizeStyle.fontSize,
      fontWeight: sizeStyle.fontWeight,
      fontStyle: heading ? 'var(--theme-heading-font-style)' : 'var(--theme-text-font-style)',
      color: heading ? 'var(--theme-heading-color)' : 'var(--theme-text-color)',
      lineHeight: sizeStyle.lineHeight,
      letterSpacing: sizeStyle.letterSpacing,
    }}>
      {paragraph.runs.map((run, runIndex) => <RichTextRun key={runIndex} value={run} />)}
    </Box>;
    })}
  </Stack>;
}

export function TextBlock({ block }: { block: PageBlock }) {
  return <RichTextContent document={normalizeRichTextDocument(block.content.document)} />;
}

export function ImageBlock({ block, mediaUrlFor }: { block: PageBlock; mediaUrlFor?: (mediaId: string) => string | undefined }) {
  const mediaId = text(block.content.imageMediaId);
  const url = mediaId ? mediaUrlFor?.(mediaId) : undefined;
  return <Surface block={block}>{url && <Box component="img" src={url} alt={text(block.content.alt)}
    sx={{ display: 'block', width: '100%', height: 'auto', maxHeight: 560, objectFit: 'cover', borderRadius: 'var(--block-border-radius)' }} />}</Surface>;
}

export function GalleryBlock({ block, mediaUrlFor }: { block: PageBlock; mediaUrlFor?: (mediaId: string) => string | undefined }) {
  return <Surface block={block}><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, gap: 'var(--page-space-2)' }}>
    {items(block.content.images).flatMap((item, index) => {
      const mediaId = text(item.mediaId);
      const url = mediaId ? mediaUrlFor?.(mediaId) : undefined;
      return url ? [<Box key={mediaId || String(index)} component="img" src={url} alt={text(item.alt)} loading="lazy"
        sx={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 'var(--block-border-radius)' }} />] : [];
    })}
  </Box></Surface>;
}

function CardList({ block, field }: { block: PageBlock; field: string }) {
  return <Surface block={block}><Stack sx={{ gap: 'var(--page-space-2)', ...bindTitleSx }}>{text(block.content.title) &&
    <Typography component="h2" variant="h5">{text(block.content.title)}</Typography>}
    {items(block.content[field]).map((item, index) => <Card key={text(item.id, String(index))} variant="outlined"
      sx={{ bgcolor: 'var(--avatar-surface-background)', color: 'var(--page-text)',
        borderColor: 'color-mix(in srgb, var(--page-text) 14%, transparent)', borderRadius: 'var(--block-border-radius)',
        '--theme-text-color': 'var(--page-text)', '--theme-heading-color': 'var(--page-text)' }}>
      <CardContent sx={{ display: 'grid', gap: 'var(--page-space-1)', p: 'var(--page-space-3)', '&:last-child': { pb: 'var(--page-space-3)' } }}><Typography component="h3" variant="h6">{text(item.title, text(item.label))}</Typography>
        {text(item.description) && <Typography>{text(item.description)}</Typography>}
        {text(item.price) && <Typography sx={{ fontWeight: 700 }}>{text(item.price)}</Typography>}
      </CardContent></Card>)}
  </Stack></Surface>;
}

function safeServiceImageUrl(value: string | null): string | null {
  if (!value) {return null;}
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}

export function ServicesBlock({ block, services = [], publicPageSlug = '', editor = false }: {
  block: PageBlock;
  services?: readonly PublicBookingService[];
  publicPageSlug?: string;
  editor?: boolean;
}) {
  const { locale } = useI18n();
  const serviceIds = Array.isArray(block.content.serviceIds)
    ? block.content.serviceIds.filter((id): id is number => Number.isInteger(id) && Number(id) > 0)
    : [];
  const byId = new Map(services.map((service) => [service.id, service]));
  const selectedServices = serviceIds.flatMap((id) => byId.get(id) ?? []);
  const reducedMotion = useReducedMotion();
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'center',
    loop: false,
    containScroll: false,
    duration: reducedMotion ? 0 : 25,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [autoplayPaused, setAutoplayPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [pageHidden, setPageHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const [manualNavigation, setManualNavigation] = useState(0);
  const [bookingServiceId, setBookingServiceId] = useState<number | null>(null);
  const interval = Number.isInteger(block.content.autoplayIntervalSeconds)
    ? Number(block.content.autoplayIntervalSeconds) : null;
  const autoplayConfigured = interval !== null && interval >= 3 && interval <= 30 && selectedServices.length > 1;
  const onSelect = useCallback(() => setSelectedIndex(emblaApi?.selectedScrollSnap() ?? 0), [emblaApi]);
  useEffect(() => {
    if (!emblaApi) {return;}
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {emblaApi.off('select', onSelect); emblaApi.off('reInit', onSelect);};
  }, [emblaApi, onSelect]);
  useEffect(() => {
    const onVisibilityChange = () => setPageHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);
  useEffect(() => {
    if (!emblaApi || !autoplayConfigured || editor || reducedMotion || autoplayPaused || hovered || focusWithin || pageHidden) {return;}
    const timer = window.setTimeout(() => emblaApi.scrollTo((emblaApi.selectedScrollSnap() + 1) % selectedServices.length), interval! * 1000);
    return () => window.clearTimeout(timer);
  }, [autoplayConfigured, autoplayPaused, editor, emblaApi, focusWithin, hovered, interval, manualNavigation, pageHidden, reducedMotion, selectedIndex, selectedServices.length]);
  const navigate = (index: number) => {
    emblaApi?.scrollTo(index);
    setManualNavigation((value) => value + 1);
  };
  const onNavigationKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? selectedServices.length - 1
      : event.key === 'ArrowRight' ? (index + 1) % selectedServices.length
        : event.key === 'ArrowLeft' ? (index - 1 + selectedServices.length) % selectedServices.length : null;
    if (nextIndex === null) {return;}
    event.preventDefault();
    navigate(nextIndex);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button[data-service-dot]')[nextIndex]?.focus();
  };
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {setFocusWithin(false);}
  };
  const title = text(block.content.title) || translate(locale, 'publicPageBuilder.blockTypeServices');
  if (selectedServices.length === 0) {
    return editor ? <Surface block={block}><Typography component="h2" variant="h5">{title}</Typography>
      <Typography color="text.secondary">{translate(locale, 'publicPageBuilder.servicesNoneSelected')}</Typography></Surface> : null;
  }
  const layout = block.content.layout === 'grid' || block.content.layout === 'list' ? block.content.layout : 'carousel';
  const carousel = layout === 'carousel' && selectedServices.length > 1;
  const wideRow = layout !== 'grid';
  const slides = selectedServices.map((service, index) => {
    const imageUrl = safeServiceImageUrl(service.imageUrl);
    const inactive = carousel && selectedIndex !== index;
    return <Box key={service.id} role="group" aria-roledescription={translate(locale, 'publicPageBuilder.carouselSlide')}
      inert={inactive ? true : undefined} aria-hidden={inactive ? true : undefined}
      aria-label={translate(locale, 'publicPageBuilder.serviceSlidePosition').replace('{current}', String(index + 1)).replace('{total}', String(selectedServices.length))}
      sx={{
        ...(carousel ? {
          flex: '0 0 88%',
          '@container public-services (min-width: 600px)': { flex: '0 0 72%' },
        } : {}),
        minWidth: 0,
        display: 'flex',
        opacity: inactive ? 0.56 : 1,
      }}>
      <Card variant="outlined" sx={{ width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        bgcolor: 'var(--avatar-surface-background)', color: 'var(--page-text)', borderColor: 'color-mix(in srgb, var(--page-text) 14%, transparent)',
        borderRadius: 'var(--block-border-radius)',
        boxShadow: carousel && !inactive
          ? '-6px 4px 18px -4px color-mix(in srgb, var(--page-text) 9%, transparent), 6px 4px 18px -4px color-mix(in srgb, var(--page-text) 9%, transparent)'
          : 'none',
        ...(wideRow ? { '@container public-services (min-width: 600px)': { flexDirection: 'row' } } : {}) }}>
        {imageUrl ? <Box component="img" src={imageUrl} alt="" loading="lazy" sx={{ width: '100%', height: 180, objectFit: 'cover',
          ...(wideRow ? { '@container public-services (min-width: 600px)': { width: 144, height: 'auto', maxHeight: 240, alignSelf: 'stretch' } } : {}) }} /> : null}
        <CardContent sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--page-space-1)', p: 'var(--page-space-3)', '&:last-child': { pb: 'var(--page-space-3)' },
          ...(wideRow ? { '@container public-services (min-width: 600px)': { flexDirection: 'row', alignItems: 'center', gap: 'var(--app-space-l)' } } : {}) }}>
          <Stack sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', gap: 'var(--page-space-1)' }}>
            <Typography component="h3" variant="h6">{service.name}</Typography>
            {service.description ? <Typography>{service.description}</Typography> : null}
            <Stack direction="row" sx={{ alignItems: 'baseline', flexWrap: 'wrap', gap: 'var(--page-space-1)', mt: 'auto' }}>
              <Typography sx={{ fontWeight: 700 }}>{formatMoney(service.price, service.currency, locale)}</Typography>
              <Typography variant="body2">{service.durationMin} {translate(locale, 'publicPageBuilder.serviceMinutes')}</Typography>
            </Stack>
            {service.firstSessionFree ? <Typography variant="body2" sx={{ color: 'var(--theme-link-title-color)', fontWeight: 700 }}>
              {translate(locale, 'publicPageBuilder.serviceFirstSessionFree')}
            </Typography> : null}
          </Stack>
          {block.content.showBookingButton !== false && publicPageSlug ? <Button
            onClick={() => setBookingServiceId(service.id)} variant="contained"
            sx={{ ...ordinaryPublicPageLinkSx, mt: 'var(--app-space-xs)', minHeight: 'var(--app-control-l)', textTransform: 'none',
              ...(wideRow ? { '@container public-services (min-width: 600px)': { mt: 0, flexShrink: 0, maxWidth: '40%' } } : {}) }}>
            {translate(locale, 'publicPageBuilder.serviceBook')}
          </Button> : null}
        </CardContent>
      </Card>
    </Box>;
  });
  return <Surface block={block}><Stack role="region" aria-label={title}
    sx={{ gap: 'var(--page-space-2)', ...bindTitleSx, containerType: 'inline-size', containerName: 'public-services', minWidth: 0 }}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocusWithin(true)} onBlurCapture={onBlur}>
    <Typography component="h2" variant="h5">{title}</Typography>
    {selectedServices.length === 1 ? slides[0] : !carousel ? <Box sx={{ display: 'grid', gap: 'var(--page-space-2)', minWidth: 0,
      gridTemplateColumns: layout === 'grid' ? 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))' : 'minmax(0, 1fr)' }}>{slides}</Box> : <>
      <Box ref={emblaRef} sx={{ overflow: 'hidden', minWidth: 0, maxWidth: '100%', touchAction: 'pan-y pinch-zoom', py: 'var(--page-space-3)',
        '--carousel-edge-width': '18px',
        maskImage: 'linear-gradient(to right, transparent, black var(--carousel-edge-width), black calc(100% - var(--carousel-edge-width)), transparent)',
        '@container public-services (min-width: 600px)': { '--carousel-edge-width': '80px' } }}>
        <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 'var(--page-space-2)', minWidth: 0,
          '@container public-services (min-width: 600px)': { gap: 'var(--page-space-3)' } }}>{slides}</Box>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', alignItems: 'center', rowGap: 0.5, minHeight: 34 }}>
        <Stack direction="row" role="group" aria-label={translate(locale, 'publicPageBuilder.carouselNavigation')} sx={{ gridColumn: 2, gap: 'var(--page-space-1)' }}>
          {selectedServices.map((service, index) => <ButtonBase key={service.id} data-service-dot
            aria-label={translate(locale, 'publicPageBuilder.goToServiceSlide').replace('{number}', String(index + 1))}
            aria-current={selectedIndex === index ? 'true' : undefined} onClick={() => navigate(index)}
            onKeyDown={(event) => onNavigationKeyDown(event, index)}
            sx={{ width: 'var(--app-space-m)', height: 'var(--app-space-m)', borderRadius: 'var(--app-radius-circle)', bgcolor: selectedIndex === index ? 'var(--theme-link-background)' : 'transparent',
              border: 'calc(var(--app-border-width) * 2) solid', borderColor: 'var(--theme-link-background)', '&:focus-visible': { outline: 'calc(var(--app-border-width) * 2) solid var(--theme-link-border-color)', outlineOffset: 'calc(var(--app-border-width) * 2)' } }} />)}
        </Stack>
        {autoplayConfigured && !editor && !reducedMotion ? <IconButton size="small" aria-label={translate(locale, `publicPageBuilder.${autoplayPaused ? 'carouselPlay' : 'carouselPause'}`)}
          sx={{ gridColumn: 3, justifySelf: 'start', ml: 'var(--page-space-1)',
            '@container public-services (max-width: 420px)': { gridColumn: 2, gridRow: 2, justifySelf: 'center', ml: 0 } }}
          onClick={() => setAutoplayPaused((value) => !value)}>{autoplayPaused ? <PlayArrow /> : <Pause />}</IconButton> : null}
      </Box>
    </>}
    {!editor && publicPageSlug && bookingServiceId !== null ? <PublicBookingDialog open onClose={() => setBookingServiceId(null)}
      slug={publicPageSlug} serviceId={String(bookingServiceId)} /> : null}
  </Stack></Surface>;
}

export const FaqBlock = ({ block }: { block: PageBlock }) => <CardList block={block} field="items" />;

const mutedBorder = '1px solid color-mix(in srgb, var(--page-text) 14%, transparent)';

function ListTitle({ block }: { block: PageBlock }) {
  return text(block.content.title) ? <Typography component="h2" variant="h5">{text(block.content.title)}</Typography> : null;
}

export const PriceListBlock = ({ block }: { block: PageBlock }) => <Surface block={block}>
  <Stack sx={{ gap: 'var(--page-space-2)', ...bindTitleSx }}>
    <ListTitle block={block} />
    <Stack component="ul" sx={{ listStyle: 'none', m: 0, p: 0, gap: 'var(--page-space-2)' }}>
      {items(block.content.items).map((item, index) => <Box component="li" key={text(item.id, String(index))}
        sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: 'var(--page-space-2)', rowGap: 'var(--page-space-1)',
          alignItems: 'baseline', pb: 'var(--page-space-2)', borderBottom: mutedBorder, '&:last-child': { borderBottom: 0, pb: 0 } }}>
        <Typography component="h3" variant="h6">{text(item.title)}</Typography>
        {text(item.price) ? <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{text(item.price)}</Typography> : <span />}
        {text(item.description) ? <Typography sx={{ gridColumn: '1 / -1', ...wrappingTextSx }}>{text(item.description)}</Typography> : null}
      </Box>)}
    </Stack>
  </Stack>
</Surface>;

export const StepsBlock = ({ block }: { block: PageBlock }) => <Surface block={block}>
  <Stack sx={{ gap: 'var(--page-space-2)', ...bindTitleSx }}>
    <ListTitle block={block} />
    <Stack component="ol" sx={{ listStyle: 'none', m: 0, p: 0, gap: 'var(--page-space-3)' }}>
      {items(block.content.items).map((item, index) => <Box component="li" key={text(item.id, String(index))}
        sx={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', columnGap: 'var(--page-space-2)', alignItems: 'start' }}>
        <Box aria-hidden="true" sx={{ width: 'var(--app-control-m)', height: 'var(--app-control-m)', borderRadius: '50%', display: 'grid', placeItems: 'center',
          fontWeight: 700, bgcolor: 'var(--theme-link-background)', color: 'var(--theme-link-title-color)' }}>{index + 1}</Box>
        <Stack sx={{ gap: 'var(--page-space-1)', minWidth: 0 }}>
          <Typography component="h3" variant="h6">{text(item.title)}</Typography>
          {text(item.description) ? <Typography sx={wrappingTextSx}>{text(item.description)}</Typography> : null}
        </Stack>
      </Box>)}
    </Stack>
  </Stack>
</Surface>;

export const StatsBlock = ({ block }: { block: PageBlock }) => <Surface block={block}>
  <Stack sx={{ gap: 'var(--page-space-2)', ...bindTitleSx }}>
    <ListTitle block={block} />
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(7.5rem, 1fr))', gap: 'var(--page-space-3)' }}>
      {items(block.content.items).map((item, index) => <Box component="li" key={text(item.id, String(index))} sx={{ textAlign: 'center', minWidth: 0 }}>
        <Typography component="div" sx={{ fontSize: 'var(--theme-h1-fontsize)', lineHeight: 'var(--theme-h1-lineheight)', fontWeight: 700, color: 'var(--theme-heading-color)' }}>{text(item.value)}</Typography>
        {text(item.description) ? <Typography sx={wrappingTextSx}>{text(item.description)}</Typography> : null}
      </Box>)}
    </Box>
  </Stack>
</Surface>;

export const HoursBlock = ({ block }: { block: PageBlock }) => <Surface block={block}>
  <Stack sx={{ gap: 'var(--page-space-2)', ...bindTitleSx }}>
    <ListTitle block={block} />
    <Stack component="dl" sx={{ m: 0, gap: 'var(--page-space-1)' }}>
      {items(block.content.items).map((item, index) => <Box key={text(item.id, String(index))}
        sx={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--page-space-2)', pb: 'var(--page-space-1)', borderBottom: mutedBorder, '&:last-child': { borderBottom: 0, pb: 0 } }}>
        <Typography component="dt" sx={{ color: 'var(--theme-text-color)', ...wrappingTextSx }}>{text(item.days)}</Typography>
        <Typography component="dd" sx={{ m: 0, fontWeight: 700, textAlign: 'right', color: 'var(--theme-text-color)', ...wrappingTextSx }}>{text(item.hours)}</Typography>
      </Box>)}
    </Stack>
  </Stack>
</Surface>;

export function VideoBlock({ block }: { block: PageBlock }) {
  const { locale } = useI18n();
  const video = parsePublicPageVideoUrl(text(block.content.url));
  return <Surface block={block}>
    <Stack sx={{ gap: 'var(--page-space-2)', ...bindTitleSx }}>
      <ListTitle block={block} />
      {video ? <Box sx={{ position: 'relative', aspectRatio: '16 / 9', borderRadius: 'var(--block-border-radius)', overflow: 'hidden', bgcolor: 'color-mix(in srgb, var(--page-text) 8%, transparent)' }}>
        <Box component="iframe" src={publicPageVideoEmbedUrl(video)} title={text(block.content.title) || translate(locale, 'publicPageBuilder.blockTypeVideo')}
          loading="lazy" allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
      </Box> : null}
    </Stack>
  </Surface>;
}

const SOCIAL_HOSTS: ReadonlyArray<[SocialPlatform, RegExp]> = [
  ['telegram', /(^|\.)(t\.me|telegram\.me|telegram\.org)$/i], ['instagram', /(^|\.)instagram\.com$/i],
  ['whatsapp', /(^|\.)(wa\.me|whatsapp\.com)$/i], ['viber', /(^|\.)viber\.com$/i], ['vk', /(^|\.)vk\.com$/i],
  ['facebook-messenger', /(^|\.)m\.me$/i], ['facebook', /(^|\.)(facebook|fb)\.com$/i],
  ['threads', /(^|\.)threads\.net$/i], ['tiktok', /(^|\.)tiktok\.com$/i],
];

/** Recognises well-known messengers and social networks by link host, so their contacts get a branded button. */
function socialPlatformFromHref(href: string): SocialPlatform | null {
  try {
    const { hostname } = new URL(href);
    return SOCIAL_HOSTS.find(([, pattern]) => pattern.test(hostname))?.[0] ?? null;
  } catch {
    return null;
  }
}

/** Brand colors by default; the page theme can switch messenger buttons to its own button colors. */
const socialBackground = (style: { background: string }) => `var(--social-button-background, ${style.background})`;
const socialColor = (style: { color: string }) => `var(--social-button-color, ${style.color})`;

const brandedButtonSx = (style: { background: string; color: string }) => ({
  ...linkLayoutSx, position: 'relative', minHeight: 'var(--app-control-l)', px: 'var(--app-space-xl)', borderRadius: 'var(--theme-link-border-radius)',
  textTransform: 'var(--theme-link-title-transform)', fontFamily: 'var(--theme-link-title-font-family)',
  fontSize: 'var(--theme-link-title-fontsize)', lineHeight: 'var(--theme-link-title-lineheight)',
  letterSpacing: 'var(--theme-link-title-letterspacing)', fontWeight: 'var(--theme-link-title-font-weight)',
  boxShadow: 'var(--theme-link-shadow-params)', background: socialBackground(style), color: socialColor(style),
  '&:hover': { background: socialBackground(style), filter: 'brightness(.94)' },
}) as const;

export function ContactsBlock({ block }: { block: PageBlock }) {
  const contacts = items(block.content.contacts).flatMap((item, index) => {
    const label = text(item.label).trim();
    const href = contactHref(item);
    return label && href ? [{ item, index, label, href }] : [];
  });
  if (contacts.length === 0) {return null;}
  const actionIcons = { phone: <PhoneOutlined />, email: <EmailOutlined /> } as const;
  return <Surface block={block}><Stack sx={{ gap: 'var(--page-space-2)', ...bindTitleSx }}>{text(block.content.title) &&
    <Typography component="h2" variant="h5">{text(block.content.title)}</Typography>}
    <Stack sx={{ gap: 'var(--theme-link-offset)' }}>{contacts.map(({ item, index, label, href }) => {
      const external = /^https?:\/\//i.test(href);
      const platform = external ? socialPlatformFromHref(href) : null;
      const actionType = (item.action as { type?: string } | undefined)?.type;
      const common = { key: text(item.id, String(index)), component: 'a', href, target: external ? '_blank' : undefined,
        rel: external ? 'noopener noreferrer' : undefined } as const;
      if (platform) {
        const style = socialPlatformStyles[platform];
        return <Button {...common} data-social-button={platform} sx={brandedButtonSx(style)}>
          <SocialPlatformIcon platform={platform} aria-hidden="true" sx={{ position: 'absolute', left: 'var(--app-space-m)', width: 24, height: 24, color: `var(--social-button-color, ${style.iconColor})` }} />
          <Box component="span" sx={{ width: '100%', textAlign: 'var(--theme-link-text-align)' }}>{label}</Box>
        </Button>;
      }
      return <Button {...common} variant="contained" startIcon={actionIcons[actionType as keyof typeof actionIcons] ?? <LinkIcon />}
        sx={{ ...ordinaryPublicPageLinkSx, ...linkLayoutSx, minHeight: 'var(--app-control-l)', textTransform: 'none' }}>{label}</Button>;
    })}</Stack>
  </Stack></Surface>;
}
export function SocialButtonBlock({ block }: { block: PageBlock }) {
  const platform = block.content.platform as SocialPlatform;
  const href = normalizeSafeHref(block.content.url);
  if (!href || !SOCIAL_PLATFORMS.includes(platform)) {return null;}
  const style = socialPlatformStyles[platform];
  return <Button component="a" href={href} target="_blank" rel="noopener noreferrer" data-social-button={platform}
    sx={{ ...linkLayoutSx, position: 'relative', minHeight: 'var(--app-control-l)', px: 'var(--app-space-xl)', borderRadius: 'var(--theme-link-border-radius)',
      textTransform: 'var(--theme-link-title-transform)', fontFamily: 'var(--theme-link-title-font-family)',
      fontSize: 'var(--theme-link-title-fontsize)', lineHeight: 'var(--theme-link-title-lineheight)',
      letterSpacing: 'var(--theme-link-title-letterspacing)', fontWeight: 'var(--theme-link-title-font-weight)',
      borderWidth: 'var(--theme-link-border-width)', boxShadow: 'var(--theme-link-shadow-params)',
      background: socialBackground(style), color: socialColor(style), '&:hover': { background: socialBackground(style), filter: 'brightness(.94)' } }}>
    <SocialPlatformIcon className="social-button__icon" platform={platform} aria-hidden="true"
      sx={{ position: 'absolute', left: 'var(--app-space-m)', width: 24, height: 24, color: `var(--social-button-color, ${style.iconColor})` }} />
    <Box component="span" className="social-button__label" sx={{ width: '100%', textAlign: 'var(--theme-link-text-align)', paddingInlineStart: 'var(--theme-link-label-offset)' }}>{text(block.content.label)}</Box>
  </Button>;
}

export function MapBlock({ block }: { block: PageBlock }) {
  const url = normalizeSafeHref(block.content.url);
  const address = text(block.content.address).trim();
  if (!address && !url) {return null;}
  return <Surface block={block}><Stack sx={{ gap: 'var(--page-space-2)', ...bindTitleSx }}>
    {text(block.content.title) ? <Typography component="h2" variant="h5">{text(block.content.title)}</Typography> : null}
    {address ? <Typography>{address}</Typography> : null}
    {url ? <Button component="a" href={url} target="_blank" rel="noopener noreferrer" variant="contained" startIcon={<PlaceOutlined />}
      sx={{ ...ordinaryPublicPageLinkSx, ...linkLayoutSx, minHeight: 'var(--app-control-l)', textTransform: 'none' }}>
      {text(block.content.label, address)}</Button> : null}
  </Stack></Surface>;
}

export function DividerBlock({ block }: { block: PageBlock }) {
  return <Surface block={block}><Divider sx={{ borderColor: 'currentColor', opacity: 0.35 }} /></Surface>;
}
