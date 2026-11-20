import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

function createPinEl(label, bgClass) {
  const wrap = document.createElement('div');
  wrap.className = 'flex flex-col items-center';
  const dot = document.createElement('div');
  dot.className = `px-2 py-0.5 rounded-full text-[10px] font-extrabold text-white shadow border border-white ${bgClass}`;
  dot.textContent = label;
  wrap.appendChild(dot);
  return wrap;
}

export default function DetourPreviewMap({
  originCoords,
  destCoords,
  pickupCoords,
  pickupLabel
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const center = pickupCoords || originCoords || destCoords || { lat: 47.6673, lng: 19.0756 };

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/bright',
      center: [center.lng, center.lat],
      zoom: 12.5,
      attributionControl: false
    });

    map.on('load', () => {
      if (originCoords && destCoords) {
        map.addSource('base-route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [originCoords.lng, originCoords.lat],
                [destCoords.lng, destCoords.lat]
              ]
            }
          }
        });
        map.addLayer({
          id: 'base-route-line',
          type: 'line',
          source: 'base-route',
          paint: {
            'line-color': '#1E4D3B',
            'line-width': 3.5,
            'line-opacity': 0.85
          }
        });
      }

      if (originCoords && destCoords && pickupCoords) {
        map.addSource('detour-route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [originCoords.lng, originCoords.lat],
                [pickupCoords.lng, pickupCoords.lat],
                [destCoords.lng, destCoords.lat]
              ]
            }
          }
        });
        map.addLayer({
          id: 'detour-route-line',
          type: 'line',
          source: 'detour-route',
          paint: {
            'line-color': '#C86446',
            'line-width': 2.5,
            'line-dasharray': [2, 2],
            'line-opacity': 0.9
          }
        });
      }
    });

    const markers = [];
    const bounds = new maplibregl.LngLatBounds();
    let pointsCount = 0;

    if (originCoords) {
      markers.push(
        new maplibregl.Marker({ element: createPinEl('Indulás', 'bg-[#1E4D3B]') })
          .setLngLat([originCoords.lng, originCoords.lat])
          .addTo(map)
      );
      bounds.extend([originCoords.lng, originCoords.lat]);
      pointsCount += 1;
    }

    if (destCoords) {
      markers.push(
        new maplibregl.Marker({ element: createPinEl('Érkezés', 'bg-[#18261F]') })
          .setLngLat([destCoords.lng, destCoords.lat])
          .addTo(map)
      );
      bounds.extend([destCoords.lng, destCoords.lat]);
      pointsCount += 1;
    }

    if (pickupCoords) {
      const shortPin = pickupLabel
        ? `Felszállás: ${pickupLabel.replace(/^\d{2}:\d{2}\s*/, '').slice(0, 18)}`
        : 'Felszállópont';
      markers.push(
        new maplibregl.Marker({ element: createPinEl(shortPin, 'bg-[#C86446]') })
          .setLngLat([pickupCoords.lng, pickupCoords.lat])
          .addTo(map)
      );
      bounds.extend([pickupCoords.lng, pickupCoords.lat]);
      pointsCount += 1;
    }

    if (pointsCount >= 2) {
      map.fitBounds(bounds, { padding: 44, maxZoom: 14, duration: 0 });
    }

    return () => {
      markers.forEach((m) => m.remove());
      map.remove();
    };
  }, [
    originCoords?.lat,
    originCoords?.lng,
    destCoords?.lat,
    destCoords?.lng,
    pickupCoords?.lat,
    pickupCoords?.lng,
    pickupLabel
  ]);

  return <div ref={containerRef} className="w-full h-44 bg-[#E8E4DA]" />;
}
