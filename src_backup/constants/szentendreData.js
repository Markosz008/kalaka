export const SZENTENDRE_CENTER = [47.6694, 19.0756];

export const SZENTENDRE_ZONES = [
  { id: 'felso_pismany', name: 'Felső-Pismány', lat: 47.6925, lng: 19.0485 },
  { id: 'also_pismany', name: 'Alsó-Pismány', lat: 47.6850, lng: 19.0555 },
  { id: 'pismany', name: 'Pismány', lat: 47.6885, lng: 19.0520 },
  { id: 'izbeg', name: 'Izbég', lat: 47.6780, lng: 19.0480 },
  { id: 'sztaravoda', name: 'Sztaravodai út környéke', lat: 47.6840, lng: 19.0610 },
  { id: 'sztelin', name: 'Sztelin', lat: 47.6820, lng: 19.0350 },
  { id: 'kozuzo', name: 'Kőzúzó', lat: 47.6740, lng: 19.0390 },
  { id: 'szarvashegy', name: 'Szarvashegy', lat: 47.6910, lng: 19.0380 },
  { id: 'pannonia', name: 'Pannónia-telep', lat: 47.6565, lng: 19.0725 },
  { id: 'bukkos', name: 'Bükkös-part', lat: 47.6675, lng: 19.0680 },
  { id: 'belvaros', name: 'Belváros', lat: 47.6694, lng: 19.0756 },
  { id: 'vasuti_villasor', name: 'Vasúti villasor', lat: 47.6620, lng: 19.0750 },
  { id: 'deak_utca', name: 'Deák Ferenc utca környéke', lat: 47.6720, lng: 19.0690 },
  { id: 'puspokmajor', name: 'Püspökmajor', lat: 47.6645, lng: 19.0640 },
  { id: 'derecske', name: 'Derecske', lat: 47.6630, lng: 19.0550 },
  { id: 'boldogtanya', name: 'Boldogtanya', lat: 47.6550, lng: 19.0510 },
  { id: 'tyukosdulo', name: 'Tyúkosdűlő', lat: 47.6940, lng: 19.0730 },
  { id: 'szigetmonostor', name: 'Szigetmonostor / Horány', lat: 47.6790, lng: 19.0950 },
  { id: 'leanyfalu', name: 'Leányfalu / Tahitótfalu', lat: 47.7160, lng: 19.0860 }
];

export const PRESET_LOCATIONS = [
  ...SZENTENDRE_ZONES.map((z) => ({
    label: `Szentendre, ${z.name}`,
    shortLabel: z.name,
    category: 'Városrész',
    lat: z.lat,
    lng: z.lng
  })),
  { label: 'Szentendre, Cseresznyés út', shortLabel: 'Cseresznyés út', category: 'Csomópont', lat: 47.6865, lng: 19.0545 },
  { label: 'Szentendre, Barackos út', shortLabel: 'Barackos út', category: 'Csomópont', lat: 47.6895, lng: 19.0510 },
  { label: 'Szentendre, Szabadságforrás', shortLabel: 'Szabadságforrás', category: 'Csomópont', lat: 47.6945, lng: 19.0440 },
  { label: 'Szentendre, Izbégi kisposta', shortLabel: 'Izbégi kisposta', category: 'Csomópont', lat: 47.6776, lng: 19.0485 },
  { label: 'Szentendre, Bükkös patak (Dunakanyar krt.)', shortLabel: 'Bükkös patak / 11-es út', category: 'Csomópont', lat: 47.6682, lng: 19.0725 },
  { label: 'Szentendre, Állomás tér (HÉV végállomás)', shortLabel: 'Szentendre állomás', category: 'Csomópont', lat: 47.6606, lng: 19.0756 },
  { label: 'Budapest, Csillaghegy', shortLabel: 'Budapest, Csillaghegy', category: 'Budapest', lat: 47.5825, lng: 19.0525 },
  { label: 'Budapest, Aquincum / Graphisoft Park', shortLabel: 'Budapest, Aquincum', category: 'Budapest', lat: 47.5620, lng: 19.0510 },
  { label: 'Budapest, Flórián tér', shortLabel: 'Budapest, Flórián tér', category: 'Budapest', lat: 47.5425, lng: 19.0420 },
  { label: 'Budapest, Árpád híd', shortLabel: 'Budapest, Árpád híd', category: 'Budapest', lat: 47.5325, lng: 19.0468 },
  { label: 'Budapest, Margit híd (Budai hídfő)', shortLabel: 'Budapest, Margit híd', category: 'Budapest', lat: 47.5147, lng: 19.0385 },
  { label: 'Budapest, Batthyány tér', shortLabel: 'Budapest, Batthyány tér', category: 'Budapest', lat: 47.5065, lng: 19.0395 },
  { label: 'Budapest, Váci út (irodafolyosó)', shortLabel: 'Budapest, Váci út', category: 'Budapest', lat: 47.5390, lng: 19.0655 }
];

export const PRO_GROUPS = [
  { id: 'all', label: 'Mindenki' },
  { id: 'haz_kert', label: 'Ház és Kert' },
  { id: 'szolgaltatas', label: 'Szolgáltatások' }
];

export const PRO_CATEGORIES = [
  {
    id: 'villany',
    group: 'haz_kert',
    label: 'Villanyszerelő',
    placeholder: 'Pl. Hibaelhárítás, biztosítéktábla, napelem, töltő kiépítés',
    isMobileTrade: true
  },
  {
    id: 'viz_futes',
    group: 'haz_kert',
    label: 'Víz-, gáz-, fűtésszerelő',
    placeholder: 'Pl. Csőtörés, kazán, hőszivattyú, bojler, duguláselhárítás',
    isMobileTrade: true
  },
  {
    id: 'klima',
    group: 'haz_kert',
    label: 'Klíma és szellőzés',
    placeholder: 'Pl. Klímatelepítés, karbantartás, vegyszeres tisztítás',
    isMobileTrade: true
  },
  {
    id: 'kert_haz',
    group: 'haz_kert',
    label: 'Kert és külső munkák',
    placeholder: 'Pl. Öntözőrendszer, fametszés, térkövezés, kerítés',
    isMobileTrade: true
  },
  {
    id: 'epito_asztalos',
    group: 'haz_kert',
    label: 'Asztalos, ács, felújítás',
    placeholder: 'Pl. Egyedi bútor, tetőjavítás, burkolás, festés, nyílászáró',
    isMobileTrade: true
  },
  {
    id: 'fodrasz_szepseg',
    group: 'szolgaltatas',
    label: 'Fodrász és szépségápolás',
    placeholder: 'Pl. Női-férfi fodrász, kozmetika, kéz- és lábápolás',
    isMobileTrade: false
  },
  {
    id: 'masszazs_mozgas',
    group: 'szolgaltatas',
    label: 'Masszőr, gyógytorna, edző',
    placeholder: 'Pl. Gyógymasszázs, sportmasszázs, gyógytorna, személyi edzés',
    isMobileTrade: false
  },
  {
    id: 'pszichologus_mental',
    group: 'szolgaltatas',
    label: 'Pszichológus, tanácsadás',
    placeholder: 'Pl. Egyéni konzultáció, pár- és családterápia, gyermekpszichológia',
    isMobileTrade: false
  },
  {
    id: 'oktatas_gyerek',
    group: 'szolgaltatas',
    label: 'Magántanár, gyerekfelügyelet',
    placeholder: 'Pl. Matematika, angol, hangszeroktatás, délutáni gyermekfelügyelet',
    isMobileTrade: false
  },
  {
    id: 'kisallat',
    group: 'szolgaltatas',
    label: 'Kisállat-ellátás',
    placeholder: 'Pl. Kutyakozmetika, kutyasétáltatás, kisállat-felügyelet',
    isMobileTrade: false
  },
  {
    id: 'penzugy_jog',
    group: 'szolgaltatas',
    label: 'Könyvelő, jogász',
    placeholder: 'Pl. Egyéni vállalkozói könyvelés, adótanácsadás, ingatlanjog',
    isMobileTrade: false
  }
];

export async function searchSzentendreAddresses(query) {
  if (!query || query.trim().length < 2) return [];
  const raw = query.trim();
  const hasCity = /szentendre|budapest|leányfalu|pomáz|budakalász|szigetmonostor|tahitótfalu/i.test(raw);
  const searchQuery = hasCity ? raw : `Szentendre ${raw}`;

  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&countrycodes=hu&q=${encodeURIComponent(searchQuery)}`;
  try {
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'hu' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((item) => {
      const a = item.address || {};
      const city = a.city || a.town || a.village || a.suburb || '';
      const road = a.road || a.pedestrian || a.neighbourhood || a.suburb || '';
      const num = a.house_number ? ` ${a.house_number}.` : '';
      const shortLabel = road
        ? `${city ? city + ', ' : ''}${road}${num}`
        : item.display_name.split(',').slice(0, 2).join(', ');
      return {
        label: shortLabel,
        category: city || 'Cím',
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon)
      };
    });
  } catch {
    return [];
  }
}

export async function reverseGeocodePoint(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'hu' } });
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address || {};
    const city = a.city || a.town || a.village || 'Szentendre';
    const road = a.road || a.pedestrian || a.suburb || a.neighbourhood || '';
    const num = a.house_number ? ` ${a.house_number}.` : '';
    if (road) return `${city}, ${road}${num}`;
    return `${city} (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  } catch {
    return null;
  }
}

export function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const diffMin = Math.round((new Date(isoString).getTime() - Date.now()) / 60000);
  if (diffMin < 0) {
    const pastMin = Math.abs(diffMin);
    if (pastMin < 60) return `${pastMin} perce`;
    return `${Math.round(pastMin / 60)} órája`;
  }
  if (diffMin < 60) return `${diffMin} perc múlva`;
  const hours = Math.floor(diffMin / 60);
  return `${hours} óra múlva`;
}
