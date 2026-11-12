import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MAP_TRANSIT_POINTS, resolveCoordsFromText } from '../constants/szentendreData.js';

const MAP_STYLES = {
  topo: {
    label: 'Térkép',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, OpenStreetMap'
  },
  street: {
    label: 'Utca',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, HERE, Garmin'
  },
  sat: {
    label: 'Műhold',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri World Imagery'
  }
};

export default function InteractiveRouteMap({
  fromText,
  toText,
  fromCoords,
  toCoords,
  selectedRide,
  onPickLocation,
  onUpdatePinCoords
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const layerGroupRef = useRef(null);

  const [mapStyle, setMapStyle] = useState('topo');
  const [routeMeta, setRouteMeta] = useState(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [47.676, 19.065],
      zoom: 13,
      zoomControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const initialTile = L.tileLayer(MAP_STYLES.topo.url, {
      attribution: MAP_STYLES.topo.attribution,
      maxZoom: 19
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    tileLayerRef.current = initialTile;
    layerGroupRef.current = group;

    // Mobilon gyakori félig szürke térkép-betöltés megelőzése
    const t1 = setTimeout(() => map.invalidateSize(), 120);
    const t2 = setTimeout(() => map.invalidateSize(), 450);

    map.on('click', async (e) => {
      const { lat, lng } = e.latlng;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=hu`
        );
        const data = await res.json();
        const addr = data?.address || {};
        const city = addr.city || addr.town || addr.village || 'Szentendre';
        const road =
          addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood;
        const house = addr.house_number ? ` ${addr.house_number}.` : '';
        const label = road
          ? `${city === 'Szentendre' ? 'Szentendre, ' : city + ', '}${road}${house}`
          : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        onPickLocation(label, { lat, lng });
      } catch {
        onPickLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`, { lat, lng });
      }
    });

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !tileLayerRef.current) return;
    const cfg = MAP_STYLES[mapStyle] || MAP_STYLES.topo;
    tileLayerRef.current.setUrl(cfg.url);
  }, [mapStyle]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    setRouteMeta(null);

    MAP_TRANSIT_POINTS.forEach((pt) => {
      const marker = L.circleMarker([pt.lat, pt.lng], {
        radius: 5,
        fillColor: '#FFFFFF',
        color: '#1E4635',
        weight: 2,
        fillOpacity: 0.95
      });

      marker.bindTooltip(pt.short, {
        direction: 'top',
        offset: [0, -5],
        className: 'text-xs font-semibold'
      });

      marker.on('click', (ev) => {
        L.DomEvent.stopPropagation(ev);
        onPickLocation(pt.name, { lat: pt.lat, lng: pt.lng });
      });

      marker.addTo(group);
    });

    const effectiveFromText = selectedRide ? selectedRide.origin_text : fromText;
    const effectiveToText = selectedRide ? selectedRide.dest_text : toText;

    const startCoord = selectedRide
      ? selectedRide.origin_lat && selectedRide.origin_lng
        ? { lat: selectedRide.origin_lat, lng: selectedRide.origin_lng }
        : resolveCoordsFromText(selectedRide.origin_text)
      : fromCoords || resolveCoordsFromText(effectiveFromText);

    const endCoord = selectedRide
      ? selectedRide.dest_lat && selectedRide.dest_lng
        ? { lat: selectedRide.dest_lat, lng: selectedRide.dest_lng }
        : resolveCoordsFromText(selectedRide.dest_text)
      : toCoords || resolveCoordsFromText(effectiveToText);

    if (startCoord) {
      const startIcon = L.divIcon({
        className: '',
        html: `<div style="width:24px;height:24px;border-radius:50%;background:#1E4635;color:#fff;font-weight:800;font-size:12px;display:grid;place-items:center;border:2.5px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.4);cursor:grab">A</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      const mStart = L.marker([startCoord.lat, startCoord.lng], {
        icon: startIcon,
        draggable: !selectedRide
      }).bindTooltip(effectiveFromText || 'Indulás', { direction: 'top' });

      mStart.on('dragend', (ev) => {
        const pos = ev.target.getLatLng();
        if (onUpdatePinCoords) onUpdatePinCoords('from', { lat: pos.lat, lng: pos.lng });
      });
      mStart.addTo(group);
    }

    if (endCoord) {
      const endIcon = L.divIcon({
        className: '',
        html: `<div style="width:24px;height:24px;border-radius:50%;background:#C86446;color:#fff;font-weight:800;font-size:12px;display:grid;place-items:center;border:2.5px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.4);cursor:grab">B</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      const mEnd = L.marker([endCoord.lat, endCoord.lng], {
        icon: endIcon,
        draggable: !selectedRide
      }).bindTooltip(effectiveToText || 'Érkezés', { direction: 'top' });

      mEnd.on('dragend', (ev) => {
        const pos = ev.target.getLatLng();
        if (onUpdatePinCoords) onUpdatePinCoords('to', { lat: pos.lat, lng: pos.lng });
      });
      mEnd.addTo(group);
    }

    if (startCoord && endCoord) {
      (async () => {
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${startCoord.lng},${startCoord.lat};${endCoord.lng},${endCoord.lat}?overview=full&geometries=geojson`;
          const res = await fetch(url);
          const data = await res.json();
          if (data?.routes?.[0]) {
            const route = data.routes[0];
            const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
            const poly = L.polyline(coords, {
              color: mapStyle === 'sat' ? '#34D399' : '#1E4635',
              weight: 4.5,
              opacity: 0.92
            }).addTo(group);

            map.fitBounds(poly.getBounds(), { padding: [28, 28], maxZoom: 15 });
            setRouteMeta({
              km: (route.distance / 1000).toFixed(1),
              min: Math.max(2, Math.round(route.duration / 60))
            });
            return;
          }
        } catch {
          // Fallback
        }
        const fallbackLine = L.polyline(
          [
            [startCoord.lat, startCoord.lng],
            [endCoord.lat, endCoord.lng]
          ],
          { color: '#1E4635', weight: 3, dashArray: '6 6' }
        ).addTo(group);
        map.fitBounds(fallbackLine.getBounds(), { padding: [28, 28], maxZoom: 15 });
      })();
    } else if (startCoord) {
      map.setView([startCoord.lat, startCoord.lng], 15);
    } else if (endCoord) {
      map.setView([endCoord.lat, endCoord.lng], 15);
    }
  }, [fromText, toText, fromCoords, toCoords, selectedRide, mapStyle]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-[#DFD9CE] bg-[#E8E4DA]">
      <div ref={mapContainerRef} className="w-full h-52 sm:h-64" />

      <div className="absolute top-2 left-2 z-[400] flex bg-white/95 backdrop-blur p-0.5 rounded-lg shadow border border-[#DFD9CE] text-[11px] font-bold">
        {Object.entries(MAP_STYLES).map(([key, cfg]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMapStyle(key)}
            className={`px-2 py-1 rounded-md transition ${
              mapStyle === key
                ? 'bg-pilis text-white'
                : 'text-[#5C6B62] hover:text-black'
            }`}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {routeMeta && (
        <div className="absolute top-2 right-2 pointer-events-none z-[400]">
          <span className="bg-pilis text-white px-2 py-1 rounded-lg text-[11px] font-bold shadow">
            {routeMeta.km} km • ~{routeMeta.min} p
          </span>
        </div>
      )}
    </div>
  );
}

