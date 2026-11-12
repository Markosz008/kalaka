// Valós szentendrei városrészek pontos középponti koordinátákkal
export const SZENTENDRE_ZONES = [
  { id: 'belvaros', name: 'Belváros', lat: 47.6673, lng: 19.0756 },
  { id: 'bukkos', name: 'Bükkös-part', lat: 47.6698, lng: 19.0715 },
  { id: 'dunakorzo', name: 'Dunakorzó', lat: 47.6685, lng: 19.0785 },
  { id: 'puspokmajor', name: 'Püspökmajor', lat: 47.6635, lng: 19.0645 },
  { id: 'kalvaria', name: 'Kálvária', lat: 47.6695, lng: 19.0630 },
  { id: 'szamarhegy', name: 'Szamárhegy', lat: 47.6715, lng: 19.0745 },
  { id: 'pismany_also', name: 'Alsó-Pismány', lat: 47.6860, lng: 19.0620 },
  { id: 'pismany_felso', name: 'Felső-Pismány', lat: 47.6918, lng: 19.0517 },
  { id: 'szarvashegy', name: 'Szarvashegy', lat: 47.6855, lng: 19.0268 },
  { id: 'izbeg', name: 'Izbég', lat: 47.6782, lng: 19.0485 },
  { id: 'sztaravoda', name: 'Sztaravoda', lat: 47.6880, lng: 19.0510 },
  { id: 'pannonia', name: 'Pannóniatelep', lat: 47.6512, lng: 19.0715 },
  { id: 'vasuti', name: 'Vasúti villasor', lat: 47.6602, lng: 19.0738 },
  { id: 'tyukosdulo', name: 'Tyúkosdűlő és Dera-part', lat: 47.6980, lng: 19.0810 },
  { id: 'derecske', name: 'Derecske', lat: 47.6560, lng: 19.0540 }
];

// Fő szolgáltatási és szakmai területek (fizikai szakik + helyi szolgáltatók együtt)
export const SERVICE_GROUPS = [
  { id: 'all', label: 'Összes' },
  { id: 'otthon', label: 'Otthon és szerelés' },
  { id: 'szepseg_egeszseg', label: 'Szépség és egészség' },
  { id: 'auto_muhely', label: 'Autó és műhely' },
  { id: 'kezmuves_gasztro', label: 'Kézműves és gasztro' },
  { id: 'mozgas_oktatas', label: 'Edzés és oktatás' }
];

// Induló szakmalista (bármikor bővíthető új szakmával az űrlapból!)
export const DEFAULT_PROFESSIONS = [
  { name: 'Villanyszerelő', group: 'otthon' },
  { name: 'Víz- és fűtésszerelő', group: 'otthon' },
  { name: 'Klímaszerelő', group: 'otthon' },
  { name: 'Kertész', group: 'otthon' },
  { name: 'Asztalos', group: 'otthon' },
  { name: 'Fodrász', group: 'szepseg_egeszseg' },
  { name: 'Kozmetikus', group: 'szepseg_egeszseg' },
  { name: 'Masszőr', group: 'szepseg_egeszseg' },
  { name: 'Pszichológus', group: 'szepseg_egeszseg' },
  { name: 'Fogorvos', group: 'szepseg_egeszseg' },
  { name: 'Gyógytornász', group: 'szepseg_egeszseg' },
  { name: 'Autószerelő', group: 'auto_muhely' },
  { name: 'Gumiszerviz', group: 'auto_muhely' },
  { name: 'Autóvillamosság', group: 'auto_muhely' },
  { name: 'Ötvös', group: 'kezmuves_gasztro' },
  { name: 'Cukrász', group: 'kezmuves_gasztro' },
  { name: 'Varrónő / Szabó', group: 'kezmuves_gasztro' },
  { name: 'Személyi edző', group: 'mozgas_oktatas' },
  { name: 'Jóga / Pilates oktató', group: 'mozgas_oktatas' },
  { name: 'Nyelvtanár / Korrepetálás', group: 'mozgas_oktatas' }
];

export function normalizeServiceGroup(cat) {
  if (['villany', 'viz_futes', 'klima', 'kert_haz', 'otthon'].includes(cat)) {
    return 'otthon';
  }
  return cat || 'otthon';
}

export const PRO_CATEGORIES = SERVICE_GROUPS;

// Valós szentendrei közlekedési csomópontok és buszöblök
export const LOCAL_PLACES = [
  { name: 'Szentendre, Fogoly utca', subtitle: '2000 Szentendre (Pismány)', lat: 47.6918, lng: 19.0517 },
  { name: 'Szabadságforrás buszforduló', subtitle: 'Szentendre, Felső-Pismány', lat: 47.6948, lng: 19.0462 },
  { name: 'Pismány, Cseresznyés út sarok', subtitle: 'Szabadságforrás út • Pismány', lat: 47.6902, lng: 19.0558 },
  { name: 'Alsó-Pismány, Barackos út', subtitle: '2000 Szentendre', lat: 47.6860, lng: 19.0620 },
  { name: '11-es út • Papírgyár megálló', subtitle: 'Szabadságforrás út torkolat', lat: 47.6852, lng: 19.0772 },
  { name: '11-es út • Sztaravodai csomópont', subtitle: 'ALDI / Lukoil kereszteződés', lat: 47.6761, lng: 19.0754 },
  { name: 'Bükkös-part • 11-es út sarok', subtitle: 'Apor híd lábánál', lat: 47.6701, lng: 19.0748 },
  { name: 'Szentendre HÉV-végállomás', subtitle: 'Állomás tér P+R', lat: 47.6602, lng: 19.0738 },
  { name: 'Pannóniatelep HÉV-megálló', subtitle: '11-es út déli csomópont', lat: 47.6512, lng: 19.0715 },
  { name: 'Szentendre, Fő tér', subtitle: 'Belváros', lat: 47.6673, lng: 19.0756 },
  { name: 'Izbég, Szentlászlói út (Iskola)', subtitle: '2000 Szentendre', lat: 47.6782, lng: 19.0485 },
  { name: 'Szarvashegyi elágazás', subtitle: 'Szentlászlói út • Buszöböl', lat: 47.6855, lng: 19.0268 },
  { name: 'Szarvashegy, Tölgyfa utca', subtitle: '2000 Szentendre', lat: 47.6890, lng: 19.0220 },
  { name: 'Skanzen bejárat', subtitle: 'Sztaravodai út', lat: 47.6915, lng: 19.0445 },
  { name: 'Püspökmajori lakótelep', subtitle: 'Kálvária út', lat: 47.6635, lng: 19.0645 },
  { name: 'Újpest-Városkapu (M3 metró)', subtitle: 'Budapest, XIII./IV. kerület', lat: 47.5605, lng: 19.0792 },
  { name: 'Budapest, Batthyány tér', subtitle: 'Budapest, I. kerület (H5 HÉV)', lat: 47.5065, lng: 19.0399 },
  { name: 'Budapest, Göncz Árpád városközpont', subtitle: 'Budapest, Árpád híd', lat: 47.5325, lng: 19.0660 }
];

export const PRESET_LOCATIONS = LOCAL_PLACES;

export const MAP_TRANSIT_POINTS = LOCAL_PLACES.slice(1, 13).map((p, idx) => ({
  id: `pt_${idx}`,
  name: p.name,
  short: p.name.split('•').pop().split(',')[0].trim(),
  lat: p.lat,
  lng: p.lng
}));

export const VALIDITY_OPTIONS = [
  { minutes: 30, label: '30 percig' },
  { minutes: 60, label: '1 óráig' },
  { minutes: 180, label: '3 óráig' },
  { minutes: 720, label: '12 óráig' },
  { minutes: 1440, label: '24 óráig' },
  { minutes: 10080, label: '7 napig' }
];

export function formatRemainingTime(expiresAtIso) {
  if (!expiresAtIso) return null;
  const diffMs = new Date(expiresAtIso).getTime() - Date.now();
  if (diffMs <= 0) return null;
  const totalMins = Math.ceil(diffMs / 60000);
  if (totalMins < 60) return `${totalMins} percig aktív`;
  const hours = Math.floor(totalMins / 60);
  if (hours < 24) return `${hours} óráig aktív`;
  const days = Math.ceil(hours / 24);
  return `${days} napig aktív`;
}

export function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const diffSec = Math.max(1, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));
  if (diffSec < 60) return 'most';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} perce`;
  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour} órája`;
}

export function resolveCoordsFromText(text) {
  if (!text) return null;
  const q = text.trim().toLowerCase();

  if (q.includes('fogoly')) {
    return { lat: 47.6918, lng: 19.0517, label: text };
  }

  const exactOrPartial = LOCAL_PLACES.find(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      q.includes(p.name.toLowerCase().split(',')[0])
  );
  if (exactOrPartial) {
    return { lat: exactOrPartial.lat, lng: exactOrPartial.lng, label: exactOrPartial.name };
  }

  const zone = SZENTENDRE_ZONES.find(
    (z) => z.name.toLowerCase().includes(q) || q.includes(z.name.toLowerCase())
  );
  if (zone) {
    return { lat: zone.lat, lng: zone.lng, label: zone.name };
  }

  if (q.includes('újpest') || q.includes('ujpest')) return { lat: 47.5605, lng: 19.0792, label: text };
  if (q.includes('batthyány') || q.includes('batthyany')) return { lat: 47.5065, lng: 19.0399, label: text };
  if (q.includes('árpád') || q.includes('göncz')) return { lat: 47.5325, lng: 19.0660, label: text };
  if (q.includes('hév') || q.includes('hev')) return { lat: 47.6602, lng: 19.0738, label: 'Szentendre HÉV-végállomás' };

  return null;
}

export async function searchAddressSuggestions(query) {
  const raw = (query || '').trim();
  if (raw.length < 2) return [];

  const qLower = raw.toLowerCase();
  const houseMatch = raw.match(/(\d+[a-zA-Z/.-]*)\s*$/);
  const typedHouseNumber = houseMatch ? houseMatch[1].replace(/\.*$/, '') : null;

  const localMatches = LOCAL_PLACES.filter(
    (p) =>
      p.name.toLowerCase().includes(qLower) ||
      p.subtitle.toLowerCase().includes(qLower)
  ).map((p) => {
    if (typedHouseNumber && !p.name.match(/\d/) && p.name.toLowerCase().includes('utca')) {
      return {
        ...p,
        name: `${p.name} ${typedHouseNumber}.`
      };
    }
    return p;
  });

  try {
    const cleanedForGeocoder = raw
      .replace(/^(felső-pismány|alsó-pismány|pismány|szarvashegy|izbég|sztaravoda|belváros)[,\s-]*/i, '')
      .trim();

    const searchTerm =
      cleanedForGeocoder.toLowerCase().includes('budapest') ||
      cleanedForGeocoder.toLowerCase().includes('újpest') ||
      cleanedForGeocoder.toLowerCase().includes('pomáz')
        ? cleanedForGeocoder
        : `${cleanedForGeocoder}, Szentendre`;

    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=hu&viewbox=18.95,47.76,19.20,47.48&bounded=1&limit=6&accept-language=hu&q=${encodeURIComponent(
      searchTerm
    )}`;

    const res = await fetch(url);
    const rows = await res.json();

    const remoteMatches = (rows || [])
      .map((item) => {
        const addr = item.address || {};
        const city =
          addr.city ||
          addr.town ||
          addr.village ||
          addr.suburb ||
          'Szentendre';
        const road = addr.road || addr.pedestrian || addr.residential || item.name || '';
        const house = addr.house_number
          ? `${addr.house_number}.`
          : typedHouseNumber && road
          ? `${typedHouseNumber}.`
          : '';

        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        if (!lat || !lng || (!road && !item.name)) return null;

        const mainTitle = road
          ? `${city === 'Szentendre' ? 'Szentendre, ' : city + ', '}${road}${house ? ' ' + house : ''}`
          : item.display_name.split(',').slice(0, 2).join(', ');

        return {
          name: mainTitle.trim(),
          subtitle: `${addr.postcode || '2000'} ${city}${addr.suburb ? ' • ' + addr.suburb : ''}`,
          lat,
          lng
        };
      })
      .filter(Boolean);

    const combined = [...localMatches];
    remoteMatches.forEach((rm) => {
      if (!combined.some((c) => c.name.toLowerCase() === rm.name.toLowerCase())) {
        combined.push(rm);
      }
    });

    return combined.slice(0, 6);
  } catch {
    return localMatches.slice(0, 6);
  }
}

