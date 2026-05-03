import { Box } from '@mui/material';
import mapboxgl, { type Map as MapboxMap } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef } from 'react';

import type { MapCoordinates } from './mapStore';

type Props = {
  token: string;
  center: MapCoordinates;
  onCenterChange: (coords: MapCoordinates) => void;
};

export function BaseMap({ token, center, onCenterChange }: Props) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const onCenterChangeRef = useRef(onCenterChange);
  const initialCenterRef = useRef(center);

  useEffect(() => {
    onCenterChangeRef.current = onCenterChange;
  }, [onCenterChange]);

  useEffect(() => {
    if (!mapContainerRef.current) {
      return;
    }

    const loadMap = () => {
      if (mapRef.current || !mapContainerRef.current) {
        return;
      }

      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [initialCenterRef.current.lng, initialCenterRef.current.lat],
        zoom: 14,
      });

      map.on('moveend', () => {
        const nextCenter = map.getCenter();
        onCenterChangeRef.current({ lat: nextCenter.lat, lng: nextCenter.lng });
      });

      mapRef.current = map;
    };

    loadMap();

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    mapRef.current.setCenter([center.lng, center.lat]);
  }, [center.lat, center.lng]);

  return <Box ref={mapContainerRef} sx={{ width: '100%', height: 320, borderRadius: 1, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }} />;
}
