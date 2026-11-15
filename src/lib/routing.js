import { resolveCoordsFromText } from '../constants/szentendreData.js';

const routeCache = new Map();

// Kizárólag valódi főúti csomópontok a kereső/szűrő chipek támogatásához (mellékutcák nélkül)
const MAIN_CORRIDOR_HUBS = [
  { name: '11-es út • Papírgyár', lat: 47.6852, lng: 19.0732 },
  { name: '11-es út • Sztaravodai csomópont', lat: 47.6761, lng: 19.0754 },
  { name: 'Bükkös-part', lat: 47.6701, lng: 19.0739 },
  { name: 'Szentendre HÉV-végállomás', lat: 47.6602, lng: 19.0738 },
  { name: 'Pannóniatelep', lat: 47.6512, lng: 19.0715 }
];

function toMetersXY(lat, lng, refLat, refLng) {
  const latScale = 111132;
  const lngScale = 111132 * Math.cos((refLat * Math.PI) / 180);
  return {
    x: (lng - refLng) * lngScale,
    y: (lat - refLat) * latScale
  };
}

function projectPointToPolyline(pt, polyCoords) {
  if (!polyCoords || polyCoords.length < 2) return null;
  const refLat = pt.lat;
  const refLng = pt.lng;
  const P = toMetersXY(pt.lat, pt.lng, refLat, refLng);

  let bestDist = Infinity;
  let bestAlongMeters = 0;
  let cumMeters = 0;

  for (let i = 0; i < polyCoords.length - 1; i++) {
    const [lat1, lng1] = polyCoords[i];
    const [lat2, lng2] = polyCoords[i + 1];
    const A = toMetersXY(lat1, lng1, refLat, refLng);
    const B = toMetersXY(lat2, lng2, refLat, refLng);

    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const segLenSq = dx * dx + dy * dy;
    const segLen = Math.sqrt(segLenSq);

    let t = 0;
    if (segLenSq > 0) {
      t = ((P.x - A.x) * dx + (P.y - A.y) * dy) / segLenSq;
      t = Math.max(0, Math.min(1, t));
    }

    const projX = A.x + t * dx;
    const projY = A.y + t * dy;
    const dist = Math.hypot(P.x - projX, P.y - projY);

    if (dist < bestDist) {
      bestDist = dist;
      bestAlongMeters = cumMeters + t * segLen;
    }

    cumMeters += segLen;
  }

  return {
    distanceMeters: bestDist,
    alongMeters: bestAlongMeters,
    totalMeters: cumMeters
  };
}

export async function fetchDrivingRoute(startCoord, endCoord) {
  if (!startCoord || !endCoord) return null;
  const key = `osrm_v2_${startCoord.lat.toFixed(4)},${startCoord.lng.toFixed(4)}->${endCoord.lat.toFixed(4)},${endCoord.lng.toFixed(4)}`;
  if (routeCache.has(key)) return routeCache.get(key);

  try {
    const cachedStr = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null;
    if (cachedStr) {
      const parsed = JSON.parse(cachedStr);
      if (parsed && Array.isArray(parsed.coords)) {
        routeCache.set(key, parsed);
        return parsed;
      }
    }
  } catch {}

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const url = `https://router.project-osrm.org/route/v1/driving/${startCoord.lng},${startCoord.lat};${endCoord.lng},${endCoord.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const data = await res.json();
    if (data?.routes?.[0]) {
      const r = data.routes[0];
      const result = {
        coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
        distanceMeters: r.distance,
        durationSeconds: r.duration
      };
      routeCache.set(key, result);
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(key, JSON.stringify(result));
        }
      } catch {}
      return result;
    }
  } catch {}

  return null;
}

export async function computeStopsAlongRoute(ride) {
  if (!ride || ride.kind !== 'offer') return [];

  const startCoord =
    ride.origin_lat && ride.origin_lng
      ? { lat: Number(ride.origin_lat), lng: Number(ride.origin_lng) }
      : resolveCoordsFromText(ride.origin_text);

  const endCoord =
    ride.dest_lat && ride.dest_lng
      ? { lat: Number(ride.dest_lat), lng: Number(ride.dest_lng) }
      : resolveCoordsFromText(ride.dest_text);

  if (!startCoord || !endCoord) return [];

  const route = await fetchDrivingRoute(startCoord, endCoord);
  if (!route || !route.coords || route.coords.length < 2) return [];

  const matchedHubs = [];
  for (const hub of MAIN_CORRIDOR_HUBS) {
    const proj = projectPointToPolyline({ lat: hub.lat, lng: hub.lng }, route.coords);
    if (!proj || proj.totalMeters < 400) continue;
    const fraction = proj.alongMeters / proj.totalMeters;
    // Szigorú, 100 méteres távolság a főúttól, hogy mellékutca soha ne kerüljön bele
    if (proj.distanceMeters <= 100 && fraction > 0.05 && fraction < 0.95) {
      matchedHubs.push({ name: hub.name, lat: hub.lat, lng: hub.lng });
    }
  }

  return matchedHubs;
}
