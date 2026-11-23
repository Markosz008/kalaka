import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';
import {
  getPendingInviteCode,
  clearPendingInviteCode
} from '../constants/betaConfig.js';
import {
  getHiddenAgreements,
  getPersonalRoutines,
  getSavedPlaces,
  playSoftNotificationTone,
  triggerSystemNotification
} from '../lib/appStorage.js';
import {
  DEFAULT_PROFILE,
  createDefaultRoadAlert,
  fetchLiveSnapshot,
  enrichOfferRidesWithStops
} from '../lib/liveDataFetcher.js';

export function useLiveData({
  setAuthInitialMode,
  setShowAuthModal,
  setSelectedRideForMap
}) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [roadAlerts, setRoadAlerts] = useState(() => [createDefaultRoadAlert()]);
  const [myAlertVotes, setMyAlertVotes] = useState({});
  const [rides, setRides] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [favors, setFavors] = useState([]);
  const [pros, setPros] = useState([]);
  const [myAgreements, setMyAgreements] = useState([]);
  const [kudosCountByUser, setKudosCountByUser] = useState({});
  const [searchStatsMap, setSearchStatsMap] = useState({});
  const [personalRoutines, setPersonalRoutines] = useState(() => getPersonalRoutines(null));
  const [savedPlaces, setSavedPlaces] = useState(() => getSavedPlaces(null));
  const [incomingToast, setIncomingToast] = useState(null);
  const [hiddenAgreementIds, setHiddenAgreementIds] = useState([]);

  const notifiedMsgKeysRef = useRef(new Set());
  const fetchDebounceRef = useRef(null);

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
    const snap = await fetchLiveSnapshot(currentUserId);
    if (!snap) return;

    setKudosCountByUser(snap.kudosMap);

    if (snap.mappedRides) {
      setRides(snap.mappedRides);
      enrichOfferRidesWithStops(snap.mappedRides).then((enrichedRides) => {
        setRides(enrichedRides);
        setSelectedRideForMap((prev) =>
          prev ? enrichedRides.find((x) => x.id === prev.id) || prev : null
        );
      });
    }

    if (snap.mappedFavors) setFavors(snap.mappedFavors);
    if (snap.proRows) setPros(snap.proRows);

    if (snap.mappedAlerts) {
      setRoadAlerts(snap.mappedAlerts);
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
          .in('alert_id', snap.alertRows.map((a) => a.id))
          .then(({ data: voteRows }) => {
            const vMap = {};
            (voteRows || []).forEach((v) => {
              vMap[v.alert_id] = v.vote;
            });
            setMyAlertVotes(vMap);
          });
      });
    } else {
      setRoadAlerts([createDefaultRoadAlert()]);
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

    if (snap.mappedAgreements) {
      setMyAgreements(snap.mappedAgreements);
      snap.mappedAgreements.forEach((item) => {
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

    setInitialLoading(false);
  }, [setSelectedRideForMap]);

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
    } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') {
        setAuthInitialMode('recovery');
        setShowAuthModal(true);
      }
      if (s?.user) {
        loadUserProfile(s.user);
        fetchAllLiveData(s.user.id);
      } else {
        setProfile(DEFAULT_PROFILE);
        setMyAgreements([]);
        setPersonalRoutines(getPersonalRoutines(null));
        setSavedPlaces(getSavedPlaces(null));
      }
    });

    let wakeRetryTimer = null;
    const handleWakeOrFocus = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        scheduleDebouncedRefresh(uid);
        if (wakeRetryTimer) clearTimeout(wakeRetryTimer);
        wakeRetryTimer = setTimeout(() => {
          fetchAllLiveData(uid);
        }, 1500);
      }
    };
    document.addEventListener('visibilitychange', handleWakeOrFocus);
    window.addEventListener('focus', handleWakeOrFocus);
    window.addEventListener('pageshow', handleWakeOrFocus);
    window.addEventListener('online', handleWakeOrFocus);

    const feedPollTimer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        fetchAllLiveData(uid);
      }
    }, 15000);

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
      .subscribe((subStatus) => {
        if (subStatus === 'SUBSCRIBED') {
          scheduleDebouncedRefresh(uid);
        }
      });

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleWakeOrFocus);
      window.removeEventListener('focus', handleWakeOrFocus);
      window.removeEventListener('pageshow', handleWakeOrFocus);
      window.removeEventListener('online', handleWakeOrFocus);
      clearInterval(feedPollTimer);
      if (wakeRetryTimer) clearTimeout(wakeRetryTimer);
      supabase.removeChannel(globalChannel);
      if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    };
  }, [loadUserProfile, fetchAllLiveData, scheduleDebouncedRefresh, session?.user?.id, setAuthInitialMode, setShowAuthModal]);

  return {
    session,
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
  };
}
