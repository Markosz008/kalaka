import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { SZENTENDRE_ZONES } from '../constants/szentendreData';

const OPENFREEMAP_BRIGHT_STYLE = 'https://tiles.openfreemap.org/styles/bright';

function getObfuscatedZoneCoords(favor) {
  const zoneObj =
    SZENTENDRE_ZONES.find(
      (z) => z.name.toLowerCase() === (favor.zone || '').trim().toLowerCase()
    ) || SZENTENDRE_ZONES[0];

  const seedStr = String(favor.id || favor.title || 'kalaka');
  let hash = 0;
  for (let i = 0; i < seedStr.length; i += 1) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) | 0;
  }
  const angle = ((Math.abs(hash) % 360) * Math.PI) / 180;
  const distDeg = 0.0008 + ((Math.abs(hash >> 4) % 100) / 100) * 0.0008;

  return {
    lat: zoneObj.lat + Math.sin(angle) * distDeg,
    lng: zoneObj.lng + Math.cos(angle) * distDeg * 1.4
  };
}

export default function FavorsMap({ favors = [], onSelectFavor }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const userLocationMarkerRef = useRef(null);
  const [showMap, setShowMap] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [selectedFavor, setSelectedFavor] = useState(null);

  useEffect(() => {
    if (expanded) {
      document.body.classList.add('kalaka-map-expanded');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.classList.remove('kalaka-map-expanded');
      document.body.style.overflow = '';
    }
    const timer = setTimeout(() => {
      if (mapRef.current) mapRef.current.resize();
    }, 60);
    return () => {
      clearTimeout(timer);
      document.body.classList.remove('kalaka-map-expanded');
      document.body.style.overflow = '';
    };
  }, [expanded, showMap]);

  useEffect(() => {
    if (!showMap || !containerRef.current || mapRef.current) return undefined;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OPENFREEMAP_BRIGHT_STYLE,
      center: [19.062, 47.674],
      zoom: 12.1,
      attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.remove();
        userLocationMarkerRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, [showMap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showMap) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    favors.forEach((fav) => {
      const coords = getObfuscatedZoneCoords(fav);
      const el = document.createElement('button');
      el.type = 'button';
      el.className =
        'w-8 h-8 rounded-full bg-terracotta text-white border-2 border-white shadow-md flex items-center justify-center text-xs font-extrabold hover:scale-110 transition cursor-pointer';
      el.title = `${fav.title} (${fav.zone || 'Szentendre'})`;
      el.textContent = '♥';
      el.onclick = (e) => {
        e.stopPropagation();
        setSelectedFavor(fav);
        map.flyTo({ center: [coords.lng, coords.lat], zoom: 14, duration: 500 });
      };

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([coords.lng, coords.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });
  }, [favors, showMap]);

  const handleCenterUserGps = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const map = mapRef.current;
        if (!map) return;

        if (!userLocationMarkerRef.current) {
          const el = document.createElement('div');
          el.style.cssText =
            'width:16px;height:16px;border-radius:9999px;background:#2563EB;border:3px solid #FFFFFF;box-shadow:0 0 0 4px rgba(37,99,235,0.28)';
          userLocationMarkerRef.current = new maplibregl.Marker({ element: el })
            .setLngLat([lng, lat])
            .addTo(map);
        } else {
          userLocationMarkerRef.current.setLngLat([lng, lat]);
        }

        map.flyTo({ center: [lng, lat], zoom: 15.2, duration: 400 });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="bg-white rounded-2xl p-3 border border-[#DFD9CE] shadow-sm space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-display font-bold text-sm text-[#18261F]">
            Szomszédsági térkép
          </span>
          <span className="text-[11px] text-[#5C6B62]">
            • {favors.length} aktív
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            setShowMap((v) => !v);
          }}
          className="shrink-0 text-xs font-bold text-pilis bg-pilis-soft px-2.5 py-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-pilis"
        >
          {showMap ? 'Elrejtés' : 'Térkép'}
        </button>
      </div>

      {showMap && (
        <div
          className={
            expanded
              ? 'fixed inset-0 z-[9999] w-screen h-[100dvh] bg-limestone flex flex-col'
              : 'relative w-full h-48 sm:h-56 rounded-xl overflow-hidden border border-[#DFD9CE] bg-[#EAE5DC]'
          }
        >
          <div ref={containerRef} className="w-full h-full" />

          <div
            className={`absolute right-2.5 z-10 flex items-center gap-1.5 pointer-events-auto ${
              expanded ? 'top-[calc(0.75rem+env(safe-area-inset-top))]' : 'top-2.5'
            }`}
          >
            <button
              type="button"
              onClick={handleCenterUserGps}
              className="bg-white/95 backdrop-blur hover:bg-limestone text-[#18261F] text-xs font-bold px-2.5 py-2 rounded-xl shadow-sm border border-[#DFD9CE] focus:outline-none focus-visible:ring-2 focus-visible:ring-pilis"
            >
              Saját helyzet
            </button>

            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              aria-label={expanded ? 'Térkép kicsinyítése' : 'Térkép nagyítása'}
              title={expanded ? 'Bezárás' : 'Nagyítás'}
              className="bg-white/95 backdrop-blur hover:bg-limestone text-[#18261F] text-xs font-bold px-2.5 py-2 rounded-xl shadow-sm border border-[#DFD9CE] focus:outline-none focus-visible:ring-2 focus-visible:ring-pilis"
            >
              {expanded ? 'Bezárás ✕' : '⛶'}
            </button>
          </div>

          {selectedFavor && (
            <div className="absolute bottom-3 left-3 right-3 z-10 bg-white/95 backdrop-blur rounded-2xl p-3 border border-[#DFD9CE] shadow-lg flex items-center justify-between gap-2.5">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wide text-terracotta">
                  {selectedFavor.zone || 'Szentendre'} • {selectedFavor.author_name || 'Szomszéd'}
                </div>
                <div className="font-bold text-xs text-[#18261F] truncate">
                  {selectedFavor.title}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {onSelectFavor && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = selectedFavor;
                      setExpanded(false);
                      onSelectFavor(target);
                    }}
                    className="bg-pilis text-white font-bold text-xs px-3 py-1.5 rounded-xl"
                  >
                    Segítek ›
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedFavor(null)}
                  className="bg-limestone text-[#5C6B62] font-bold text-xs px-2 py-1.5 rounded-xl border border-[#DFD9CE]"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
