import MyLocationRounded from '@mui/icons-material/MyLocationRounded';
import { Box, IconButton, Stack } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import { AppButton } from '../../shared/ui/AppButton';
import { BaseMap } from './BaseMap';
import type { MapStore } from './mapStore';

type Props = {
  token: string;
  mapStore: MapStore;
  saveLabel: string;
  onSave: (payload: { lat: number; lng: number; fullAddress: string | null }) => void;
};

export const CroshairMap = observer(function CroshairMap({ token, mapStore, saveLabel, onSave }: Props) {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${mapStore.center.lng}&latitude=${mapStore.center.lat}&access_token=${token}`,
      );
      const payload = await response.json();
      const fullAddress = payload?.features?.[0]?.properties?.full_address ?? null;
      onSave({ ...mapStore.center, fullAddress });
    } catch {
      onSave({ ...mapStore.center, fullAddress: null });
    } finally {
      setIsSaving(false);
    }
  };

  const handleZoomToMyPosition = () => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition((position) => {
      mapStore.setCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
    });
  };

  return (
    <Stack spacing={1} sx={{ position: 'relative' }}>
      <BaseMap token={token} center={mapStore.center} onCenterChange={(coords) => mapStore.setCenter(coords)} />
      <Box sx={{ pointerEvents: 'none', position: 'absolute', inset: 0 }}>
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', width: 24, height: 2, bgcolor: 'error.main', transform: 'translate(-50%, -50%)' }} />
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', width: 2, height: 24, bgcolor: 'error.main', transform: 'translate(-50%, -50%)' }} />
      </Box>
      <IconButton
        onClick={handleZoomToMyPosition}
        sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'background.paper' }}
        aria-label={saveLabel}
      >
        <MyLocationRounded fontSize="small" />
      </IconButton>
      <AppButton onClick={handleSave} isLoading={isSaving}>{saveLabel}</AppButton>
    </Stack>
  );
});
