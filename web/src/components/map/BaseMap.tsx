import { Box } from '@mui/material';
import { useEffect, useRef } from 'react';

import type { MapCoordinates } from './mapStore';

type Props = {
  token: string;
  center: MapCoordinates;
  onCenterChange: (coords: MapCoordinates) => void;
};

type MapInstance = {
  remove: () => void;
  on: (event: string, callback: () => void) => void;
  getCenter: () => { lat: number; lng: number };
  setCenter: (coords: [number, number]) => void;
};

type MapboxGlobal = {
  Map: new (options: Record<string, unknown>) => MapInstance;
  accessToken: string;
};

const MAPBOX_SCRIPT_ID = 'mapbox-gl-script';
const MAPBOX_STYLE_ID = 'mapbox-gl-style';

export function BaseMap({ token, center, onCenterChange }: Props) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const onCenterChangeRef = useRef(onCenterChange);
  const initialCenterRef = useRef(center);

  useEffect(() => {
    onCenterChangeRef.current = onCenterChange;
  }, [onCenterChange]);

  useEffect(() => {
    if (!mapContainerRef.current) {
      return;
    }

    const loadMap = async () => {
      if (!document.getElementById(MAPBOX_STYLE_ID)) {
        const link = document.createElement('link');
        link.id = MAPBOX_STYLE_ID;
        link.rel = 'stylesheet';
        link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css';
        document.head.appendChild(link);
      }

      if (!document.getElementById(MAPBOX_SCRIPT_ID)) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.id = MAPBOX_SCRIPT_ID;
          script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Mapbox script load failed'));
          document.body.appendChild(script);
        });
      }

      const mapboxgl = (window as any).mapboxgl as MapboxGlobal | undefined;
      if (!mapboxgl || mapRef.current || !mapContainerRef.current) {
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
