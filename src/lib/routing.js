const R = 6371;
const rad = (d) => (d * Math.PI) / 180;

export function straightKm(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Autós útvonal (OSRM). Ha nem elérhető, légvonal alapú becslés.
export async function getRoute(a, b, signal) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error('route');
    const data = await res.json();
    const r = data.routes && data.routes[0];
    if (!r) throw new Error('route');
    return {
      km: r.distance / 1000,
      min: Math.max(1, Math.round(r.duration / 60)),
      coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      estimated: false
    };
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    const km = straightKm(a, b) * 1.3;
    return { km, min: Math.max(1, Math.round((km / 35) * 60)), coords: null, estimated: true };
  }
}

export function formatTrip(info) {
  if (!info) return '';
  const km = info.km.toFixed(1).replace('.', ',');
  return `${info.estimated ? 'kb. ' : ''}${km} km • ${info.estimated ? 'kb. ' : '~'}${info.min} perc`;
}
