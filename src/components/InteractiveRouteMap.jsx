import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { resolveCoordsFromText, maskAddressForPublic } from '../constants/szentendreData.js';

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
  rides = [],
  fromText,
  toText,
  fromCoords,
  toCoords,
  selectedRide,
  onSelectRideOnMap,
  onPickLocation,
  onUpdatePinCoords
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const layerGroupRef = useRef(null);

  const [mapStyle, setMapStyle] = useState('topo');
  const [routeMeta, setRouteMeta] = useState(null);
  const [locating, setLocating] = useState(false);

  // Legfrissebb callback referenciák, hogy ne kelljen újrainicializálni a térképet
  const onPickRef = useRef(onPickLocation);
  const onSelectRideRef = useRef(onSelectRideOnMap);
  const onUpdatePinRef = useRef(onUpdatePinCoords);
  const selectedRideRef = useRef(selectedRide);

  useEffect(() => {
    onPickRef.current = onPickLocation;
    onSelectRideRef.current = onSelectRideOnMap;
    onUpdatePinRef.current = onUpdatePinCoords;
    selectedRideRef.current = selectedRide;
  }, [onPickLocation, onSelectRideOnMap, onUpdatePinCoords, selectedRide]);

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

    const t1 = setTimeout(() => map.invalidateSize(), 120);
    const t2 = setTimeout(() => map.invalidateSize(), 450);

    map.on('click', async (e) => {
      if (selectedRideRef.current) return;
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
        if (onPickRef.current) onPickRef.current(label, { lat, lng });
      } catch {
        if (onPickRef.current) onPickRef.current(`${lat.toFixed(4)}, ${lng.toFixed(4)}`, { lat, lng });
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

  // Saját GPS helyzet lekérése és beírása indulási pontnak
  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lng], 15);
        }
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=hu`
          );
          const data = await res.json();
          const addr = data?.address || {};
          const city = addr.city || addr.town || addr.village || 'Szentendre';
          const road = addr.road || addr.pedestrian || addr.suburb || 'Jelenlegi helyzetem';
          const house = addr.house_number ? ` ${addr.house_number}.` : '';
          const label = `${city === 'Szentendre' ? 'Szentendre, ' : city + ', '}${road}${house}`;
          if (onPickRef.current) onPickRef.current(label, { lat, lng }, 'from');
        } catch {
          if (onPickRef.current) onPickRef.current('Jelenlegi helyzetem', { lat, lng }, 'from');
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    setRouteMeta(null);

    const effectiveFromText = selectedRide ? maskAddressForPublic(selectedRide.origin_text) : fromText;
    const effectiveToText = selectedRide ? maskAddressForPublic(selectedRide.dest_text) : toText;

    const startCoord = selectedRide
      ? selectedRide.origin_lat && selectedRide.origin_lng
        ? { lat: selectedRide.origin_lat, lng: selectedRide.origin_lng }
        : resolveCoordsFromText(selectedRide.origin_text)
      : resolveCoordsFromText(effectiveFromText) || fromCoords;

    const endCoord = selectedRide
      ? selectedRide.dest_lat && selectedRide.dest_lng
        ? { lat: selectedRide.dest_lat, lng: selectedRide.dest_lng }
        : resolveCoordsFromText(selectedRide.dest_text)
      : resolveCoordsFromText(effectiveToText) || toCoords;

    // 1. HA NINCS KIVÁLASZTOTT ÚTVONAL: Élő aktív kiírások jelvényei jelennek meg a térképen (statikus üres pöttyök helyett!)
    if (!selectedRide && !startCoord && !endCoord && Array.isArray(rides) && rides.length > 0) {
      const boundsPoints = [];
      rides.forEach((r, idx) => {
        const c =
          r.origin_lat && r.origin_lng
            ? { lat: r.origin_lat, lng: r.origin_lng }
            : resolveCoordsFromText(r.origin_text);
        if (!c) return;

        // Ha ketten ugyanabból az utcából indulnak, enyhén eltoljuk a jelvényt
        const lat = c.lat + ((idx % 3) - 1) * 0.0005;
        const lng = c.lng + ((idx % 2) - 0.5) * 0.0005;
        boundsPoints.push([lat, lng]);

        const isOffer = r.kind === 'offer';
        const bg = isOffer ? '#1E4635' : '#C86446';
        const badgeText = isOffer
          ? `${r.time_label} • ${r.seats} hely`
          : `${r.time_label} • Utat keres`;

        const liveIcon = L.divIcon({
          className: '',
          html: `<div style="background:${bg};color:#fff;font-weight:800;font-size:11px;padding:4px 9px;border-radius:99px;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.35);white-space:nowrap;cursor:pointer">${badgeText}</div>`,
          iconSize: [110, 26],
          iconAnchor: [55, 13]
        });

        const marker = L.marker([lat, lng], { icon: liveIcon });
        marker.on('click', (ev) => {
          L.DomEvent.stopPropagation(ev);
          if (onSelectRideRef.current) onSelectRideRef.current(r);
        });
        marker.addTo(group);
      });

      if (boundsPoints.length === 1) {
        map.setView(boundsPoints[0], 14);
      } else if (boundsPoints.length > 1) {
        map.fitBounds(L.latLngBounds(boundsPoints), { padding: [36, 36], maxZoom: 14 });
      }
    }

    // 2. HA KONKRÉT ÚT VAN KIVÁLASZTVA: A köztes megállók névvel és időponttal jelennek meg az útvonalon
    if (selectedRide && Array.isArray(selectedRide.stops) && selectedRide.stops.length > 0) {
      selectedRide.stops.forEach((st) => {
        const stopCoord =
          st.lat && st.lng
            ? { lat: st.lat, lng: st.lng }
            : resolveCoordsFromText(st.name);
        if (!stopCoord) return;

        const stopDot = L.circleMarker([stopCoord.lat, stopCoord.lng], {
          radius: 5,
          fillColor: '#FFFFFF',
          color: '#1E4635',
          weight: 2.5,
          fillOpacity: 1
        });

        stopDot.bindTooltip(`${st.time} • ${st.name}`, {
          direction: 'top',
          offset: [0, -6],
          className: 'text-xs font-bold'
        });
        stopDot.bindPopup(
          `<div style="font-family:sans-serif;font-size:12px;font-weight:700;color:#18261F">${st.time} • ${st.name}</div>`
        );
        stopDot.on('click', (ev) => {
          L.DomEvent.stopPropagation(ev);
          stopDot.openPopup();
        });
        stopDot.addTo(group);
      });
    }

    // 3. A (Indulás) és B (Érkezés) jelölők
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
        if (onUpdatePinRef.current) onUpdatePinRef.current('from', { lat: pos.lat, lng: pos.lng });
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
        if (onUpdatePinRef.current) onUpdatePinRef.current('to', { lat: pos.lat, lng: pos.lng });
      });
      mEnd.addTo(group);
    }

    // 4. Valós útvonal kirajzolása OSRM-mel
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
          // Fallback egyenes vonal
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
  }, [rides, fromText, toText, fromCoords, toCoords, selectedRide, mapStyle]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-[#DFD9CE] bg-[#E8E4DA]">
      <div ref={mapContainerRef} className="w-full h-52 sm:h-64" />

      {/* Bal felül: Térképréteg-választó */}
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

      {/* Jobb felül: Távolság jelvény VAGY Saját helyzet gomb */}
      <div className="absolute top-2 right-2 z-[400] flex items-center gap-1.5">
        {selectedRide && (
          <button
            type="button"
            onClick={() => onSelectRideRef.current && onSelectRideRef.current(null)}
            className="bg-white/95 hover:bg-white text-[#18261F] px-2.5 py-1 rounded-lg text-[11px] font-bold shadow border border-[#DFD9CE]"
          >
            Útvonal bezárása ✕
          </button>
        )}
        {routeMeta && (
          <span className="bg-pilis text-white px-2 py-1 rounded-lg text-[11px] font-bold shadow pointer-events-none">
            {routeMeta.km} km • ~{routeMeta.min} p
          </span>
        )}
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={locating}
          className="bg-white/95 hover:bg-white text-[#18261F] px-2.5 py-1 rounded-lg text-[11px] font-bold shadow border border-[#DFD9CE] transition"
        >
          {locating ? 'Helyzet...' : 'Saját helyzet'}
        </button>
      </div>
    </div>
  );
}

