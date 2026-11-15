import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const RASTER_STYLE = {
  version: 8,
  sources: {
    'carto': {
      type: 'raster',
      tiles: ['https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'],
      tileSize: 256
    }
  },
  layers: [{ id: 'c', type: 'raster', source: 'carto' }]
};

export default function InteractiveRouteMap({
  rides = [],
  fromCoords = null,
  toCoords = null,
  selectedRide = null,
  onSelectRideOnMap,
  onPickLocation,
  onUpdatePinCoords
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [mapError, setMapError] = useState(false);

  const effectiveFrom =
    selectedRide && selectedRide.origin_lat && selectedRide.origin_lng
      ? { lat: Number(selectedRide.origin_lat), lng: Number(selectedRide.origin_lng) }
      : fromCoords;

  const effectiveTo =
    selectedRide && selectedRide.dest_lat && selectedRide.dest_lng
      ? { lat: Number(selectedRide.dest_lat), lng: Number(selectedRide.dest_lng) }
      : toCoords;

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: RASTER_STYLE,
        center: [19.0756, 47.6694],
        zoom: 13,
        attributionControl: false
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

      map.on('load', () => {
        map.resize();
      });

      mapRef.current = map;
    } catch (err) {
      console.error('Térkép inicializálási hiba:', err);
      setMapError(true);
    }

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
      }
    };
  }, []);

  if (mapError) {
    return (
      <div className="w-full h-56 rounded-2xl bg-limestone border border-[#DFD9CE] grid place-items-center text-xs text-[#5C6B62] font-bold">
        Térkép betöltési hiba. A keresés és az útinfó ettől függetlenül működik.
      </div>
    );
  }

  return (
    <div className="relative w-full h-56 sm:h-64 rounded-2xl overflow-hidden border border-[#DFD9CE] bg-[#ECE7DC]">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}
