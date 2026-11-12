import { LOCAL_PLACES, resolveCoordsFromText } from '../constants/szentendreData.js';

const routeCache = new Map();

function addMinutesToTime(timeStr, minsToAdd) {
  const [hh, mm] = (timeStr || '05:50').split(':').map(Number);
  const totalMins = (hh * 60 + mm + minsToAdd + 1440) % 1440;
  const nh = String(Math.floor(totalMins / 60)).padStart(2, '0');
  const nm = String(totalMins % 60).padStart(2, '0');
  return `${nh}:${nm}`;
}

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
  const key = `${startCoord.lat.toFixed(4)},${startCoord.lng.toFixed(4)}->${endCoord.lat.toFixed(4)},${endCoord.lng.toFixed(4)}`;
  if (routeCache.has(key)) return routeCache.get(key);

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${startCoord.lng},${startCoord.lat};${endCoord.lng},${endCoord.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data?.routes?.[0]) {
      const r = data.routes[0];
      const result = {
        coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
        distanceMeters: r.distance,
        durationSeconds: r.duration
      };
      routeCache.set(key, result);
      return result;
    }
  } catch {
    // Hálózati hiba esetén egyenes szakasz fallback
  }

  const fallback = {
    coords: [
      [startCoord.lat, startCoord.lng],
      [endCoord.lat, endCoord.lng]
    ],
    distanceMeters: 5000,
    durationSeconds: 600,
    isFallback: true
  };
  return fallback;
}

export async function computeStopsAlongRoute(ride) {
  if (!ride || ride.kind !== 'offer') return [];

  const startCoord =
    ride.origin_lat && ride.origin_lng
      ? { lat: ride.origin_lat, lng: ride.origin_lng }
      : resolveCoordsFromText(ride.origin_text);

  const endCoord =
    ride.dest_lat && ride.dest_lng
      ? { lat: ride.dest_lat, lng: ride.dest_lng }
      : resolveCoordsFromText(ride.dest_text);

  if (!startCoord || !endCoord) return [];

  const route = await fetchDrivingRoute(startCoord, endCoord);
  if (!route || !route.coords || route.coords.length < 2) return [];

  const maxCorridorMeters = route.isFallback ? 350 : 260;
  const candidates = [];

  for (const place of LOCAL_PLACES) {
    // Indulási és érkezési pont közvetlen környezetét (220 m) kihagyjuk
    const distFromStart = Math.hypot(
      (place.lat - startCoord.lat) * 111132,
      (place.lng - startCoord.lng) * 74830
    );
    const distFromEnd = Math.hypot(
      (place.lat - endCoord.lat) * 111132,
      (place.lng - endCoord.lng) * 74830
    );
    if (distFromStart < 220 || distFromEnd < 220) continue;

    const proj = projectPointToPolyline({ lat: place.lat, lng: place.lng }, route.coords);
    if (!proj || proj.totalMeters < 400) continue;

    const fraction = proj.alongMeters / proj.totalMeters;
    if (proj.distanceMeters <= maxCorridorMeters && fraction > 0.04 && fraction < 0.96) {
      candidates.push({
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        alongMeters: proj.alongMeters,
        fraction
      });
    }
  }

  // Haladási irány szerinti sorbarendezés
  candidates.sort((a, b) => a.alongMeters - b.alongMeters);

  // Túl közeli (300 m-en belüli) megállók ritkítása
  const deduped = [];
  for (const c of candidates) {
    if (
      deduped.length === 0 ||
      c.alongMeters - deduped[deduped.length - 1].alongMeters >= 300
    ) {
      deduped.push(c);
    }
  }

  return deduped.slice(0, 6).map((c) => {
    const minsFromStart = Math.max(1, Math.round((c.fraction * route.durationSeconds) / 60));
    return {
      time: addMinutesToTime(ride.time_label, minsFromStart),
      name: c.name,
      lat: c.lat,
      lng: c.lng
    };
  });
}
