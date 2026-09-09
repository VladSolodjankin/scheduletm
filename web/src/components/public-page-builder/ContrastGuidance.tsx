import { CheckCircleOutlined, ErrorOutlined, HelpOutlined } from '@mui/icons-material';
import { Box, List, ListItem, ListItemIcon, ListItemText, Paper, Stack, Typography } from '@mui/material';
import { useId } from 'react';
import type { ContrastCheck, ContrastStatus, ContrastUnknownReason } from '../../features/public-page-builder/model/contrast';
import type { Locale } from '../../shared/i18n/dictionaries';
import { publicPageText, type PublicPageUiKey } from './uiText';

const labelKeys: Record<string, PublicPageUiKey> = {
  'page.heading': 'contrastPageHeading',
  'page.text': 'contrastPageText',
  'page.link-title': 'contrastLinkTitle',
  'page.link-subtitle': 'contrastLinkSubtitle',
  'section.heading': 'contrastSectionHeading',
  'section.text': 'contrastSectionText',
  'section.link-title': 'contrastLinkTitle',
  'section.link-subtitle': 'contrastLinkSubtitle',
  'block.heading': 'contrastBlockHeading',
  'block.text': 'contrastBlockText',
  'block.link-title': 'contrastLinkTitle',
  'block.link-subtitle': 'contrastLinkSubtitle',
  'block.card-heading': 'contrastCardHeading',
  'block.card-text': 'contrastCardText',
  'block.card-link-title': 'contrastCardLinkTitle',
  'block.card-content': 'contrastCardContent',
};

const statusKeys: Record<ContrastStatus, PublicPageUiKey> = {
  pass: 'contrastPass',
  fail: 'contrastFail',
  unknown: 'contrastUnknown',
};

const reasonKeys: Record<ContrastUnknownReason, PublicPageUiKey> = {
  'background-image': 'contrastImageReason',
  'background-preset': 'contrastPresetReason',
  'unsupported-color': 'contrastColorReason',
  'unknown-surface': 'contrastSurfaceReason',
  'nested-surface': 'contrastNestedReason',
};

function StatusIcon({ status }: { status: ContrastStatus }) {
  if (status === 'pass') {return <CheckCircleOutlined aria-hidden color="success" fontSize="small" />;}
  if (status === 'fail') {return <ErrorOutlined aria-hidden color="error" fontSize="small" />;}
  return <HelpOutlined aria-hidden color="warning" fontSize="small" />;
}

function formatRatio(locale: Locale, check: ContrastCheck): string {
  if (check.ratio === null) {return publicPageText(locale, 'contrastRatioUnknown').replace('{minimum}', String(check.minimum));}
  return publicPageText(locale, 'contrastRatio')
    .replace('{ratio}', check.ratio.toFixed(2))
    .replace('{minimum}', String(check.minimum));
}

export function ContrastGuidance({ checks, locale }: { checks: readonly ContrastCheck[]; locale: Locale }) {
  const titleId = useId();
  if (checks.length === 0) {return null;}
  return <Paper component="section" variant="outlined" aria-labelledby={titleId} data-public-page-contrast-guidance sx={{ p: 1.5 }}>
    <Stack spacing={0.75}>
      <Typography id={titleId} variant="subtitle2" sx={{ fontWeight: 700 }}>{publicPageText(locale, 'contrastGuidance')}</Typography>
      <Typography variant="caption" color="text.secondary">{publicPageText(locale, 'contrastGuidanceDescription')}</Typography>
      <List dense disablePadding aria-live="polite" aria-atomic="true">
        {checks.map((check) => {
          const label = publicPageText(locale, labelKeys[check.id] ?? 'contrastText');
          const status = publicPageText(locale, statusKeys[check.status]);
          const reason = check.reason ? publicPageText(locale, reasonKeys[check.reason]) : null;
          return <ListItem key={check.id} disableGutters alignItems="flex-start" data-contrast-status={check.status}>
            <ListItemIcon sx={{ minWidth: 30, pt: 0.25 }}><StatusIcon status={check.status} /></ListItemIcon>
            <ListItemText
              primary={<Box component="span" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
                <Typography component="span" variant="body2">— {status}</Typography>
              </Box>}
              secondary={`${formatRatio(locale, check)}${reason ? ` · ${reason}` : ''}`}
              slotProps={{ secondary: { component: 'span' } }}
            />
          </ListItem>;
        })}
      </List>
    </Stack>
  </Paper>;
}
