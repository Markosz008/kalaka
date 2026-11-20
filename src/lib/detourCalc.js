import {
  SZENTENDRE_BUS_STOPS,
  SZENTENDRE_ZONES,
  resolveCoordsFromText
} from '../constants/szentendreData.js';

const EXTRA_REGIONAL_POINTS = [
  { keys: ['pomáz', 'pomaz'], lat: 47.6485, lng: 19.0245, label: 'Pomáz' },
  { keys: ['budakalász', 'budakalasz', 'omszk'], lat: 47.6215, lng: 19.0485, label: 'Budakalász' },
  { keys: ['leányfalu', 'leanyfalu'], lat: 47.7175, lng: 19.0885, label: 'Leányfalu' },
  { keys: ['tahitótfalu', 'tahitotfalu'], lat: 47.7525, lng: 19.0765, label: 'Tahitótfalu' },
  { keys: ['dunabogdány', 'dunabogdany'], lat: 47.7985, lng: 19.0435, label: 'Dunabogdány' },
  { keys: ['visegrád', 'visegrad'], lat: 47.7925, lng: 18.9725, label: 'Visegrád' },
  { keys: ['békásmegyer', 'bekasmegyer'], lat: 47.5995, lng: 19.0545, label: 'Békásmegyer' },
  { keys: ['csillaghegy'], lat: 47.5845, lng: 19.0465, label: 'Csillaghegy' },
  { keys: ['rómaifürdő', 'romaifurdo', 'aquincum'], lat: 47.5665, lng: 19.0505, label: 'Óbuda / Aquincum' },
  { keys: ['flórián', 'florian', 'óbuda', 'obuda'], lat: 47.5415, lng: 19.0415, label: 'Óbuda, Flórián tér' },
  { keys: ['margit híd', 'margit hid'], lat: 47.5150, lng: 19.0390, label: 'Margit híd' },
  { keys: ['nyugati'], lat: 47.5105, lng: 19.0565, label: 'Nyugati pályaudvar' },
  { keys: ['pilisborosjenő', 'pilisborosjeno', 'üröm', 'urom'], lat: 47.6035, lng: 19.0085, label: 'Üröm / Pilisborosjenő' },
  { keys: ['szentendre'], lat: 47.6673, lng: 19.0756, label: 'Szentendre' },
  { keys: ['budapest'], lat: 47.5325, lng: 19.0660, label: 'Budapest' }
];

export function haversineKm(a, b) {
  if (!a || !b) return 0;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function resolvePointCoords(text) {
  if (!text) return null;
  const clean = String(text).replace(/^\d{2}:\d{2}\s*/, '').trim();
  const baseHit = resolveCoordsFromText(clean);
  if (baseHit) return baseHit;

  const q = clean.toLowerCase();
  const regionalHit = EXTRA_REGIONAL_POINTS.find((p) =>
    p.keys.some((k) => q.includes(k))
  );
  if (regionalHit) {
    return { lat: regionalHit.lat, lng: regionalHit.lng, label: regionalHit.label };
  }
  return null;
}

export function estimateRideDetour(originCoords, destCoords, pickupCoords) {
  if (!pickupCoords || (!originCoords && !destCoords)) return null;

  let rawExtraKm = 0;
  if (originCoords && destCoords) {
    const direct = haversineKm(originCoords, destCoords);
    const viaPickup = haversineKm(originCoords, pickupCoords) + haversineKm(pickupCoords, destCoords);
    rawExtraKm = Math.max(0, viaPickup - direct);
  } else {
    rawExtraKm = haversineKm(originCoords || destCoords, pickupCoords);
  }

  const extraKm = Math.round(rawExtraKm * 1.35 * 10) / 10;
  const extraMins = extraKm < 0.3 ? 0 : Math.max(1, Math.round(extraKm * 2.4));
  const kmStr = extraKm.toFixed(1).replace('.', ',');

  if (extraKm <= 1.0) {
    return {
      extraKm,
      extraMins,
      level: 'on_route',
      label: extraKm < 0.3 ? 'Útba esik' : `Útba esik (+${kmStr} km)`,
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200'
    };
  }

  if (extraKm <= 2.5) {
    return {
      extraKm,
      extraMins,
      level: 'small',
      label: `Kis kitérő (+${kmStr} km • ~${extraMins} perc)`,
      badgeClass: 'bg-amber-50 text-amber-900 border-amber-200'
    };
  }

  return {
    extraKm,
    extraMins,
    level: 'large',
    label: `Nagy kitérő (+${kmStr} km • ~${extraMins} perc)`,
    badgeClass: 'bg-red-50 text-red-800 border-red-200'
  };
}

export function getSuggestedPickupOptions(originCoords, destCoords, rideStops = []) {
  const seen = new Set();
  const options = [];

  if (Array.isArray(rideStops)) {
    rideStops.forEach((st) => {
      if (!st?.name) return;
      const key = st.name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      const coords = st.lat && st.lng ? { lat: st.lat, lng: st.lng } : resolvePointCoords(st.name);
      const detour = estimateRideDetour(originCoords, destCoords, coords);
      options.push({
        id: `ride-${key}`,
        name: st.name,
        shortName: st.name.replace(/^Szentendre,\s*/i, ''),
        subtitle: st.time ? `Sofőr megállója • ${st.time}` : 'Sofőr megállója',
        time: st.time || '',
        lat: coords?.lat || null,
        lng: coords?.lng || null,
        isDriverStop: true,
        detour
      });
    });
  }

  SZENTENDRE_BUS_STOPS.forEach((s) => {
    const shortName = s.name.replace(/^Szentendre,\s*/i, '');
    const key = shortName.toLowerCase();
    if (seen.has(key) || seen.has(s.name.toLowerCase())) return;
    seen.add(key);
    const coords = { lat: s.lat, lng: s.lng };
    const detour = estimateRideDetour(originCoords, destCoords, coords);
    options.push({
      id: s.id,
      name: shortName,
      shortName,
      subtitle: `${s.zone} • ${s.lines}`,
      time: '',
      lat: s.lat,
      lng: s.lng,
      isDriverStop: false,
      detour
    });
  });

  SZENTENDRE_ZONES.forEach((z) => {
    const key = z.name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const coords = { lat: z.lat, lng: z.lng };
    const detour = estimateRideDetour(originCoords, destCoords, coords);
    options.push({
      id: `zone-${z.id}`,
      name: `${z.name} (városrész)`,
      shortName: z.name,
      subtitle: 'Szentendre városrész',
      time: '',
      lat: z.lat,
      lng: z.lng,
      isDriverStop: false,
      detour
    });
  });

  options.sort((a, b) => {
    if (a.isDriverStop !== b.isDriverStop) return a.isDriverStop ? -1 : 1;
    const da = a.detour ? a.detour.extraKm : 99;
    const db = b.detour ? b.detour.extraKm : 99;
    return da - db;
  });

  return options;
}
