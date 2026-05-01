import { Stack, Typography } from '@mui/material';
import { useMemo } from 'react';

import { CroshairMap } from '../map/CroshairMap';
import { MapStore, type MapCoordinates } from '../map/mapStore';

type Props = {
  initialCoordinates: MapCoordinates | null;
  onSave: (coordinates: MapCoordinates) => void;
  saveLabel: string;
  hintLabel: string;
  tokenMissingLabel: string;
};

const DEFAULT_CENTER: MapCoordinates = { lat: 40.7128, lng: -74.006 };

export function BusinessLocationMap({ initialCoordinates, onSave, saveLabel, hintLabel, tokenMissingLabel }: Props) {
  const token = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined;
  const mapStore = useMemo(() => new MapStore(initialCoordinates ?? DEFAULT_CENTER), [initialCoordinates]);

  return (
    <Stack spacing={1}>
      <Typography variant="body2" color="text.secondary">{hintLabel}</Typography>
      {token ? (
        <CroshairMap token={token} mapStore={mapStore} saveLabel={saveLabel} onSave={onSave} />
      ) : (
        <Typography variant="caption" color="text.secondary">{tokenMissingLabel}</Typography>
      )}
    </Stack>
  );
}
