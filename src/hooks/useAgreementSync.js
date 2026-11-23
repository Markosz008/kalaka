import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';

function isUuid(val) {
  return (
    typeof val === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
  );
}

export function useAgreementSync(agreement, currentUserId) {
  const [messages, setMessages] = useState([]);
  const [liveAgr, setLiveAgr] = useState(agreement || null);
  const [gpsErrorMsg, setGpsErrorMsg] = useState(null);
  const [gpsActive, setGpsActive] = useState(false);
  const watchIdRef = useRef(null);

  const isLiveDbAgreement = Boolean(supabase && isUuid(agreement?.id));
  const isHelper = liveAgr?.helper_id === currentUserId;
  const isRideAgreement = Boolean(liveAgr?.ride_id);
  const status = liveAgr?.status || 'chatting';

  useEffect(() => {
    setLiveAgr(agreement || null);
    setGpsErrorMsg(null);
    if (!agreement?.id || !supabase || !isUuid(agreement.id)) {
      setMessages([]);
      return;
    }

    let mounted = true;
    let isTerminal = ['completed', 'cancelled'].includes(agreement.status);
    let syncing = false;

    const syncAgreementState = async () => {
      if (!mounted || syncing) return;
      syncing = true;
      try {
        const [{ data: msgData }, { data: agrData }] = await Promise.all([
          supabase
            .from('messages')
            .select('*')
            .eq('agreement_id', agreement.id)
            .order('created_at', { ascending: true }),
          supabase
            .from('agreements')
            .select('*')
            .eq('id', agreement.id)
            .maybeSingle()
        ]);
        if (!mounted) return;
        if (msgData) setMessages(msgData);
        if (agrData) {
          isTerminal = ['completed', 'cancelled'].includes(agrData.status);
          setLiveAgr((prev) => (prev ? { ...prev, ...agrData } : agrData));
        }
      } finally {
        syncing = false;
      }
    };

    syncAgreementState();

    const channel = supabase
      .channel(`agr-chat-${agreement.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `agreement_id=eq.${agreement.id}`
        },
        (payload) => {
          if (!mounted || !payload.new) return;
          setMessages((prev) =>
            prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `agreement_id=eq.${agreement.id}`
        },
        (payload) => {
          if (!mounted || !payload.new) return;
          setMessages((prev) =>
            prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m))
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agreements',
          filter: `id=eq.${agreement.id}`
        },
        (payload) => {
          if (!mounted || !payload.new) return;
          isTerminal = ['completed', 'cancelled'].includes(payload.new.status);
          setLiveAgr((prev) => (prev ? { ...prev, ...payload.new } : payload.new));
        }
      )
      .subscribe((subStatus) => {
        if (subStatus === 'SUBSCRIBED') {
          syncAgreementState();
        }
      });

    const handleResume = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        syncAgreementState();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleResume);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleResume);
      window.addEventListener('pageshow', handleResume);
      window.addEventListener('online', handleResume);
    }

    const pollTimer = setInterval(() => {
      if (
        !isTerminal &&
        (typeof document === 'undefined' || document.visibilityState === 'visible')
      ) {
        syncAgreementState();
      }
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(pollTimer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleResume);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleResume);
        window.removeEventListener('pageshow', handleResume);
        window.removeEventListener('online', handleResume);
      }
      supabase.removeChannel(channel);
    };
  }, [agreement?.id]);

  useEffect(() => {
    if (!isLiveDbAgreement || !isRideAgreement || status !== 'started' || !isHelper) {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setGpsActive(false);
      return;
    }

    if (!navigator.geolocation) {
      setGpsErrorMsg('A böngésződ nem támogatja a GPS-helyzetmegosztást.');
      return;
    }

    setGpsActive(true);
    let lastSentAt = 0;

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();
        if (now - lastSentAt < 4000) return;
        lastSentAt = now;
        const { latitude: lat, longitude: lng } = pos.coords;
        setGpsErrorMsg(null);
        await supabase
          .from('agreements')
          .update({
            driver_lat: lat,
            driver_lng: lng,
            driver_updated_at: new Date().toISOString()
          })
          .eq('id', liveAgr.id);
      },
      () => {
        setGpsErrorMsg('Engedélyezd a GPS-t, vagy küldd el a pozíciódat gombbal.');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setGpsActive(false);
    };
  }, [isLiveDbAgreement, isRideAgreement, status, isHelper, liveAgr?.id]);

  return {
    messages,
    setMessages,
    liveAgr,
    setLiveAgr,
    gpsErrorMsg,
    setGpsErrorMsg,
    gpsActive,
    isLiveDbAgreement
  };
}
