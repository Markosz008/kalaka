import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SZENTENDRE_CENTER } from '../constants/szentendreData';

const createBadgeIcon = (bgColor, label) =>
  L.divIcon({
    className: 'custom-pin',
    html: `<div style="background:${bgColor};color:#fff;font-weight:700;font-size:11px;padding:3px 8px;border-radius:999px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.25);white-space:nowrap;">${label}</div>`,
    iconAnchor: [28, 14]
  });

export default function InteractiveRouteMap({
  mode = 'browse',
  rides = [],
  originPoint,
  destPoint,
  activePin,
  onPickPoint,
  onSelectRide
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerGroupRef = useRef(null);
  const propsRef = useRef({ mode, activePin, onPickPoint, onSelectRide });

  useEffect(() => {
    propsRef.current = { mode, activePin, onPickPoint, onSelectRide };
  }, [mode, activePin, onPickPoint, onSelectRide]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: SZENTENDRE_CENTER,
      zoom: 13,
      scrollWheelZoom: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);

    map.on('click', (e) => {
      const { mode: currentMode, activePin: pin, onPickPoint: pickFn } = propsRef.current;
      if (currentMode === 'picker' && pin && pickFn) {
        pickFn(pin, e.latlng.lat, e.latlng.lng);
      }
    });

    mapRef.current = map;
    layerGroupRef.current = layerGroup;

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layerGroupRef.current;
    if (!map || !layers) return;

    layers.clearLayers();
    const boundsPoints = [];

    if (mode === 'picker') {
      const hasOrigin = Number.isFinite(originPoint?.lat) && Number.isFinite(originPoint?.lng);
      const hasDest = Number.isFinite(destPoint?.lat) && Number.isFinite(destPoint?.lng);

      if (hasOrigin) {
        const originLatLng = [originPoint.lat, originPoint.lng];
        boundsPoints.push(originLatLng);
        const marker = L.marker(originLatLng, {
          draggable: true,
          icon: createBadgeIcon('#1E4635', 'Indulás')
        });
        marker.on('dragend', (e) => {
          const pos = e.target.getLatLng();
          propsRef.current.onPickPoint?.('origin', pos.lat, pos.lng);
        });
        marker.addTo(layers);
      }

      if (hasDest) {
        const destLatLng = [destPoint.lat, destPoint.lng];
        boundsPoints.push(destLatLng);
        const marker = L.marker(destLatLng, {
          draggable: true,
          icon: createBadgeIcon('#C86446', 'Érkezés')
        });
        marker.on('dragend', (e) => {
          const pos = e.target.getLatLng();
          propsRef.current.onPickPoint?.('dest', pos.lat, pos.lng);
        });
        marker.addTo(layers);
      }

      if (hasOrigin && hasDest) {
        L.polyline(
          [
            [originPoint.lat, originPoint.lng],
            [destPoint.lat, destPoint.lng]
          ],
          { color: '#1E4635', weight: 4, dashArray: '6 6' }
        ).addTo(layers);
      }
    } else {
      rides.forEach((ride) => {
        if (!Number.isFinite(ride.origin_lat) || !Number.isFinite(ride.origin_lng)) return;
        const start = [ride.origin_lat, ride.origin_lng];
        boundsPoints.push(start);

        const isOffer = ride.kind === 'offer';
        const color = isOffer ? '#1E4635' : '#C86446';
        const badgeText = isOffer ? `${ride.seats} hely` : 'Utazna';

        const marker = L.marker(start, {
          icon: createBadgeIcon(color, badgeText)
        });

        const popupContainer = document.createElement('div');
        popupContainer.className = 'text-xs space-y-1';
        popupContainer.innerHTML = `
          <div style="font-weight:700;color:#1c1917;">${ride.origin_text} → ${ride.dest_text}</div>
          <div style="color:#57534e;">${ride.schedule_label || 'Ma'}</div>
        `;

        if (propsRef.current.onSelectRide) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = 'Egyeztetés';
          btn.style.cssText =
            'margin-top:6px;width:100%;padding:4px 10px;background:#1E4635;color:#fff;border-radius:6px;font-weight:600;cursor:pointer;';
          btn.onclick = () => propsRef.current.onSelectRide(ride);
          popupContainer.appendChild(btn);
        }

        marker.bindPopup(popupContainer);
        marker.addTo(layers);

        if (Number.isFinite(ride.dest_lat) && Number.isFinite(ride.dest_lng)) {
          const end = [ride.dest_lat, ride.dest_lng];
          L.polyline([start, end], { color, weight: 3, opacity: 0.65 }).addTo(layers);
        }
      });
    }

    if (boundsPoints.length >= 2) {
      map.fitBounds(boundsPoints, { padding: [36, 36], maxZoom: 15 });
    } else if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], 14);
    }
  }, [mode, rides, originPoint, destPoint]);

  return (
    <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-stone-200 shadow-sm bg-stone-100">
      <div ref={containerRef} className="w-full h-full z-10" />
    </div>
  );
}
