import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { resolveCoordsFromText } from '../constants/szentendreData.js';

const VECTOR_STYLE_URL = 'https://tiles.openfreemap.org/styles/bright';

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

function resolveAlertCoords(msgText) {
  const s = (msgText || '').toLowerCase();
  if (s.includes('hév') || s.includes('hev') || s.includes('p+r')) {
    return { lat: 47.6602, lng: 19.0738 };
  }
  if (s.includes('pismány') || s.includes('pismany') || s.includes('sztaravoda')) {
    return { lat: 47.6852, lng: 19.0645 };
  }
  if (s.includes('izbég') || s.includes('izbeg') || s.includes('szarvashegy')) {
    return { lat: 47.6782, lng: 19.0485 };
  }
  return { lat: 47.6761, lng: 19.0754 };
}

export default function InteractiveRouteMap({
  rides = [],
  roadAlerts = [],
  fromCoords = null,
  toCoords = null,
  selectedRide = null,
  isVisible = true,
  onSelectRideOnMap,
  onPickLocation,
  onClearSelectedRide,
  onUpdatePinCoords,
  onExpandChange
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerARef = useRef(null);
  const markerBRef = useRef(null);
  const rideMarkersRef = useRef([]);
  const alertMarkersRef = useRef([]);
  const onPickLocationRef = useRef(onPickLocation);

  useEffect(() => {
    onPickLocationRef.current = onPickLocation;
  }, [onPickLocation]);

  const [mapMode, setMapMode] = useState('street');
  const [isExpanded, setIsExpanded] = useState(false);
  const [routeStats, setRouteStats] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  const effectiveFrom = selectedRide
    ? selectedRide.origin_lat && selectedRide.origin_lng
      ? { lat: Number(selectedRide.origin_lat), lng: Number(selectedRide.origin_lng) }
      : resolveCoordsFromText(selectedRide.origin_text)
    : fromCoords;

  const effectiveTo = selectedRide
    ? selectedRide.dest_lat && selectedRide.dest_lng
      ? { lat: Number(selectedRide.dest_lat), lng: Number(selectedRide.dest_lng) }
      : resolveCoordsFromText(selectedRide.dest_text)
    : toCoords;

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let map = null;
    try {
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: VECTOR_STYLE_URL,
        center: [19.068, 47.675],
        zoom: 13.2,
        attributionControl: false
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

      const fallbackTimer = setTimeout(() => setMapReady(true), 2000);

      map.on('load', () => {
        clearTimeout(fallbackTimer);
        if (!map.getSource('esri-sat')) {
          map.addSource('esri-sat', {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            attribution: '© Esri'
          });
          map.addLayer({
            id: 'esri-sat-layer',
            type: 'raster',
            source: 'esri-sat',
            minzoom: 0,
            maxzoom: 19,
            layout: { visibility: 'none' }
          });
        }

        map.resize();
        setMapReady(true);
      });

      map.on('click', async (e) => {
        if (!onPickLocationRef.current || selectedRide) return;
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
          onPickLocationRef.current(`${city}, ${road}${house}`, { lat, lng });
        } catch {
          onPickLocationRef.current('Kijelölt pont a térképen', { lat, lng });
        }
      });

      mapRef.current = map;
    } catch (err) {
      console.error('Map init error:', err);
      setMapError(true);
    }

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
      }
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    if ((isVisible || isExpanded) && mapRef.current) {
      const t = setTimeout(() => mapRef.current?.resize(), 30);
      return () => clearTimeout(t);
    }
  }, [isVisible, isExpanded]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isExpanded) {
      document.body.classList.add('kalaka-map-expanded');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.classList.remove('kalaka-map-expanded');
      document.body.style.overflow = '';
    }

    const onKey = (e) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
        if (onExpandChange) onExpandChange(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('kalaka-map-expanded');
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [isExpanded, onExpandChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    try {
      const isSat = mapMode === 'satellite';
      if (map.getLayer('esri-sat-layer')) {
        map.setLayoutProperty('esri-sat-layer', 'visibility', isSat ? 'visible' : 'none');
      }
    } catch {}
  }, [mapMode, mapReady]);

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

    const validFrom =
      effectiveFrom &&
      typeof effectiveFrom.lat === 'number' &&
      typeof effectiveFrom.lng === 'number' &&
      !isNaN(effectiveFrom.lat) &&
      !isNaN(effectiveFrom.lng);

    const validTo =
      effectiveTo &&
      typeof effectiveTo.lat === 'number' &&
      typeof effectiveTo.lng === 'number' &&
      !isNaN(effectiveTo.lat) &&
      !isNaN(effectiveTo.lng);

    if (validFrom) {
      const mA = new maplibregl.Marker({
        element: createPinElement('A', '#1E4635'),
        draggable: Boolean(onUpdatePinCoords && !selectedRide)
      })
        .setLngLat([effectiveFrom.lng, effectiveFrom.lat])
        .addTo(map);

      mA.on('dragend', () => {
        const pos = mA.getLngLat();
        if (onUpdatePinCoords) onUpdatePinCoords('from', { lat: pos.lat, lng: pos.lng });
      });
      markerARef.current = mA;
    }

    if (validTo) {
      const mB = new maplibregl.Marker({
        element: createPinElement('B', '#C86446'),
        draggable: Boolean(onUpdatePinCoords && !selectedRide)
      })
        .setLngLat([effectiveTo.lng, effectiveTo.lat])
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

    let cancelled = false;

    if (validFrom && validTo) {
      const bounds = new maplibregl.LngLatBounds()
        .extend([effectiveFrom.lng, effectiveFrom.lat])
        .extend([effectiveTo.lng, effectiveTo.lat]);
      map.fitBounds(bounds, { padding: 54, maxZoom: 15.5, duration: 400 });

      fetch(
        `https://router.project-osrm.org/route/v1/driving/${effectiveFrom.lng},${effectiveFrom.lat};${effectiveTo.lng},${effectiveTo.lat}?overview=full&geometries=geojson`
      )
        .then((r) => r.json())
        .then((data) => {
          if (cancelled || !mapRef.current) return;
          const route = data?.routes?.[0];
          if (!route) return;
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
              'line-opacity': 0.92
            }
          });
        })
        .catch(() => {
          if (!cancelled) setRouteStats(null);
        });
    } else {
      clearRouteLayer();
      setRouteStats(null);
      const single = validFrom ? effectiveFrom : validTo ? effectiveTo : null;
      if (single) {
        map.flyTo({
          center: [single.lng, single.lat],
          zoom: 16,
          duration: 400
        });
      }
    }

    return () => {
      cancelled = true;
    };
  }, [effectiveFrom?.lat, effectiveFrom?.lng, effectiveTo?.lat, effectiveTo?.lng, mapReady, selectedRide]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    rideMarkersRef.current.forEach((m) => m.remove());
    rideMarkersRef.current = [];

    if (effectiveFrom || effectiveTo) return;

    rides.forEach((r) => {
      if (!r.origin_lat || !r.origin_lng) return;
      const el = document.createElement('button');
      el.type = 'button';
      el.style.padding = '3px 7px';
      el.style.borderRadius = '9999px';
      el.style.fontSize = '10px';
      el.style.fontWeight = '800';
      el.style.color = '#fff';
      el.style.background = r.kind === 'ask' ? '#C86446' : '#1E4635';
      el.style.border = '2px solid #fff';
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)';
      el.textContent = r.depart_time || 'Út';
      el.onclick = (ev) => {
        ev.stopPropagation();
        if (onSelectRideOnMap) onSelectRideOnMap(r);
      };

      const mk = new maplibregl.Marker({ element: el })
        .setLngLat([Number(r.origin_lng), Number(r.origin_lat)])
        .addTo(map);
      rideMarkersRef.current.push(mk);
    });
  }, [rides, effectiveFrom, effectiveTo, mapReady, onSelectRideOnMap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    alertMarkersRef.current.forEach((m) => m.remove());
    alertMarkersRef.current = [];

    (roadAlerts || [])
      .filter((a) => a.status_level === 'warn' || a.status_level === 'danger')
      .forEach((al) => {
        const pt = resolveAlertCoords(al.message);
        const el = document.createElement('div');
        const isDanger = al.status_level === 'danger';
        el.style.cssText = `background:${isDanger ? '#991B1B' : '#B45309'};color:#fff;font-weight:800;font-size:10px;padding:3px 8px;border-radius:99px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);white-space:nowrap;pointer-events:none`;
        const shortLabel = (al.message || '').split(':')[0].slice(0, 18);
        el.textContent = `! ${shortLabel}`;
        el.title = al.message;

        const mk = new maplibregl.Marker({ element: el })
          .setLngLat([pt.lng, pt.lat])
          .addTo(map);
        alertMarkersRef.current.push(mk);
      });
  }, [roadAlerts, mapReady]);

  const handleCenterGps = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      mapRef.current?.flyTo({
        center: [pos.coords.longitude, pos.coords.latitude],
        zoom: 15.5,
        duration: 400
      });
    });
  };

  if (mapError) {
    return (
      <div className="w-full h-56 rounded-2xl bg-limestone border border-[#DFD9CE] grid place-items-center text-xs text-[#4A5850] font-bold">
        Térkép betöltési hiba. A keresés és az útinfó ettől függetlenül működik.
      </div>
    );
  }

  const toggleExpand = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      if (onExpandChange) onExpandChange(next);
      return next;
    });
  };

  return (
    <div
      className={
        isExpanded
          ? 'fixed inset-0 z-[9999] w-screen h-[100dvh] bg-[#ECE7DC]'
          : 'relative w-full h-60 md:h-72 rounded-2xl overflow-hidden border border-[#DFD9CE] bg-[#ECE7DC]'
      }
    >
      <div ref={mapContainerRef} className="w-full h-full" />

      {!mapReady && (
        <div className="absolute inset-0 grid place-items-center bg-[#ECE7DC]/90 pointer-events-none z-20">
          <span className="text-xs font-bold text-[#4A5850] bg-white/90 px-3 py-1.5 rounded-full border border-[#DFD9CE] shadow-sm">
            Térkép betöltése...
          </span>
        </div>
      )}

      <div
        className={`absolute left-2.5 right-2.5 flex items-center justify-between gap-2 pointer-events-none z-10 ${
          isExpanded ? 'top-[calc(0.75rem+env(safe-area-inset-top))]' : 'top-2.5'
        }`}
      >
        <div className="flex bg-white/95 backdrop-blur rounded-xl p-0.5 shadow-sm border border-[#DFD9CE] pointer-events-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => setMapMode('street')}
            className={`px-2.5 py-1.5 rounded-lg transition ${
              mapMode === 'street' ? 'bg-pilis text-white' : 'text-[#4A5850]'
            }`}
          >
            Térkép
          </button>
          <button
            type="button"
            onClick={() => setMapMode('satellite')}
            className={`px-2.5 py-1.5 rounded-lg transition ${
              mapMode === 'satellite' ? 'bg-pilis text-white' : 'text-[#4A5850]'
            }`}
          >
            Műhold
          </button>
        </div>

        {routeStats && (
          <div className="bg-[#18261F]/90 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5 pointer-events-auto">
            <span>{routeStats.km} km • ~{routeStats.mins} p</span>
            {selectedRide && onClearSelectedRide && (
              <button
                type="button"
                onClick={onClearSelectedRide}
                aria-label="Kijelölt útvonal bezárása"
                className="ml-0.5 w-5 h-5 rounded-full bg-white/20 hover:bg-white/35 grid place-items-center text-[11px] leading-none"
              >
                ✕
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={handleCenterGps}
            className="bg-white/95 backdrop-blur hover:bg-limestone text-[#18261F] text-xs font-bold px-2.5 py-2 rounded-xl shadow-sm border border-[#DFD9CE]"
          >
            Saját helyzet
          </button>

          <button
            type="button"
            onClick={toggleExpand}
            aria-label={isExpanded ? 'Térkép kicsinyítése' : 'Térkép nagyítása'}
            title={isExpanded ? 'Bezárás' : 'Nagyítás'}
            className="bg-white/95 backdrop-blur hover:bg-limestone text-[#18261F] text-xs font-bold px-2.5 py-2 rounded-xl shadow-sm border border-[#DFD9CE]"
          >
            {isExpanded ? 'Bezárás ✕' : '⛶'}
          </button>
        </div>
      </div>

      {isExpanded && !selectedRide && (
        <div className="absolute bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-3 right-14 z-10 pointer-events-none">
          <div className="inline-block bg-white/95 backdrop-blur text-[#18261F] text-xs font-semibold px-3 py-2 rounded-xl shadow-lg border border-[#DFD9CE]">
            Bökj bárhová a térképen
          </div>
        </div>
      )}
    </div>
  );
}
