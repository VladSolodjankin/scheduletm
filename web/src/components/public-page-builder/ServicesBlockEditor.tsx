import ArrowDownward from '@mui/icons-material/ArrowDownward';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import OpenInNew from '@mui/icons-material/OpenInNew';
import Refresh from '@mui/icons-material/Refresh';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import type { ServicesResponse } from '../services/types';
import { isServiceSelectable, MAX_PUBLIC_PAGE_SERVICES } from '../../features/public-page-builder/model/services';
import type { BlockContent, PageBlock } from '../../features/public-page-builder/types/publicPage';
import type { Locale } from '../../shared/i18n/dictionaries';
import { publicPageText } from './uiText';

function selectedIds(content: BlockContent): number[] {
  return Array.isArray(content.serviceIds)
    ? content.serviceIds.filter((id): id is number => Number.isInteger(id) && Number(id) > 0)
    : [];
}

export function ServicesBlockEditor({ block, locale, catalog, loading, error, onRefresh, onContentChange }: {
  block: PageBlock;
  locale: Locale;
  catalog: ServicesResponse | null;
  loading: boolean;
  error: boolean;
  onRefresh: () => void;
  onContentChange: (content: BlockContent) => void;
}) {
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [temporaryIds, setTemporaryIds] = useState<number[]>([]);
  const [autoplaySecondsInput, setAutoplaySecondsInput] = useState(() => {
    const value = block.content.autoplayIntervalSeconds;
    return Number.isInteger(value) && Number(value) >= 3 && Number(value) <= 30 ? String(value) : '5';
  });
  const ids = selectedIds(block.content);
  const catalogById = useMemo(() => new Map((catalog?.services ?? []).map((service) => [service.id, service])), [catalog]);
  const openSelection = () => {
    setTemporaryIds(ids);
    setSelectionOpen(true);
  };
  const update = (changes: BlockContent) => onContentChange({ ...block.content, ...changes });
  const move = (index: number, offset: -1 | 1) => {
    const next = [...ids];
    const target = index + offset;
    if (target < 0 || target >= next.length) {return;}
    [next[index], next[target]] = [next[target], next[index]];
    update({ serviceIds: next });
  };
  const confirmSelection = () => {
    onContentChange({
      title: typeof block.content.title === 'string' ? block.content.title : '',
      serviceIds: temporaryIds.slice(0, MAX_PUBLIC_PAGE_SERVICES),
      autoplayIntervalSeconds: Number.isInteger(block.content.autoplayIntervalSeconds) ? block.content.autoplayIntervalSeconds : null,
      showBookingButton: typeof block.content.showBookingButton === 'boolean' ? block.content.showBookingButton : true,
    });
    setSelectionOpen(false);
  };
  const commitAutoplaySeconds = () => {
    const current = Number(block.content.autoplayIntervalSeconds);
    const fallback = Number.isInteger(current) && current >= 3 && current <= 30 ? current : 5;
    const parsed = Number(autoplaySecondsInput.trim());
    const next = autoplaySecondsInput.trim() && Number.isFinite(parsed)
      ? Math.min(30, Math.max(3, Math.round(parsed))) : fallback;
    setAutoplaySecondsInput(String(next));
    update({ autoplayIntervalSeconds: next });
  };
  return <Stack spacing={2}>
    <TextField size="small" fullWidth label={publicPageText(locale, 'fieldTitle')}
      value={typeof block.content.title === 'string' ? block.content.title : ''}
      slotProps={{ htmlInput: { maxLength: 100 } }}
      onChange={(event) => update({ title: event.target.value })} />
    {error ? <Alert severity="warning" action={<Button onClick={onRefresh}>{publicPageText(locale, 'retry')}</Button>}>
      {publicPageText(locale, 'servicesLoadError')}
    </Alert> : null}
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
      <Button variant="outlined" onClick={openSelection}>{publicPageText(locale, 'chooseServices')}</Button>
      <Button component="a" href="/services?create=1" target="_blank" rel="noopener noreferrer" startIcon={<OpenInNew />}>
        {publicPageText(locale, 'addService')}
      </Button>
      <Button startIcon={<Refresh />} onClick={onRefresh} disabled={loading}>
        {publicPageText(locale, 'refreshServices')}
      </Button>
    </Stack>
    <Stack spacing={1}>
      <Typography variant="subtitle2">{publicPageText(locale, 'selectedServices')}</Typography>
      {ids.length === 0 ? <Typography color="text.secondary">{publicPageText(locale, 'servicesNoneSelected')}</Typography> : ids.map((id, index) => {
        const service = catalogById.get(id);
        const unavailable = !service || !catalog || !isServiceSelectable(service, catalog);
        return <Stack key={id} direction="row" spacing={0.75} sx={{ alignItems: 'center', border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ overflowWrap: 'anywhere' }}>{service?.name ?? `#${id}`}</Typography>
            {unavailable ? <Typography variant="caption" color="warning.main">{publicPageText(locale, 'servicesUnavailable')}</Typography> : null}
          </Stack>
          {service ? <Tooltip title={publicPageText(locale, 'editService')}><IconButton component="a" href={`/services?edit=${id}`}
            target="_blank" rel="noopener noreferrer" size="small" aria-label={publicPageText(locale, 'editService')}><EditOutlined fontSize="small" /></IconButton></Tooltip> : null}
          <Tooltip title={publicPageText(locale, 'moveUp')}><span><IconButton size="small" disabled={index === 0}
            aria-label={publicPageText(locale, 'moveUp')} onClick={() => move(index, -1)}><ArrowUpward fontSize="small" /></IconButton></span></Tooltip>
          <Tooltip title={publicPageText(locale, 'moveDown')}><span><IconButton size="small" disabled={index === ids.length - 1}
            aria-label={publicPageText(locale, 'moveDown')} onClick={() => move(index, 1)}><ArrowDownward fontSize="small" /></IconButton></span></Tooltip>
          <IconButton size="small" aria-label={publicPageText(locale, 'removeItem')}
            onClick={() => update({ serviceIds: ids.filter((candidate) => candidate !== id) })}><DeleteOutlined fontSize="small" /></IconButton>
        </Stack>;
      })}
    </Stack>
    <FormControlLabel control={<Switch checked={block.content.autoplayIntervalSeconds !== null && block.content.autoplayIntervalSeconds !== undefined}
      onChange={(_, checked) => {
        if (checked) {setAutoplaySecondsInput('5');}
        update({ autoplayIntervalSeconds: checked ? 5 : null });
      }} />} label={publicPageText(locale, 'servicesAutoplay')} />
    {block.content.autoplayIntervalSeconds !== null && block.content.autoplayIntervalSeconds !== undefined ? <TextField size="small" type="number"
      label={publicPageText(locale, 'servicesAutoplaySeconds')} value={autoplaySecondsInput}
      slotProps={{ htmlInput: { min: 3, max: 30, step: 1 } }}
      onChange={(event) => setAutoplaySecondsInput(event.target.value)} onBlur={commitAutoplaySeconds} /> : null}
    <FormControlLabel control={<Switch checked={block.content.showBookingButton !== false}
      onChange={(_, checked) => update({ showBookingButton: checked })} />} label={publicPageText(locale, 'showBookingButton')} />
    <Dialog open={selectionOpen} onClose={() => setSelectionOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>{publicPageText(locale, 'servicesSelectionTitle')}</DialogTitle>
      <DialogContent dividers>
        {loading ? <Typography>{publicPageText(locale, 'servicesLoading')}</Typography> : null}
        {!loading && (catalog?.services.length ?? 0) === 0 ? <Typography color="text.secondary">{publicPageText(locale, 'servicesCatalogEmpty')}</Typography> : null}
        <List disablePadding>
          {(catalog?.services ?? []).map((service) => {
            const checked = temporaryIds.includes(service.id);
            const available = isServiceSelectable(service, catalog!);
            const disabled = (!available && !checked) || (!checked && temporaryIds.length >= MAX_PUBLIC_PAGE_SERVICES);
            return <ListItem key={service.id} disablePadding secondaryAction={!available ? <Typography variant="caption" color="warning.main">
              {publicPageText(locale, 'servicesUnavailable')}</Typography> : null}>
              <ListItemButton disabled={disabled} onClick={() => setTemporaryIds((current) => checked
                ? current.filter((id) => id !== service.id) : [...current, service.id])}>
                <Checkbox edge="start" checked={checked} tabIndex={-1} disableRipple />
                <ListItemText primary={service.name} secondary={`${service.basePrice} · ${service.baseDurationMinutes} ${publicPageText(locale, 'serviceMinutes')}`} />
              </ListItemButton>
            </ListItem>;
          })}
        </List>
        <Typography variant="caption" color="text.secondary">{publicPageText(locale, 'servicesSelectionLimit').replace('{count}', String(MAX_PUBLIC_PAGE_SERVICES))}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setSelectionOpen(false)}>{publicPageText(locale, 'cancel')}</Button>
        <Button variant="contained" onClick={confirmSelection}>{publicPageText(locale, 'confirmSelection')}</Button>
      </DialogActions>
    </Dialog>
  </Stack>;
}
