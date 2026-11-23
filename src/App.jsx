import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase.js';
import {
  resolveCoordsFromText,
  maskAddressForPublic
} from './constants/szentendreData.js';
import HeaderRoadBar from './components/HeaderRoadBar.jsx';
import { stripAccents } from './components/AddressAutocompleteInput.jsx';
import AgreementChatModal from './components/AgreementChatModal.jsx';
import UserProfileModal from './components/UserProfileModal.jsx';
import LegalModal from './components/LegalModal.jsx';
import AuthModal from './components/AuthModal.jsx';
import BetaGateModal from './components/BetaGateModal.jsx';
import {
  BETA_INVITE_ONLY,
  captureInviteFromUrl
} from './constants/betaConfig.js';
import MessagesTabView from './components/MessagesTabView.jsx';
import RoadAlertsModal from './components/RoadAlertsModal.jsx';
import InstallPushGuideModal from './components/InstallPushGuideModal.jsx';
import MessagePushPromptModal from './components/MessagePushPromptModal.jsx';
import {
  triggerRadarPushIfNeeded,
  syncAppBadge,
  getCurrentPushSubscription,
  getDeviceInstallInfo,
  shouldPromptForMessagePush,
  snoozeMessagePushPrompt
} from './lib/webPush.js';
import NewPostModal from './components/NewPostModal.jsx';
import RidesRoutePanel from './components/RidesRoutePanel.jsx';
import FavorsTabView from './components/FavorsTabView.jsx';
import RidesFeedView from './components/RidesFeedView.jsx';
import BottomNavBar from './components/BottomNavBar.jsx';
import {
  BASE_QUICK_DESTINATIONS,
  normalizeRouteToken,
  geocodeAddressFallback,
  markAgreementReadStorage
} from './lib/appStorage.js';
import { useAgreementActions } from './hooks/useAgreementActions.js';
import { usePostCrud } from './hooks/usePostCrud.js';
import { useLiveData } from './hooks/useLiveData.js';

const ProsDirectoryView = React.lazy(() => import('./components/ProsDirectoryView.jsx'));

export default function App() {
  const [activeTab, setActiveTab] = useState('rides');
  const [authInitialMode, setAuthInitialMode] = useState('login');
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [rideKindFilter, setRideKindFilter] = useState('all');

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

  const [activeAgreement, setActiveAgreement] = useState(null);
  const [inspectedUser, setInspectedUser] = useState(null);
  const [locatingOriginGps, setLocatingOriginGps] = useState(false);
  const [appNotice, setAppNotice] = useState(null);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showRoadModal, setShowRoadModal] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);

  const [customRoadText, setCustomRoadText] = useState('');
  const [customRoadLevel, setCustomRoadLevel] = useState('warn');
  const [selectedRoadHub, setSelectedRoadHub] = useState('11-es út');
  const roadInputRef = useRef(null);

  const {
    session,
    authReady,
    profile,
    setProfile,
    roadAlerts,
    myAlertVotes,
    rides,
    setRides,
    initialLoading,
    favors,
    setFavors,
    pros,
    myAgreements,
    setMyAgreements,
    kudosCountByUser,
    searchStatsMap,
    personalRoutines,
    setPersonalRoutines,
    savedPlaces,
    setSavedPlaces,
    incomingToast,
    setIncomingToast,
    hiddenAgreementIds,
    setHiddenAgreementIds,
    loadUserProfile,
    fetchAllLiveData
  } = useLiveData({
    setAuthInitialMode,
    setShowAuthModal,
    setSelectedRideForMap
  });

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

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

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

  const [pendingNotifAgrId, setPendingNotifAgrId] = useState(null);
  const [showPushModal, setShowPushModal] = useState(false);
  const [jitPushPrompt, setJitPushPrompt] = useState(null);
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const info = getDeviceInstallInfo();
      const sub = await getCurrentPushSubscription();
      if (active) setPushEnabled(Boolean(sub?.endpoint) && info.permission === 'granted');
    })();
    return () => {
      active = false;
    };
  }, [session?.user?.id, showPushModal, showRoadModal]);

  const maybeOpenJitPushPrompt = (title, subtitle) => {
    const uid = session?.user?.id;
    if (!uid || pushEnabled) return;
    const info = getDeviceInstallInfo();
    if (info.permission === 'denied') return;
    if (!shouldPromptForMessagePush(uid)) return;
    setJitPushPrompt({ title, subtitle });
  };

  const {
    inlineComposerMode,
    setInlineComposerMode,
    inlineTime,
    setInlineTime,
    inlineSchedule,
    setInlineSchedule,
    inlineSeats,
    setInlineSeats,
    inlineNote,
    setInlineNote,
    inlineCarInfo,
    setInlineCarInfo,
    inlineSaving,
    showNewModal,
    setShowNewModal,
    editingItemId,
    setEditingItemId,
    newKind,
    setNewKind,
    newFavorMode,
    setNewFavorMode,
    newFrom,
    setNewFrom,
    setNewFromCoords,
    newTo,
    setNewTo,
    setNewToCoords,
    newTime,
    setNewTime,
    newScheduleText,
    setNewScheduleText,
    newSeats,
    setNewSeats,
    newValidMins,
    setNewValidMins,
    newNote,
    setNewNote,
    newMinHearts,
    setNewMinHearts,
    showModalAdvanced,
    setShowModalAdvanced,
    handlePublishInlineRide,
    handleDeleteRide,
    handleDeleteFavor,
    handleOpenEditRide,
    handleOpenEditFavor,
    handleSaveModalPost
  } = usePostCrud({
    session,
    profile,
    filterFrom,
    filterTo,
    fromCoords,
    toCoords,
    setRides,
    setFavors,
    setPersonalRoutines,
    setActiveTab,
    setShowAuthModal,
    showNotice,
    fetchAllLiveData,
    maybeOpenJitPushPrompt
  });

  const {
    handleOpenAgreement,
    handleStartRideAgreement,
    handleStartFavorAgreement,
    handleStartProAgreement,
    handleHideCompletedAgreement
  } = useAgreementActions({
    session,
    profile,
    myAgreements,
    setMyAgreements,
    hiddenAgreementIds,
    setHiddenAgreementIds,
    setIncomingToast,
    setActiveAgreement,
    setShowAuthModal,
    showNotice,
    fetchAllLiveData
  });

  useEffect(() => {
    syncAppBadge(unreadCount);
    const handleForeground = () => {
      if (document.visibilityState === 'visible') {
        syncAppBadge(unreadCount);
      }
    };
    document.addEventListener('visibilitychange', handleForeground);
    window.addEventListener('focus', handleForeground);
    return () => {
      document.removeEventListener('visibilitychange', handleForeground);
      window.removeEventListener('focus', handleForeground);
    };
  }, [unreadCount]);

  useEffect(() => {
    const routeFromUrl = (rawUrl) => {
      try {
        const parsed = new URL(rawUrl, window.location.origin);
        const open = parsed.searchParams.get('open');
        const agrId = parsed.searchParams.get('agr');
        if (open === 'radar') {
          setShowRoadModal(true);
        } else if (open === 'messages') {
          setActiveTab('messages');
          if (agrId) setPendingNotifAgrId(agrId);
        }
        if (open || agrId) {
          window.history.replaceState({}, '', '/');
        }
      } catch {}
    };
    routeFromUrl(window.location.href);
    const onSwMessage = (event) => {
      if (event?.data?.type === 'KALAKA_NOTIF_CLICK' && event.data.url) {
        routeFromUrl(event.data.url);
      }
    };
    navigator.serviceWorker?.addEventListener?.('message', onSwMessage);
    return () => navigator.serviceWorker?.removeEventListener?.('message', onSwMessage);
  }, []);

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

  useEffect(() => {
    if (!pendingNotifAgrId) return;
    const target = myAgreements.find((a) => a.id === pendingNotifAgrId);
    if (target) {
      setPendingNotifAgrId(null);
      handleOpenAgreement(target);
    }
  }, [pendingNotifAgrId, myAgreements]);

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
            showPushBanner={Boolean(session?.user) && !pushEnabled}
            onOpenPushSettings={() => setShowPushModal(true)}
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
          pushEnabled={pushEnabled}
          onOpenPushSettings={() => setShowPushModal(true)}
        />
      )}

      <MessagePushPromptModal
        isOpen={Boolean(jitPushPrompt)}
        title={jitPushPrompt?.title}
        subtitle={jitPushPrompt?.subtitle}
        supabase={supabase}
        currentUserId={session?.user?.id}
        onClose={() => setJitPushPrompt(null)}
        onSnooze={() => {
          snoozeMessagePushPrompt(session?.user?.id);
          setJitPushPrompt(null);
        }}
        onEnabled={() => {
          setPushEnabled(true);
          showNotice('Üzenet-értesítések bekapcsolva ✓');
          setJitPushPrompt(null);
        }}
      />

      <InstallPushGuideModal
        isOpen={showPushModal}
        onClose={() => setShowPushModal(false)}
        supabase={supabase}
        currentUserId={session?.user?.id}
        showNotice={showNotice}
        onStatusChange={(active) => setPushEnabled(active)}
        onNeedAuth={() => {
          setShowPushModal(false);
          setShowAuthModal(true);
        }}
      />

      {BETA_INVITE_ONLY &&
        isSupabaseConfigured &&
        (!session?.user ||
          profile.id !== session.user.id ||
          (!profile.beta_approved && !profile.is_admin)) && (
          <BetaGateModal
            session={session}
            profileLoading={!authReady || Boolean(session?.user && profile.id !== session.user.id)}
            onOpenAuth={(nextMode) => {
              setAuthInitialMode(nextMode || 'login');
              setShowAuthModal(true);
            }}
            onOpenLegalModal={() => setShowLegalModal(true)}
            onApproved={() => {
              if (session?.user) {
                loadUserProfile(session.user);
                fetchAllLiveData(session.user.id);
              }
            }}
          />
        )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          setAuthInitialMode('login');
        }}
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
        showPushBanner={Boolean(session?.user) && !pushEnabled}
        onOpenPushSettings={() => setShowPushModal(true)}
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
