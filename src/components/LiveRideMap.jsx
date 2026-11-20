import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import { resolveCoordsFromText } from '../constants/szentendreData.js';

const VECTOR_STYLE_URL = 'https://tiles.openfreemap.org/styles/bright';

function createCarMarkerEl(labelText) {
  const wrap = document.createElement('div');
  wrap.className = 'flex flex-col items-center pointer-events-none select-none';
  wrap.innerHTML = `
    <div class="relative flex items-center justify-center">
      <span class="absolute w-10 h-10 rounded-full bg-[#1E4635]/35 animate-ping"></span>
      <div class="relative w-9 h-9 rounded-full bg-[#1E4635] border-[2.5px] border-white shadow-lg flex items-center justify-center">
        <svg viewBox="0 0 24 24" class="w-5 h-5 text-[#F5F2EA]" fill="currentColor" aria-hidden="true">
          <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11v6a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-6zm2.2-1h9.6l-.9-2.8a.6.6 0 0 0-.6-.4H8.7a.6.6 0 0 0-.6.4L7.2 10zM7.5 14a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5zm9 0a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5z"/>
        </svg>
      </div>
    </div>
  `;
  const label = document.createElement('span');
  label.className = 'mt-0.5 px-2 py-0.5 rounded-full bg-[#18261F]/90 text-white text-[10px] font-bold shadow whitespace-nowrap';
  label.textContent = labelText || '';
  wrap.appendChild(label);
  return wrap;
}

function createNeighborMarkerEl(labelText) {
  const wrap = document.createElement('div');
  wrap.className = 'flex flex-col items-center pointer-events-none select-none';
  wrap.innerHTML = `
    <div class="w-9 h-9 rounded-full bg-[#C25938] border-[2.5px] border-white shadow-lg flex items-center justify-center">
      <svg viewBox="0 0 24 24" class="w-5 h-5 text-white" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="7" r="3.2"/>
        <path d="M12 11.5c-3.4 0-6 1.8-6 4.2V18a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2.3c0-2.4-2.6-4.2-6-4.2z"/>
      </svg>
    </div>
  `;
  const label = document.createElement('span');
  label.setAttribute('data-label', '');
  label.className = 'mt-0.5 px-2 py-0.5 rounded-full bg-[#C25938] text-white text-[10px] font-bold shadow whitespace-nowrap';
  label.textContent = labelText || '';
  wrap.appendChild(label);
  return wrap;
}

export default function LiveRideMap({
  driverLat,
  driverLng,
  passengerLat,
  passengerLng,
  pickupStopName,
  isHelper
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const passengerMarkerRef = useRef(null);
  const fittedPairRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  const pickupFallback = pickupStopName
    ? resolveCoordsFromText(pickupStopName.replace(/^\d{2}:\d{2}\s*/, ''))
    : null;

  const hasLivePassenger =
    passengerLat !== null &&
    passengerLat !== undefined &&
    passengerLng !== null &&
    passengerLng !== undefined &&
    !Number.isNaN(Number(passengerLat)) &&
    !Number.isNaN(Number(passengerLng));

  const passengerCoord = hasLivePassenger
    ? { lat: Number(passengerLat), lng: Number(passengerLng) }
    : pickupFallback;

  const driverCoord =
    driverLat !== null &&
    driverLat !== undefined &&
    driverLng !== null &&
    driverLng !== undefined &&
    !Number.isNaN(Number(driverLat)) &&
    !Number.isNaN(Number(driverLng))
      ? { lat: Number(driverLat), lng: Number(driverLng) }
      : null;

  const driverLabel = isHelper ? 'Te (Sofőr)' : 'Sofőr';
  const passengerLabel = hasLivePassenger
    ? isHelper
      ? 'Szomszéd'
      : 'Itt állsz'
    : 'Felszállópont';

  const fitView = useCallback(
    (animate = true) => {
      const map = mapRef.current;
      if (!map) return;
      if (driverCoord && passengerCoord) {
        const bounds = new maplibregl.LngLatBounds()
          .extend([driverCoord.lng, driverCoord.lat])
          .extend([passengerCoord.lng, passengerCoord.lat]);
        map.fitBounds(bounds, { padding: 48, maxZoom: 15.5, duration: animate ? 500 : 0 });
      } else if (driverCoord) {
        map.easeTo({ center: [driverCoord.lng, driverCoord.lat], zoom: 15, duration: animate ? 500 : 0 });
      } else if (passengerCoord) {
        map.easeTo({ center: [passengerCoord.lng, passengerCoord.lat], zoom: 15, duration: animate ? 500 : 0 });
      }
    },
    [driverCoord?.lat, driverCoord?.lng, passengerCoord?.lat, passengerCoord?.lng]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const initial = driverCoord || passengerCoord || { lat: 47.6694, lng: 19.0756 };
    let map = null;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: VECTOR_STYLE_URL,
        center: [initial.lng, initial.lat],
        zoom: 14.5,
        attributionControl: false
      });
      mapRef.current = map;
      map.on('load', () => {
        map.resize();
        map.addSource('live-approach', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
        map.addLayer({
          id: 'live-approach-line',
          type: 'line',
          source: 'live-approach',
          paint: {
            'line-color': '#1E4635',
            'line-width': 3,
            'line-dasharray': [2, 2]
          }
        });
        setMapReady(true);
      });
    } catch {}

    return () => {
      driverMarkerRef.current?.remove();
      passengerMarkerRef.current?.remove();
      driverMarkerRef.current = null;
      passengerMarkerRef.current = null;
      fittedPairRef.current = false;
      setMapReady(false);
      if (map) {
        try {
          map.remove();
        } catch {}
      }
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (passengerCoord && !Number.isNaN(passengerCoord.lat) && !Number.isNaN(passengerCoord.lng)) {
      if (!passengerMarkerRef.current) {
        passengerMarkerRef.current = new maplibregl.Marker({
          element: createNeighborMarkerEl(passengerLabel),
          anchor: 'bottom'
        })
          .setLngLat([passengerCoord.lng, passengerCoord.lat])
          .addTo(map);
      } else {
        passengerMarkerRef.current.setLngLat([passengerCoord.lng, passengerCoord.lat]);
        const lbl = passengerMarkerRef.current.getElement().querySelector('[data-label]');
        if (lbl) lbl.textContent = passengerLabel;
      }
    }

    if (driverCoord && !Number.isNaN(driverCoord.lat) && !Number.isNaN(driverCoord.lng)) {
      if (!driverMarkerRef.current) {
        driverMarkerRef.current = new maplibregl.Marker({
          element: createCarMarkerEl(driverLabel),
          anchor: 'bottom'
        })
          .setLngLat([driverCoord.lng, driverCoord.lat])
          .addTo(map);
      } else {
        driverMarkerRef.current.setLngLat([driverCoord.lng, driverCoord.lat]);
      }
    }

    const src = map.getSource('live-approach');
    if (src) {
      if (driverCoord && passengerCoord) {
        src.setData({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [driverCoord.lng, driverCoord.lat],
              [passengerCoord.lng, passengerCoord.lat]
            ]
          }
        });
      } else {
        src.setData({ type: 'FeatureCollection', features: [] });
      }
    }

    if (driverCoord && passengerCoord && !fittedPairRef.current) {
      fittedPairRef.current = true;
      fitView(false);
    } else if (!fittedPairRef.current && (driverCoord || passengerCoord)) {
      fitView(false);
    }
  }, [
    mapReady,
    driverCoord?.lat,
    driverCoord?.lng,
    passengerCoord?.lat,
    passengerCoord?.lng,
    driverLabel,
    passengerLabel,
    fitView
  ]);

  useEffect(() => {
    let wakeLock = null;
    const requestWakeLock = async () => {
      if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
      try {
        wakeLock = await navigator.wakeLock.request('screen');
      } catch {}
    };
    requestWakeLock();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="relative w-full h-48">
      <div ref={containerRef} className="w-full h-full" />
      <button
        type="button"
        onClick={() => fitView(true)}
        className="absolute top-2 right-2 z-10 bg-white/95 hover:bg-white text-[#18261F] text-[11px] font-bold px-2.5 py-1 rounded-full shadow border border-[#DFD9CE]"
      >
        Középre
      </button>
    </div>
  );
}
