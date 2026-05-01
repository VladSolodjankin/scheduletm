import { Box, Stack } from '@mui/material';
import { observer } from 'mobx-react-lite';

import { AppButton } from '../../shared/ui/AppButton';
import { BaseMap } from './BaseMap';
import type { MapStore } from './mapStore';

type Props = {
  token: string;
  mapStore: MapStore;
  saveLabel: string;
  onSave: (coords: { lat: number; lng: number }) => void;
};

export const CroshairMap = observer(function CroshairMap({ token, mapStore, saveLabel, onSave }: Props) {
  return (
    <Stack spacing={1} sx={{ position: 'relative' }}>
      <BaseMap token={token} center={mapStore.center} onCenterChange={(coords) => mapStore.setCenter(coords)} />
      <Box sx={{ pointerEvents: 'none', position: 'absolute', inset: 0 }}>
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', width: 24, height: 2, bgcolor: 'error.main', transform: 'translate(-50%, -50%)' }} />
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', width: 2, height: 24, bgcolor: 'error.main', transform: 'translate(-50%, -50%)' }} />
      </Box>
      <AppButton onClick={() => onSave(mapStore.center)}>{saveLabel}</AppButton>
    </Stack>
  );
});
