import React, { useState, useEffect, useCallback, useRef} from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase.js';
import { computeStopsAlongRoute } from './lib/routing.js';
import {
  VALIDITY_OPTIONS,
  resolveCoordsFromText
} from './constants/szentendreData.js';
import HeaderRoadBar from './components/HeaderRoadBar.jsx';
import AddressAutocompleteInput from './components/AddressAutocompleteInput.jsx';
import InteractiveRouteMap from './components/InteractiveRouteMap.jsx';
import RideCard from './components/RideCard.jsx';
import FavorCard from './components/FavorCard.jsx';
import ProsDirectoryView from './components/ProsDirectoryView.jsx';
import AgreementChatModal from './components/AgreementChatModal.jsx';
import UserProfileModal from './components/UserProfileModal.jsx';
import AuthModal from './components/AuthModal.jsx';

function addMinutesToTime(timeStr, minsToAdd) {
  const [hh, mm] = (timeStr || '05:50').split(':').map(Number);
  const totalMins = (hh * 60 + mm + minsToAdd + 1440) % 1440;
  const nh = String(Math.floor(totalMins / 60)).padStart(2, '0');
  const nm = String(totalMins % 60).padStart(2, '0');
  return `${nh}:${nm}`;
}

function buildIntermediateStops(baseTime, originText = '', destText = '') {
  const o = originText.toLowerCase();
  const d = destText.toLowerCase();

  if (o.includes('szarvashegy') || d.includes('szarvashegy') || o.includes('izbég') || d.includes('izbég')) {
    return [
      { time: addMinutesToTime(baseTime, 4), name: 'Szarvashegyi elágazás' },
      { time: addMinutesToTime(baseTime, 7), name: 'Izbég, Szentlászlói út' },
      { time: addMinutesToTime(baseTime, 11), name: 'Bükkös-part • 11-es út sarok' },
      { time: addMinutesToTime(baseTime, 14), name: 'Szentendre HÉV-végállomás' }
    ];
  }

  return [
    { time: addMinutesToTime(baseTime, 4), name: 'Szabadságforrás buszforduló' },
    { time: addMinutesToTime(baseTime, 7), name: '11-es út • Papírgyár megálló' },
    { time: addMinutesToTime(baseTime, 10), name: 'Bükkös-part • 11-es út sarok' },
    { time: addMinutesToTime(baseTime, 13), name: 'Szentendre HÉV-végállomás' },
    { time: addMinutesToTime(baseTime, 15), name: 'Pannóniatelep HÉV-megálló' }
  ];
}

function getReadTimestamps(userId) {
  if (!userId) return {};
  try {
    return JSON.parse(localStorage.getItem(`kalaka_read_${userId}`) || '{}');
  } catch {
    return {};
  }
}

function markAgreementReadStorage(userId, agreementId) {
  if (!userId || !agreementId) return;
  try {
    const map = getReadTimestamps(userId);
    map[agreementId] = new Date().toISOString();
    localStorage.setItem(`kalaka_read_${userId}`, JSON.stringify(map));
  } catch {}
}

function getHiddenAgreements(userId) {
  if (!userId) return [];
  try {
    return JSON.parse(localStorage.getItem(`kalaka_hidden_${userId}`) || '[]');
  } catch {
    return [];
  }
}

function playSoftNotificationTone() {
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

const BASE_QUICK_DESTINATIONS = [
  'HÉV-végállomás',
  'Újpest-Városkapu',
  'Bükkös-part',
  'Papírgyár',
  'Pismány',
  'Szarvashegy',
  'Izbég',
  'Pannóniatelep'
];

function getPersonalRoutines(userId) {
  if (!userId) return [];
  try {
    return JSON.parse(localStorage.getItem(`kalaka_routines_${userId}`) || '[]');
  } catch {
    return [];
  }
}

function recordPersonalRoutine(userId, origin, dest) {
  if (!userId || !origin?.trim() || !dest?.trim()) return;
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
      existing.updatedAt = Date.now();
    } else {
      list.push({ key, origin: cleanO, dest: cleanD, count: 1, updatedAt: Date.now() });
    }
    list.sort((a, b) => (b.count - a.count) || (b.updatedAt - a.updatedAt));
    localStorage.setItem(`kalaka_routines_${userId}`, JSON.stringify(list.slice(0, 4)));
  } catch {}
}

function getNextQuarterHourHHMM() {
  const d = new Date(Date.now() + 15 * 60000);
  const mins = Math.ceil(d.getMinutes() / 15) * 15;
  d.setMinutes(mins, 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function isPastTimeToday(hhmm) {
  if (!hhmm || !hhmm.includes(':')) return false;
  const [hh, mm] = hhmm.split(':').map(Number);
  if (isNaN(hh) || isNaN(mm)) return false;
  const now = new Date();
  const target = new Date();
  target.setHours(hh, mm, 0, 0);
  return target.getTime() < now.getTime() - 60000;
}

function resolveAutoDayForTime(hhmm, isRecurring = false) {
  if (isRecurring) return 'Munkanapokon (H–P)';
  if (!hhmm || !hhmm.includes(':')) return 'Ma';
  const [hh, mm] = hhmm.split(':').map(Number);
  if (isNaN(hh) || isNaN(mm)) return 'Ma';
  const now = new Date();
  const target = new Date();
  target.setHours(hh, mm, 0, 0);
  return target.getTime() < now.getTime() - 60000 ? 'Holnap' : 'Ma';
}

function resolveAutoExpiresAt(hhmm, isRecurring = false, fallbackHours = 12) {
  if (isRecurring) {
    return new Date(Date.now() + 30 * 24 * 3600000).toISOString();
  }
  const day = resolveAutoDayForTime(hhmm, false);
  const [hh, mm] = (hhmm || '12:00').split(':').map(Number);
  const target = new Date();
  target.setHours(isNaN(hh) ? 12 : hh, isNaN(mm) ? 0 : mm, 0, 0);
  if (day === 'Holnap') {
    target.setDate(target.getDate() + 1);
  }
  const byTarget = target.getTime() + 2 * 3600000;
  const byHours = Date.now() + Number(fallbackHours || 12) * 3600000;
  return new Date(Math.max(byTarget, byHours)).toISOString();
}

export default function App() {
  const [activeTab, setActiveTab] = useState('rides');
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState({
    id: 'guest-user',
    display_name: '',
    zone: 'Pismány',
    ride_hearts: 0,
    favor_hearts: 0
  });

  const [roadAlerts, setRoadAlerts] = useState([
    {
      id: 'default-ok',
      status_level: 'ok',
      message: 'Folyamatos haladás a 11-es úton • Hegyi utak tiszták',
      author_name: 'Közösségi útinfó',
      created_at: new Date().toISOString()
    }
  ]);

  const [rides, setRides] = useState([]);
  const [favors, setFavors] = useState([]);
  const [pros, setPros] = useState([]);
  const [myAgreements, setMyAgreements] = useState([]);

  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [fromCoords, setFromCoords] = useState(null);
  const [toCoords, setToCoords] = useState(null);
  const [activeSearchField, setActiveSearchField] = useState('from');
  const [showMap, setShowMap] = useState(true);
  const [selectedRideForMap, setSelectedRideForMap] = useState(null);

  const [inlineComposerMode, setInlineComposerMode] = useState(null);
  const [inlineTime, setInlineTime] = useState(() => getNextQuarterHourHHMM());
  const [inlineSchedule, setInlineSchedule] = useState('Munkanapokon (H–P)');
  const [inlineSeats, setInlineSeats] = useState(3);
  const [inlineValidMins, setInlineValidMins] = useState(720);
  const [inlineNote, setInlineNote] = useState('');
  const [inlineSaving, setInlineSaving] = useState(false);

  const [activeAgreement, setActiveAgreement] = useState(null);
  const notifiedMsgKeysRef = useRef(new Set());
  const [inspectedUser, setInspectedUser] = useState(null);
  const [kudosCountByUser, setKudosCountByUser] = useState({});
  const [selectedStopByRide, setSelectedStopByRide] = useState({});
  const [inlineCarInfo, setInlineCarInfo] = useState('');
  const [searchStatsMap, setSearchStatsMap] = useState({});
  const [personalRoutines, setPersonalRoutines] = useState([]);
  const [locatingOriginGps, setLocatingOriginGps] = useState(false);
  const [incomingToast, setIncomingToast] = useState(null);
  const [readVersion, setReadVersion] = useState(0);
  const [hiddenAgreementIds, setHiddenAgreementIds] = useState([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showRoadModal, setShowRoadModal] = useState(false);

  const [customRoadText, setCustomRoadText] = useState('');
  const [customRoadLevel, setCustomRoadLevel] = useState('warn');

  const [newKind, setNewKind] = useState('offer');
  const [newFrom, setNewFrom] = useState('');
  const [newTo, setNewTo] = useState('');
  const [newFromCoords, setNewFromCoords] = useState(null);
  const [newToCoords, setNewToCoords] = useState(null);
  const [newTime, setNewTime] = useState('05:50');
  const [newScheduleText, setNewScheduleText] = useState('Munkanapokon (H–P)');
  const [newSeats, setNewSeats] = useState(3);
  const [newValidMins, setNewValidMins] = useState(720);
  const [newNote, setNewNote] = useState('');
  const [newMinHearts, setNewMinHearts] = useState(0);

  const loadUserProfile = useCallback(async (authUser) => {
    if (!supabase || !authUser) return;
    let { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (!data) {
      const fallbackName =
        authUser.user_metadata?.full_name ||
        authUser.email?.split('@')[0] ||
        'Szomszéd';
      const cleanZone = (authUser.user_metadata?.zone || 'Pismány')
        .replace(/\s*\(.*?\)\s*/g, '')
        .trim();
      const { data: inserted } = await supabase
        .from('profiles')
        .insert({
          id: authUser.id,
          display_name:
            fallbackName === 'Belépés' ? authUser.email?.split('@')[0] : fallbackName,
          zone: cleanZone
        })
        .select('*')
        .single();
      data = inserted;
    } else if (data.display_name === 'Belépés') {
      const fixedName = authUser.email?.split('@')[0] || 'Márk';
      const { data: fixed } = await supabase
        .from('profiles')
        .update({ display_name: fixedName })
        .eq('id', authUser.id)
        .select('*')
        .single();
      if (fixed) data = fixed;
    }
    if (data) {
      setProfile(data);
      if (data.car_info) setInlineCarInfo(data.car_info);
      setHiddenAgreementIds(getHiddenAgreements(data.id));
      setPersonalRoutines(getPersonalRoutines(data.id));
    }
  }, []);

  const fetchAllLiveData = useCallback(async (currentUserId) => {
    if (!supabase) return;
    const nowIso = new Date().toISOString();

    const { data: rideRows } = await supabase
      .from('rides')
      .select('*, author:profiles!rides_user_id_fkey(display_name, ride_hearts, favor_hearts, zone)')
      .eq('status', 'open')
      .gt('expires_at', nowIso)
      .order('departure_at', { ascending: true });

    if (rideRows) {
      const mappedRides = rideRows.map((r) => {
        const dt = new Date(r.departure_at);
        const timeStr = dt.toTimeString().slice(0, 5);
        const recMatch = r.note?.match(/^\[Rendszeres:\s*(.*?)\]\s*(.*)$/);
        const isRec = Boolean(r.recurring_id || r.schedule_label || recMatch);
        const scheduleLabel =
          r.schedule_label || (recMatch ? recMatch[1] : isRec ? 'Munkanapokon (H–P)' : null);
        const cleanNote = recMatch ? recMatch[2] : r.note;

        return {
          ...r,
          note: cleanNote,
          author_name: r.author?.display_name
            ? `${r.author.display_name}${r.author.zone ? ' • ' + r.author.zone : ''}`
            : 'Szomszéd',
          author_ride_hearts: r.author?.ride_hearts || 0,
          author_favor_hearts: r.author?.favor_hearts || 0,
          is_recurring: isRec,
          schedule_text: scheduleLabel,
          depart_time: timeStr,
          date_label: 'Ma',
          stops: []
        };
      });
      setRides(mappedRides);
      supabase
        .from('route_search_stats')
        .select('hub_label, search_count')
        .then(({ data: statRows }) => {
          if (statRows) {
            const m = {};
            statRows.forEach((s) => {
              m[s.hub_label] = s.search_count || 0;
            });
            setSearchStatsMap(m);
          }
        });

      // Irányhelyes köztes megállók kiszámítása a tényleges útvonal alapján
      Promise.all(
        mappedRides.map(async (rideItem) => {
          if (rideItem.kind !== 'offer') return rideItem;
          const computedStops = await computeStopsAlongRoute(rideItem);
          return { ...rideItem, stops: computedStops };
        })
      ).then((enrichedRides) => {
        setRides(enrichedRides);
        setSelectedRideForMap((prev) =>
          prev ? enrichedRides.find((x) => x.id === prev.id) || prev : null
        );
      });
    }

    const { data: favorRows } = await supabase
      .from('favors')
      .select('*, author:profiles!favors_user_id_fkey(display_name, favor_hearts, zone)')
      .eq('status', 'open')
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false });

    if (favorRows) {
      const mappedFavors = favorRows.map((f) => ({
        ...f,
        author_name: f.author?.display_name || 'Szomszéd',
        author_favor_hearts: f.author?.favor_hearts || 0,
        invited_by_name: 'Helyi tag'
      }));
      setFavors(mappedFavors);
    }

    const { data: proRows } = await supabase
      .from('local_pros')
      .select('*')
      .eq('is_active', true)
      .order('endorsement_count', { ascending: false });
    if (proRows) setPros(proRows);

    const { data: alertRows } = await supabase
      .from('road_alerts')
      .select('*, reporter:profiles!road_alerts_reporter_id_fkey(display_name, zone)')
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(10);

    if (alertRows && alertRows.length > 0) {
      setRoadAlerts(
        alertRows.map((a) => ({
          ...a,
          author_name: a.reporter?.display_name || 'Helyi autós'
        }))
      );
    } else {
      setRoadAlerts([
        {
          id: 'default-ok',
          status_level: 'ok',
          message: 'Folyamatos haladás a 11-es úton • Hegyi utak tiszták',
          author_name: 'Közösségi útinfó',
          created_at: new Date().toISOString()
        }
      ]);
    }

    if (currentUserId && currentUserId !== 'guest-user') {
      const { data: agrRows } = await supabase
        .from('agreements')
        .select(`
          *,
          requester:profiles!agreements_requester_id_fkey(display_name),
          helper:profiles!agreements_helper_id_fkey(display_name),
          ride:rides(origin_text, dest_text, kind, user_id, car_info),
          favor:favors(title),
          pro:local_pros(business_name, profession_name)
        `)
        .or(`requester_id.eq.${currentUserId},helper_id.eq.${currentUserId}`)
        .order('created_at', { ascending: false });

      if (agrRows) {
        const agrIds = agrRows.map((x) => x.id);
        let latestMsgByAgr = {};
        if (agrIds.length > 0) {
          const { data: recentMsgs } = await supabase
            .from('messages')
            .select('agreement_id, sender_id, body, created_at')
            .in('agreement_id', agrIds)
            .order('created_at', { ascending: false })
            .limit(80);
          (recentMsgs || []).forEach((m) => {
            if (!latestMsgByAgr[m.agreement_id]) {
              latestMsgByAgr[m.agreement_id] = m;
            }
          });
        }

        const readMap = getReadTimestamps(currentUserId);
        const mappedAgrs = agrRows.map((a) => {
          const isReq = a.requester_id === currentUserId;
          const lastMsg = latestMsgByAgr[a.id] || null;
          const lastActivityAt = lastMsg?.created_at || a.created_at;
          const lastReadAt = readMap[a.id];
          const isUnread = Boolean(
            lastMsg &&
            lastMsg.sender_id !== currentUserId &&
            (!lastReadAt || new Date(lastMsg.created_at) > new Date(lastReadAt))
          );

          return {
            ...a,
            partner_name: a.pro
              ? a.pro.business_name
              : isReq
              ? a.helper?.display_name || 'Szomszéd'
              : a.requester?.display_name || 'Szomszéd',
            post_owner_id: a.ride?.user_id || a.helper_id,
            car_info: a.ride?.car_info || null,
            title: a.ride
              ? `${a.ride.origin_text} → ${a.ride.dest_text}`
              : a.pro
              ? a.pro.profession_name || 'Szakmai megkeresés'
              : a.favor?.title || 'Egyeztetés',
            last_message_body: lastMsg?.body || '',
            last_activity_at: lastActivityAt,
            has_unread: isUnread
          };
        });

        mappedAgrs.sort(
          (x, y) => new Date(y.last_activity_at) - new Date(x.last_activity_at)
        );
        setMyAgreements(mappedAgrs);
        mappedAgrs.forEach((item) => {
          if (item.has_unread && item.last_activity_at) {
            const notifKey = `${item.id}_${item.last_activity_at}`;
            if (!notifiedMsgKeysRef.current.has(notifKey)) {
              notifiedMsgKeysRef.current.add(notifKey);
              playSoftNotificationTone();
              setIncomingToast({
                agreement_id: item.id,
                body: `${item.partner_name}: ${item.last_message_body || 'Új üzenet / jelentkezés'}`
              });
            }
          }
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        loadUserProfile(s.user);
        fetchAllLiveData(s.user.id);
      } else {
        fetchAllLiveData(null);
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        loadUserProfile(s.user);
        fetchAllLiveData(s.user.id);
      } else {
        setProfile({
          id: 'guest-user',
          display_name: '',
          zone: 'Pismány',
          ride_hearts: 0,
          favor_hearts: 0
        });
        setMyAgreements([]);
      }
    });

    const globalChannel = supabase
      .channel('public-feed-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, () =>
        fetchAllLiveData(session?.user?.id)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'favors' }, () =>
        fetchAllLiveData(session?.user?.id)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agreements' }, () =>
        fetchAllLiveData(session?.user?.id)
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const uid = session?.user?.id;
        const msg = payload.new;
        if (!uid || !msg) return;
        fetchAllLiveData(uid);
        if (msg.sender_id !== uid) {
          // Ha el volt rejtve a beszélgetés, újra megjelenítjük
          setHiddenAgreementIds((prev) => {
            if (!prev.includes(msg.agreement_id)) return prev;
            const next = prev.filter((id) => id !== msg.agreement_id);
            localStorage.setItem(`kalaka_hidden_${uid}`, JSON.stringify(next));
            return next;
          });
          playSoftNotificationTone();
          setIncomingToast({
            agreement_id: msg.agreement_id,
            body: msg.body
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'road_alerts' }, () =>
        fetchAllLiveData(session?.user?.id)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'local_pros' }, () =>
        fetchAllLiveData(session?.user?.id)
      )
      .subscribe();

    const expiryTimer = setInterval(() => {
      const now = Date.now();
      setRides((prev) =>
        prev.filter((r) => !r.expires_at || new Date(r.expires_at).getTime() > now)
      );
      setFavors((prev) =>
        prev.filter((f) => !f.expires_at || new Date(f.expires_at).getTime() > now)
      );
    }, 30000);

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(globalChannel);
      clearInterval(expiryTimer);
    };
  }, [loadUserProfile, fetchAllLiveData, session?.user?.id]);

  const filteredRides = rides.filter((r) => {
    const qFrom = filterFrom.trim().toLowerCase();
    const qTo = filterTo.trim().toLowerCase();

    const stopsText = (r.stops || []).map((s) => s.name.toLowerCase()).join(' ');
    const fullRouteText = `${r.origin_text} ${stopsText} ${r.dest_text}`.toLowerCase();

    const matchFrom =
      !qFrom ||
      r.origin_text.toLowerCase().includes(qFrom) ||
      stopsText.includes(qFrom);

    const matchTo =
      !qTo ||
      r.dest_text.toLowerCase().includes(qTo) ||
      stopsText.includes(qTo) ||
      fullRouteText.includes(qTo);

    return matchFrom && matchTo;
  });

  const handleSelectQuickLocation = (locName, coordsObj = null, forcedField = null) => {
    setSelectedRideForMap(null);
    if (locName === 'Mind') {
      setFilterFrom('');
      setFilterTo('');
      setFromCoords(null);
      setToCoords(null);
      setInlineComposerMode(null);
      return;
    }

    const targetField = forcedField || ((activeSearchField === 'to' || (filterFrom && !filterTo)) ? 'to' : 'from');
    if (targetField === 'to') {
      setFilterTo(locName);
      setToCoords(coordsObj || resolveCoordsFromText(locName));
      setActiveSearchField('to');
    } else {
      setFilterFrom(locName);
      setFromCoords(coordsObj || resolveCoordsFromText(locName));
      setActiveSearchField('to');
    }
  };

  const handlePublishInlineRide = async (e) => {
    e.preventDefault();
    if (!filterFrom.trim() || !filterTo.trim()) return;

    if (!session?.user) {
      setShowAuthModal(true);
      return;
    }

    setInlineSaving(true);
    try {
      const [hh, mm] = (inlineTime || '05:50').split(':').map(Number);
      const dep = new Date();
      dep.setHours(hh || 5, mm || 50, 0, 0);
      if (dep < new Date()) dep.setDate(dep.getDate() + 1);

      const validMinutes = Number(inlineValidMins) || 720;
      const exp = new Date(Date.now() + validMinutes * 60 * 1000);

      const isRec = inlineComposerMode === 'recurring';
      const dbKind = inlineComposerMode === 'ask' ? 'ask' : 'offer';

      const startPt = fromCoords || resolveCoordsFromText(filterFrom);
      const endPt = toCoords || resolveCoordsFromText(filterTo);

      const payload = {
        user_id: session.user.id,
        kind: dbKind,
        origin_text: filterFrom.trim(),
        dest_text: filterTo.trim(),
        departure_at: dep.toISOString(),
        expires_at: exp.toISOString(),
        seats: dbKind === 'ask' ? Number(inlineSeats) || 1 : Number(inlineSeats) || 3,
        is_confirmed_today: true,
        note: isRec
          ? `[Rendszeres: ${inlineSchedule}] ${inlineNote.trim()}`.trim()
          : inlineNote.trim()
      };

      if (startPt) {
        payload.origin_lat = startPt.lat;
        payload.origin_lng = startPt.lng;
      }
      if (endPt) {
        payload.dest_lat = endPt.lat;
        payload.dest_lng = endPt.lng;
      }

      const { error } = await supabase.from('rides').insert(payload);
      if (error) {
        const { origin_lat, origin_lng, dest_lat, dest_lng, ...basicPayload } = payload;
        const { error: retryErr } = await supabase.from('rides').insert(basicPayload);
        if (retryErr) throw retryErr;
      }

      await fetchAllLiveData(session.user.id);
      setInlineComposerMode(null);
      setInlineNote('');
    } catch (err) {
      alert(`Hiba a mentéskor: ${err.message}`);
    } finally {
      setInlineSaving(false);
    }
  };

  const handleDeleteRide = async (rideId) => {
    if (!window.confirm('Biztosan törlöd ezt az utat?')) return;
    setRides((prev) => prev.filter((r) => r.id !== rideId));
    if (supabase && !String(rideId).startsWith('demo-')) {
      const { error } = await supabase.from('rides').delete().eq('id', rideId);
      if (error) {
        alert(`Törlési hiba: ${error.message}`);
        fetchAllLiveData(session?.user?.id);
      }
    }
  };

  const handleDeleteFavor = async (favorId) => {
    if (!window.confirm('Biztosan törlöd ezt a kérést?')) return;
    setFavors((prev) => prev.filter((f) => f.id !== favorId));
    if (supabase && !String(favorId).startsWith('demo-')) {
      const { error } = await supabase.from('favors').delete().eq('id', favorId);
      if (error) {
        alert(`Törlési hiba: ${error.message}`);
        fetchAllLiveData(session?.user?.id);
      }
    }
  };

  const handleOpenEditRide = (ride) => {
    setEditingItemId(ride.id);
    setNewKind(ride.is_recurring ? 'recurring' : ride.kind);
    setNewFrom(ride.origin_text);
    setNewTo(ride.dest_text);
    setNewTime(ride.time_label || '05:50');
    setNewScheduleText(ride.schedule_text || 'Munkanapokon (H–P)');
    setNewSeats(ride.seats || 3);
    setNewNote(ride.note || '');
    setNewValidMins(720);
    setShowNewModal(true);
  };

  const handleOpenEditFavor = (favor) => {
    setEditingItemId(favor.id);
    setNewKind('favor');
    setNewFrom(favor.title);
    setNewNote(favor.description || '');
    setNewMinHearts(favor.min_favor_hearts || 0);
    setNewValidMins(1440);
    setShowNewModal(true);
  };

  const handleSaveModalPost = async (e) => {
    e.preventDefault();
    if (!session?.user) {
      setShowNewModal(false);
      setShowAuthModal(true);
      return;
    }

    const validMinutes = Number(newValidMins) || 720;
    const expIso = new Date(Date.now() + validMinutes * 60 * 1000).toISOString();

    if (newKind === 'favor') {
      if (!newFrom.trim()) return;
      const favPayload = {
        title: newFrom.trim(),
        description: newNote.trim(),
        zone: profile.zone || 'Pismány',
        min_favor_hearts: Number(newMinHearts) || 0,
        expires_at: expIso
      };

      if (editingItemId) {
        const { error } = await supabase
          .from('favors')
          .update(favPayload)
          .eq('id', editingItemId);
        if (error) {
          alert(`Szerkesztési hiba: ${error.message}`);
          return;
        }
      } else {
        const { error } = await supabase
          .from('favors')
          .insert({ ...favPayload, user_id: session.user.id });
        if (error) {
          alert(`Mentési hiba: ${error.message}`);
          return;
        }
      }
      setActiveTab('favors');
    } else {
      if (!newFrom.trim() || !newTo.trim()) return;
      const [hh, mm] = (newTime || '05:50').split(':').map(Number);
      const dep = new Date();
      dep.setHours(hh || 5, mm || 50, 0, 0);

      const startPt = newFromCoords || resolveCoordsFromText(newFrom);
      const endPt = newToCoords || resolveCoordsFromText(newTo);

      const ridePayload = {
        kind: newKind === 'recurring' ? 'offer' : newKind,
        origin_text: newFrom.trim(),
        dest_text: newTo.trim(),
        departure_at: dep.toISOString(),
        expires_at: expIso,
        seats: Number(newSeats) || 3,
        is_confirmed_today: true,
        note:
          newKind === 'recurring'
            ? `[Rendszeres: ${newScheduleText}] ${newNote.trim()}`.trim()
            : newNote.trim()
      };

      if (startPt) {
        ridePayload.origin_lat = startPt.lat;
        ridePayload.origin_lng = startPt.lng;
      }
      if (endPt) {
        ridePayload.dest_lat = endPt.lat;
        ridePayload.dest_lng = endPt.lng;
      }

      if (editingItemId) {
        const { error } = await supabase
          .from('rides')
          .update(ridePayload)
          .eq('id', editingItemId);
        if (error) {
          const { origin_lat, origin_lng, dest_lat, dest_lng, ...basic } = ridePayload;
          const { error: retryErr } = await supabase
            .from('rides')
            .update(basic)
            .eq('id', editingItemId);
          if (retryErr) {
            alert(`Szerkesztési hiba: ${retryErr.message}`);
            return;
          }
        }
      } else {
        const { error } = await supabase
          .from('rides')
          .insert({ ...ridePayload, user_id: session.user.id });
        if (error) {
          const { origin_lat, origin_lng, dest_lat, dest_lng, ...basic } = ridePayload;
          const { error: retryErr } = await supabase
            .from('rides')
            .insert({ ...basic, user_id: session.user.id });
          if (retryErr) {
            alert(`Mentési hiba: ${retryErr.message}`);
            return;
          }
        }
      }
      setActiveTab('rides');
    }

    setShowNewModal(false);
    setEditingItemId(null);
    setNewFrom('');
    setNewTo('');
    setNewNote('');
    fetchAllLiveData(session.user.id);
  };

  const handleStartRideAgreement = async (ride, selectedStop) => {
    if (!session?.user) {
      setShowAuthModal(true);
      return;
    }

    const requesterId = ride.kind === 'offer' ? session.user.id : ride.user_id;
    const helperId = ride.kind === 'offer' ? ride.user_id : session.user.id;
    const stopLabel = selectedStop ? `${selectedStop.time} ${selectedStop.name}` : null;

    const { data: createdAgr, error } = await supabase
      .from('agreements')
      .insert({
        ride_id: ride.id,
        requester_id: requesterId,
        helper_id: helperId,
        pickup_stop_name: stopLabel,
        status: 'chatting'
      })
      .select('*')
      .single();

    if (error) {
      alert(`Hiba: ${error.message}`);
      return;
    }

    await supabase.from('messages').insert({
      agreement_id: createdAgr.id,
      sender_id: session.user.id,
      body: stopLabel
        ? `Szia! Felszállnék itt: ${stopLabel}.`
        : 'Szia! Csatlakoznék az úthoz.'
    });

    setActiveAgreement({
      ...createdAgr,
      post_owner_id: ride.user_id,
      car_info: ride.car_info || null,
      partner_name: ride.author_name,
      title: `${ride.origin_text} → ${ride.dest_text}`
    });
    fetchAllLiveData(session.user.id);
  };

  const handleStartFavorAgreement = async (favor) => {
    if (!session?.user) {
      setShowAuthModal(true);
      return;
    }

    const { data: createdAgr, error } = await supabase
      .from('agreements')
      .insert({
        favor_id: favor.id,
        requester_id: session.user.id,
        helper_id: favor.user_id,
        status: 'chatting'
      })
      .select('*')
      .single();

    if (error) {
      alert(`Nem sikerült megnyitni: ${error.message}`);
      return;
    }

    await supabase.from('messages').insert({
      agreement_id: createdAgr.id,
      sender_id: session.user.id,
      body: `Szia! Érdekelne: ${favor.title}`
    });

    setActiveAgreement({
      ...createdAgr,
      partner_name: favor.author_name,
      title: favor.title
    });
    fetchAllLiveData(session.user.id);
  };

  const handleStartProAgreement = async (pro) => {
    if (!session?.user) {
      setShowAuthModal(true);
      return;
    }

    // Meglévő beszélgetés keresése ezzel a szakival, hogy ne duplikálódjon
    const { data: existingAgr } = await supabase
      .from('agreements')
      .select('*')
      .eq('pro_id', pro.id)
      .eq('requester_id', session.user.id)
      .maybeSingle();

    if (existingAgr) {
      setActiveAgreement({
        ...existingAgr,
        partner_name: pro.business_name,
        title: pro.profession_name || 'Szakmai egyeztetés'
      });
      return;
    }

    const { data: createdAgr, error } = await supabase
      .from('agreements')
      .insert({
        pro_id: pro.id,
        requester_id: session.user.id,
        helper_id: pro.owner_id || null,
        status: 'chatting'
      })
      .select('*')
      .single();

    if (error) {
      alert(`Nem sikerült megnyitni a beszélgetést: ${error.message}`);
      return;
    }

    await supabase.from('messages').insert({
      agreement_id: createdAgr.id,
      sender_id: session.user.id,
      body: `Szia! Érdeklődnék (${pro.profession_name || pro.business_name}).`
    });

    setActiveAgreement({
      ...createdAgr,
      partner_name: pro.business_name,
      title: pro.profession_name || 'Szakmai egyeztetés'
    });
    fetchAllLiveData(session.user.id);
  };

  const handleAddRoadAlert = async (level, messageText) => {
    const cleanMsg = (messageText || '').trim();
    if (cleanMsg.length < 4) return;

    if (!session?.user) {
      setShowRoadModal(false);
      setShowAuthModal(true);
      return;
    }

    if (supabase) {
      const { error } = await supabase.from('road_alerts').insert({
        reporter_id: session.user.id,
        status_level: level,
        message: cleanMsg
      });
      if (error) {
        alert(`Hiba: ${error.message}`);
        return;
      }
      await fetchAllLiveData(session.user.id);
    }
    setCustomRoadText('');
  };

  const handleDeleteRoadAlert = async (alertId) => {
    if (!supabase || alertId === 'default-ok') return;
    await supabase.from('road_alerts').delete().eq('id', alertId);
    fetchAllLiveData(session?.user?.id);
  };

  const handleCheckInProZone = async (proId, zoneName) => {
    setPros((prev) =>
      prev.map((p) => (p.id === proId ? { ...p, active_zone_today: zoneName } : p))
    );
    if (supabase && proId) {
      await supabase
        .from('local_pros')
        .update({ active_zone_today: zoneName })
        .eq('id', proId);
    }
  };

  const handleEndorsePro = async (pro) => {
    if (!session?.user) {
      setShowAuthModal(true);
      return;
    }
    const nextCount = (pro.endorsement_count || 0) + 1;
    setPros((prev) =>
      prev.map((p) => (p.id === pro.id ? { ...p, endorsement_count: nextCount } : p))
    );
    if (supabase) {
      await supabase
        .from('local_pros')
        .update({ endorsement_count: nextCount })
        .eq('id', pro.id);
    }
  };

  const handleRegisterNewPro = async (newProObj) => {
    if (supabase && session?.user) {
      const { data, error } = await supabase
        .from('local_pros')
        .insert({ ...newProObj, owner_id: session.user.id, endorsement_count: 1 })
        .select('*')
        .single();
      if (!error && data) {
        setPros((prev) => [data, ...prev]);
      }
    }
  };

  const hasBothRouteEnds = Boolean(filterFrom.trim() && filterTo.trim());

  const trackDestinationSearch = async (label) => {
    const clean = (label || '').trim();
    if (clean.length < 2) return;
    const matchedHub = BASE_QUICK_DESTINATIONS.find(
      (h) =>
        clean.toLowerCase().includes(h.toLowerCase()) ||
        h.toLowerCase().includes(clean.toLowerCase())
    );
    const hubToLog = matchedHub || clean;
    setSearchStatsMap((prev) => ({
      ...prev,
      [hubToLog]: (prev[hubToLog] || 0) + 1
    }));
    if (supabase) {
      await supabase.rpc('increment_route_search', { p_hub_label: hubToLog });
    }
  };

  const handleSwapOriginDest = () => {
    const prevO = fromQuery;
    const prevD = toQuery;
    const prevOCoord = originPinCoord;
    const prevDCoord = destPinCoord;
    setFromQuery(prevD);
    setToQuery(prevO);
    if (typeof setOriginPinCoord === 'function') setOriginPinCoord(prevDCoord || null);
    if (typeof setDestPinCoord === 'function') setDestPinCoord(prevOCoord || null);
  };

  const handleFillOriginFromCurrentGps = () => {
    if (!navigator.geolocation) return;
    setLocatingOriginGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        if (typeof setOriginPinCoord === 'function') {
          setOriginPinCoord({ lat, lng });
        }
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=hu`
          );
          const data = await res.json();
          const addr = data?.address || {};
          const city = addr.city || addr.town || addr.village || 'Szentendre';
          const road = addr.road || addr.pedestrian || addr.suburb || '';
          const house = addr.house_number ? ` ${addr.house_number}.` : '';
          setFromQuery(road ? `${city}, ${road}${house}` : `${city} (aktuális helyzet)`);
        } catch {
          setFromQuery('Szentendre (aktuális helyzet)');
        }
        setLocatingOriginGps(false);
      },
      () => {
        setLocatingOriginGps(false);
        alert('Engedélyezd a helymeghatározást a böngészőben.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const smartQuickChips = (() => {
    const hour = new Date().getHours();
    const isMorning = hour >= 5 && hour < 12;
    const morningHubs = new Set(['HÉV-végállomás', 'Újpest-Városkapu', 'Papírgyár', 'Bükkös-part']);
    const afternoonHubs = new Set(['Pismány', 'Szarvashegy', 'Izbég', 'Pannóniatelep']);

    const allLabels = Array.from(
      new Set([...BASE_QUICK_DESTINATIONS, ...Object.keys(searchStatsMap)])
    );

    return allLabels
      .map((label) => {
        const needle = label.toLowerCase();
        const liveCount = rides.filter((r) => {
          const destMatch = (r.dest_text || '').toLowerCase().includes(needle);
          const stopMatch = (r.stops || []).some((s) =>
            (s.name || '').toLowerCase().includes(needle)
          );
          return destMatch || stopMatch;
        }).length;

        const searches = searchStatsMap[label] || 0;
        const timeBoost = isMorning
          ? morningHubs.has(label)
            ? 8
            : 0
          : afternoonHubs.has(label)
          ? 8
          : 0;

        const score = liveCount * 25 + searches + timeBoost;
        return { label, liveCount, searches, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 7);
  })();

  const topPersonalRoutine = personalRoutines[0] || null;

  const visibleAgreements = myAgreements.filter(
    (a) => !hiddenAgreementIds.includes(a.id)
  );
  const unreadCount = visibleAgreements.filter((a) => a.has_unread).length;

  const handleOpenAgreement = (agr) => {
    if (session?.user?.id && agr?.id) {
      markAgreementReadStorage(session.user.id, agr.id);
      setReadVersion((v) => v + 1);
      setMyAgreements((prev) =>
        prev.map((item) =>
          item.id === agr.id ? { ...item, has_unread: false } : item
        )
      );
    }
    setIncomingToast(null);
    setActiveAgreement(agr);
  };

  const handleHideCompletedAgreement = (e, agrId) => {
    e.preventDefault();
    e.stopPropagation();
    const uid = session?.user?.id;
    if (!uid) return;
    markAgreementReadStorage(uid, agrId);
    setMyAgreements((prev) =>
      prev.map((item) => (item.id === agrId ? { ...item, has_unread: false } : item))
    );
    const next = Array.from(new Set([...hiddenAgreementIds, agrId]));
    setHiddenAgreementIds(next);
    localStorage.setItem(`kalaka_hidden_${uid}`, JSON.stringify(next));
  };

  return (
    <div className="w-full max-w-xl mx-auto min-h-screen pb-28 overflow-x-hidden">
      {/* Felugró értesítés új bejövő üzenetkor (ha a chat nincs megnyitva) */}
      {incomingToast && activeAgreement?.id !== incomingToast.agreement_id && (
        <div
          onClick={() => {
            const target = myAgreements.find((a) => a.id === incomingToast.agreement_id);
            if (target) handleOpenAgreement(target);
            else {
              setActiveTab('messages');
              setIncomingToast(null);
            }
          }}
          className="fixed top-3 left-3 right-3 max-w-md mx-auto z-50 bg-[#18261F] text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-400/40 flex items-center justify-between gap-3 cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-terracotta animate-ping shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-emerald-300">
                Új üzenet érkezett
              </div>
              <div className="text-xs font-medium truncate">
                {incomingToast.body}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIncomingToast(null);
            }}
            className="text-xs font-bold text-white/70 hover:text-white px-1.5 shrink-0"
          >
            ✕
          </button>
        </div>
      )}
      <HeaderRoadBar
        session={session}
        profile={profile}
        roadAlerts={roadAlerts}
        onOpenRoadModal={() => setShowRoadModal(true)}
        onOpenAuthModal={() => setShowAuthModal(true)}
      />

      {activeTab === 'rides' && (
        <section className="mx-3 sm:mx-4 -mt-3 bg-white rounded-2xl p-3 sm:p-3.5 shadow-lg border border-[#DFD9CE] relative z-20 space-y-2.5 box-border">
          <div className="space-y-1">
            <AddressAutocompleteInput
              value={filterFrom}
              onFocus={() => setActiveSearchField('from')}
              onChange={(val) => {
                setSelectedRideForMap(null);
                setFilterFrom(val);
              }}
              onSelectPlace={(place) => {
                setFromCoords(place ? { lat: place.lat, lng: place.lng } : null);
                setActiveSearchField('to');
              }}
              placeholder="Honnan indulsz?"
              dotColor="border-pilis"
            />

            <div className="border-t border-[#ECE7DC] pt-1">
              <AddressAutocompleteInput
                value={filterTo}
                onFocus={() => setActiveSearchField('to')}
                onChange={(val) => {
                  setSelectedRideForMap(null);
                  setFilterTo(val);
                }}
                onSelectPlace={(place) => {
                  setToCoords(place ? { lat: place.lat, lng: place.lng } : null);
                }}
                placeholder="Hová tartasz?"
                isSolidDot
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#ECE7DC] min-w-0">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5 min-w-0 flex-1">
              {[
                'Mind',
                'Szentendre HÉV-végállomás',
                'Bükkös-part',
                'Papírgyár',
                'Pismány',
                'Szarvashegy',
                'Izbég'
              ].map((chip) => {
                const isSelected =
                  (chip === 'Mind' && !filterFrom && !filterTo) ||
                  filterFrom === chip ||
                  filterTo === chip;
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleSelectQuickLocation(chip)}
                    className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border transition ${
                      isSelected
                        ? 'bg-pilis text-white border-pilis'
                        : 'bg-limestone text-[#5C6B62] border-[#DFD9CE] hover:border-pilis'
                    }`}
                  >
                    {chip.replace('Szentendre ', '')}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowMap((v) => !v)}
              className="shrink-0 text-xs font-bold text-pilis bg-pilis-soft px-2.5 py-1 rounded-lg"
            >
              {showMap ? 'Térkép elrejtése' : 'Térkép'}
            </button>
          </div>

          {showMap && (
            <InteractiveRouteMap
              rides={filteredRides}
              fromText={filterFrom}
              toText={filterTo}
              fromCoords={fromCoords}
              toCoords={toCoords}
              selectedRide={selectedRideForMap}
              onSelectRideOnMap={(rideObj) => {
                setSelectedRideForMap(rideObj);
              }}
              onPickLocation={(label, coordsObj, forcedField) =>
                handleSelectQuickLocation(label, coordsObj, forcedField)
              }
              onUpdatePinCoords={(which, coordsObj) => {
                if (which === 'from') setFromCoords(coordsObj);
                else setToCoords(coordsObj);
              }}
            />
          )}

          {hasBothRouteEnds && (
            <div className="pt-2.5 border-t border-[#ECE7DC]">
              {!inlineComposerMode ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-limestone p-2.5 rounded-xl border border-[#DFD9CE]">
                  <span className="text-xs font-bold text-[#18261F] px-1">
                    Kiírod ezt az útvonalat?
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setInlineSeats(3);
                        setInlineValidMins(720);
                        setInlineComposerMode('offer');
                      }}
                      className="bg-pilis hover:bg-pilis-light text-white font-bold text-xs px-2.5 py-2 rounded-lg transition"
                    >
                      Van helyem
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInlineSeats(3);
                        setInlineValidMins(10080);
                        setInlineComposerMode('recurring');
                      }}
                      className="bg-white hover:border-pilis text-pilis border border-[#DFD9CE] font-bold text-xs px-2.5 py-2 rounded-lg transition"
                    >
                      Rendszeres
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInlineSeats(1);
                        setInlineValidMins(180);
                        setInlineComposerMode('ask');
                      }}
                      className="bg-terracotta hover:bg-[#b55538] text-white font-bold text-xs px-2.5 py-2 rounded-lg transition"
                    >
                      Utat keresek
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={handlePublishInlineRide}
                  className="bg-limestone p-3 rounded-xl border border-pilis/30 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-1 bg-white p-1 rounded-lg border border-[#DFD9CE] text-[11px] font-bold">
                      {[
                        ['offer', 'Van helyem'],
                        ['recurring', 'Rendszeres'],
                        ['ask', 'Utat keresek']
                      ].map(([m, lbl]) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setInlineComposerMode(m);
                            if (m === 'ask') setInlineSeats(1);
                            else if (inlineSeats === 1) setInlineSeats(3);
                          }}
                          className={`px-2 py-1 rounded-md transition ${
                            inlineComposerMode === m
                              ? 'bg-pilis text-white'
                              : 'text-[#5C6B62]'
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setInlineComposerMode(null)}
                      className="text-xs font-bold text-[#5C6B62] hover:text-black px-1"
                    >
                      Mégse ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between bg-white border border-[#DFD9CE] rounded-xl px-3 py-2">
                      <span className="text-xs text-[#5C6B62] font-semibold">Indulás:</span>
                      <input
                        type="time"
                        value={inlineTime}
                        onChange={(e) => setInlineTime(e.target.value)}
                        className="text-sm font-bold focus:outline-none bg-transparent"
                      />
                  {!false && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-pilis-soft text-pilis shrink-0">
                      {resolveAutoDayForTime(inlineTime, false)}
                    </span>
                  )}
                    </div>

                    <select
                      value={inlineSeats}
                      onChange={(e) => setInlineSeats(e.target.value)}
                      className="bg-white border border-[#DFD9CE] rounded-xl px-3 py-2 text-xs font-bold"
                    >
                      {[1, 2, 3, 4].map((n) => (
                        <option key={n} value={n}>
                          {inlineComposerMode === 'ask' ? `${n} utas` : `${n} szabad hely`}
                        </option>
                      ))}
                    </select>

                    {inlineComposerMode === 'recurring' && (
                      <select
                        value={inlineSchedule}
                        onChange={(e) => setInlineSchedule(e.target.value)}
                        className="col-span-2 bg-white border border-[#DFD9CE] rounded-xl px-3 py-2 text-xs font-bold"
                      >
                        <option value="Munkanapokon (H–P)">Munkanapokon (H–P)</option>
                        <option value="Minden nap">Minden nap</option>
                        <option value="Hétvégén (Szo–V)">Hétvégén (Szo–V)</option>
                        <option value="Hétfő, Szerda, Péntek">Hétfő, Szerda, Péntek</option>
                        <option value="Kedd, Csütörtök">Kedd, Csütörtök</option>
                      </select>
                    )}

                    <select
                      value={inlineValidMins}
                      onChange={(e) => setInlineValidMins(Number(e.target.value))}
                      className="col-span-2 bg-white border border-[#DFD9CE] rounded-xl px-3 py-2 text-xs font-bold text-pilis"
                    >
                      {VALIDITY_OPTIONS.map((opt) => (
                        <option key={opt.minutes} value={opt.minutes}>
                          Érvényes: {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inlineNote}
                      onChange={(e) => setInlineNote(e.target.value)}
                      placeholder="Megjegyzés (nem kötelező)..."
                      className="flex-1 min-w-0 bg-white border border-[#DFD9CE] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pilis"
                    />
                    <button
                      type="submit"
                      disabled={inlineSaving}
                      className="shrink-0 bg-pilis hover:bg-pilis-light text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition"
                    >
                      {inlineSaving ? 'Mentés...' : 'Közzététel'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </section>
      )}

      <main className="px-3 sm:px-4 mt-4 space-y-3">
        {activeTab === 'rides' && (
          <>
            {filteredRides.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center border border-[#DFD9CE] space-y-2">
                <div className="text-sm font-bold text-[#18261F]">
                  Jelenleg nincs aktív út erre az útvonalra.
                </div>
                <p className="text-xs text-[#5C6B62]">
                  Add meg fent a Honnan és Hová mezőt, és tedd közzé elsőként!
                </p>
              </div>
            ) : (
              filteredRides.map((ride) => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  kudosCount={kudosCountByUser[ride.user_id] || 0}
                  onInspectUser={setInspectedUser}
                  currentUserId={session?.user?.id || profile.id}
                  onStartAgreement={handleStartRideAgreement}
                  onShowOnMap={(r) => {
                    setSelectedRideForMap(r);
                    setShowMap(true);
                  }}
                  onEditRide={handleOpenEditRide}
                  onDeleteRide={handleDeleteRide}
                />
              ))
            )}
          </>
        )}

        {activeTab === 'favors' && (
          <>
            {favors.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center border border-[#DFD9CE] space-y-2">
                <div className="text-sm font-bold text-[#18261F]">
                  Még nincs aktív Kaláka-kérés.
                </div>
                <button
                  onClick={() => {
                    setEditingItemId(null);
                    setNewKind('favor');
                    setShowNewModal(true);
                  }}
                  className="bg-pilis text-white font-bold text-xs px-4 py-2.5 rounded-xl"
                >
                  + Új Kaláka-kérés
                </button>
              </div>
            ) : (
              favors.map((fav) => (
                <FavorCard
                  key={fav.id}
                  favor={fav}
                  currentUserId={session?.user?.id || profile.id}
                  userFavorHearts={profile.favor_hearts}
                  onStartFavorAgreement={handleStartFavorAgreement}
                  onEditFavor={handleOpenEditFavor}
                  onDeleteFavor={handleDeleteFavor}
                />
              ))
            )}
          </>
        )}

        {activeTab === 'messages' && (
          <div className="space-y-2.5">
            <h2 className="font-display font-extrabold text-lg">
              Beszélgetéseim ({visibleAgreements.length})
            </h2>
            {visibleAgreements.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center text-xs text-[#5C6B62] border border-[#DFD9CE]">
                Még nincs aktív beszélgetésed.
              </div>
            ) : (
              visibleAgreements.map((agr) => {
                const isDone = agr.status === 'completed' || agr.status === 'cancelled';
                return (
                  <div
                    key={agr.id}
                    onClick={() => handleOpenAgreement(agr)}
                    className={`bg-white rounded-2xl p-3.5 sm:p-4 border shadow-sm flex items-center justify-between gap-3 cursor-pointer transition ${
                      agr.has_unread
                        ? 'border-terracotta ring-1 ring-terracotta/30'
                        : 'border-[#DFD9CE] hover:border-pilis'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {agr.has_unread && (
                        <span className="w-2.5 h-2.5 rounded-full bg-terracotta mt-1.5 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-[#18261F] truncate">
                            {agr.partner_name}
                          </span>
                          {isDone && (
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full shrink-0">
                              Lezárva
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#5C6B62] truncate">
                          {agr.title}
                        </div>
                        {agr.last_message_body && (
                          <div
                            className={`text-xs mt-1 truncate ${
                              agr.has_unread
                                ? 'font-bold text-[#18261F]'
                                : 'text-[#5C6B62]'
                            }`}
                          >
                            {agr.last_message_body}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isDone && (
                        <button
                          type="button"
                          onClick={(e) => handleHideCompletedAgreement(e, agr.id)}
                          className="text-[11px] font-bold text-[#5C6B62] hover:text-red-700 bg-limestone px-2.5 py-1.5 rounded-xl border border-[#DFD9CE]"
                        >
                          Elrejtés
                        </button>
                      )}
                      <span
                        className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                          agr.has_unread
                            ? 'bg-terracotta text-white'
                            : 'bg-pilis-soft text-pilis'
                        }`}
                      >
                        {agr.has_unread ? 'Új üzenet' : 'Megnyitás ›'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'pros' && (
          <ProsDirectoryView
            pros={pros}
            session={session}
            profile={profile}
            onOpenAuthModal={() => setShowAuthModal(true)}
            onRefreshPros={() => fetchAllLiveData(session?.user?.id)}
            onStartProAgreement={handleStartProAgreement}
          />
        )}
      </main>

      {/* Alsó navigációs sáv: beépített középső "+ Új" gombbal, így SOHA nem takarja el a kártyák gombjait mobilon */}
      <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-[#DFD9CE] pb-[env(safe-area-inset-bottom)] z-30">
        <div className="max-w-xl mx-auto grid grid-cols-5 items-center">
          <button
            onClick={() => setActiveTab('rides')}
            className={`py-3 text-xs font-bold border-t-2 transition ${
              activeTab === 'rides'
                ? 'border-pilis text-pilis'
                : 'border-transparent text-[#5C6B62]'
            }`}
          >
            Utak
          </button>

          <button
            onClick={() => setActiveTab('favors')}
            className={`py-3 text-xs font-bold border-t-2 transition ${
              activeTab === 'favors'
                ? 'border-pilis text-pilis'
                : 'border-transparent text-[#5C6B62]'
            }`}
          >
            Kaláka
          </button>

          <div className="flex justify-center py-1.5">
            <button
              onClick={() => {
                setEditingItemId(null);
                setNewFrom(filterFrom);
                setNewTo(filterTo);
                setNewFromCoords(fromCoords);
                setNewToCoords(toCoords);
                if (activeTab === 'favors') setNewKind('favor');
                else if (newKind === 'favor') setNewKind('offer');
                setShowNewModal(true);
              }}
              className="bg-terracotta hover:bg-[#b55538] text-white font-display font-extrabold text-xs px-3.5 py-2 rounded-full shadow-md transition"
            >
              + Új
            </button>
          </div>

          <button
            onClick={() => setActiveTab('messages')}
            className={`relative py-3 text-xs font-bold border-t-2 transition px-1 flex items-center justify-center gap-1 ${
              activeTab === 'messages'
                ? 'border-pilis text-pilis'
                : 'border-transparent text-[#5C6B62]'
            }`}
          >
            <span>Üzenet</span>
            {unreadCount > 0 && (
              <span className="bg-terracotta text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full leading-tight">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('pros')}
            className={`py-3 text-xs font-bold border-t-2 transition ${
              activeTab === 'pros'
                ? 'border-pilis text-pilis'
                : 'border-transparent text-[#5C6B62]'
            }`}
          >
            Szakik
          </button>
        </div>
      </nav>

      {showRoadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-limestone w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-3 border border-[#DFD9CE] shadow-2xl max-h-[90vh] overflow-y-auto box-border">
            <div className="flex justify-between items-center">
              <h3 className="font-display font-extrabold text-lg">
                11-es út és hegyi útinfó ({roadAlerts.length})
              </h3>
              <button
                onClick={() => setShowRoadModal(false)}
                className="text-sm font-bold text-[#5C6B62] px-2 py-1"
              >
                Bezárás ✕
              </button>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {roadAlerts.map((al) => (
                <div
                  key={al.id}
                  className="bg-white rounded-xl p-3 border border-[#DFD9CE] text-xs space-y-1 flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] text-[#5C6B62]">
                      <span className="font-bold text-[#18261F]">
                        {al.author_name || 'Helyi autós'}
                      </span>
                      <span>
                        {new Date(al.created_at).toLocaleTimeString('hu-HU', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="font-semibold text-[#18261F] mt-0.5 break-words">{al.message}</div>
                  </div>
                  {session?.user && al.reporter_id === session.user.id && (
                    <button
                      type="button"
                      onClick={() => handleDeleteRoadAlert(al.id)}
                      className="text-[11px] font-bold text-red-700 hover:underline shrink-0"
                    >
                      Törlés
                    </button>
                  )}
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddRoadAlert(customRoadLevel, customRoadText);
              }}
              className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-2.5"
            >
              <div className="text-xs font-bold text-[#18261F]">
                Új útinfó beküldése:
              </div>
              <div className="grid grid-cols-3 gap-1 bg-limestone p-1 rounded-lg text-[11px] font-bold">
                {[
                  ['warn', 'Torlódás'],
                  ['danger', 'Baleset / Jég'],
                  ['ok', 'Tiszta út']
                ].map(([lvl, lbl]) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setCustomRoadLevel(lvl)}
                    className={`py-1.5 rounded ${
                      customRoadLevel === lvl ? 'bg-pilis text-white' : 'text-[#5C6B62]'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
              <input
                type="text"
                required
                value={customRoadText}
                onChange={(e) => setCustomRoadText(e.target.value)}
                placeholder="Írd le, hol és mi történik..."
                className="w-full bg-limestone border border-[#DFD9CE] rounded-xl px-3 py-2 text-base box-border"
              />
              <button
                type="submit"
                className="w-full bg-pilis text-white font-bold py-2.5 rounded-xl text-xs"
              >
                Közzététel
              </button>
            </form>
          </div>
        </div>
      )}

      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleSaveModalPost}
            className="bg-limestone w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-3 border border-[#DFD9CE] max-h-[90vh] overflow-y-auto box-border"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-display font-extrabold text-lg">
                {editingItemId ? 'Kiírás szerkesztése' : 'Új kiírás'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowNewModal(false);
                  setEditingItemId(null);
                }}
                className="text-sm font-bold text-[#5C6B62] px-2 py-1"
              >
                Bezárás ✕
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1 bg-[#ECE7DC] p-1 rounded-xl text-[11px] sm:text-xs font-bold">
              {[
                ['offer', 'Van helyem'],
                ['recurring', 'Rendszeres'],
                ['ask', 'Utat keresek'],
                ['favor', 'Kaláka']
              ].map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setNewKind(k)}
                  className={`py-2 rounded-lg truncate px-1 ${
                    newKind === k ? 'bg-white text-pilis shadow-sm' : 'text-[#5C6B62]'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {newKind === 'favor' ? (
              <input
                type="text"
                required
                value={newFrom}
                onChange={(e) => setNewFrom(e.target.value)}
                placeholder="Miben kérsz vagy ajánlasz segítséget?"
                className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-base box-border"
              />
            ) : (
              <div className="bg-white rounded-xl p-2 border border-[#DFD9CE] space-y-1.5">
                <AddressAutocompleteInput
                  value={newFrom}
                  onChange={setNewFrom}
                  onSelectPlace={(pl) =>
                    setNewFromCoords(pl ? { lat: pl.lat, lng: pl.lng } : null)
                  }
                  placeholder="Honnan indulsz?"
                />
                <div className="border-t border-[#ECE7DC] pt-1.5">
                  <AddressAutocompleteInput
                    value={newTo}
                    onChange={setNewTo}
                    onSelectPlace={(pl) =>
                      setNewToCoords(pl ? { lat: pl.lat, lng: pl.lng } : null)
                    }
                    placeholder="Hová mész?"
                    isSolidDot
                  />
                </div>
              </div>
            )}

            {newKind !== 'favor' ? (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-base font-bold box-border"
                />
                <select
                  value={newSeats}
                  onChange={(e) => setNewSeats(e.target.value)}
                  className="bg-white border border-[#DFD9CE] rounded-xl px-3 py-2.5 text-xs font-bold box-border"
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {newKind === 'ask' ? `${n} utas` : `${n} szabad hely`}
                    </option>
                  ))}
                </select>
                {newKind === 'recurring' && (
                  <select
                    value={newScheduleText}
                    onChange={(e) => setNewScheduleText(e.target.value)}
                    className="col-span-2 bg-white border border-[#DFD9CE] rounded-xl px-3 py-2.5 text-xs font-bold box-border"
                  >
                    <option value="Munkanapokon (H–P)">Munkanapokon (H–P)</option>
                    <option value="Minden nap">Minden nap</option>
                    <option value="Hétvégén (Szo–V)">Hétvégén (Szo–V)</option>
                    <option value="Hétfő, Szerda, Péntek">Hétfő, Szerda, Péntek</option>
                    <option value="Kedd, Csütörtök">Kedd, Csütörtök</option>
                  </select>
                )}
              </div>
            ) : (
              <div className="bg-white border border-[#DFD9CE] rounded-xl p-3">
                <label className="text-xs font-bold block mb-1">
                  Kölcsönzés feltétele: legalább {newMinHearts} korábbi segítés
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={newMinHearts}
                  onChange={(e) => setNewMinHearts(e.target.value)}
                  className="w-full accent-pilis"
                />
              </div>
            )}

            <div className="bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#18261F]">
                Érvényesség
              </span>
              <select
                value={newValidMins}
                onChange={(e) => setNewValidMins(Number(e.target.value))}
                className="text-xs font-bold text-pilis bg-limestone px-2.5 py-1.5 rounded-lg border border-[#DFD9CE]"
              >
                {VALIDITY_OPTIONS.map((opt) => (
                  <option key={opt.minutes} value={opt.minutes}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Megjegyzés (nem kötelező)"
              className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-base box-border"
            />

            <button
              type="submit"
              className="w-full bg-pilis text-white font-bold py-3 rounded-xl text-sm"
            >
              {editingItemId ? 'Módosítások mentése' : 'Közzététel'}
            </button>
          </form>
        </div>
      )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        session={session}
        profile={profile}
        onProfileUpdated={(updated) => setProfile(updated)}
      />

      <AgreementChatModal
        agreement={activeAgreement}
        currentUser={profile}
        onClose={() => {
          if (session?.user?.id && activeAgreement?.id) {
            markAgreementReadStorage(session.user.id, activeAgreement.id);
            setMyAgreements((prev) =>
              prev.map((x) =>
                x.id === activeAgreement.id ? { ...x, has_unread: false } : x
              )
            );
          }
          setActiveAgreement(null);
        }}
        onAgreementUpdated={(updatedAgr) => {
          setActiveAgreement((prev) => (prev ? { ...prev, ...updatedAgr } : null));
          fetchAllLiveData(session?.user?.id);
          if (session?.user) loadUserProfile(session.user);
        }}
      />
    </div>
  );
}

