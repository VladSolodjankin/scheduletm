import {
  Box,
  Button,
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
import { Add, Delete } from '@mui/icons-material';
import type { ReactNode } from 'react';
import type {
  BlockContent,
  CtaAction,
  PageBlock,
} from '../../features/public-page-builder/types/publicPage';
import { ctaActionToHref } from '../../features/public-page-builder/model/cta';
import { useI18n } from '../../shared/i18n/I18nContext';
import { publicPageText } from '../public-page-builder/uiText';

export type Item = Record<string, unknown>;

export const text = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;
export const items = (value: unknown): Item[] =>
  Array.isArray(value) ? value.filter((item): item is Item => Boolean(item) && typeof item === 'object') : [];
export const required = (content: BlockContent, ...keys: string[]): string[] =>
  keys.filter((key) => !text(content[key]).trim()).map((key) => `${key} is required`);
const hasValue = (value: unknown): boolean =>
  typeof value === 'string' ? Boolean(value.trim()) : value !== null && value !== undefined;
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

function Surface({ block, children }: { block: PageBlock; children: ReactNode }) {
  return (
    <Box
      sx={{
        bgcolor: block.design.backgroundColor ?? 'transparent',
        color: block.design.textColor ?? 'inherit',
        borderRadius: 3,
        p: { xs: 2, sm: 3 },
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

function scalarFields(
  value: Record<string, unknown>,
  onChange: (next: Record<string, unknown>) => void,
) {
  return Object.entries(value).filter(([, item]) => typeof item === 'string').map(([key, item]) => (
    <TextField
      key={key}
      label={key}
      value={item}
      size="small"
      multiline={key === 'body' || key === 'description'}
      onChange={(event) => onChange({ ...value, [key]: event.target.value })}
    />
  ));
}

function ActionEditor({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const type = typeof value.type === 'string' ? value.type : 'url';
  const field = type === 'phone' ? 'phone' : type === 'email' ? 'email' : 'url';
  return (
    <Stack direction="row" spacing={1}>
      <TextField select size="small" label="action" value={type}
        onChange={(event) => onChange({ type: event.target.value, [event.target.value === 'phone' ? 'phone' : event.target.value === 'email' ? 'email' : 'url']: '' })}>
        {['url', 'phone', 'email', 'messenger'].map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
      </TextField>
      <TextField size="small" label={field} value={text(value[field])}
        onChange={(event) => onChange({ ...value, [field]: event.target.value })} />
    </Stack>
  );
}

export function GenericBlockEditor({
  block,
  onContentChange,
}: {
  block: PageBlock;
  onContentChange?: (content: BlockContent) => void;
}) {
  const { locale } = useI18n();
  const update = onContentChange ?? (() => undefined);
  return (
    <Stack spacing={1}>
      {scalarFields(block.content, update)}
      {Object.entries(block.content).map(([key, value]) => {
        if (key === 'action' && value && typeof value === 'object' && !Array.isArray(value)) {
          return <ActionEditor key={key} value={value as Record<string, unknown>}
            onChange={(action) => update({ ...block.content, action })} />;
        }
        if (!Array.isArray(value)) {return null;}
        const rows = items(value);
        return (
          <Stack key={key} spacing={1}>
            <Typography variant="subtitle2">{key}</Typography>
            {rows.map((row, index) => (
              <Stack key={text(row.id, String(index))} spacing={1}
                sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
                {scalarFields(row, (nextRow) => update({
                  ...block.content,
                  [key]: rows.map((candidate, rowIndex) => rowIndex === index ? nextRow : candidate),
                }))}
                {row.action && typeof row.action === 'object' && !Array.isArray(row.action) ? (
                  <ActionEditor value={row.action as Record<string, unknown>} onChange={(action) => update({
                    ...block.content,
                    [key]: rows.map((candidate, rowIndex) => rowIndex === index ? { ...candidate, action } : candidate),
                  })} />
                ) : null}
                <IconButton size="small" aria-label={`Remove ${key} item`}
                  onClick={() => update({ ...block.content, [key]: rows.filter((_, rowIndex) => rowIndex !== index) })}>
                  <Delete fontSize="small" />
                </IconButton>
              </Stack>
            ))}
            <Button size="small" startIcon={<Add />} onClick={() => {
              const sample = rows[0] ?? { label: '', url: '' };
              update({
                ...block.content,
                [key]: [...rows, Object.fromEntries(Object.keys(sample).map((field) => [
                  field,
                  field === 'id' ? crypto.randomUUID() : field === 'action' ? { type: 'url', url: '' } : '',
                ]))],
              });
            }}>{publicPageText(locale, 'addItem')}</Button>
          </Stack>
        );
      })}
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

export function LinksBlock({ block }: { block: PageBlock }) {
  return <Surface block={block}><Stack spacing={1.5}>{items(block.content.links).map((item, index) =>
    <CtaButton key={text(item.id, String(index))} label={text(item.label)} action={item.action} />,
  )}</Stack></Surface>;
}

export function TextBlock({ block }: { block: PageBlock }) {
  return <Surface block={block}><Typography component="h2" variant="h5" gutterBottom>{text(block.content.title)}</Typography>
    <Typography sx={{ whiteSpace: 'pre-wrap' }}>{text(block.content.body)}</Typography></Surface>;
}

export function ImageBlock({ block }: { block: PageBlock }) {
  const url = text(block.content.url);
  return <Surface block={block}>{url && <Box component="img" src={url} alt={text(block.content.alt)}
    sx={{ display: 'block', width: '100%', height: 'auto', maxHeight: 560, objectFit: 'cover', borderRadius: 2 }} />}</Surface>;
}

export function GalleryBlock({ block }: { block: PageBlock }) {
  return <Surface block={block}><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, gap: 1.5 }}>
    {items(block.content.images).map((item, index) => <Box key={text(item.id, String(index))} component="img"
      src={text(item.url)} alt={text(item.alt)} loading="lazy"
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
export const SocialsBlock = ({ block }: { block: PageBlock }) =>
  <LinkList block={block} field="links" kind="web" />;
export const MessengersBlock = ({ block }: { block: PageBlock }) =>
  <LinkList block={block} field="links" kind="web" />;

export function MapBlock({ block }: { block: PageBlock }) {
  const url = normalizeSafeHref(block.content.url, 'web');
  return <Surface block={block}><Typography component="h2" variant="h5">{text(block.content.title)}</Typography>
    <Typography>{text(block.content.address)}</Typography>{url && <Link href={url} target="_blank" rel="noopener noreferrer"
      sx={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>{text(block.content.label, text(block.content.address))}</Link>}</Surface>;
}

export function DividerBlock({ block }: { block: PageBlock }) {
  return <Surface block={block}><Divider sx={{ borderColor: 'currentColor', opacity: 0.35 }} /></Surface>;
}
