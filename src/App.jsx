import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase.js';
import { computeStopsAlongRoute } from './lib/routing.js';
import {
  resolveCoordsFromText,
  maskAddressForPublic
} from './constants/szentendreData.js';
import HeaderRoadBar from './components/HeaderRoadBar.jsx';
import { stripAccents } from './components/AddressAutocompleteInput.jsx';
import { parseFavorTag } from './components/FavorCard.jsx';
import AgreementChatModal from './components/AgreementChatModal.jsx';
import UserProfileModal from './components/UserProfileModal.jsx';
import LegalModal from './components/LegalModal.jsx';
import AuthModal from './components/AuthModal.jsx';
import BetaGateModal from './components/BetaGateModal.jsx';
import {
  BETA_INVITE_ONLY,
  captureInviteFromUrl,
  getPendingInviteCode,
  clearPendingInviteCode
} from './constants/betaConfig.js';
import MessagesTabView from './components/MessagesTabView.jsx';
import RoadAlertsModal from './components/RoadAlertsModal.jsx';
import { triggerRadarPushIfNeeded } from './lib/webPush.js';
import NewPostModal from './components/NewPostModal.jsx';
import RidesRoutePanel from './components/RidesRoutePanel.jsx';
import FavorsTabView from './components/FavorsTabView.jsx';
import RidesFeedView from './components/RidesFeedView.jsx';
import BottomNavBar from './components/BottomNavBar.jsx';
import {
  BASE_QUICK_DESTINATIONS,
  formatAgreementRideTitle,
  normalizeRouteToken,
  geocodeAddressFallback,
  getReadTimestamps,
  markAgreementReadStorage,
  getHiddenAgreements,
  getPersonalRoutines,
  recordPersonalRoutine,
  getSavedPlaces,
  playSoftNotificationTone,
  triggerSystemNotification,
  getNextQuarterHourHHMM,
  getUpcomingRoundTimeSlots,
  resolveAutoDayForTime,
  formatDayLabelFromIso
} from './lib/appStorage.js';

const ProsDirectoryView = React.lazy(() => import('./components/ProsDirectoryView.jsx'));

export default function App() {
  const [activeTab, setActiveTab] = useState('rides');
  const [session, setSession] = useState(null);
  const [authInitialMode, setAuthInitialMode] = useState('login');
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
      category: 'traffic',
      zone: 'Szentendre',
      status_level: 'ok',
      message: 'Folyamatos haladás a 11-es úton • Hegyi utak tiszták',
      author_name: 'Közösségi útinfó',
      confirm_count: 0,
      clear_count: 0,
      updates: [],
      created_at: new Date().toISOString()
    }
  ]);
  const [myAlertVotes, setMyAlertVotes] = useState({});

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
  const [showMap, setShowMap] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 768
  );
  const [hasOpenedMap, setHasOpenedMap] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 768
  );
  useEffect(() => {
    if (showMap) setHasOpenedMap(true);
  }, [showMap]);
  const [selectedRideForMap, setSelectedRideForMap] = useState(null);

  const [inlineComposerMode, setInlineComposerMode] = useState(null);
  const [inlineTime, setInlineTime] = useState(() => getNextQuarterHourHHMM());
  const [inlineSchedule, setInlineSchedule] = useState('Munkanapokon (H–P)');
  const [inlineSeats, setInlineSeats] = useState(3);
  const [inlineNote, setInlineNote] = useState('');
  const [inlineCarInfo, setInlineCarInfo] = useState('');
  const [inlineSaving, setInlineSaving] = useState(false);

  const [activeAgreement, setActiveAgreement] = useState(null);
  const notifiedMsgKeysRef = useRef(new Set());
  const fetchDebounceRef = useRef(null);

  const [inspectedUser, setInspectedUser] = useState(null);
  const [kudosCountByUser, setKudosCountByUser] = useState({});
  const [searchStatsMap, setSearchStatsMap] = useState({});
  const [personalRoutines, setPersonalRoutines] = useState(() => getPersonalRoutines(null));
  const [savedPlaces, setSavedPlaces] = useState(() => getSavedPlaces(null));
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
  const [selectedRoadHub, setSelectedRoadHub] = useState('11-es út');
  const roadInputRef = useRef(null);

  const [newKind, setNewKind] = useState('offer');
  const [newFavorMode, setNewFavorMode] = useState('ask');
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
  const [showModalAdvanced, setShowModalAdvanced] = useState(false);

  const showNotice = useCallback((text, tone = 'info') => {
    setAppNotice({ text, tone });
    setTimeout(() => setAppNotice(null), 4000);
  }, []);

  const toggleSavePersonalPlace = useCallback(
    async (rawLabel, explicitCoords = null) => {
      const cleanLabel = (rawLabel || '').trim();
      if (cleanLabel.length < 3) return;
      const uid = session?.user?.id || null;
      const storageKey = `kalaka_places_${uid || 'guest'}`;

      const exists = savedPlaces.some(
        (p) => p.label.toLowerCase() === cleanLabel.toLowerCase()
      );
      if (exists) {
        const next = savedPlaces.filter(
          (p) => p.label.toLowerCase() !== cleanLabel.toLowerCase()
        );
        setSavedPlaces(next);
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {}
        showNotice('Hely eltávolítva a saját helyek közül.');
        return;
      }

      let resolved = explicitCoords || resolveCoordsFromText(cleanLabel);
      if (!resolved) {
        resolved = await geocodeAddressFallback(cleanLabel);
      }

      const next = [
        {
          label: cleanLabel,
          lat: resolved?.lat || null,
          lng: resolved?.lng || null
        },
        ...savedPlaces
      ].slice(0, 6);

      setSavedPlaces(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      showNotice('Elmentve a saját helyeid közé ★');
    },
    [savedPlaces, session?.user?.id, showNotice]
  );

  useEffect(() => {
    captureInviteFromUrl();
  }, []);

  const loadUserProfile = useCallback(async (authUser) => {
    if (!supabase || !authUser) return;
    let { data } = await supabase
      .from('profiles')
      .select('id, display_name, zone, bio, car_info, avatar_url, ride_hearts, favor_hearts, is_gps_local_verified, invite_code, is_admin, beta_approved')
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
        .select('id, display_name, zone, bio, car_info, avatar_url, ride_hearts, favor_hearts, is_gps_local_verified, invite_code, is_admin, beta_approved')
        .single();
      data = inserted;
    } else if (data.display_name === 'Belépés') {
      const fixedName = authUser.email?.split('@')[0] || 'Szomszéd';
      const { data: fixed } = await supabase
        .from('profiles')
        .update({ display_name: fixedName })
        .eq('id', authUser.id)
        .select('id, display_name, zone, bio, car_info, avatar_url, ride_hearts, favor_hearts, is_gps_local_verified, invite_code, is_admin, beta_approved')
        .single();
      if (fixed) data = fixed;
    }

    if (data) {
      if (!data.beta_approved && !data.is_admin) {
        const pendingCode = getPendingInviteCode();
        if (pendingCode) {
          try {
            const { data: redeemRes } = await supabase.rpc('redeem_beta_invite', {
              p_code: pendingCode
            });
            if (redeemRes?.ok) {
              clearPendingInviteCode();
              data = { ...data, beta_approved: true };
            }
          } catch {}
        }
      }
      setProfile(data);
      const dbHidden = Array.isArray(data.hidden_agreement_ids) ? data.hidden_agreement_ids : [];
      const localHidden = getHiddenAgreements(data.id);
      const mergedHidden = Array.from(new Set([...dbHidden, ...localHidden]));
      setHiddenAgreementIds(mergedHidden);
      localStorage.setItem(`kalaka_hidden_${data.id}`, JSON.stringify(mergedHidden));
      if (supabase && mergedHidden.length > dbHidden.length) {
        supabase
          .from('profiles')
          .update({ hidden_agreement_ids: mergedHidden })
          .eq('id', data.id)
          .then(() => {});
      }
      setPersonalRoutines(getPersonalRoutines(data.id));
      setSavedPlaces(getSavedPlaces(data.id));
    }
  }, []);

  const fetchAllLiveData = useCallback(async (currentUserId) => {
    if (!supabase) return;
    const nowIso = new Date().toISOString();

    const [{ data: rideRows }, { data: favorRows }, { data: allProfs }, { data: allKudosRows }, { data: proRows }, { data: alertRows }] =
      await Promise.all([
        supabase
          .from('rides')
          .select('*, author:profiles!rides_user_id_fkey(display_name, ride_hearts, favor_hearts, zone, car_info, avatar_url)')
          .eq('status', 'open')
          .gt('expires_at', nowIso)
          .order('departure_at', { ascending: true }),
        supabase
          .from('favors')
          .select('*, author:profiles!favors_user_id_fkey(display_name, favor_hearts, zone, avatar_url)')
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
          .order('last_confirmed_at', { ascending: false })
          .limit(20)
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

        let fixedOriginLat = r.origin_lat;
        let fixedOriginLng = r.origin_lng;
        if (
          (r.origin_text || '').toLowerCase().includes('fogoly') &&
          (!fixedOriginLng || Number(fixedOriginLng) < 19.059)
        ) {
          fixedOriginLat = 47.69031;
          fixedOriginLng = 19.06172;
        }

        return {
          ...r,
          origin_lat: fixedOriginLat,
          origin_lng: fixedOriginLng,
          departure_at: effectiveDepIso,
          note: cleanNote,
          author_name: r.author?.display_name || 'Szomszéd',
          author_zone: r.author?.zone || '',
          author_avatar: r.author?.avatar_url || null,
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
          author_avatar: f.author?.avatar_url || null,
          author_favor_hearts: f.author?.favor_hearts || 0
        }))
      );
    }

    if (proRows) setPros(proRows);

    if (alertRows && alertRows.length > 0) {
      setRoadAlerts(
        alertRows.map((a) => ({
          ...a,
          author_name: a.reporter?.display_name || 'Helyi lakos'
        }))
      );
      supabase.auth.getUser().then(({ data: uData }) => {
        const activeUid = uData?.user?.id;
        if (!activeUid) {
          setMyAlertVotes({});
          return;
        }
        supabase
          .from('road_alert_votes')
          .select('alert_id, vote')
          .eq('user_id', activeUid)
          .in(
            'alert_id',
            alertRows.map((a) => a.id)
          )
          .then(({ data: voteRows }) => {
            const vMap = {};
            (voteRows || []).forEach((v) => {
              vMap[v.alert_id] = v.vote;
            });
            setMyAlertVotes(vMap);
          });
      });
    } else {
      setRoadAlerts([
        {
          id: 'default-ok',
          category: 'traffic',
          zone: 'Szentendre',
          status_level: 'ok',
          message: 'Folyamatos haladás a 11-es úton • Hegyi utak tiszták',
          author_name: 'Közösségi útinfó',
          confirm_count: 0,
          clear_count: 0,
          updates: [],
          created_at: new Date().toISOString()
        }
      ]);
      setMyAlertVotes({});
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
          requester:profiles!agreements_requester_id_fkey(display_name, avatar_url),
          helper:profiles!agreements_helper_id_fkey(display_name, car_info, avatar_url),
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
            partner_avatar: a.pro
              ? null
              : isReq
              ? a.helper?.avatar_url || null
              : a.requester?.avatar_url || null,
            post_owner_id: a.ride?.user_id || a.helper_id,
            car_info: a.ride?.car_info || a.helper?.car_info || null,
            title: a.ride
              ? formatAgreementRideTitle(a.ride.origin_text, a.ride.dest_text, a.status)
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

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

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
        setPersonalRoutines(getPersonalRoutines(null));
        setSavedPlaces(getSavedPlaces(null));
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
            if (supabase) {
              supabase
                .from('profiles')
                .update({ hidden_agreement_ids: next })
                .eq('id', uid)
                .then(() => {});
            }
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

  const activeTimeRides = useMemo(
    () =>
      rides.filter(
        (r) => r.is_recurring || !r.expires_at || new Date(r.expires_at).getTime() > nowTick
      ),
    [rides, nowTick]
  );

  const exactFilteredRides = useMemo(() => {
    const qFromRaw = stripAccents(filterFrom);
    const qToRaw = stripAccents(filterTo);
    if (!qFromRaw && !qToRaw) return activeTimeRides;

    const qFromToken = normalizeRouteToken(filterFrom);
    const qToToken = normalizeRouteToken(filterTo);

    return activeTimeRides.filter((r) => {
      const originNorm = stripAccents(r.origin_text);
      const destNorm = stripAccents(r.dest_text);
      const originToken = normalizeRouteToken(r.origin_text);
      const destToken = normalizeRouteToken(r.dest_text);
      const stopsText = stripAccents((r.stops || []).map((s) => s.name).join(' '));
      const stopsToken = normalizeRouteToken(stopsText);
      const fullRouteText = `${originNorm} ${stopsText} ${destNorm}`;
      const fullRouteToken = `${originToken} ${stopsToken} ${destToken}`;

      const matchFrom =
        !qFromRaw ||
        originNorm.includes(qFromRaw) ||
        stopsText.includes(qFromRaw) ||
        (qFromToken.length >= 3 &&
          (originToken.includes(qFromToken) ||
            qFromToken.includes(originToken) ||
            stopsToken.includes(qFromToken)));

      const matchTo =
        !qToRaw ||
        destNorm.includes(qToRaw) ||
        stopsText.includes(qToRaw) ||
        fullRouteText.includes(qToRaw) ||
        (qToToken.length >= 3 &&
          (destToken.includes(qToToken) ||
            qToToken.includes(destToken) ||
            fullRouteToken.includes(qToToken)));

      return matchFrom && matchTo;
    });
  }, [activeTimeRides, filterFrom, filterTo]);

  const hasRouteFilter = Boolean(filterFrom.trim() || filterTo.trim());
  const showingCityFallbackRides =
    hasRouteFilter && exactFilteredRides.length === 0 && activeTimeRides.length > 0;
  const filteredRides = showingCityFallbackRides ? activeTimeRides : exactFilteredRides;

  const smartQuickChips = useMemo(() => {
    const hour = new Date().getHours();
    const isMorning = hour >= 5 && hour < 12;
    const morningHubs = new Set(['Szentendre HÉV-végállomás', 'Újpest-Városkapu', 'Papírgyár', 'Bükkös-part']);
    const afternoonHubs = new Set(['Szentendre HÉV-végállomás', 'Pismány', 'Szarvashegy', 'Izbég', 'Pannóniatelep']);

    const savedLabelsSet = new Set(savedPlaces.map((p) => p.label.toLowerCase()));

    return BASE_QUICK_DESTINATIONS.filter((lbl) => !savedLabelsSet.has(lbl.toLowerCase()))
      .map((label) => {
        const needle = label.replace('Szentendre ', '').toLowerCase();
        const liveCount = activeTimeRides.filter((r) => {
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
  }, [activeTimeRides, searchStatsMap, savedPlaces]);

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

  const handleClearRouteInputs = () => {
    setSelectedRideForMap(null);
    setFilterFrom('');
    setFilterTo('');
    setFromCoords(null);
    setToCoords(null);
    setInlineComposerMode(null);
    setActiveSearchField('from');
    setShowMap(typeof window !== 'undefined' && window.innerWidth >= 768);
  };

  const handleSelectQuickLocation = (locName, coordsObj = null, forcedField = null) => {
    setSelectedRideForMap(null);
    if (locName === 'Mind') {
      handleClearRouteInputs();
      return;
    }
    setShowMap(true);

    const savedHit = savedPlaces.find(
      (p) => p.label.toLowerCase() === locName.toLowerCase()
    );
    const resolvedPoint =
      coordsObj ||
      (savedHit?.lat && savedHit?.lng ? { lat: savedHit.lat, lng: savedHit.lng } : null) ||
      resolveCoordsFromText(locName);

    const targetField =
      forcedField || (activeSearchField === 'to' || (filterFrom && !filterTo) ? 'to' : 'from');
    if (targetField === 'to') {
      setFilterTo(locName);
      setToCoords(resolvedPoint);
      setActiveSearchField('from');
    } else {
      setFilterFrom(locName);
      setFromCoords(resolvedPoint);
      setActiveSearchField('to');
    }
  };

  const handleLoadPersonalRoutine = async (routine) => {
    if (!routine) return;
    setSelectedRideForMap(null);
    setFilterFrom(routine.origin);
    setFilterTo(routine.dest);
    setShowMap(true);

    const initialO =
      routine.originCoords?.lat &&
      routine.originCoords?.lng &&
      !(routine.origin.toLowerCase().includes('fogoly') && routine.originCoords.lng < 19.059)
        ? routine.originCoords
        : resolveCoordsFromText(routine.origin);

    const initialD =
      routine.destCoords?.lat && routine.destCoords?.lng
        ? routine.destCoords
        : resolveCoordsFromText(routine.dest);

    setFromCoords(initialO);
    setToCoords(initialD);

    const [exactO, exactD] = await Promise.all([
      initialO ? Promise.resolve(initialO) : geocodeAddressFallback(routine.origin),
      initialD ? Promise.resolve(initialD) : geocodeAddressFallback(routine.dest)
    ]);

    if (exactO) setFromCoords(exactO);
    if (exactD) setToCoords(exactD);
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

      const startPt = fromCoords || resolveCoordsFromText(filterFrom) || (await geocodeAddressFallback(filterFrom));
      const endPt = toCoords || resolveCoordsFromText(filterTo) || (await geocodeAddressFallback(filterTo));
      const chosenCar =
        dbKind === 'offer' ? inlineCarInfo.trim() || profile?.car_info || null : null;

      const payload = {
        user_id: session.user.id,
        kind: dbKind,
        origin_text: filterFrom.trim(),
        dest_text: filterTo.trim(),
        departure_at: dep.toISOString(),
        expires_at: exp.toISOString(),
        seats: dbKind === 'ask' ? Number(inlineSeats) || 1 : Number(inlineSeats) || 3,
        car_info: chosenCar,
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

      if (chosenCar && !profile?.car_info) {
        await supabase
          .from('profiles')
          .update({ car_info: chosenCar })
          .eq('id', session.user.id);
      }

      recordPersonalRoutine(session.user.id, filterFrom.trim(), filterTo.trim(), startPt, endPt);
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
    setNewFrom(ride.origin_text || '');
    setNewTo(ride.dest_text || '');
    setNewFromCoords(
      ride.origin_lat && ride.origin_lng
        ? { lat: Number(ride.origin_lat), lng: Number(ride.origin_lng) }
        : null
    );
    setNewToCoords(
      ride.dest_lat && ride.dest_lng
        ? { lat: Number(ride.dest_lat), lng: Number(ride.dest_lng) }
        : null
    );
    setNewTime(ride.time_label || '05:50');
    setNewScheduleText(ride.schedule_text || 'Munkanapokon (H–P)');
    setNewSeats(ride.seats || 3);
    setNewNote(ride.note || '');
    setNewValidMins(720);
    setShowNewModal(true);
  };

  const handleOpenEditFavor = (favor) => {
    const { isOffer, cleanTitle } = parseFavorTag(favor.title);
    setEditingItemId(favor.id);
    setNewKind('favor');
    setNewFavorMode(isOffer ? 'offer' : 'ask');
    setNewFrom(cleanTitle);
    setNewNote(favor.description || '');
    setNewMinHearts(favor.min_favor_hearts || 0);
    setNewValidMins(1440);
    setShowModalAdvanced(Boolean(favor.min_favor_hearts > 0));
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
      const rawClean = newFrom.replace(/^\[(Felajánlás|Kérés)\]\s*/i, '').trim();
      if (!rawClean) return;

      const prefix = newFavorMode === 'offer' ? '[Felajánlás] ' : '[Kérés] ';
      const favPayload = {
        title: `${prefix}${rawClean}`,
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
      recordPersonalRoutine(session.user.id, newFrom.trim(), newTo.trim(), startPt, endPt);
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
      const resolvedCar = ride.car_info || (ride.kind === 'ask' ? profile?.car_info || null : null);
      handleOpenAgreement({
        ...existingAgr,
        post_owner_id: ride.user_id,
        car_info: resolvedCar,
        partner_name: ride.author_name,
        partner_avatar: ride.author_avatar || null,
        title: formatAgreementRideTitle(ride.origin_text, ride.dest_text, existingAgr.status)
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
      body:
        ride.kind === 'ask'
          ? 'Szia! Szívesen elviszlek erre az útra.'
          : stopLabel
          ? `Szia! Felszállnék itt: ${stopLabel}.`
          : 'Szia! Csatlakoznék az úthoz.'
    });

    const resolvedCar = ride.car_info || (ride.kind === 'ask' ? profile?.car_info || null : null);
    handleOpenAgreement({
      ...createdAgr,
      post_owner_id: ride.user_id,
      car_info: resolvedCar,
      partner_name: ride.author_name,
      partner_avatar: ride.author_avatar || null,
      title: formatAgreementRideTitle(ride.origin_text, ride.dest_text, 'chatting')
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
        partner_avatar: favor.author_avatar || null,
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
      partner_avatar: favor.author_avatar || null,
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
      body: 'Szia! Szeretnék érdeklődni, mikor lenne szabad időpontod.'
    });

    handleOpenAgreement({
      ...createdAgr,
      partner_name: pro.business_name,
      title: pro.profession_name || 'Szakmai egyeztetés'
    });
    fetchAllLiveData(session.user.id);
  };

  const handleSelectRoadPrefix = (prefix) => {
    setSelectedRoadHub(prefix);
    setCustomRoadText((prev) => {
      const stripped = (prev || '')
        .replace(/^(11-es út|HÉV \/ P\+R|Pismány \/ Sztaravoda|Izbég \/ Szarvashegy):\s*/i, '')
        .trim();
      return stripped ? `${prefix}: ${stripped}` : `${prefix}: `;
    });
    setTimeout(() => roadInputRef.current?.focus(), 20);
  };

  const handleSubmitCityAlert = async ({ category, zone, level, message }) => {
    const cleanMsg = (message || '').trim();
    if (cleanMsg.length < 4) return false;

    if (!session?.user) {
      setShowRoadModal(false);
      setShowAuthModal(true);
      return false;
    }

    if (supabase) {
      const { data, error } = await supabase.rpc('submit_city_alert', {
        p_category: category || 'traffic',
        p_zone: zone || '11-es út',
        p_status_level: level || 'warn',
        p_message: cleanMsg
      });
      if (error) {
        showNotice(`Hiba: ${error.message}`, 'err');
        return false;
      }
      if (data?.should_push && data?.alert_id) {
        triggerRadarPushIfNeeded(supabase, data.alert_id);
      }
      await fetchAllLiveData(session.user.id);
      showNotice(
        data?.action === 'merged'
          ? 'Csatolva a meglévő jelzéshez (+1) ✓'
          : 'Jelzés közzétéve ✓'
      );
      return true;
    }
    return false;
  };

  const handleVoteCityAlert = async (alertId, vote, note = '') => {
    if (!session?.user) {
      setShowRoadModal(false);
      setShowAuthModal(true);
      return false;
    }
    if (!supabase || !alertId || alertId === 'default-ok') return false;

    const { data, error } = await supabase.rpc('vote_city_alert', {
      p_alert_id: alertId,
      p_vote: vote,
      p_note: note ? note.trim() : null
    });
    if (error) {
      showNotice(`Hiba: ${error.message}`, 'err');
      return false;
    }
    if (data?.should_push && data?.alert_id) {
      triggerRadarPushIfNeeded(supabase, data.alert_id);
    }
    await fetchAllLiveData(session.user.id);
    if (vote === 'clear') {
      showNotice(
        data?.resolved
          ? 'Jelzés lezárva ✓'
          : 'Rögzítve — még 1 megerősítés és lezárul ✓'
      );
    } else {
      showNotice('Megerősítés rögzítve (+1) ✓');
    }
    return true;
  };

  const handleDeleteRoadAlert = async (alertId) => {
    if (!supabase || alertId === 'default-ok') return;
    await supabase.from('road_alerts').delete().eq('id', alertId);
    fetchAllLiveData(session?.user?.id);
  };

  const handleHideCompletedAgreement = async (e, agrId) => {
    e.preventDefault();
    e.stopPropagation();
    const uid = session?.user?.id;
    if (!uid) return;
    markAgreementReadStorage(uid, agrId);
    setMyAgreements((prev) =>
      prev.map((item) => (item.id === agrId ? { ...item, has_unread: false } : item))
    );
    setIncomingToast((prev) => (prev?.agreement_id === agrId ? null : prev));
    const next = Array.from(new Set([...hiddenAgreementIds, agrId]));
    setHiddenAgreementIds(next);
    localStorage.setItem(`kalaka_hidden_${uid}`, JSON.stringify(next));
    if (supabase) {
      await supabase
        .from('profiles')
        .update({ hidden_agreement_ids: next })
        .eq('id', uid);
    }
  };

  const hasBothRouteEnds = Boolean(filterFrom.trim() && filterTo.trim());
  const isFromSaved = savedPlaces.some(
    (p) => p.label.toLowerCase() === filterFrom.trim().toLowerCase()
  );
  const isToSaved = savedPlaces.some(
    (p) => p.label.toLowerCase() === filterTo.trim().toLowerCase()
  );
  const isCurrentRouteSaved =
    hasBothRouteEnds &&
    personalRoutines.some(
      (r) =>
        r.origin.toLowerCase() === filterFrom.trim().toLowerCase() &&
        r.dest.toLowerCase() === filterTo.trim().toLowerCase()
    );
  const displayedRides = useMemo(
    () => filteredRides.filter((r) => rideKindFilter === 'all' || r.kind === rideKindFilter),
    [filteredRides, rideKindFilter]
  );

  return (
    <div className="w-full max-w-xl mx-auto min-h-screen pb-28 overflow-x-hidden">
      {appNotice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-[calc(env(safe-area-inset-top)+0.75rem)] left-1/2 -translate-x-1/2 z-[70] w-[92%] max-w-md"
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
          className="fixed top-[calc(env(safe-area-inset-top)+0.75rem)] left-3 right-3 max-w-md mx-auto z-50 bg-[#18261F] text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-400/40 flex items-center justify-between gap-3 cursor-pointer"
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
        <RidesRoutePanel
          session={session}
          profile={profile}
          filterFrom={filterFrom}
          setFilterFrom={setFilterFrom}
          filterTo={filterTo}
          setFilterTo={setFilterTo}
          fromCoords={fromCoords}
          setFromCoords={setFromCoords}
          toCoords={toCoords}
          setToCoords={setToCoords}
          setActiveSearchField={setActiveSearchField}
          isFromSaved={isFromSaved}
          isToSaved={isToSaved}
          toggleSavePersonalPlace={toggleSavePersonalPlace}
          locatingOriginGps={locatingOriginGps}
          onFillOriginFromCurrentGps={handleFillOriginFromCurrentGps}
          onSwapOriginDest={handleSwapOriginDest}
          onClearRouteInputs={handleClearRouteInputs}
          hasRouteFilter={hasRouteFilter}
          hasBothRouteEnds={hasBothRouteEnds}
          personalRoutines={personalRoutines}
          setPersonalRoutines={setPersonalRoutines}
          onLoadPersonalRoutine={handleLoadPersonalRoutine}
          savedPlaces={savedPlaces}
          smartQuickChips={smartQuickChips}
          onSelectQuickLocation={handleSelectQuickLocation}
          showMap={showMap}
          setShowMap={setShowMap}
          hasOpenedMap={hasOpenedMap}
          filteredRides={filteredRides}
          roadAlerts={roadAlerts}
          selectedRideForMap={selectedRideForMap}
          setSelectedRideForMap={setSelectedRideForMap}
          isCurrentRouteSaved={isCurrentRouteSaved}
          inlineComposerMode={inlineComposerMode}
          setInlineComposerMode={setInlineComposerMode}
          inlineTime={inlineTime}
          setInlineTime={setInlineTime}
          inlineSeats={inlineSeats}
          setInlineSeats={setInlineSeats}
          inlineSchedule={inlineSchedule}
          setInlineSchedule={setInlineSchedule}
          inlineCarInfo={inlineCarInfo}
          setInlineCarInfo={setInlineCarInfo}
          inlineNote={inlineNote}
          setInlineNote={setInlineNote}
          inlineSaving={inlineSaving}
          onPublishInlineRide={handlePublishInlineRide}
          onOpenLegalModal={() => setShowLegalModal(true)}
          showNotice={showNotice}
        />
      )}

      <main className="px-3 sm:px-4 mt-4 space-y-3">
        {activeTab === 'rides' && (
          <RidesFeedView
            nowTick={nowTick}
            profile={profile}
            session={session}
            rides={rides}
            filteredRides={filteredRides}
            activeTimeRides={activeTimeRides}
            displayedRides={displayedRides}
            showingCityFallbackRides={showingCityFallbackRides}
            initialLoading={initialLoading}
            rideKindFilter={rideKindFilter}
            setRideKindFilter={setRideKindFilter}
            filterFrom={filterFrom}
            setFilterFrom={setFilterFrom}
            filterTo={filterTo}
            setFilterTo={setFilterTo}
            fromCoords={fromCoords}
            setFromCoords={setFromCoords}
            toCoords={toCoords}
            setToCoords={setToCoords}
            savedPlaces={savedPlaces}
            personalRoutines={personalRoutines}
            hasRouteFilter={hasRouteFilter}
            hasBothRouteEnds={hasBothRouteEnds}
            onClearRouteInputs={handleClearRouteInputs}
            setInlineSeats={setInlineSeats}
            setInlineComposerMode={setInlineComposerMode}
            showMap={showMap}
            setShowMap={setShowMap}
            selectedRideForMap={selectedRideForMap}
            setSelectedRideForMap={setSelectedRideForMap}
            myAgreements={myAgreements}
            kudosCountByUser={kudosCountByUser}
            onInspectUser={setInspectedUser}
            onStartRideAgreement={handleStartRideAgreement}
            onEditRide={handleOpenEditRide}
            onDeleteRide={handleDeleteRide}
            onOpenNewRideModal={() => {
              setEditingItemId(null);
              setNewFrom(filterFrom);
              setNewTo(filterTo);
              setNewFromCoords(fromCoords);
              setNewToCoords(toCoords);
              setNewKind('offer');
              setShowNewModal(true);
            }}
          />
        )}

        {activeTab === 'favors' && (
          <FavorsTabView
            favors={favors}
            myAgreements={myAgreements}
            kudosCountByUser={kudosCountByUser}
            session={session}
            profile={profile}
            onOpenAuthModal={() => setShowAuthModal(true)}
            onInspectUser={setInspectedUser}
            onStartFavorAgreement={handleStartFavorAgreement}
            onEditFavor={handleOpenEditFavor}
            onDeleteFavor={handleDeleteFavor}
            onRefreshData={fetchAllLiveData}
            showNotice={showNotice}
          />
        )}

        {activeTab === 'messages' && (
          <MessagesTabView
            visibleAgreements={visibleAgreements}
            onOpenAgreement={handleOpenAgreement}
            onHideCompletedAgreement={handleHideCompletedAgreement}
          />
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
            ÁSZF, felelősségkizárás, sütik és adatkezelés (GDPR)
          </button>
        </div>
      </main>

      <BottomNavBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unreadCount={unreadCount}
        actionRequiredCount={actionRequiredCount}
        onOpenNewModal={() => {
          setEditingItemId(null);
          if (activeTab === 'favors') {
            setNewKind('favor');
            setNewFavorMode('ask');
            setNewFrom('');
            setNewTo('');
            setShowModalAdvanced(false);
          } else {
            if (newKind === 'favor') setNewKind('offer');
            setNewFrom(filterFrom);
            setNewTo(filterTo);
            setNewFromCoords(fromCoords);
            setNewToCoords(toCoords);
          }
          setShowNewModal(true);
        }}
      />

      <RoadAlertsModal
        isOpen={showRoadModal}
        onClose={() => setShowRoadModal(false)}
        roadAlerts={roadAlerts}
        myAlertVotes={myAlertVotes}
        currentUserId={session?.user?.id}
        supabase={supabase}
        showNotice={showNotice}
        onNeedAuth={() => {
          setShowRoadModal(false);
          setShowAuthModal(true);
        }}
        onSubmitCityAlert={handleSubmitCityAlert}
        onVoteCityAlert={handleVoteCityAlert}
        onDeleteRoadAlert={handleDeleteRoadAlert}
      />

      <NewPostModal
        isOpen={showNewModal}
        editingItemId={editingItemId}
        newKind={newKind}
        setNewKind={setNewKind}
        newFavorMode={newFavorMode}
        setNewFavorMode={setNewFavorMode}
        newFrom={newFrom}
        setNewFrom={setNewFrom}
        setNewFromCoords={setNewFromCoords}
        newTo={newTo}
        setNewTo={setNewTo}
        setNewToCoords={setNewToCoords}
        newTime={newTime}
        setNewTime={setNewTime}
        newSeats={newSeats}
        setNewSeats={setNewSeats}
        newScheduleText={newScheduleText}
        setNewScheduleText={setNewScheduleText}
        newNote={newNote}
        setNewNote={setNewNote}
        newValidMins={newValidMins}
        setNewValidMins={setNewValidMins}
        newMinHearts={newMinHearts}
        setNewMinHearts={setNewMinHearts}
        showModalAdvanced={showModalAdvanced}
        setShowModalAdvanced={setShowModalAdvanced}
        onClose={() => {
          setShowNewModal(false);
          setEditingItemId(null);
        }}
        onSubmit={handleSaveModalPost}
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

      {BETA_INVITE_ONLY &&
        isSupabaseConfigured &&
        (!session?.user ||
          profile.id !== session.user.id ||
          (!profile.beta_approved && !profile.is_admin)) && (
          <BetaGateModal
            session={session}
            profileLoading={Boolean(session?.user && profile.id !== session.user.id)}
            onOpenAuth={(nextMode) => {
              setAuthInitialMode(nextMode || 'login');
              setShowAuthModal(true);
            }}
            onOpenLegalModal={() => setShowLegalModal(true)}
            onApproved={() => {
              if (session?.user) loadUserProfile(session.user);
            }}
          />
        )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        session={session}
        profile={profile}
        initialMode={authInitialMode}
        onProfileUpdated={(updated) => setProfile(updated)}
        onOpenLegalModal={() => setShowLegalModal(true)}
      />

      <LegalModal
        isOpen={showLegalModal}
        onClose={() => setShowLegalModal(false)}
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
