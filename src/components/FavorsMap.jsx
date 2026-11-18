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
  const [expanded, setExpanded] = useState(false);
  const [selectedFavor, setSelectedFavor] = useState(null);

  useEffect(() => {
    if (expanded) {
      document.body.classList.add('kalaka-map-expanded');
    } else {
      document.body.classList.remove('kalaka-map-expanded');
    }
    const timer = setTimeout(() => {
      if (mapRef.current) mapRef.current.resize();
    }, 60);
    return () => {
      clearTimeout(timer);
      document.body.classList.remove('kalaka-map-expanded');
    };
  }, [expanded]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OPENFREEMAP_BRIGHT_STYLE,
      center: [19.0645, 47.6735],
      zoom: 12.6,
      attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

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
  }, [favors]);

  return (
    <div
      className={
        expanded
          ? 'fixed inset-0 z-[9999] w-screen h-[100dvh] bg-limestone flex flex-col'
          : 'relative w-full h-44 sm:h-52 rounded-2xl overflow-hidden border border-[#DFD9CE] shadow-sm bg-[#EAE5DC]'
      }
    >
      <div ref={containerRef} className="w-full h-full" />

      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 pointer-events-none">
        <span className="pointer-events-auto bg-white/95 backdrop-blur text-[#18261F] text-[11px] font-bold px-2.5 py-1.5 rounded-xl border border-[#DFD9CE] shadow-sm">
          Szomszédsági körzetek (~150 m pontosság)
        </span>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="pointer-events-auto bg-white/95 hover:bg-white text-[#18261F] font-bold text-xs px-2.5 py-1.5 rounded-xl border border-[#DFD9CE] shadow-sm transition"
          title={expanded ? 'Bezárás' : 'Teljes képernyő'}
        >
          {expanded ? 'Bezárás ✕' : '⛶'}
        </button>
      </div>

      {selectedFavor && (
        <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur rounded-2xl p-3 border border-[#DFD9CE] shadow-lg flex items-center justify-between gap-2.5">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wide text-terracotta">
              {selectedFavor.zone || 'Szentendre'} • {selectedFavor.author?.full_name || 'Szomszéd'}
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
  );
}
