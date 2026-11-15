import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase.js';
import { computeStopsAlongRoute } from './lib/routing.js';
import {
  VALIDITY_OPTIONS,
  resolveCoordsFromText
} from './constants/szentendreData.js';
import HeaderRoadBar from './components/HeaderRoadBar.jsx';
import AddressAutocompleteInput, { stripAccents } from './components/AddressAutocompleteInput.jsx';
import InteractiveRouteMap from './components/InteractiveRouteMap.jsx';
import RideCard from './components/RideCard.jsx';
import FavorCard from './components/FavorCard.jsx';
import AgreementChatModal from './components/AgreementChatModal.jsx';
import UserProfileModal from './components/UserProfileModal.jsx';
import LegalModal from './components/LegalModal.jsx';
import AuthModal from './components/AuthModal.jsx';

const ProsDirectoryView = React.lazy(() => import('./components/ProsDirectoryView.jsx'));

const BASE_QUICK_DESTINATIONS = [
  'Szentendre HÉV-végállomás',
  'Bükkös-part',
  'Papírgyár',
  'Pismány',
  'Szarvashegy',
  'Izbég',
  'Újpest-Városkapu',
  'Pannóniatelep'
];

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

function triggerSystemNotification(title, body) {
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

function getNextQuarterHourHHMM() {
  const d = new Date(Date.now() + 15 * 60000);
  const mins = Math.ceil(d.getMinutes() / 15) * 15;
  d.setMinutes(mins, 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getUpcomingRoundTimeSlots() {
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

function getOffsetTimeString(addMinutes = 10) {
  const d = new Date(Date.now() + addMinutes * 60000);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
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

function formatDayLabelFromIso(isoStr, isRec = false, schedLabel = null) {
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
  const [initialLoading, setInitialLoading] = useState(true);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [rideKindFilter, setRideKindFilter] = useState('all');
  const [favors, setFavors] = useState([]);
  const [pros, setPros] = useState([]);
  const [myAgreements, setMyAgreements] = useState([]);

  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [fromCoords, setFromCoords] = useState(null);
  const [toCoords, setToCoords] = useState(null);
  const [activeSearchField, setActiveSearchField] = useState('from');
  const [showMap, setShowMap] = useState(false);
  const [selectedRideForMap, setSelectedRideForMap] = useState(null);

  const [inlineComposerMode, setInlineComposerMode] = useState(null);
  const [inlineTime, setInlineTime] = useState(() => getNextQuarterHourHHMM());
  const [inlineSchedule, setInlineSchedule] = useState('Munkanapokon (H–P)');
  const [inlineSeats, setInlineSeats] = useState(3);
  const [inlineNote, setInlineNote] = useState('');
  const [inlineSaving, setInlineSaving] = useState(false);

  const [activeAgreement, setActiveAgreement] = useState(null);
  const notifiedMsgKeysRef = useRef(new Set());
  const fetchDebounceRef = useRef(null);

  const [inspectedUser, setInspectedUser] = useState(null);
  const [kudosCountByUser, setKudosCountByUser] = useState({});
  const [searchStatsMap, setSearchStatsMap] = useState({});
  const [personalRoutines, setPersonalRoutines] = useState([]);
  const [locatingOriginGps, setLocatingOriginGps] = useState(false);
  const [incomingToast, setIncomingToast] = useState(null);
  const [appNotice, setAppNotice] = useState(null);
  const [hiddenAgreementIds, setHiddenAgreementIds] = useState([]);

  const [showNewModal, setShowNewModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showRoadModal, setShowRoadModal] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);

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

  const showNotice = useCallback((text, tone = 'info') => {
    setAppNotice({ text, tone });
    setTimeout(() => setAppNotice(null), 4000);
  }, []);

  const loadUserProfile = useCallback(async (authUser) => {
    if (!supabase || !authUser) return;
    let { data } = await supabase
      .from('profiles')
      .select('id, display_name, zone, bio, car_info, ride_hearts, favor_hearts, is_gps_local_verified, invite_code')
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
            fallbackName === 'Belépés' ? authUser.email?.split('@')[0] || 'Szomszéd' : fallbackName,
          zone: cleanZone
        })
        .select('id, display_name, zone, bio, car_info, ride_hearts, favor_hearts, is_gps_local_verified, invite_code')
        .single();
      data = inserted;
    } else if (data.display_name === 'Belépés') {
      const fixedName = authUser.email?.split('@')[0] || 'Szomszéd';
      const { data: fixed } = await supabase
        .from('profiles')
        .update({ display_name: fixedName })
        .eq('id', authUser.id)
        .select('id, display_name, zone, bio, car_info, ride_hearts, favor_hearts, is_gps_local_verified, invite_code')
        .single();
      if (fixed) data = fixed;
    }

    if (data) {
      setProfile(data);
      setHiddenAgreementIds(getHiddenAgreements(data.id));
      setPersonalRoutines(getPersonalRoutines(data.id));
    }
  }, []);

  const fetchAllLiveData = useCallback(async (currentUserId) => {
    if (!supabase) return;
    const nowIso = new Date().toISOString();

    const [{ data: rideRows }, { data: favorRows }, { data: allProfs }, { data: allKudosRows }, { data: proRows }, { data: alertRows }] =
      await Promise.all([
        supabase
          .from('rides')
          .select('*, author:profiles!rides_user_id_fkey(display_name, ride_hearts, favor_hearts, zone, car_info)')
          .eq('status', 'open')
          .gt('expires_at', nowIso)
          .order('departure_at', { ascending: true }),
        supabase
          .from('favors')
          .select('*, author:profiles!favors_user_id_fkey(display_name, favor_hearts, zone)')
          .eq('status', 'open')
          .gt('expires_at', nowIso)
          .order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, ride_hearts, favor_hearts'),
        supabase.from('kudos').select('receiver_id'),
        supabase
          .from('local_pros')
          .select('*')
          .eq('is_active', true)
          .order('endorsement_count', { ascending: false }),
        supabase
          .from('road_alerts')
          .select('*, reporter:profiles!road_alerts_reporter_id_fkey(display_name, zone)')
          .gt('expires_at', nowIso)
          .order('created_at', { ascending: false })
          .limit(10)
      ]);

    const kMap = {};
    (allProfs || []).forEach((p) => {
      kMap[p.id] = (p.ride_hearts || 0) + (p.favor_hearts || 0);
    });
    const rawCounts = {};
    (allKudosRows || []).forEach((kr) => {
      if (kr.receiver_id) rawCounts[kr.receiver_id] = (rawCounts[kr.receiver_id] || 0) + 1;
    });
    Object.keys(rawCounts).forEach((uid) => {
      kMap[uid] = Math.max(kMap[uid] || 0, rawCounts[uid]);
    });
    setKudosCountByUser(kMap);

    if (rideRows) {
      const mappedRides = rideRows.map((r) => {
        const dt = new Date(r.departure_at);
        const timeStr = dt.toTimeString().slice(0, 5);
        const recMatch = r.note?.match(/^\[Rendszeres:\s*(.*?)\]\s*(.*)$/);
        const isRec = Boolean(r.recurring_id || r.schedule_label || recMatch);
        const scheduleLabel =
          r.schedule_label || (recMatch ? recMatch[1] : isRec ? 'Munkanapokon (H–P)' : null);
        const cleanNote = recMatch ? recMatch[2] : r.note;

        let effectiveDepIso = r.departure_at;
        if (isRec) {
          const [hh, mm] = timeStr.split(':').map(Number);
          const nextDep = new Date();
          nextDep.setHours(hh || 6, mm || 0, 0, 0);
          if (nextDep.getTime() < Date.now() - 15 * 60000) {
            nextDep.setDate(nextDep.getDate() + 1);
          }
          effectiveDepIso = nextDep.toISOString();
        }

        return {
          ...r,
          departure_at: effectiveDepIso,
          note: cleanNote,
          author_name: r.author?.display_name || 'Szomszéd',
          author_zone: r.author?.zone || '',
          author_car: r.car_info || r.author?.car_info || null,
          car_info: r.car_info || r.author?.car_info || null,
          author_ride_hearts: r.author?.ride_hearts || 0,
          author_favor_hearts: r.author?.favor_hearts || 0,
          is_recurring: isRec,
          schedule_text: scheduleLabel,
          depart_time: timeStr,
          time_label: timeStr,
          date_label: formatDayLabelFromIso(effectiveDepIso, isRec, scheduleLabel),
          stops: []
        };
      });
      mappedRides.sort((a, b) => new Date(a.departure_at) - new Date(b.departure_at));
      setRides(mappedRides);

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

    if (favorRows) {
      setFavors(
        favorRows.map((f) => ({
          ...f,
          author_name: f.author?.display_name || 'Szomszéd',
          author_zone: f.author?.zone || '',
          author_favor_hearts: f.author?.favor_hearts || 0
        }))
      );
    }

    if (proRows) setPros(proRows);

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
              const previewText = `${item.partner_name}: ${item.last_message_body || 'Új üzenet / jelentkezés'}`;
              playSoftNotificationTone();
              triggerSystemNotification('Kaláka Szentendre', previewText);
              setIncomingToast({
                agreement_id: item.id,
                body: previewText
              });
            }
          }
        });
      }
    }

    setInitialLoading(false);
  }, []);

  const scheduleDebouncedRefresh = useCallback(
    (uid) => {
      if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
      fetchDebounceRef.current = setTimeout(() => {
        fetchAllLiveData(uid);
      }, 500);
    },
    [fetchAllLiveData]
  );

  // 60 másodperces élő órajel lejárt utak automatikus szűréséhez
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Auth + Egyetlen, debounced Realtime csatorna + ablak-fókusz szinkron
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    const uid = session?.user?.id || null;

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

    const handleWakeOrFocus = () => {
      if (document.visibilityState === 'visible') {
        scheduleDebouncedRefresh(uid);
      }
    };
    document.addEventListener('visibilitychange', handleWakeOrFocus);
    window.addEventListener('focus', handleWakeOrFocus);

    const globalChannel = supabase
      .channel('public-feed-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, () =>
        scheduleDebouncedRefresh(uid)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'favors' }, () =>
        scheduleDebouncedRefresh(uid)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agreements' }, (payload) => {
        // Élő GPS koordináta-frissítésnél nem töltjük újra az egész főoldalt
        const oldRow = payload.old || {};
        const newRow = payload.new || {};
        if (
          payload.eventType === 'UPDATE' &&
          oldRow.status === newRow.status &&
          oldRow.requester_agreed === newRow.requester_agreed &&
          oldRow.helper_agreed === newRow.helper_agreed
        ) {
          return;
        }
        scheduleDebouncedRefresh(uid);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new;
        if (!uid || !msg) return;
        scheduleDebouncedRefresh(uid);
        if (msg.sender_id !== uid) {
          setHiddenAgreementIds((prev) => {
            if (!prev.includes(msg.agreement_id)) return prev;
            const next = prev.filter((id) => id !== msg.agreement_id);
            localStorage.setItem(`kalaka_hidden_${uid}`, JSON.stringify(next));
            return next;
          });
          playSoftNotificationTone();
          triggerSystemNotification('Új üzenet a Kalákán', msg.body || 'Új üzeneted érkezett');
          setIncomingToast({
            agreement_id: msg.agreement_id,
            body: msg.body
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'road_alerts' }, () =>
        scheduleDebouncedRefresh(uid)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'local_pros' }, () =>
        scheduleDebouncedRefresh(uid)
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleWakeOrFocus);
      window.removeEventListener('focus', handleWakeOrFocus);
      supabase.removeChannel(globalChannel);
      if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    };
  }, [loadUserProfile, fetchAllLiveData, scheduleDebouncedRefresh, session?.user?.id]);

  const filteredRides = useMemo(() => {
    const activeTimeRides = rides.filter(
      (r) => r.is_recurring || !r.expires_at || new Date(r.expires_at).getTime() > nowTick
    );
    const qFrom = stripAccents(filterFrom);
    const qTo = stripAccents(filterTo);
    if (!qFrom && !qTo) return activeTimeRides;

    return activeTimeRides.filter((r) => {
      const originNorm = stripAccents(r.origin_text);
      const destNorm = stripAccents(r.dest_text);
      const stopsText = stripAccents((r.stops || []).map((s) => s.name).join(' '));
      const fullRouteText = `${originNorm} ${stopsText} ${destNorm}`;

      const matchFrom =
        !qFrom ||
        originNorm.includes(qFrom) ||
        stopsText.includes(qFrom);

      const matchTo =
        !qTo ||
        destNorm.includes(qTo) ||
        stopsText.includes(qTo) ||
        fullRouteText.includes(qTo);

      return matchFrom && matchTo;
    });
  }, [rides, filterFrom, filterTo, nowTick]);

  const smartQuickChips = useMemo(() => {
    const hour = new Date().getHours();
    const isMorning = hour >= 5 && hour < 12;
    const morningHubs = new Set(['Szentendre HÉV-végállomás', 'Újpest-Városkapu', 'Papírgyár', 'Bükkös-part']);
    const afternoonHubs = new Set(['Szentendre HÉV-végállomás', 'Pismány', 'Szarvashegy', 'Izbég', 'Pannóniatelep']);

    return BASE_QUICK_DESTINATIONS.map((label) => {
      const needle = label.replace('Szentendre ', '').toLowerCase();
      const liveCount = filteredRides.filter((r) => {
        const routeStr = `${r.origin_text} ${r.dest_text}`.toLowerCase();
        const stopMatch = (r.stops || []).some((s) =>
          (s.name || '').toLowerCase().includes(needle)
        );
        return routeStr.includes(needle) || stopMatch;
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
      return { label, liveCount, score };
    })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [filteredRides, searchStatsMap]);

  const visibleAgreements = useMemo(
    () => myAgreements.filter((a) => !hiddenAgreementIds.includes(a.id)),
    [myAgreements, hiddenAgreementIds]
  );

  const unreadCount = useMemo(
    () => visibleAgreements.filter((a) => a.has_unread).length,
    [visibleAgreements]
  );

  const actionRequiredCount = useMemo(() => {
    const uid = session?.user?.id;
    if (!uid) return 0;
    return visibleAgreements.filter((a) => {
      if (['completed', 'cancelled'].includes(a.status)) return false;
      const postOwnerId = a.post_owner_id || a.helper_id;
      const isPostOwner = postOwnerId === uid;
      const ownerIsHelper = postOwnerId === a.helper_id;
      const ownerConfirmed = ownerIsHelper ? Boolean(a.helper_agreed) : Boolean(a.requester_agreed);
      const joinerConfirmed = ownerIsHelper ? Boolean(a.requester_agreed) : Boolean(a.helper_agreed);
      if (a.status === 'chatting' && isPostOwner && !ownerConfirmed) return true;
      if (a.status === 'chatting' && !isPostOwner && ownerConfirmed && !joinerConfirmed) return true;
      if (a.status === 'arrived' && a.requester_id === uid) return true;
      return false;
    }).length;
  }, [visibleAgreements, session?.user?.id]);

  const handleSelectQuickLocation = (locName, coordsObj = null, forcedField = null) => {
    setSelectedRideForMap(null);
    if (locName === 'Mind') {
      setFilterFrom('');
      setFilterTo('');
      setFromCoords(null);
      setToCoords(null);
      setInlineComposerMode(null);
      setShowMap(false);
      return;
    }
    setShowMap(true);

    const targetField =
      forcedField || (activeSearchField === 'to' || (filterFrom && !filterTo) ? 'to' : 'from');
    if (targetField === 'to') {
      setFilterTo(locName);
      setToCoords(coordsObj || resolveCoordsFromText(locName));
      setActiveSearchField('from');
    } else {
      setFilterFrom(locName);
      setFromCoords(coordsObj || resolveCoordsFromText(locName));
      setActiveSearchField('to');
    }
  };

  const handleSwapOriginDest = () => {
    setSelectedRideForMap(null);
    const prevO = filterFrom;
    const prevD = filterTo;
    const prevOCoord = fromCoords;
    const prevDCoord = toCoords;
    setFilterFrom(prevD);
    setFilterTo(prevO);
    setFromCoords(prevDCoord || null);
    setToCoords(prevOCoord || null);
  };

  const handleFillOriginFromCurrentGps = () => {
    if (!navigator.geolocation) {
      showNotice('A böngésződ nem támogatja a helymeghatározást.', 'err');
      return;
    }
    setLocatingOriginGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setFromCoords({ lat, lng });
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=hu`
          );
          const data = await res.json();
          const addr = data?.address || {};
          const city = addr.city || addr.town || addr.village || 'Szentendre';
          const road = addr.road || addr.pedestrian || addr.suburb || '';
          const house = addr.house_number ? ` ${addr.house_number}.` : '';
          setFilterFrom(road ? `${city}, ${road}${house}` : `${city} (aktuális helyzet)`);
        } catch {
          setFilterFrom('Szentendre (aktuális helyzet)');
        }
        setLocatingOriginGps(false);
      },
      () => {
        setLocatingOriginGps(false);
        showNotice('Engedélyezd a helymeghatározást a böngészőben.', 'err');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
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

      const isRec = inlineComposerMode === 'recurring';
      const dbKind = inlineComposerMode === 'ask' ? 'ask' : 'offer';

      const exp = isRec
        ? new Date(Date.now() + 30 * 24 * 3600000)
        : dbKind === 'ask'
        ? new Date(dep.getTime() + 30 * 60000)
        : new Date(dep.getTime() + 45 * 60000);

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
        car_info: profile?.car_info || null,
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

      recordPersonalRoutine(session.user.id, filterFrom.trim(), filterTo.trim());
      setPersonalRoutines(getPersonalRoutines(session.user.id));
      await fetchAllLiveData(session.user.id);
      setInlineComposerMode(null);
      setInlineNote('');
      showNotice('Útvonal közzétéve ✓');
    } catch (err) {
      showNotice(`Hiba a mentéskor: ${err.message}`, 'err');
    } finally {
      setInlineSaving(false);
    }
  };

  const handleDeleteRide = async (rideId) => {
    setRides((prev) => prev.filter((r) => r.id !== rideId));
    if (supabase && !String(rideId).startsWith('demo-')) {
      const { error } = await supabase.from('rides').delete().eq('id', rideId);
      if (error) {
        showNotice(`Törlési hiba: ${error.message}`, 'err');
        fetchAllLiveData(session?.user?.id);
      } else {
        showNotice('Útvonal törölve.');
      }
    }
  };

  const handleDeleteFavor = async (favorId) => {
    setFavors((prev) => prev.filter((f) => f.id !== favorId));
    if (supabase && !String(favorId).startsWith('demo-')) {
      const { error } = await supabase.from('favors').delete().eq('id', favorId);
      if (error) {
        showNotice(`Törlési hiba: ${error.message}`, 'err');
        fetchAllLiveData(session?.user?.id);
      } else {
        showNotice('Kérés törölve.');
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

    if (newKind === 'favor') {
      const validMinutes = Number(newValidMins) || 1440;
      const expIso = new Date(Date.now() + validMinutes * 60 * 1000).toISOString();

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
          showNotice(`Szerkesztési hiba: ${error.message}`, 'err');
          return;
        }
      } else {
        const { error } = await supabase
          .from('favors')
          .insert({ ...favPayload, user_id: session.user.id });
        if (error) {
          showNotice(`Mentési hiba: ${error.message}`, 'err');
          return;
        }
      }
      setActiveTab('favors');
    } else {
      if (!newFrom.trim() || !newTo.trim()) return;
      const [hh, mm] = (newTime || '05:50').split(':').map(Number);
      const dep = new Date();
      dep.setHours(hh || 5, mm || 50, 0, 0);
      if (dep < new Date()) dep.setDate(dep.getDate() + 1);

      const isRec = newKind === 'recurring';
      const actualKind = isRec ? 'offer' : newKind;

      const expDate = isRec
        ? new Date(Date.now() + 30 * 24 * 3600000)
        : actualKind === 'ask'
        ? new Date(dep.getTime() + 30 * 60000)
        : new Date(dep.getTime() + 45 * 60000);

      const startPt = newFromCoords || resolveCoordsFromText(newFrom);
      const endPt = newToCoords || resolveCoordsFromText(newTo);

      const ridePayload = {
        kind: actualKind,
        origin_text: newFrom.trim(),
        dest_text: newTo.trim(),
        departure_at: dep.toISOString(),
        expires_at: expDate.toISOString(),
        seats: Number(newSeats) || 3,
        car_info: profile?.car_info || null,
        is_confirmed_today: true,
        note: isRec
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
            showNotice(`Szerkesztési hiba: ${retryErr.message}`, 'err');
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
            showNotice(`Mentési hiba: ${retryErr.message}`, 'err');
            return;
          }
        }
      }
      recordPersonalRoutine(session.user.id, newFrom.trim(), newTo.trim());
      setPersonalRoutines(getPersonalRoutines(session.user.id));
      setActiveTab('rides');
    }

    setShowNewModal(false);
    setEditingItemId(null);
    setNewFrom('');
    setNewTo('');
    setNewNote('');
    showNotice(editingItemId ? 'Módosítások mentve ✓' : 'Közzétéve ✓');
    fetchAllLiveData(session.user.id);
  };

  const handleOpenAgreement = (agr) => {
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      Notification.requestPermission().catch(() => {});
    }
    if (session?.user?.id && agr?.id) {
      markAgreementReadStorage(session.user.id, agr.id);
      setMyAgreements((prev) =>
        prev.map((item) => (item.id === agr.id ? { ...item, has_unread: false } : item))
      );
    }
    setIncomingToast(null);
    setActiveAgreement(agr);
  };

  const handleStartRideAgreement = async (ride, selectedStop) => {
    if (!session?.user) {
      setShowAuthModal(true);
      return;
    }

    const existingLocal = myAgreements.find((a) => a.ride_id === ride.id);
    if (existingLocal) {
      handleOpenAgreement(existingLocal);
      return;
    }

    const requesterId = ride.kind === 'offer' ? session.user.id : ride.user_id;
    const helperId = ride.kind === 'offer' ? ride.user_id : session.user.id;
    const stopLabel = selectedStop ? `${selectedStop.time} ${selectedStop.name}` : null;

    const { data: existingAgr } = await supabase
      .from('agreements')
      .select('*')
      .eq('ride_id', ride.id)
      .eq('requester_id', requesterId)
      .eq('helper_id', helperId)
      .maybeSingle();

    if (existingAgr) {
      handleOpenAgreement({
        ...existingAgr,
        post_owner_id: ride.user_id,
        car_info: ride.car_info || null,
        partner_name: ride.author_name,
        title: `${ride.origin_text} → ${ride.dest_text}`
      });
      return;
    }

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
      showNotice(`Nem sikerült csatlakozni: ${error.message}`, 'err');
      return;
    }

    await supabase.from('messages').insert({
      agreement_id: createdAgr.id,
      sender_id: session.user.id,
      body: stopLabel
        ? `Szia! Felszállnék itt: ${stopLabel}.`
        : 'Szia! Csatlakoznék az úthoz.'
    });

    handleOpenAgreement({
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

    const existingLocal = myAgreements.find((a) => a.favor_id === favor.id);
    if (existingLocal) {
      handleOpenAgreement(existingLocal);
      return;
    }

    const requesterId = session.user.id;
    const helperId = favor.user_id;

    const { data: existingAgr } = await supabase
      .from('agreements')
      .select('*')
      .eq('favor_id', favor.id)
      .eq('requester_id', requesterId)
      .eq('helper_id', helperId)
      .maybeSingle();

    if (existingAgr) {
      handleOpenAgreement({
        ...existingAgr,
        partner_name: favor.author_name,
        title: favor.title
      });
      return;
    }

    const { data: createdAgr, error } = await supabase
      .from('agreements')
      .insert({
        favor_id: favor.id,
        requester_id: requesterId,
        helper_id: helperId,
        status: 'chatting'
      })
      .select('*')
      .single();

    if (error) {
      showNotice(`Nem sikerült megnyitni: ${error.message}`, 'err');
      return;
    }

    await supabase.from('messages').insert({
      agreement_id: createdAgr.id,
      sender_id: session.user.id,
      body: `Szia! Érdekelne: ${favor.title}`
    });

    handleOpenAgreement({
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

    const { data: existingAgr } = await supabase
      .from('agreements')
      .select('*')
      .eq('pro_id', pro.id)
      .eq('requester_id', session.user.id)
      .maybeSingle();

    if (existingAgr) {
      handleOpenAgreement({
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
      showNotice(`Nem sikerült megnyitni a beszélgetést: ${error.message}`, 'err');
      return;
    }

    await supabase.from('messages').insert({
      agreement_id: createdAgr.id,
      sender_id: session.user.id,
      body: `Szia! Érdeklődnék (${pro.profession_name || pro.business_name}).`
    });

    handleOpenAgreement({
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
        showNotice(`Hiba: ${error.message}`, 'err');
        return;
      }
      await fetchAllLiveData(session.user.id);
      showNotice('Útinfó közzétéve ✓');
    }
    setCustomRoadText('');
  };

  const handleClearRoadAlert = async (alertId) => {
    if (!session?.user) {
      setShowRoadModal(false);
      setShowAuthModal(true);
      return;
    }
    if (supabase && alertId && alertId !== 'default-ok') {
      await supabase
        .from('road_alerts')
        .update({ expires_at: new Date().toISOString() })
        .eq('id', alertId);
      await fetchAllLiveData(session.user.id);
      showNotice('Köszönjük! Az útinfó jelzés lezárva.');
    }
  };

  const handleDeleteRoadAlert = async (alertId) => {
    if (!supabase || alertId === 'default-ok') return;
    await supabase.from('road_alerts').delete().eq('id', alertId);
    fetchAllLiveData(session?.user?.id);
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

  const hasBothRouteEnds = Boolean(filterFrom.trim() && filterTo.trim());
  const topPersonalRoutine = personalRoutines[0] || null;
  const displayedRides = useMemo(
    () => filteredRides.filter((r) => rideKindFilter === 'all' || r.kind === rideKindFilter),
    [filteredRides, rideKindFilter]
  );

  return (
    <div className="w-full max-w-xl mx-auto min-h-screen pb-28 overflow-x-hidden">
      {/* Globális alkalmazás visszajelző sáv (Toast) */}
      {appNotice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[70] w-[92%] max-w-md"
        >
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center justify-between gap-2 ${
              appNotice.tone === 'err'
                ? 'bg-red-900 text-white border-red-700'
                : 'bg-[#18261F] text-white border-white/15'
            }`}
          >
            <span>{appNotice.text}</span>
            <button
              type="button"
              aria-label="Értesítés bezárása"
              onClick={() => setAppNotice(null)}
              className="opacity-80 hover:opacity-100 px-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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
            aria-label="Üzenet értesítés bezárása"
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
        onOpenAuthModal={() =>
          session?.user
            ? setInspectedUser({
                userId: session.user.id,
                name: profile?.display_name,
                zone: profile?.zone
              })
            : setShowAuthModal(true)
        }
      />

      {activeTab === 'rides' && (
        <section className="mx-3 sm:mx-4 -mt-3 bg-white rounded-2xl p-3 sm:p-3.5 shadow-lg border border-[#DFD9CE] relative z-20 space-y-2.5 box-border">
          <div className="flex items-center gap-1.5">
            <div className="flex-1 min-w-0 space-y-1">
              <AddressAutocompleteInput
                value={filterFrom}
                onFocus={() => setActiveSearchField('from')}
                onChange={(val) => {
                  setSelectedRideForMap(null);
                  setFromCoords(null);
                  setFilterFrom(val);
                }}
                onSelectPlace={(place) => {
                  setFromCoords(place ? { lat: place.lat, lng: place.lng } : null);
                  if (place) setShowMap(true);
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
                    setToCoords(null);
                    setFilterTo(val);
                  }}
                  onSelectPlace={(place) => {
                    setToCoords(place ? { lat: place.lat, lng: place.lng } : null);
                    if (place) setShowMap(true);
                  }}
                  placeholder="Hová tartasz?"
                  isSolidDot
                />
              </div>
            </div>

            <div className="flex flex-col gap-1 shrink-0">
              <button
                type="button"
                onClick={handleFillOriginFromCurrentGps}
                disabled={locatingOriginGps}
                aria-label="Jelenlegi GPS helyzetem betöltése"
                title="Jelenlegi GPS helyzetem"
                className="w-8 h-8 rounded-xl bg-limestone hover:bg-pilis-soft text-pilis border border-[#DFD9CE] grid place-items-center text-xs font-bold transition active:scale-95"
              >
                {locatingOriginGps ? '…' : '📍'}
              </button>
              <button
                type="button"
                onClick={handleSwapOriginDest}
                aria-label="Indulás és érkezés megfordítása"
                title="Irány megfordítása"
                className="w-8 h-8 rounded-xl bg-limestone hover:bg-pilis-soft text-[#18261F] border border-[#DFD9CE] grid place-items-center text-xs font-bold transition active:scale-95"
              >
                ⇅
              </button>
            </div>
          </div>

          {topPersonalRoutine && !filterFrom && !filterTo && (
            <div className="flex items-center justify-between gap-2 bg-pilis-soft/45 px-2.5 py-1.5 rounded-xl border border-pilis/15 text-xs">
              <span className="truncate text-[#18261F] font-medium">
                Szokásos:{' '}
                <strong className="font-bold">
                  {topPersonalRoutine.origin} → {topPersonalRoutine.dest}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setFilterFrom(topPersonalRoutine.origin);
                  setFilterTo(topPersonalRoutine.dest);
                  setFromCoords(resolveCoordsFromText(topPersonalRoutine.origin));
                  setToCoords(resolveCoordsFromText(topPersonalRoutine.dest));
                }}
                className="shrink-0 bg-pilis text-white font-bold text-[11px] px-2.5 py-1 rounded-lg transition active:scale-95"
              >
                Betöltés ›
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-[#ECE7DC] min-w-0">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5 pr-3 min-w-0 flex-1 [mask-image:linear-gradient(to_right,black_88%,transparent_100%)]">
              <button
                type="button"
                onClick={() => handleSelectQuickLocation('Mind')}
                className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border transition ${
                  !filterFrom && !filterTo
                    ? 'bg-pilis text-white border-pilis'
                    : 'bg-limestone text-[#5C6B62] border-[#DFD9CE] hover:border-pilis'
                }`}
              >
                Mind
              </button>

              {smartQuickChips.map((chipObj) => {
                const isSelected =
                  filterFrom === chipObj.label || filterTo === chipObj.label;
                return (
                  <button
                    key={chipObj.label}
                    type="button"
                    onClick={() => handleSelectQuickLocation(chipObj.label)}
                    className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border transition flex items-center gap-1 ${
                      isSelected
                        ? 'bg-pilis text-white border-pilis'
                        : 'bg-limestone text-[#5C6B62] border-[#DFD9CE] hover:border-pilis'
                    }`}
                  >
                    <span>{chipObj.label.replace('Szentendre ', '')}</span>
                    {chipObj.liveCount > 0 && (
                      <span
                        className={`text-[10px] font-extrabold px-1.5 rounded-full ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-pilis-soft text-pilis'
                        }`}
                      >
                        {chipObj.liveCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowMap((v) => !v)}
              aria-expanded={showMap}
              className="shrink-0 text-xs font-bold text-pilis bg-pilis-soft px-2.5 py-1 rounded-lg transition active:scale-95"
            >
              {showMap ? 'Térkép ▴' : '🗺️ Térkép'}
            </button>
          </div>

          {showMap && (
            <InteractiveRouteMap
              rides={filteredRides}
              fromText={filterFrom}
              toText={filterTo}
              fromCoords={fromCoords || resolveCoordsFromText(filterFrom)}
              toCoords={toCoords || resolveCoordsFromText(filterTo)}
              selectedRide={selectedRideForMap}
              onSelectRideOnMap={(rideObj) => setSelectedRideForMap(rideObj)}
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
                        setInlineComposerMode('offer');
                      }}
                      className="bg-pilis hover:bg-pilis-light text-white font-bold text-xs px-2.5 py-2 rounded-lg transition active:scale-95"
                    >
                      Van helyem
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInlineSeats(3);
                        setInlineComposerMode('recurring');
                      }}
                      className="bg-white hover:border-pilis text-pilis border border-[#DFD9CE] font-bold text-xs px-2.5 py-2 rounded-lg transition active:scale-95"
                    >
                      Rendszeres
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInlineSeats(1);
                        setInlineComposerMode('ask');
                      }}
                      className="bg-terracotta hover:bg-[#b55538] text-white font-bold text-xs px-2.5 py-2 rounded-lg transition active:scale-95"
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
                      <div className="flex items-center gap-1.5">
                        <input
                          type="time"
                          value={inlineTime}
                          onChange={(e) => setInlineTime(e.target.value)}
                          className="text-sm font-bold focus:outline-none bg-transparent"
                        />
                        {inlineComposerMode !== 'recurring' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pilis-soft text-pilis shrink-0">
                            {resolveAutoDayForTime(inlineTime, false)}
                          </span>
                        )}
                      </div>
                    </div>

                    <select
                      value={inlineSeats}
                      onChange={(e) => setInlineSeats(Number(e.target.value))}
                      aria-label="Helyek vagy utasok száma"
                      className="bg-white border border-[#DFD9CE] rounded-xl px-3 py-2 text-xs font-bold"
                    >
                      {[1, 2, 3, 4].map((n) => (
                        <option key={n} value={n}>
                          {inlineComposerMode === 'ask' ? `${n} utas` : `${n} szabad hely`}
                        </option>
                      ))}
                    </select>

                    {inlineComposerMode !== 'recurring' ? (
                      <div className="col-span-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                        {getUpcomingRoundTimeSlots().map((slotTime) => (
                          <button
                            key={slotTime}
                            type="button"
                            onClick={() => setInlineTime(slotTime)}
                            className={`shrink-0 text-[11px] font-bold border px-2.5 py-1 rounded-lg transition ${
                              inlineTime === slotTime
                                ? 'bg-pilis text-white border-pilis'
                                : 'bg-white hover:bg-pilis-soft text-pilis border-[#DFD9CE]'
                            }`}
                          >
                            🕒 {slotTime}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <select
                        value={inlineSchedule}
                        onChange={(e) => setInlineSchedule(e.target.value)}
                        aria-label="Rendszeres ütemezés"
                        className="col-span-2 bg-white border border-[#DFD9CE] rounded-xl px-3 py-2 text-xs font-bold"
                      >
                        <option value="Munkanapokon (H–P)">Munkanapokon (H–P)</option>
                        <option value="Minden nap">Minden nap</option>
                        <option value="Hétvégén (Szo–V)">Hétvégén (Szo–V)</option>
                        <option value="Hétfő, Szerda, Péntek">Hétfő, Szerda, Péntek</option>
                        <option value="Kedd, Csütörtök">Kedd, Csütörtök</option>
                      </select>
                    )}
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
            <div className="flex items-center justify-between gap-1.5 bg-white p-1 rounded-xl border border-[#DFD9CE] shadow-sm">
              {[
                ['all', `Minden út (${filteredRides.length})`],
                ['offer', `🚗 Van hely (${filteredRides.filter((r) => r.kind === 'offer').length})`],
                ['ask', `🙋 Utat keres (${filteredRides.filter((r) => r.kind === 'ask').length})`]
              ].map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setRideKindFilter(k)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition ${
                    rideKindFilter === k
                      ? 'bg-pilis text-white shadow-sm'
                      : 'text-[#5C6B62] hover:text-[#18261F]'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {initialLoading ? (
              <div className="space-y-2.5">
                {[1, 2].map((n) => (
                  <div
                    key={n}
                    className="bg-white rounded-2xl p-4 border border-[#DFD9CE] animate-pulse space-y-3"
                  >
                    <div className="flex justify-between">
                      <div className="h-6 w-24 bg-[#ECE7DC] rounded-lg" />
                      <div className="h-6 w-16 bg-[#ECE7DC] rounded-full" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-3/4 bg-[#ECE7DC] rounded" />
                      <div className="h-4 w-2/3 bg-[#ECE7DC] rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : displayedRides.length === 0 ? (
              <div className="bg-white rounded-2xl p-5 sm:p-6 text-center border border-[#DFD9CE] space-y-2.5">
                <div className="text-sm font-bold text-[#18261F]">
                  {filterFrom || filterTo || rideKindFilter !== 'all'
                    ? 'Nincs aktív út erre a szűrésre.'
                    : 'Még nincs kiírt út a következő órákra.'}
                </div>
                <p className="text-xs text-[#5C6B62] leading-relaxed">
                  {filterFrom || filterTo || rideKindFilter !== 'all'
                    ? 'Próbálj meg másik megállót választani, vagy töröld a szűrőket.'
                    : 'Indulsz valahová Szentendrén belül vagy a HÉV-hez? Írd ki 10 másodperc alatt!'}
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  {(filterFrom || filterTo || rideKindFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterFrom('');
                        setFilterTo('');
                        setFromCoords(null);
                        setToCoords(null);
                        setRideKindFilter('all');
                      }}
                      className="bg-limestone hover:bg-[#E5DFD3] text-[#18261F] border border-[#DFD9CE] font-bold text-xs px-3.5 py-2 rounded-xl"
                    >
                      Szűrők törlése
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItemId(null);
                      setNewFrom(filterFrom);
                      setNewTo(filterTo);
                      setNewKind('offer');
                      setShowNewModal(true);
                    }}
                    className="bg-pilis text-white font-bold text-xs px-4 py-2 rounded-xl"
                  >
                    + Útvonal kiírása
                  </button>
                </div>
              </div>
            ) : (
              displayedRides.map((ride) => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  hasExistingAgreement={myAgreements.some((a) => a.ride_id === ride.id)}
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
              <div className="bg-white rounded-2xl p-6 text-center border border-[#DFD9CE] space-y-2.5">
                <div className="text-sm font-bold text-[#18261F]">
                  Még nincs aktív Kaláka-kérés.
                </div>
                <p className="text-xs text-[#5C6B62]">
                  Kérj kölcsön egy szerszámot a szomszédtól, vagy ajánlj fel segítséget!
                </p>
                <button
                  type="button"
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
                  hasExistingAgreement={myAgreements.some((a) => a.favor_id === fav.id)}
                  kudosCount={kudosCountByUser[fav.user_id] || 0}
                  onInspectUser={setInspectedUser}
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
              <div className="bg-white rounded-2xl p-6 text-center text-xs text-[#5C6B62] border border-[#DFD9CE] space-y-2">
                <div className="font-bold text-sm text-[#18261F]">
                  Még nincs aktív beszélgetésed.
                </div>
                <p>Csatlakozz egy fuvarhoz vagy Kaláka-kéréshez az egyeztetéshez.</p>
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
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                agr.status === 'cancelled'
                                  ? 'bg-gray-200 text-gray-700'
                                  : 'bg-emerald-100 text-emerald-900'
                              }`}
                            >
                              {agr.status === 'cancelled' ? 'Lemondva' : 'Lezárva'}
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
          <React.Suspense
            fallback={
              <div className="bg-white rounded-2xl p-6 text-center text-xs font-bold text-[#5C6B62] border border-[#DFD9CE]">
                Szakemberek betöltése...
              </div>
            }
          >
            <ProsDirectoryView
              pros={pros}
              session={session}
              profile={profile}
              onOpenAuthModal={() =>
                session?.user
                  ? setInspectedUser({
                      userId: session.user.id,
                      name: profile?.display_name,
                      zone: profile?.zone
                    })
                  : setShowAuthModal(true)
              }
              onRefreshPros={() => fetchAllLiveData(session?.user?.id)}
              onStartProAgreement={handleStartProAgreement}
            />
          </React.Suspense>
        )}

        <div className="pt-4 pb-2 text-center">
          <button
            type="button"
            onClick={() => setShowLegalModal(true)}
            className="text-[11px] font-semibold text-[#7A867E] hover:text-pilis underline decoration-[#DFD9CE] underline-offset-2"
          >
            Házirend, biztonság és adatkezelés (GDPR)
          </button>
        </div>
      </main>

      <nav
        aria-label="Fő navigáció"
        className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-[#DFD9CE] pb-[env(safe-area-inset-bottom)] z-30"
      >
        <div className="max-w-xl mx-auto grid grid-cols-5 items-center">
          <button
            type="button"
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
            type="button"
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
              type="button"
              aria-label="Új kiírás létrehozása"
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
              className="bg-terracotta hover:bg-[#b55538] text-white font-display font-extrabold text-xs px-3.5 py-2 rounded-full shadow-md transition active:scale-95"
            >
              + Új
            </button>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('messages')}
            className={`relative py-3 text-xs font-bold border-t-2 transition px-1 flex items-center justify-center gap-1 ${
              activeTab === 'messages'
                ? 'border-pilis text-pilis'
                : 'border-transparent text-[#5C6B62]'
            }`}
          >
            <span>Üzenet</span>
            {(unreadCount > 0 || actionRequiredCount > 0) && (
              <span className="bg-terracotta text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full leading-tight">
                {unreadCount > 0 ? unreadCount : `${actionRequiredCount}!`}
              </span>
            )}
          </button>

          <button
            type="button"
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
        <div
          role="dialog"
          aria-modal="true"
          aria-label="11-es út és hegyi útinfó"
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="bg-limestone w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-3 border border-[#DFD9CE] shadow-2xl max-h-[90vh] overflow-y-auto box-border">
            <div className="flex justify-between items-center">
              <h3 className="font-display font-extrabold text-lg">
                11-es út és hegyi útinfó ({roadAlerts.length})
              </h3>
              <button
                type="button"
                aria-label="Útinfó ablak bezárása"
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
                    <div className="font-semibold text-[#18261F] mt-0.5 break-words">
                      {al.message}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {al.id !== 'default-ok' && (
                      <button
                        type="button"
                        onClick={() => handleClearRoadAlert(al.id)}
                        className="text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 px-2 py-0.5 rounded-full"
                      >
                        ✓ Már tiszta
                      </button>
                    )}
                    {session?.user && al.reporter_id === session.user.id && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRoadAlert(al.id)}
                        className="text-[11px] font-bold text-red-700 hover:underline"
                      >
                        Törlés
                      </button>
                    )}
                  </div>
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
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingItemId ? 'Kiírás szerkesztése' : 'Új kiírás'}
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
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
                aria-label="Űrlap bezárása"
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
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white border border-[#DFD9CE] rounded-xl px-3 py-2 flex items-center justify-between gap-1">
                    <input
                      type="time"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      className="text-base font-bold bg-transparent focus:outline-none"
                    />
                    {newKind !== 'recurring' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pilis-soft text-pilis">
                        {resolveAutoDayForTime(newTime, false)}
                      </span>
                    )}
                  </div>
                  <select
                    value={newSeats}
                    onChange={(e) => setNewSeats(e.target.value)}
                    aria-label="Szabad helyek száma"
                    className="bg-white border border-[#DFD9CE] rounded-xl px-3 py-2.5 text-xs font-bold box-border"
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {newKind === 'ask' ? `${n} utas` : `${n} szabad hely`}
                      </option>
                    ))}
                  </select>
                </div>

                {newKind !== 'recurring' ? (
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {getUpcomingRoundTimeSlots().map((slotTime) => (
                      <button
                        key={slotTime}
                        type="button"
                        onClick={() => setNewTime(slotTime)}
                        className={`shrink-0 text-[11px] font-bold border px-2.5 py-1 rounded-lg transition ${
                          newTime === slotTime
                            ? 'bg-pilis text-white border-pilis'
                            : 'bg-white hover:bg-pilis-soft text-pilis border-[#DFD9CE]'
                        }`}
                      >
                        🕒 {slotTime}
                      </button>
                    ))}
                  </div>
                ) : (
                  <select
                    value={newScheduleText}
                    onChange={(e) => setNewScheduleText(e.target.value)}
                    aria-label="Rendszeres napok"
                    className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3 py-2.5 text-xs font-bold box-border"
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
              <>
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
              </>
            )}

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

      <LegalModal
        isOpen={showLegalModal}
        onClose={() => setShowLegalModal(false)}
      />

      {inspectedUser && (
        <UserProfileModal
          userId={inspectedUser.userId}
          initialName={inspectedUser.name}
          initialZone={inspectedUser.zone}
          currentUser={session?.user}
          onClose={() => setInspectedUser(null)}
          onProfileUpdated={(updatedProf) => {
            setProfile(updatedProf);
            fetchAllLiveData(session?.user?.id);
          }}
        />
      )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        session={session}
        profile={profile}
        onProfileUpdated={(updated) => setProfile(updated)}
      />

      <AgreementChatModal
        onInspectUser={setInspectedUser}
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
