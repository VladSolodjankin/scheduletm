import {
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  Divider,
  IconButton,
  MenuItem,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add, ChatBubbleOutlined, Delete, EmailOutlined, Facebook, Instagram, Link as LinkIcon, PhoneOutlined, Telegram, WhatsApp,
} from '@mui/icons-material';
import { SvgIcon, type SvgIconProps } from '@mui/material';
import type { KeyboardEvent, ReactNode } from 'react';
import type {
  BlockContent,
  CtaAction,
  PageBlock,
} from '../../features/public-page-builder/types/publicPage';
import { ctaActionToHref } from '../../features/public-page-builder/model/cta';
import { useI18n } from '../../shared/i18n/I18nContext';
import { publicPageText } from '../public-page-builder/uiText';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '../../features/public-page-builder/model/socialPlatforms';

export type Item = Record<string, unknown>;

export const text = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;
export const items = (value: unknown): Item[] =>
  Array.isArray(value) ? value.filter((item): item is Item => Boolean(item) && typeof item === 'object') : [];
export const required = (content: BlockContent, ...keys: string[]): string[] =>
  keys.filter((key) => !text(content[key]).trim()).map((key) => `${key} is required`);
const hasValue = (value: unknown): boolean =>
  typeof value === 'string' ? Boolean(value.trim()) : value !== null && value !== undefined;
const wrappingTextSx = { maxWidth: '100%', minWidth: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } as const;
export const validItems = (content: BlockContent, key: string, fields: string[]): string[] =>
  items(content[key]).flatMap((item, index) =>
    fields.filter((field) => !hasValue(item[field])).map((field) => `${key}.${index}.${field} is required`),
  );

export type SafeLinkKind = 'contact' | 'web';

export function normalizeSafeHref(value: unknown, kind: SafeLinkKind): string | null {
  const href = text(value).trim();
  if (!href) {
    return null;
  }
  if (/^https?:\/\//i.test(href)) {
    try {
      const url = new URL(href);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
    } catch {
      return null;
    }
  }
  if (kind === 'contact' && /^mailto:/i.test(href)) {
    return ctaActionToHref({ type: 'email', email: href.slice(7) });
  }
  if (kind === 'contact' && /^tel:/i.test(href)) {
    return ctaActionToHref({ type: 'phone', phone: href.slice(4) });
  }
  return null;
}

function Surface({ children }: { block: PageBlock; children: ReactNode }) {
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
      sx={{ minHeight: 44, textTransform: 'none' }}
    >
      {label}
    </Button>
  );
}

export const socialPlatformStyles: Record<SocialPlatform, { background: string; color: string; iconColor: string }> = {
  'facebook-messenger': { background: 'linear-gradient(135deg, #00B2FF, #A033FF, #FF5280)', color: '#fff', iconColor: '#fff' },
  vk: { background: '#0077FF', color: '#fff', iconColor: '#fff' }, whatsapp: { background: '#25D366', color: '#071B0D', iconColor: '#071B0D' },
  viber: { background: '#7360F2', color: '#fff', iconColor: '#fff' }, telegram: { background: '#229ED9', color: '#fff', iconColor: '#fff' },
  facebook: { background: '#1877F2', color: '#fff', iconColor: '#fff' }, threads: { background: '#000', color: '#fff', iconColor: '#fff' },
  instagram: { background: 'linear-gradient(135deg, #833AB4, #FD1D1D, #FCAF45)', color: '#fff', iconColor: '#fff' },
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

const fieldKeys: Record<string, Parameters<typeof publicPageText>[1]> = {
  title: 'fieldTitle', subtitle: 'fieldSubtitle', body: 'fieldBody', description: 'fieldDescription',
  label: 'fieldLabel', url: 'fieldUrl', alt: 'imageAlt', imageUrl: 'fieldImageUrl', imageAlt: 'imageAlt',
  ctaLabel: 'fieldCtaLabel', address: 'fieldAddress', price: 'fieldPrice', platform: 'fieldPlatform',
};

function Field({ field, value, onChange }: { field: string; value: unknown; onChange: (value: string) => void }) {
  const { locale } = useI18n();
  return <TextField size="small" fullWidth label={publicPageText(locale, fieldKeys[field] ?? 'fieldValue')}
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
      <TextField select size="small" label={publicPageText(locale, 'fieldAction')} value={type}
        onChange={(event) => onChange({ type: event.target.value, [event.target.value === 'phone' ? 'phone' : event.target.value === 'email' ? 'email' : 'url']: '' })}>
        {['url', 'phone', 'email', 'messenger'].map((option) => <MenuItem key={option} value={option}>{publicPageText(locale, `action${option[0].toUpperCase()}${option.slice(1)}` as Parameters<typeof publicPageText>[1])}</MenuItem>)}
      </TextField>
      <TextField size="small" fullWidth label={publicPageText(locale, field === 'phone' ? 'fieldPhone' : field === 'email' ? 'fieldEmail' : 'fieldUrl')} value={text(value[field])}
        onChange={(event) => onChange({ ...value, [field]: event.target.value })} />
    </Stack>
  );
}

const editorShape: Record<string, { fields?: string[]; list?: { key: string; fields: string[] } }> = {
  hero: { fields: ['title', 'subtitle', 'ctaLabel'] },
  avatar: { fields: ['heading', 'subtitle'] },
  button: { fields: ['label'] },
  links: { list: { key: 'links', fields: ['label'] } }, text: { fields: ['title', 'body'] },
  image: {},
  services: { fields: ['title'], list: { key: 'services', fields: ['title', 'description', 'price'] } },
  contacts: { fields: ['title'], list: { key: 'contacts', fields: ['label', 'url'] } },
  'social-button': { fields: ['label', 'url'] },
  map: { fields: ['title', 'address', 'label', 'url'] },
  faq: { fields: ['title'], list: { key: 'items', fields: ['title', 'description'] } }, divider: {},
};

const avatarLayouts = ['centered', 'image-left', 'image-right', 'compact'] as const;

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

function AvatarLayoutPreview({ layout }: { layout: typeof avatarLayouts[number] }) {
  const image = <Box sx={{ width: layout === 'compact' ? 18 : 24, height: layout === 'image-right' ? 42 : layout === 'compact' ? 18 : 24,
    borderRadius: layout === 'centered' || layout === 'compact' ? '50%' : 1, bgcolor: 'primary.main', flex: '0 0 auto' }} />;
  const copy = <Stack spacing={0.5} sx={{ flex: 1, alignItems: layout === 'centered' || layout === 'compact' ? 'center' : 'stretch' }}>
    <Box sx={{ height: 5, width: layout === 'compact' ? '45%' : '70%', borderRadius: 1, bgcolor: 'text.primary' }} />
    <Box sx={{ height: 4, width: '90%', borderRadius: 1, bgcolor: 'text.disabled' }} />
  </Stack>;
  if (layout === 'image-left') {return <Stack direction="row" spacing={1} sx={{ alignItems: 'center', width: '100%' }}>{image}{copy}</Stack>;}
  if (layout === 'image-right') {return <Box sx={{ position: 'relative', width: '100%', height: 42 }}>{image}<Box sx={{ position: 'absolute', inset: 'auto 4px 4px', bgcolor: 'rgba(255,255,255,.8)', p: 0.5 }}>{copy}</Box></Box>;}
  return <Stack spacing={0.75} sx={{ alignItems: 'center', width: '100%' }}>{image}{copy}</Stack>;
}

export function SpecializedBlockEditor({
  block,
  onContentChange,
}: {
  block: PageBlock;
  onContentChange?: (content: BlockContent) => void;
}) {
  const { locale } = useI18n();
  const update = onContentChange ?? (() => undefined);
  const shape = editorShape[block.type] ?? {};
  const list = shape.list;
  const rows = list ? items(block.content[list.key]) : [];
  const addRow = (preset?: SocialPlatform) => {
    const fields = list?.fields ?? [];
    const row = Object.fromEntries(fields.map((field) => [field, '']));
    update({ ...block.content, [list!.key]: [...rows, {
      id: crypto.randomUUID(), ...row,
      ...(list!.key === 'links' && block.type === 'links' ? { action: { type: 'url', url: '' } } : {}),
      ...(preset ? { platform: preset, label: publicPageText(locale, `platform${preset[0].toUpperCase()}${preset.slice(1)}` as Parameters<typeof publicPageText>[1]), url: 'https://' } : {}),
    }] });
  };
  return (
    <Stack spacing={1.5}>
      {shape.fields?.map((field) => <Field key={field} field={field} value={block.content[field]}
        onChange={(value) => update({ ...block.content, [field]: value })} />)}
      {block.type === 'hero' && block.content.action && typeof block.content.action === 'object' && !Array.isArray(block.content.action)
        ? <ActionEditor value={block.content.action as Record<string, unknown>} onChange={(action) => update({ ...block.content, action })} /> : null}
      {block.type === 'button' && block.content.action && typeof block.content.action === 'object' && !Array.isArray(block.content.action)
        ? <><ActionEditor value={block.content.action as Record<string, unknown>} onChange={(action) => update({ ...block.content, action })} />
          <TextField select size="small" label={publicPageText(locale, 'buttonIcon')} value={text(block.content.icon)} onChange={(event) => update({ ...block.content, icon: event.target.value })}>
            <MenuItem value="">{publicPageText(locale, 'none')}</MenuItem>{(['link', 'phone', 'email', 'message'] as const).map((icon) => <MenuItem key={icon} value={icon}>{publicPageText(locale, `buttonIcon${icon[0].toUpperCase()}${icon.slice(1)}` as Parameters<typeof publicPageText>[1])}</MenuItem>)}</TextField>
          <TextField size="small" label={publicPageText(locale, 'buttonColor')} value={text(block.content.color)} onChange={(event) => update({ ...block.content, color: event.target.value })} />
          <TextField size="small" label={publicPageText(locale, 'buttonTextColor')} value={text(block.content.textColor)} onChange={(event) => update({ ...block.content, textColor: event.target.value })} /></> : null}
      {block.type === 'avatar' ? <Stack spacing={1}>
        <Typography variant="subtitle2" id={`avatar-layout-${block.id}`}>{publicPageText(locale, 'fieldLayout')}</Typography>
        <Box role="radiogroup" aria-labelledby={`avatar-layout-${block.id}`} sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
          {avatarLayouts.map((layout) => {
            const selected = text(block.content.layout, 'centered') === layout;
            const label = publicPageText(locale, `avatarLayout${layout.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()).replace(/^./, (letter) => letter.toUpperCase())}` as Parameters<typeof publicPageText>[1]);
            return <ButtonBase key={layout} role="radio" aria-checked={selected} aria-label={label}
              tabIndex={selected ? 0 : -1}
              onClick={() => update({ ...block.content, layout })}
              onKeyDown={(event) => selectAvatarLayoutWithKeyboard(event, layout, (nextLayout) => update({ ...block.content, layout: nextLayout }))}
              sx={{ display: 'block', borderRadius: 2, textAlign: 'left', outline: '2px solid transparent',
                '&:focus-visible': { outlineColor: 'primary.main', outlineOffset: 2 } }}>
              <Card variant="outlined" sx={{ height: '100%', borderColor: selected ? 'primary.main' : 'divider', borderWidth: selected ? 2 : 1,
                bgcolor: selected ? 'action.selected' : 'background.paper' }}>
                <CardContent sx={{ display: 'grid', gap: 1, p: 1.25, '&:last-child': { pb: 1.25 } }}>
                  <Box sx={{ height: 52, display: 'flex', alignItems: 'center' }}><AvatarLayoutPreview layout={layout} /></Box>
                  <Typography variant="caption" sx={{ fontWeight: selected ? 700 : 500 }}>{label}</Typography>
                </CardContent>
              </Card>
            </ButtonBase>;
          })}
        </Box>
      </Stack> : null}
      {list ? <Stack spacing={1}>
            <Typography variant="subtitle2">{publicPageText(locale, 'items')}</Typography>
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
                    [list.key]: rows.map((candidate, rowIndex) => rowIndex === index ? { ...candidate, action } : candidate),
                  })} />
                ) : null}
                <IconButton size="small" aria-label={publicPageText(locale, 'removeItem')}
                  onClick={() => update({ ...block.content, [list.key]: rows.filter((_, rowIndex) => rowIndex !== index) })}>
                  <Delete fontSize="small" />
                </IconButton>
              </Stack>
            ))}
            <Button size="small" startIcon={<Add />} onClick={() => addRow()}>{publicPageText(locale, 'addItem')}</Button>
          </Stack> : null}
    </Stack>
  );
}

export function HeroBlock({ block }: { block: PageBlock }) {
  return (
    <Surface block={block}>
      <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
        {text(block.content.imageUrl) && (
          <Box component="img" src={text(block.content.imageUrl)} alt={text(block.content.imageAlt)}
            sx={{ width: '100%', maxHeight: 420, objectFit: 'cover', borderRadius: 2 }} />
        )}
        <Typography component="h1" variant="h3">{text(block.content.title)}</Typography>
        {text(block.content.subtitle) && <Typography variant="h6">{text(block.content.subtitle)}</Typography>}
        <CtaButton label={text(block.content.ctaLabel)} action={block.content.action} />
      </Stack>
    </Surface>
  );
}

export function AvatarBlock({ block, mediaUrlFor }: { block: PageBlock; mediaUrlFor?: (mediaId: string) => string | undefined }) {
  const layout = text(block.content.layout, 'centered');
  const imageMediaId = text(block.content.imageMediaId);
  const imageUrl = (imageMediaId ? mediaUrlFor?.(imageMediaId) : undefined) ?? text(block.content.imageUrl);
  const copy = <Box sx={{ maxWidth: '100%', minWidth: 0 }}><Typography component="h1" variant={layout === 'compact' ? 'h5' : 'h4'} sx={wrappingTextSx}>{text(block.content.heading)}</Typography>
    {text(block.content.subtitle) ? <Typography sx={wrappingTextSx}>{text(block.content.subtitle)}</Typography> : null}</Box>;
  if (layout === 'image-right') {
    return <Box sx={{ position: 'relative', minHeight: 360, display: 'flex', alignItems: 'flex-end', overflow: 'hidden', minWidth: 0, maxWidth: '100%' }}>
      {imageUrl ? <Box component="img" src={imageUrl} alt={text(block.content.imageAlt)} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
      <Box sx={{ position: 'relative', width: '100%', p: 3, pt: 12, color: '#fff', background: 'linear-gradient(transparent, rgba(0,0,0,.72))' }}>{copy}</Box>
    </Box>;
  }
  if (layout === 'image-left') {
    return <Stack direction="row" spacing={2.5} sx={{ alignItems: 'center', textAlign: 'left', minWidth: 0, maxWidth: '100%' }}>
      {imageUrl ? <Box component="img" src={imageUrl} alt={text(block.content.imageAlt)} sx={{ width: 128, height: 128, borderRadius: 2, objectFit: 'cover', flex: '0 0 auto' }} /> : null}{copy}
    </Stack>;
  }
  if (layout === 'centered') {
    return <Box sx={{ textAlign: 'center', pt: imageUrl ? 7 : 2, mt: imageUrl ? 7 : 0, position: 'relative', minWidth: 0, maxWidth: '100%' }}>
      {imageUrl ? <Box component="img" src={imageUrl} alt={text(block.content.imageAlt)} sx={{ width: 128, height: 128, borderRadius: '50%', objectFit: 'cover', position: 'absolute', top: -64, left: '50%', transform: 'translateX(-50%)', border: '4px solid white' }} /> : null}{copy}
    </Box>;
  }
  return <Stack spacing={1} sx={{ alignItems: 'center', textAlign: 'center', minWidth: 0, maxWidth: '100%' }}>
    {imageUrl ? <Box component="img" src={imageUrl} alt={text(block.content.imageAlt)} sx={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} /> : null}{copy}
  </Stack>;
}

export function ButtonBlock({ block }: { block: PageBlock }) {
  const href = hrefFor(block.content.action);
  if (!href) {return null;}
  const external = /^https?:\/\//i.test(href);
  const icons = { link: <LinkIcon />, phone: <PhoneOutlined />, email: <EmailOutlined />, message: <ChatBubbleOutlined /> } as const;
  const icon = text(block.content.icon) as keyof typeof icons;
  return <Button component="a" href={href} target={external ? '_blank' : undefined} startIcon={icons[icon]}
    rel={external ? 'noopener noreferrer' : undefined} variant="contained" fullWidth
    sx={{ minHeight: 48, textTransform: 'none', bgcolor: text(block.content.color) || undefined, color: text(block.content.textColor) || undefined,
      borderRadius: 'var(--theme-link-border-radius, 24px)' }}>{text(block.content.label)}</Button>;
}

export function LinksBlock({ block }: { block: PageBlock }) {
  return <Surface block={block}><Stack spacing={1.5}>{items(block.content.links).map((item, index) =>
    <CtaButton key={text(item.id, String(index))} label={text(item.label)} action={item.action} />,
  )}</Stack></Surface>;
}

export function TextBlock({ block }: { block: PageBlock }) {
  return <Box sx={{ maxWidth: '100%', minWidth: 0 }}><Typography component="h2" variant="h5" gutterBottom sx={wrappingTextSx}>{text(block.content.title)}</Typography>
    <Typography sx={wrappingTextSx}>{text(block.content.body)}</Typography></Box>;
}

export function ImageBlock({ block, mediaUrlFor }: { block: PageBlock; mediaUrlFor?: (mediaId: string) => string | undefined }) {
  const mediaId = text(block.content.imageMediaId);
  const url = (mediaId ? mediaUrlFor?.(mediaId) : undefined) ?? text(block.content.url);
  return <Surface block={block}>{url && <Box component="img" src={url} alt={text(block.content.alt)}
    sx={{ display: 'block', width: '100%', height: 'auto', maxHeight: 560, objectFit: 'cover', borderRadius: 2 }} />}</Surface>;
}

export function GalleryBlock({ block, mediaUrlFor }: { block: PageBlock; mediaUrlFor?: (mediaId: string) => string | undefined }) {
  return <Surface block={block}><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, gap: 1.5 }}>
    {items(block.content.images).map((item, index) => <Box key={text(item.id, String(index))} component="img"
      src={(text(item.mediaId) ? mediaUrlFor?.(text(item.mediaId)) : undefined) ?? text(item.url)} alt={text(item.alt)} loading="lazy"
      sx={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 2 }} />)}
  </Box></Surface>;
}

function CardList({ block, field }: { block: PageBlock; field: string }) {
  return <Surface block={block}><Stack spacing={1.5}>{text(block.content.title) &&
    <Typography component="h2" variant="h5">{text(block.content.title)}</Typography>}
    {items(block.content[field]).map((item, index) => <Card key={text(item.id, String(index))} variant="outlined">
      <CardContent><Typography component="h3" variant="h6">{text(item.title, text(item.label))}</Typography>
        {text(item.description) && <Typography>{text(item.description)}</Typography>}
        {text(item.price) && <Typography sx={{ fontWeight: 700 }}>{text(item.price)}</Typography>}
      </CardContent></Card>)}
  </Stack></Surface>;
}

export const ServicesBlock = ({ block }: { block: PageBlock }) => <CardList block={block} field="services" />;
export const FaqBlock = ({ block }: { block: PageBlock }) => <CardList block={block} field="items" />;

function LinkList({ block, field, kind }: { block: PageBlock; field: string; kind: SafeLinkKind }) {
  return <Surface block={block}><Stack spacing={1}>{text(block.content.title) &&
    <Typography component="h2" variant="h5">{text(block.content.title)}</Typography>}
    {items(block.content[field]).map((item, index) => {
      const href = normalizeSafeHref(item.url, kind);
      if (!href) {
        return null;
      }
      const external = /^https?:\/\//i.test(href);
      return <Link key={text(item.id, String(index))} href={href} target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined} sx={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
        {text(item.label)}
      </Link>;
    })}
  </Stack></Surface>;
}

export const ContactsBlock = ({ block }: { block: PageBlock }) =>
  <LinkList block={block} field="contacts" kind="contact" />;
export function SocialButtonBlock({ block }: { block: PageBlock }) {
  const platform = block.content.platform as SocialPlatform;
  const href = normalizeSafeHref(block.content.url, 'web');
  if (!href || !SOCIAL_PLATFORMS.includes(platform)) {return null;}
  const style = socialPlatformStyles[platform];
  return <Button component="a" href={href} target="_blank" rel="noopener noreferrer" fullWidth data-social-button={platform}
    sx={{ position: 'relative', minHeight: 52, px: 6, width: '100%', borderRadius: 'var(--theme-link-border-radius, 40px)',
      textTransform: 'var(--theme-link-title-transform, none)', fontFamily: 'var(--theme-link-title-font-family, Inter, sans-serif)',
      fontSize: 'var(--theme-link-title-fontsize, 16px)', lineHeight: 'var(--theme-link-title-lineheight, 1.2)',
      letterSpacing: 'var(--theme-link-title-letterspacing, 0px)', fontWeight: 'var(--theme-link-title-font-weight, 500)',
      borderWidth: 'var(--theme-link-border-width, 0px)', boxShadow: 'var(--theme-link-shadow-params, none)',
      background: style.background, color: style.color, '&:hover': { background: style.background, filter: 'brightness(.94)' } }}>
    <SocialPlatformIcon className="social-button__icon" platform={platform} aria-hidden="true"
      sx={{ position: 'absolute', left: 18, width: 24, height: 24, color: style.iconColor }} />
    <Box component="span" className="social-button__label" sx={{ width: '100%', textAlign: 'center' }}>{text(block.content.label)}</Box>
  </Button>;
}

export function MapBlock({ block }: { block: PageBlock }) {
  const url = normalizeSafeHref(block.content.url, 'web');
  return <Surface block={block}><Typography component="h2" variant="h5">{text(block.content.title)}</Typography>
    <Typography>{text(block.content.address)}</Typography>{url && <Link href={url} target="_blank" rel="noopener noreferrer"
      sx={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>{text(block.content.label, text(block.content.address))}</Link>}</Surface>;
}

export function DividerBlock({ block }: { block: PageBlock }) {
  return <Surface block={block}><Divider sx={{ borderColor: 'currentColor', opacity: 0.35 }} /></Surface>;
}
