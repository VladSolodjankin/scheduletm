import ArrowDownward from '@mui/icons-material/ArrowDownward';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import OpenInNew from '@mui/icons-material/OpenInNew';
import GridView from '@mui/icons-material/GridView';
import Refresh from '@mui/icons-material/Refresh';
import ViewCarousel from '@mui/icons-material/ViewCarousel';
import ViewList from '@mui/icons-material/ViewList';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  ToggleButton,
  ToggleButtonGroup,
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
import type { BlockContent, PageBlock, ServicesLayout } from '../../features/public-page-builder/types/publicPage';
import type { Locale } from '../../shared/i18n/dictionaries';
import { translate } from '../../shared/i18n/translate';

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
  const servicesLayout: ServicesLayout = block.content.layout === 'grid' || block.content.layout === 'list' ? block.content.layout : 'carousel';
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
    update({ serviceIds: temporaryIds.slice(0, MAX_PUBLIC_PAGE_SERVICES) });
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
    <TextField size="small" fullWidth label={translate(locale, 'publicPageBuilder.fieldTitle')}
      value={typeof block.content.title === 'string' ? block.content.title : ''}
      slotProps={{ htmlInput: { maxLength: 100 } }}
      onChange={(event) => update({ title: event.target.value })} />
    {error ? <Alert severity="warning" action={<Button onClick={onRefresh}>{translate(locale, 'publicPageBuilder.retry')}</Button>}>
      {translate(locale, 'publicPageBuilder.servicesLoadError')}
    </Alert> : null}
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
      <Button variant="outlined" onClick={openSelection}>{translate(locale, 'publicPageBuilder.chooseServices')}</Button>
      <Button component="a" href="/services?create=1" target="_blank" rel="noopener noreferrer" startIcon={<OpenInNew />}>
        {translate(locale, 'publicPageBuilder.addService')}
      </Button>
      <Button startIcon={<Refresh />} onClick={onRefresh} disabled={loading}>
        {translate(locale, 'publicPageBuilder.refreshServices')}
      </Button>
    </Stack>
    <Stack spacing={1}>
      <Typography variant="subtitle2">{translate(locale, 'publicPageBuilder.selectedServices')}</Typography>
      {ids.length === 0 ? <Typography color="text.secondary">{translate(locale, 'publicPageBuilder.servicesNoneSelected')}</Typography> : ids.map((id, index) => {
        const service = catalogById.get(id);
        const unavailable = !service || !catalog || !isServiceSelectable(service, catalog);
        return <Stack key={id} direction="row" spacing={0.75} sx={{ alignItems: 'center', border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ overflowWrap: 'anywhere' }}>{service?.name ?? `#${id}`}</Typography>
            {unavailable ? <Typography variant="caption" color="warning.main">{translate(locale, 'publicPageBuilder.servicesUnavailable')}</Typography> : null}
          </Stack>
          {service ? <Tooltip title={translate(locale, 'publicPageBuilder.editService')}><IconButton component="a" href={`/services?edit=${id}`}
            target="_blank" rel="noopener noreferrer" size="small" aria-label={translate(locale, 'publicPageBuilder.editService')}><EditOutlined fontSize="small" /></IconButton></Tooltip> : null}
          <Tooltip title={translate(locale, 'publicPageBuilder.moveUp')}><span><IconButton size="small" disabled={index === 0}
            aria-label={translate(locale, 'publicPageBuilder.moveUp')} onClick={() => move(index, -1)}><ArrowUpward fontSize="small" /></IconButton></span></Tooltip>
          <Tooltip title={translate(locale, 'publicPageBuilder.moveDown')}><span><IconButton size="small" disabled={index === ids.length - 1}
            aria-label={translate(locale, 'publicPageBuilder.moveDown')} onClick={() => move(index, 1)}><ArrowDownward fontSize="small" /></IconButton></span></Tooltip>
          <IconButton size="small" aria-label={translate(locale, 'publicPageBuilder.removeItem')}
            onClick={() => update({ serviceIds: ids.filter((candidate) => candidate !== id) })}><DeleteOutlined fontSize="small" /></IconButton>
        </Stack>;
      })}
    </Stack>
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
      <Typography variant="body2">{translate(locale, 'publicPageBuilder.servicesLayout')}</Typography>
      <ToggleButtonGroup exclusive size="small" aria-label={translate(locale, 'publicPageBuilder.servicesLayout')} value={servicesLayout}
        onChange={(_event, next: ServicesLayout | null) => { if (next) {update({ layout: next });} }}>
        <Tooltip title={translate(locale, 'publicPageBuilder.servicesLayoutCarousel')}><ToggleButton value="carousel" aria-label={translate(locale, 'publicPageBuilder.servicesLayoutCarousel')}><ViewCarousel fontSize="small" /></ToggleButton></Tooltip>
        <Tooltip title={translate(locale, 'publicPageBuilder.servicesLayoutGrid')}><ToggleButton value="grid" aria-label={translate(locale, 'publicPageBuilder.servicesLayoutGrid')}><GridView fontSize="small" /></ToggleButton></Tooltip>
        <Tooltip title={translate(locale, 'publicPageBuilder.servicesLayoutList')}><ToggleButton value="list" aria-label={translate(locale, 'publicPageBuilder.servicesLayoutList')}><ViewList fontSize="small" /></ToggleButton></Tooltip>
      </ToggleButtonGroup>
    </Stack>
    {servicesLayout === 'carousel' ? <>
    <FormControlLabel control={<Switch checked={block.content.autoplayIntervalSeconds !== null && block.content.autoplayIntervalSeconds !== undefined}
      onChange={(_, checked) => {
        if (checked) {setAutoplaySecondsInput('5');}
        update({ autoplayIntervalSeconds: checked ? 5 : null });
      }} />} label={translate(locale, 'publicPageBuilder.servicesAutoplay')} />
    {block.content.autoplayIntervalSeconds !== null && block.content.autoplayIntervalSeconds !== undefined ? <TextField size="small" type="number"
      label={translate(locale, 'publicPageBuilder.servicesAutoplaySeconds')} value={autoplaySecondsInput}
      slotProps={{ htmlInput: { min: 3, max: 30, step: 1 } }}
      onChange={(event) => setAutoplaySecondsInput(event.target.value)} onBlur={commitAutoplaySeconds} /> : null}
    </> : null}
    <FormControlLabel control={<Switch checked={block.content.showBookingButton !== false}
      onChange={(_, checked) => update({ showBookingButton: checked })} />} label={translate(locale, 'publicPageBuilder.showBookingButton')} />
    <Dialog open={selectionOpen} onClose={() => setSelectionOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>{translate(locale, 'publicPageBuilder.servicesSelectionTitle')}</DialogTitle>
      <DialogContent dividers>
        {loading ? <Typography>{translate(locale, 'publicPageBuilder.servicesLoading')}</Typography> : null}
        {!loading && (catalog?.services.length ?? 0) === 0 ? <Typography color="text.secondary">{translate(locale, 'publicPageBuilder.servicesCatalogEmpty')}</Typography> : null}
        <List disablePadding>
          {(catalog?.services ?? []).map((service) => {
            const checked = temporaryIds.includes(service.id);
            const available = isServiceSelectable(service, catalog!);
            const disabled = (!available && !checked) || (!checked && temporaryIds.length >= MAX_PUBLIC_PAGE_SERVICES);
            return <ListItem key={service.id} disablePadding secondaryAction={!available ? <Typography variant="caption" color="warning.main">
              {translate(locale, 'publicPageBuilder.servicesUnavailable')}</Typography> : null}>
              <ListItemButton disabled={disabled} onClick={() => setTemporaryIds((current) => checked
                ? current.filter((id) => id !== service.id) : [...current, service.id])}>
                <Checkbox edge="start" checked={checked} tabIndex={-1} disableRipple />
                <ListItemText primary={service.name} secondary={`${service.basePrice} · ${service.baseDurationMinutes} ${translate(locale, 'publicPageBuilder.serviceMinutes')}`} />
              </ListItemButton>
            </ListItem>;
          })}
        </List>
        <Typography variant="caption" color="text.secondary">{translate(locale, 'publicPageBuilder.servicesSelectionLimit').replace('{count}', String(MAX_PUBLIC_PAGE_SERVICES))}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setSelectionOpen(false)}>{translate(locale, 'publicPageBuilder.cancel')}</Button>
        <Button variant="contained" onClick={confirmSelection}>{translate(locale, 'publicPageBuilder.confirmSelection')}</Button>
      </DialogActions>
    </Dialog>
  </Stack>;
}
