import { Button, Stack, Typography } from '@mui/material';
import { getBlockDefinitions } from '../../features/public-page-builder/model/blockRegistry';
import type { Locale } from '../../shared/i18n/dictionaries';
import { publicPageText } from './uiText';

export function BlockLibrary({ locale, onAdd }: { locale: Locale; onAdd: (type: string) => void }) {
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">{publicPageText(locale, 'blocks')}</Typography>
      {getBlockDefinitions().map((definition) => (
        <Button key={definition.type} size="small" variant="outlined" onClick={() => onAdd(definition.type)}>
          {definition.name}
        </Button>
      ))}
    </Stack>
  );
}
