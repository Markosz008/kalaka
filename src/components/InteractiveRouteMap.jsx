import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';

const MAP_STYLE = {
  version: 8,
  sources: {
    'osm-raster': {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors'
    }
  },
  layers: [
    {
      id: 'osm-raster-layer',
      type: 'raster',
      source: 'osm-raster',
      minzoom: 0,
      maxzoom: 19
    }
  ]
};

const SATELLITE_STYLE = {
  version: 8,
  sources: {
    esri: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      attribution: '© Esri'
    }
  },
  layers: [
    {
      id: 'esri-sat',
      type: 'raster',
      source: 'esri',
      minzoom: 0,
      maxzoom: 19
    }
  ]
};

function createPinElement(letter, bgColor) {
  const el = document.createElement('div');
  el.style.width = '30px';
  el.style.height = '30px';
  el.style.borderRadius = '9999px';
  el.style.background = bgColor;
  el.style.color = '#ffffff';
  el.style.fontWeight = '800';
  el.style.fontSize = '12px';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.border = '2.5px solid #ffffff';
  el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.32)';
  el.style.cursor = 'grab';
  el.textContent = letter;
  return el;
}

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
  const markerARef = useRef(null);
  const markerBRef = useRef(null);
  const rideMarkersRef = useRef([]);

  const [mapMode, setMapMode] = useState('vector');
  const [routeStats, setRouteStats] = useState(null);
  const [mapReady, setMapReady] = useState(false);

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

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [19.0756, 47.6694],
      zoom: 13.5,
      attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('load', () => {
      map.resize();
      setMapReady(true);
    });

    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.resize();
        setMapReady(true);
      }
    }, 250);

    map.on('click', async (e) => {
      if (!onPickLocation) return;
      const { lat, lng } = e.lngLat;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=hu`
        );
        const data = await res.json();
        const addr = data?.address || {};
        const city = addr.city || addr.town || addr.village || 'Szentendre';
        const road = addr.road || addr.pedestrian || addr.suburb || 'Kijelölt pont';
        const house = addr.house_number ? ` ${addr.house_number}.` : '';
        onPickLocation(`${city}, ${road}${house}`, { lat, lng });
      } catch {
        onPickLocation('Kijelölt pont a térképen', { lat, lng });
      }
    });

    mapRef.current = map;
    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(mapMode === 'satellite' ? SATELLITE_STYLE : MAP_STYLE);
    map.once('styledata', () => {
      map.resize();
    });
  }, [mapMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (markerARef.current) {
      markerARef.current.remove();
      markerARef.current = null;
    }
    if (markerBRef.current) {
      markerBRef.current.remove();
      markerBRef.current = null;
    }

    if (effectiveFrom && !isNaN(effectiveFrom.lat) && !isNaN(effectiveFrom.lng)) {
      const mA = new maplibregl.Marker({
        element: createPinElement('A', '#1E4635'),
        draggable: Boolean(onUpdatePinCoords && !selectedRide)
      })
        .setLngLat([Number(effectiveFrom.lng), Number(effectiveFrom.lat)])
        .addTo(map);

      mA.on('dragend', () => {
        const pos = mA.getLngLat();
        if (onUpdatePinCoords) onUpdatePinCoords('from', { lat: pos.lat, lng: pos.lng });
      });
      markerARef.current = mA;
    }

    if (effectiveTo && !isNaN(effectiveTo.lat) && !isNaN(effectiveTo.lng)) {
      const mB = new maplibregl.Marker({
        element: createPinElement('B', '#C86446'),
        draggable: Boolean(onUpdatePinCoords && !selectedRide)
      })
        .setLngLat([Number(effectiveTo.lng), Number(effectiveTo.lat)])
        .addTo(map);

      mB.on('dragend', () => {
        const pos = mB.getLngLat();
        if (onUpdatePinCoords) onUpdatePinCoords('to', { lat: pos.lat, lng: pos.lng });
      });
      markerBRef.current = mB;
    }

    const clearRouteLayer = () => {
      try {
        if (map.getLayer('kalaka-route-line')) map.removeLayer('kalaka-route-line');
        if (map.getSource('kalaka-route')) map.removeSource('kalaka-route');
      } catch {}
    };

    if (effectiveFrom && effectiveTo) {
      const bounds = new maplibregl.LngLatBounds()
        .extend([Number(effectiveFrom.lng), Number(effectiveFrom.lat)])
        .extend([Number(effectiveTo.lng), Number(effectiveTo.lat)]);
      map.fitBounds(bounds, { padding: 54, maxZoom: 15.5, duration: 400 });

      fetch(
        `https://router.project-osrm.org/route/v1/driving/${effectiveFrom.lng},${effectiveFrom.lat};${effectiveTo.lng},${effectiveTo.lat}?overview=full&geometries=geojson`
      )
        .then((r) => r.json())
        .then((data) => {
          const route = data?.routes?.[0];
          if (!route || !mapRef.current) return;
          setRouteStats({
            km: (route.distance / 1000).toFixed(1),
            mins: Math.max(1, Math.round(route.duration / 60))
          });

          clearRouteLayer();
          map.addSource('kalaka-route', {
            type: 'geojson',
            data: { type: 'Feature', geometry: route.geometry }
          });
          map.addLayer({
            id: 'kalaka-route-line',
            type: 'line',
            source: 'kalaka-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#1E4635',
              'line-width': 4.5,
              'line-opacity': 0.9
            }
          });
        })
        .catch(() => setRouteStats(null));
    } else {
      clearRouteLayer();
      setRouteStats(null);
      const single = effectiveFrom || effectiveTo;
      if (single && !isNaN(single.lat) && !isNaN(single.lng)) {
        map.flyTo({
          center: [Number(single.lng), Number(single.lat)],
          zoom: 16,
          duration: 400
        });
      }
    }
  }, [effectiveFrom?.lat, effectiveFrom?.lng, effectiveTo?.lat, effectiveTo?.lng, mapReady, selectedRide]);

  return (
    <div className="relative w-full h-60 sm:h-64 rounded-2xl overflow-hidden border border-[#DFD9CE] bg-[#ECE7DC]">
      <div ref={mapContainerRef} className="w-full h-full" />

      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 pointer-events-none z-10">
        <div className="flex bg-white/95 backdrop-blur rounded-xl p-0.5 shadow-sm border border-[#DFD9CE] pointer-events-auto text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setMapMode('vector')}
            className={`px-2.5 py-1 rounded-lg transition ${
              mapMode === 'vector' ? 'bg-pilis text-white' : 'text-[#5C6B62]'
            }`}
          >
            Térkép
          </button>
          <button
            type="button"
            onClick={() => setMapMode('satellite')}
            className={`px-2.5 py-1 rounded-lg transition ${
              mapMode === 'satellite' ? 'bg-pilis text-white' : 'text-[#5C6B62]'
            }`}
          >
            Műhold
          </button>
        </div>

        {routeStats && (
          <div className="bg-[#18261F]/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm">
            {routeStats.km} km • ~{routeStats.mins} p
          </div>
        )}

        <button
          type="button"
          onClick={handleCenterGps}
          className="bg-white/95 backdrop-blur hover:bg-limestone text-[#18261F] text-[11px] font-bold px-2.5 py-1.5 rounded-xl shadow-sm border border-[#DFD9CE] pointer-events-auto"
        >
          Saját helyzet
        </button>
      </div>
    </div>
  );
}
