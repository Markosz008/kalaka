export const RADAR_CATEGORIES = [
  {
    id: 'traffic',
    label: 'Forgalom',
    shortLabel: 'Forgalom',
    ttlLabel: '45 perc',
    zones: [
      '11-es út',
      'Pismány / Sztaravoda',
      'Izbég / Bükkös',
      'Belváros / Dunakorzó',
      'Pannóniatelep / Papírgyár'
    ],
    presets: [
      { label: 'Lépésben halad', level: 'warn', text: 'Lépésben halad a sor' },
      { label: 'Áll / Baleset', level: 'danger', text: 'Teljesen beállt a forgalom, érdemes kerülni' },
      { label: 'Már halad', level: 'ok', text: 'Folyamatos haladás, tiszta az út' }
    ]
  },
  {
    id: 'transit',
    label: 'HÉV & Busz',
    shortLabel: 'HÉV / Busz',
    ttlLabel: '60 perc',
    zones: ['H5 HÉV', 'HÉV P+R parkoló', '878 / 879 busz', 'Volánbusz / 11-es'],
    presets: [
      { label: 'Késik / Pótló', level: 'danger', text: 'Jelentős késés vagy pótlóbusz közlekedik' },
      { label: 'P+R megtelt', level: 'warn', text: 'A P+R parkoló gyakorlatilag megtelt' },
      { label: 'Menetrend szerint', level: 'ok', text: 'Rendben, menetrend szerint közlekedik' }
    ]
  },
  {
    id: 'utility',
    label: 'Közmű & Veszély',
    shortLabel: 'Közmű',
    ttlLabel: '3 óra',
    zones: [
      'Pismány / Sztaravoda',
      'Izbég / Szarvashegy',
      'Belváros',
      'Püspökmajor',
      'Pannóniatelep / Tyúkosdűlő'
    ],
    presets: [
      { label: 'Áramszünet', level: 'danger', text: 'Áramszünet van a környéken' },
      { label: 'Víz / Csőtörés', level: 'danger', text: 'Vízhiány vagy csőtörés' },
      { label: 'Kidőlt fa / Veszély', level: 'warn', text: 'Útakadály, kidőlt fa vagy csúszós szakasz' }
    ]
  },
  {
    id: 'local',
    label: 'Helyi sürgős',
    shortLabel: 'Helyi',
    ttlLabel: '6 óra',
    zones: ['Pismány', 'Belváros / Duna-part', 'Izbég / Bükkös', 'Püspökmajor', 'Pannóniatelep'],
    presets: [
      { label: 'Kóbor állat', level: 'warn', text: 'Gazdátlan kutya kóborol a környéken' },
      { label: 'Figyelmeztetés', level: 'warn', text: 'Fontos helyi figyelmeztetés a lakóknak' },
      { label: 'Talált tárgy', level: 'ok', text: 'Talált kulcs vagy érték, gazdáját keresi' }
    ]
  }
];

export const RADAR_CATEGORY_MAP = Object.fromEntries(
  RADAR_CATEGORIES.map((c) => [c.id, c])
);

export function formatShortTime(isoStr) {
  if (!isoStr) return '';
  try {
    return new Date(isoStr).toLocaleTimeString('hu-HU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

export function formatMinutesLeft(expiresAtIso) {
  if (!expiresAtIso) return '';
  const diffMin = Math.round((new Date(expiresAtIso).getTime() - Date.now()) / 60000);
  if (diffMin <= 0) return 'lejáróban';
  if (diffMin < 60) return `még ${diffMin} percig aktív`;
  const hrs = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return mins > 0 ? `még ${hrs} ó ${mins} p` : `még ${hrs} óráig aktív`;
}
