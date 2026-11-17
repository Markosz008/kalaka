export const SZENTENDRE_ZONES = [
  { id: 'belvaros', name: 'Belváros', lat: 47.6673, lng: 19.0756 },
  { id: 'bukkos', name: 'Bükkös-part', lat: 47.6698, lng: 19.0715 },
  { id: 'dunakorzo', name: 'Dunakorzó', lat: 47.6685, lng: 19.0785 },
  { id: 'puspokmajor', name: 'Püspökmajor', lat: 47.6635, lng: 19.0645 },
  { id: 'kalvaria', name: 'Kálvária', lat: 47.6695, lng: 19.0630 },
  { id: 'szamarhegy', name: 'Szamárhegy', lat: 47.6715, lng: 19.0745 },
  { id: 'pismany', name: 'Pismány', lat: 47.6895, lng: 19.0555 },
  { id: 'szarvashegy', name: 'Szarvashegy', lat: 47.6855, lng: 19.0268 },
  { id: 'izbeg', name: 'Izbég', lat: 47.6782, lng: 19.0485 },
  { id: 'sztaravoda', name: 'Sztaravoda', lat: 47.6880, lng: 19.0510 },
  { id: 'pannonia', name: 'Pannóniatelep', lat: 47.6512, lng: 19.0715 },
  { id: 'vasuti', name: 'Vasúti villasor', lat: 47.6602, lng: 19.0738 },
  { id: 'tyukosdulo', name: 'Tyúkosdűlő és Dera-part', lat: 47.6980, lng: 19.0810 },
  { id: 'derecske', name: 'Derecske', lat: 47.6560, lng: 19.0540 }
];

export const SZENTENDRE_BUS_STOPS = [
  { id: 'bs_hev', name: 'Szentendre autóbusz-állomás (HÉV)', lines: 'H5, 870–889', zone: 'Vasúti villasor', lat: 47.6602, lng: 19.0738 },
  { id: 'bs_pannonia', name: 'Szentendre, Pannóniatelep HÉV', lines: 'H5, 880, 882, 884, 889', zone: 'Pannóniatelep', lat: 47.6512, lng: 19.0715 },
  { id: 'bs_egri', name: 'Szentendre, Egri utca', lines: '880, 882, 884, 889', zone: 'Pannóniatelep', lat: 47.6548, lng: 19.0725 },
  { id: 'bs_fokt', name: 'Szentendre, Római sánc', lines: '880, 882, 884, 889', zone: 'Belváros', lat: 47.6648, lng: 19.0748 },
  { id: 'bs_bukkos', name: 'Szentendre, Bükkös patak', lines: '870, 878, 879, 880, 882, 884, 889', zone: 'Bükkös-part', lat: 47.6701, lng: 19.0741 },
  { id: 'bs_dunakorzo', name: 'Szentendre, Dunakorzó / Lázár cár tér', lines: '880, 889', zone: 'Dunakorzó', lat: 47.6685, lng: 19.0778 },
  { id: 'bs_szamarhegy_alja', name: 'Szentendre, Szamárhegy (Városháza)', lines: '870, 880, 889', zone: 'Szamárhegy', lat: 47.6718, lng: 19.0748 },
  { id: 'bs_sztaravodai_ut', name: 'Szentendre, Sztaravodai út (11-es út)', lines: '870, 878, 879, 880, 882, 884, 889', zone: 'Belváros', lat: 47.6761, lng: 19.0754 },
  { id: 'bs_papirgyar', name: 'Szentendre, Papírgyár', lines: '878, 879, 880, 882, 884, 889', zone: 'Pismány', lat: 47.6852, lng: 19.0732 },
  { id: 'bs_pismany_elag', name: 'Szentendre, Pismányi elágazás', lines: '878, 879, 880, 882, 884', zone: 'Pismány', lat: 47.6894, lng: 19.0762 },
  { id: 'bs_dera', name: 'Szentendre, Dera-patak / Híd', lines: '880, 882, 884, 889', zone: 'Tyúkosdűlő és Dera-part', lat: 47.6952, lng: 19.0795 },
  { id: 'bs_tyukosdulo', name: 'Szentendre, Tyúkosdűlő', lines: '880, 882, 884, 889', zone: 'Tyúkosdűlő és Dera-part', lat: 47.6992, lng: 19.0818 },

  { id: 'bs_barackos', name: 'Szentendre, Barackos út', lines: '878, 879', zone: 'Pismány', lat: 47.6860, lng: 19.0620 },
  { id: 'bs_szilvas', name: 'Szentendre, Szilvás utca', lines: '878, 879', zone: 'Pismány', lat: 47.6881, lng: 19.0588 },
  { id: 'bs_cseresznyes', name: 'Szentendre, Cseresznyés út', lines: '878, 879', zone: 'Pismány', lat: 47.6902, lng: 19.0558 },
  { id: 'bs_mandulas', name: 'Szentendre, Mandulás utca', lines: '878, 879', zone: 'Pismány', lat: 47.6924, lng: 19.0512 },
  { id: 'bs_szabadsagforras', name: 'Szentendre, Szabadságforrás (buszforduló)', lines: '878, 879', zone: 'Pismány', lat: 47.6948, lng: 19.0462 },

  { id: 'bs_kalvaria_ter', name: 'Szentendre, Kálvária tér', lines: '870, 871, 876, 877', zone: 'Kálvária', lat: 47.6712, lng: 19.0672 },
  { id: 'bs_canissa', name: 'Szentendre, Canissa utca', lines: '870, 871', zone: 'Kálvária', lat: 47.6752, lng: 19.0655 },
  { id: 'bs_tehenesz', name: 'Szentendre, Tehenész utca', lines: '870, 871', zone: 'Sztaravoda', lat: 47.6815, lng: 19.0575 },
  { id: 'bs_sztaravoda_forras', name: 'Szentendre, Sztaravoda forrás', lines: '870, 871', zone: 'Sztaravoda', lat: 47.6872, lng: 19.0505 },
  { id: 'bs_skanzen', name: 'Szentendre, Szabadtéri Néprajzi Múzeum (Skanzen)', lines: '870, 871', zone: 'Sztaravoda', lat: 47.6915, lng: 19.0445 },

  { id: 'bs_vasuti_villasor', name: 'Szentendre, Vasúti villasor', lines: '872, 873, 874, 876, 877', zone: 'Vasúti villasor', lat: 47.6618, lng: 19.0695 },
  { id: 'bs_baratsag_koz', name: 'Szentendre, Barátság köz', lines: '876, 877', zone: 'Püspökmajor', lat: 47.6612, lng: 19.0668 },
  { id: 'bs_tavaszi_utca', name: 'Szentendre, Tavaszi utca', lines: '876, 877', zone: 'Püspökmajor', lat: 47.6608, lng: 19.0635 },
  { id: 'bs_puspokmajor_lakotelep', name: 'Szentendre, Püspökmajori lakótelep', lines: '876, 877', zone: 'Püspökmajor', lat: 47.6635, lng: 19.0645 },
  { id: 'bs_vasvari_lakotelep', name: 'Szentendre, Vasvári lakótelep', lines: '876, 877', zone: 'Püspökmajor', lat: 47.6675, lng: 19.0630 },
  { id: 'bs_kalvaria_ut', name: 'Szentendre, Kálvária út (Rendelőintézet)', lines: '876, 877', zone: 'Püspökmajor', lat: 47.6688, lng: 19.0650 },
  { id: 'bs_jázmin_utca', name: 'Szentendre, Jázmin utca', lines: '875, 876, 877', zone: 'Pannóniatelep', lat: 47.6562, lng: 19.0698 },
  { id: 'bs_egres_ut', name: 'Szentendre, Egres út', lines: '875, 876, 877', zone: 'Pannóniatelep', lat: 47.6545, lng: 19.0685 },

  { id: 'bs_izbegi_elagazas', name: 'Szentendre, Izbégi elágazás', lines: '872, 873, 874', zone: 'Izbég', lat: 47.6745, lng: 19.0558 },
  { id: 'bs_szentlaszlo_iskola', name: 'Szentendre, Izbég, Szentlászlói út (Iskola)', lines: '872, 873, 874, 876, 877', zone: 'Izbég', lat: 47.6782, lng: 19.0485 },
  { id: 'bs_izbeg_templom', name: 'Szentendre, Izbég, Templom', lines: '872, 873, 874', zone: 'Izbég', lat: 47.6805, lng: 19.0435 },
  { id: 'bs_izbeg_sportpalya', name: 'Szentendre, Izbég, Sportpálya', lines: '872, 873, 874', zone: 'Izbég', lat: 47.6830, lng: 19.0365 },
  { id: 'bs_szarvashegy_elag', name: 'Szentendre, Szarvashegyi elágazás', lines: '872, 873, 874', zone: 'Szarvashegy', lat: 47.6855, lng: 19.0268 },
  { id: 'bs_szarvashegy_tolgyfa', name: 'Szentendre, Szarvashegy, Tölgyfa utca', lines: '872, 873, 874', zone: 'Szarvashegy', lat: 47.6890, lng: 19.0220 },
  { id: 'bs_szarvashegy_fordulo', name: 'Szentendre, Szarvashegy, autóbusz-forduló', lines: '872, 873, 874', zone: 'Szarvashegy', lat: 47.6928, lng: 19.0175 },
  { id: 'bs_lajosforras_elag', name: 'Szentendre, Lajosforrási elágazás', lines: '874', zone: 'Szarvashegy', lat: 47.6945, lng: 19.0120 },

  { id: 'bs_derecske_bejarat', name: 'Szentendre, Derecske dűlő', lines: '875', zone: 'Derecske', lat: 47.6560, lng: 19.0540 },
  { id: 'bs_bolcsode', name: 'Szentendre, Kőzúzó utca / Bölcsőde', lines: '875, 876, 877', zone: 'Derecske', lat: 47.6585, lng: 19.0605 }
];

export const ZONE_TRANSIT_INFO = {
  'Pismány': { lines: '878, 879', busMinsAfterHev: [18, 48], driveMins: 9 },
  'Sztaravoda': { lines: '870, 871', busMinsAfterHev: [25, 55], driveMins: 8 },
  'Izbég': { lines: '872, 873, 874', busMinsAfterHev: [12, 42], driveMins: 8 },
  'Szarvashegy': { lines: '872, 873, 874', busMinsAfterHev: [12, 42], driveMins: 12 },
  'Püspökmajor': { lines: '876, 877', busMinsAfterHev: [10, 30, 50], driveMins: 6 },
  'Kálvária': { lines: '870, 876, 877', busMinsAfterHev: [10, 40], driveMins: 6 },
  'Derecske': { lines: '875, 876', busMinsAfterHev: [15, 45], driveMins: 7 },
  'Tyúkosdűlő és Dera-part': { lines: '880, 882, 884, 889', busMinsAfterHev: [8, 28, 48], driveMins: 10 },
  'Pannóniatelep': { lines: 'H5, 880, 889', busMinsAfterHev: [5, 25, 45], driveMins: 4 },
  'Belváros': { lines: '870, 880, 889', busMinsAfterHev: [8, 28, 48], driveMins: 4 },
  'Bükkös-part': { lines: '870, 878, 880', busMinsAfterHev: [8, 28, 48], driveMins: 5 },
  'Dunakorzó': { lines: '880, 889', busMinsAfterHev: [8, 28, 48], driveMins: 5 },
  'Szamárhegy': { lines: '870, 880', busMinsAfterHev: [10, 40], driveMins: 6 },
  'Vasúti villasor': { lines: 'H5, 872–877', busMinsAfterHev: [5, 25, 45], driveMins: 3 }
};

export const SERVICE_GROUPS = [
  { id: 'all', label: 'Összes' },
  { id: 'otthon', label: 'Otthon és szerelés' },
  { id: 'szepseg_egeszseg', label: 'Szépség és egészség' },
  { id: 'auto_muhely', label: 'Autó és műhely' },
  { id: 'kezmuves_gasztro', label: 'Kézműves és gasztro' },
  { id: 'mozgas_oktatas', label: 'Edzés és oktatás' }
];

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

export const LOCAL_PLACES = [
  { name: 'Szentendre, Fogoly utca', subtitle: '2000 Szentendre (Pismány)', lat: 47.69031, lng: 19.06172 },
  ...SZENTENDRE_BUS_STOPS.map((s) => ({
    name: s.name,
    subtitle: `${s.zone} • Járatok: ${s.lines}`,
    lat: s.lat,
    lng: s.lng
  })),
  { name: 'Szentendre, Fő tér', subtitle: 'Belváros', lat: 47.6673, lng: 19.0756 },
  { name: 'Újpest-Városkapu (M3 metró)', subtitle: 'Budapest, XIII./IV. kerület', lat: 47.5605, lng: 19.0792 },
  { name: 'Budapest, Batthyány tér', subtitle: 'Budapest, I. kerület (H5 HÉV)', lat: 47.5065, lng: 19.0399 },
  { name: 'Budapest, Göncz Árpád városközpont', subtitle: 'Budapest, Árpád híd', lat: 47.5325, lng: 19.0660 }
];

export const PRESET_LOCATIONS = LOCAL_PLACES;

export const MAP_TRANSIT_POINTS = SZENTENDRE_BUS_STOPS.map((s) => ({
  id: s.id,
  name: s.name,
  short: s.name.replace(/^Szentendre,\s*/i, ''),
  lines: s.lines,
  lat: s.lat,
  lng: s.lng
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

  if (q.includes('hév') || q.includes('hev') || q.includes('állomás tér')) {
    return { lat: 47.6602, lng: 19.0738, label: 'Szentendre autóbusz-állomás (HÉV)' };
  }
  if (q.includes('fogoly')) {
    return { lat: 47.69031, lng: 19.06172, label: text };
  }

  const busHit = SZENTENDRE_BUS_STOPS.find(
    (s) =>
      s.name.toLowerCase() === q ||
      s.name.toLowerCase().includes(q) ||
      q.includes(s.name.replace(/^Szentendre,\s*/i, '').toLowerCase())
  );
  if (busHit) {
    return { lat: busHit.lat, lng: busHit.lng, label: busHit.name };
  }

  const exactOrPartial = LOCAL_PLACES.find(
    (p) => p.name.toLowerCase() === q || p.name.toLowerCase().includes(q)
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

  return null;
}

export function maskAddressForPublic(fullAddress) {
  if (!fullAddress) return '';
  return fullAddress.replace(/[,\s]+\d+[a-zA-Z/.-]*\.?\s*$/, '').trim();
}
