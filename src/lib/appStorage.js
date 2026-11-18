import { resolveCoordsFromText, maskAddressForPublic } from '../constants/szentendreData.js';
import { stripAccents } from '../components/AddressAutocompleteInput.jsx';

export const BASE_QUICK_DESTINATIONS = [
  'Szentendre HÉV-végállomás',
  'Bükkös-part',
  'Papírgyár',
  'Pismány',
  'Szarvashegy',
  'Izbég',
  'Újpest-Városkapu',
  'Pannóniatelep'
];

export const ROAD_LOCATION_PREFIXES = [
  '11-es út',
  'HÉV / P+R',
  'Pismány / Sztaravoda',
  'Izbég / Szarvashegy'
];

export const ROAD_QUICK_PRESETS = {
  '11-es út': [
    { level: 'warn', label: 'Lépésben halad', text: '11-es út: Lépésben halad a sor a Papírgyár / belváros felé' },
    { level: 'danger', label: 'Baleset / Torlódás', text: '11-es út: Nagy torlódás, érdemes kerülni' },
    { level: 'ok', label: 'Tiszta, halad', text: '11-es út: Folyamatos, zavartalan haladás' }
  ],
  'HÉV / P+R': [
    { level: 'warn', label: 'P+R megtelt', text: 'HÉV / P+R: A parkoló megtelt, nehezen van hely' },
    { level: 'danger', label: 'HÉV késés / pótlás', text: 'HÉV / P+R: H5 HÉV fennakadás vagy késés' },
    { level: 'ok', label: 'Van szabad hely', text: 'HÉV / P+R: Van még szabad parkolóhely' }
  ],
  'Pismány / Sztaravoda': [
    { level: 'warn', label: 'Lassú haladás', text: 'Pismány / Sztaravoda: Lassabb haladás a hegyi szakaszon' },
    { level: 'danger', label: 'Útakadály / Csúszós', text: 'Pismány / Sztaravoda: Útakadály vagy csúszós úttest' },
    { level: 'ok', label: 'Járható, tiszta', text: 'Pismány / Sztaravoda: Tiszta, jól járható utak' }
  ],
  'Izbég / Szarvashegy': [
    { level: 'warn', label: 'Torlódás az iskolánál', text: 'Izbég / Szarvashegy: Torlódás a Szentlászlói úton' },
    { level: 'danger', label: 'Útzár / Akadály', text: 'Izbég / Szarvashegy: Útakadály a szarvashegyi szakaszon' },
    { level: 'ok', label: 'Tiszta út', text: 'Izbég / Szarvashegy: Folyamatos haladás' }
  ]
};

export function formatAgreementRideTitle(originText, destText, agrStatus) {
  const isApproved = ['agreed', 'started', 'arrived', 'completed'].includes(agrStatus);
  if (isApproved) {
    return `${originText} → ${destText}`;
  }
  return `${maskAddressForPublic(originText)} → ${maskAddressForPublic(destText)}`;
}

export function normalizeRouteToken(rawStr) {
  const s = stripAccents(rawStr);
  if (!s) return '';
  if (s.includes('hev') || s.includes('allomas ter')) return 'hev';
  if (s.includes('ujpest')) return 'ujpest';
  if (s.includes('papirgyar')) return 'papirgyar';
  if (s.includes('bukkos')) return 'bukkos';
  return s
    .replace(/^szentendre[,\s]+/, '')
    .replace(/^budapest[,\s]+/, '')
    .replace(/\bu\.\s*/g, 'utca ')
    .replace(/\b(utca|ut|ter|korut|setany|dulo|koz)\b/g, '')
    .replace(/[,\s]+\d+[a-z0-9/.-]*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function geocodeAddressFallback(rawAddress) {
  const clean = (rawAddress || '')
    .replace(/\bu\.\s*/gi, 'utca ')
    .replace(/\bu\s+(?=\d)/gi, 'utca ')
    .trim();
  if (!clean) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=hu&limit=1&q=${encodeURIComponent(clean)}`
    );
    const arr = await res.json();
    if (Array.isArray(arr) && arr[0]) {
      const lat = Number(arr[0].lat);
      const lng = Number(arr[0].lon);
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
  } catch {}
  return resolveCoordsFromText(rawAddress);
}

export function getReadTimestamps(userId) {
  if (!userId) return {};
  try {
    return JSON.parse(localStorage.getItem(`kalaka_read_${userId}`) || '{}');
  } catch {
    return {};
  }
}

export function markAgreementReadStorage(userId, agreementId) {
  if (!userId || !agreementId) return;
  try {
    const map = getReadTimestamps(userId);
    map[agreementId] = new Date().toISOString();
    localStorage.setItem(`kalaka_read_${userId}`, JSON.stringify(map));
  } catch {}
}

export function getHiddenAgreements(userId) {
  if (!userId) return [];
  try {
    return JSON.parse(localStorage.getItem(`kalaka_hidden_${userId}`) || '[]');
  } catch {
    return [];
  }
}

export function getPersonalRoutines(userId) {
  const key = `kalaka_routines_${userId || 'guest'}`;
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

export function recordPersonalRoutine(userId, origin, dest, originCoords = null, destCoords = null) {
  if (!origin?.trim() || !dest?.trim()) return;
  const keyStorage = `kalaka_routines_${userId || 'guest'}`;
  try {
    const cleanO = origin.trim();
    const cleanD = dest.trim();
    if (cleanO.toLowerCase() === cleanD.toLowerCase()) return;
    const list = getPersonalRoutines(userId);
    const key = `${cleanO.toLowerCase()}->${cleanD.toLowerCase()}`;
    const existing = list.find((x) => x.key === key);
    if (existing) {
      existing.count = (existing.count || 1) + 1;
      existing.origin = cleanO;
      existing.dest = cleanD;
      if (originCoords?.lat && originCoords?.lng) {
        existing.originCoords = { lat: Number(originCoords.lat), lng: Number(originCoords.lng) };
      }
      if (destCoords?.lat && destCoords?.lng) {
        existing.destCoords = { lat: Number(destCoords.lat), lng: Number(destCoords.lng) };
      }
      existing.updatedAt = Date.now();
    } else {
      list.push({
        key,
        origin: cleanO,
        dest: cleanD,
        originCoords:
          originCoords?.lat && originCoords?.lng
            ? { lat: Number(originCoords.lat), lng: Number(originCoords.lng) }
            : null,
        destCoords:
          destCoords?.lat && destCoords?.lng
            ? { lat: Number(destCoords.lat), lng: Number(destCoords.lng) }
            : null,
        count: 1,
        updatedAt: Date.now()
      });
    }
    list.sort((a, b) => (b.count - a.count) || (b.updatedAt - a.updatedAt));
    localStorage.setItem(keyStorage, JSON.stringify(list.slice(0, 5)));
  } catch {}
}

export function getSavedPlaces(userId) {
  const key = `kalaka_places_${userId || 'guest'}`;
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

export function playSoftNotificationTone() {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([120, 60, 120]);
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch {}
}

export function triggerSystemNotification(title, body) {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      if (navigator.serviceWorker?.ready) {
        navigator.serviceWorker.ready
          .then((reg) => {
            reg.showNotification(title, {
              body,
              icon: '/icon.svg',
              badge: '/icon.svg',
              tag: 'kalaka-live-msg'
            });
          })
          .catch(() => {});
      } else {
        new Notification(title, { body, icon: '/icon.svg' });
      }
    }
  } catch {}
}

export function getNextQuarterHourHHMM() {
  const d = new Date(Date.now() + 15 * 60000);
  const mins = Math.ceil(d.getMinutes() / 15) * 15;
  d.setMinutes(mins, 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function getUpcomingRoundTimeSlots() {
  const fmt = (dt) =>
    `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;

  const s1 = new Date(Date.now() + 5 * 60000);
  const rem = s1.getMinutes() % 15;
  s1.setMinutes(rem === 0 ? s1.getMinutes() : s1.getMinutes() + (15 - rem), 0, 0);

  const s2 = new Date(s1.getTime() + 15 * 60000);

  const s3 = new Date(s2.getTime());
  if (s2.getMinutes() === 0) {
    s3.setMinutes(30, 0, 0);
  } else {
    s3.setHours(s2.getHours() + 1, 0, 0, 0);
  }

  return [fmt(s1), fmt(s2), fmt(s3)];
}

export function resolveAutoDayForTime(hhmm, isRecurring = false) {
  if (isRecurring) return 'Munkanapokon (H–P)';
  if (!hhmm || !hhmm.includes(':')) return 'Ma';
  const [hh, mm] = hhmm.split(':').map(Number);
  if (isNaN(hh) || isNaN(mm)) return 'Ma';
  const now = new Date();
  const target = new Date();
  target.setHours(hh, mm, 0, 0);
  return target.getTime() < now.getTime() - 60000 ? 'Holnap' : 'Ma';
}

export function formatDayLabelFromIso(isoStr, isRec = false, schedLabel = null) {
  if (isRec) return schedLabel || 'Munkanapokon (H–P)';
  if (!isoStr) return 'Ma';
  const dt = new Date(isoStr);
  if (isNaN(dt.getTime())) return 'Ma';
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetStart = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const diffDays = Math.round((targetStart - todayStart) / 86400000);
  if (diffDays <= 0) return 'Ma';
  if (diffDays === 1) return 'Holnap';
  return dt.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
}
