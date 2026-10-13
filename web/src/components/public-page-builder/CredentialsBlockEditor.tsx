import AddRounded from '@mui/icons-material/AddRounded';
import ArrowDownward from '@mui/icons-material/ArrowDownward';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import { Button, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import {
  credentialItems,
  isValidCredentialYear,
  MAX_CREDENTIAL_ORGANIZATION_LENGTH,
  MAX_CREDENTIAL_TITLE_LENGTH,
  MAX_CREDENTIALS,
  type CredentialItem,
} from '../../features/public-page-builder/model/credentials';
import type { BlockContent, PageBlock } from '../../features/public-page-builder/types/publicPage';
import type { Locale } from '../../shared/i18n/dictionaries';
import { publicPageText } from './uiText';

export function CredentialsBlockEditor({ block, locale, onContentChange, onRemoveItem, renderImageControl }: {
  block: PageBlock;
  locale: Locale;
  onContentChange: (content: BlockContent) => void;
  onRemoveItem: (itemId: string) => void;
  renderImageControl: (item: CredentialItem, index: number) => ReactNode;
}) {
  const items = credentialItems(block.content);
  const title = typeof block.content.title === 'string' ? block.content.title : '';
  const setItems = (next: CredentialItem[]) => onContentChange({ ...block.content, items: next });
  const updateItem = (itemId: string, changes: Partial<CredentialItem>) => setItems(
    items.map((item) => item.id === itemId ? { ...item, ...changes } : item),
  );
  const move = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= items.length) {return;}
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  };
  const add = () => setItems([...items, { id: crypto.randomUUID(), imageMediaId: null, alt: '', title: '', organization: '', year: '' }]);
  return <Stack spacing={2}>
    <TextField size="small" fullWidth label={publicPageText(locale, 'fieldTitle')} value={title}
      slotProps={{ htmlInput: { maxLength: 120 } }}
      onChange={(event) => onContentChange({ ...block.content, title: event.target.value })} />
    {items.length === 0 ? <Typography color="text.secondary">{publicPageText(locale, 'credentialsEmpty')}</Typography> : null}
    {items.map((item, index) => <Stack key={item.id} spacing={1.5} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          {publicPageText(locale, 'credentialsItem').replace('{number}', String(index + 1))}
        </Typography>
        <Tooltip title={publicPageText(locale, 'moveUp')}><span><IconButton size="small" disabled={index === 0}
          aria-label={publicPageText(locale, 'moveUp')} onClick={() => move(index, -1)}><ArrowUpward fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip title={publicPageText(locale, 'moveDown')}><span><IconButton size="small" disabled={index === items.length - 1}
          aria-label={publicPageText(locale, 'moveDown')} onClick={() => move(index, 1)}><ArrowDownward fontSize="small" /></IconButton></span></Tooltip>
        <IconButton size="small" aria-label={publicPageText(locale, 'removeItem')}
          onClick={() => onRemoveItem(item.id)}><DeleteOutlined fontSize="small" /></IconButton>
      </Stack>
      {renderImageControl(item, index)}
      <TextField size="small" fullWidth required label={publicPageText(locale, 'credentialsItemTitle')} value={item.title}
        slotProps={{ htmlInput: { maxLength: MAX_CREDENTIAL_TITLE_LENGTH } }}
        onChange={(event) => updateItem(item.id, { title: event.target.value })} />
      <TextField size="small" fullWidth label={publicPageText(locale, 'credentialsOrganization')} value={item.organization}
        slotProps={{ htmlInput: { maxLength: MAX_CREDENTIAL_ORGANIZATION_LENGTH } }}
        onChange={(event) => updateItem(item.id, { organization: event.target.value })} />
      <TextField size="small" fullWidth label={publicPageText(locale, 'credentialsYear')} value={item.year}
        error={!isValidCredentialYear(item.year)} helperText={publicPageText(locale, 'credentialsYearHelper')}
        slotProps={{ htmlInput: { maxLength: 4, inputMode: 'numeric' } }}
        onChange={(event) => updateItem(item.id, { year: event.target.value })} />
    </Stack>)}
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Button size="small" startIcon={<AddRounded />} disabled={items.length >= MAX_CREDENTIALS} onClick={add}>
        {publicPageText(locale, 'credentialsAddItem')}
      </Button>
      <Typography variant="caption" color="text.secondary">
        {publicPageText(locale, 'credentialsCount').replace('{count}', String(items.length)).replace('{max}', String(MAX_CREDENTIALS))}
      </Typography>
    </Stack>
  </Stack>;
}
