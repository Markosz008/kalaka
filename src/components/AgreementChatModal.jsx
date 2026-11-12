import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { supabase } from '../lib/supabase.js';
import { resolveCoordsFromText } from '../constants/szentendreData.js';

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function AgreementChatModal({
  onInspectUser,
  agreement,
  currentUser,
  onClose,
  onAgreementUpdated
}) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [liveAgr, setLiveAgr] = useState(agreement || null);
  const [busy, setBusy] = useState(false);
  const [gpsErrorMsg, setGpsErrorMsg] = useState(null);
  const [errorBanner, setErrorBanner] = useState(null);
  const [gpsActive, setGpsActive] = useState(false);
  const [sharingPassengerPin, setSharingPassengerPin] = useState(false);

  const bottomRef = useRef(null);
  const liveMapContainerRef = useRef(null);
  const liveMapRef = useRef(null);
  const liveLayerRef = useRef(null);
  const watchIdRef = useRef(null);

  const isUuid = (val) =>
    typeof val === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  const isLiveDbAgreement = Boolean(supabase && isUuid(agreement?.id));
  const isRequester = liveAgr?.requester_id === currentUser?.id;
  const isHelper = liveAgr?.helper_id === currentUser?.id;
  const isProInquiry = Boolean(liveAgr?.pro_id);
  const isRideAgreement = Boolean(liveAgr?.ride_id);
  const status = liveAgr?.status || 'chatting';

  // Ki a hirdetés feladója (aki először hagyja jóvá a jelentkezést) és ki a csatlakozó fél?
  const postOwnerId = liveAgr?.post_owner_id || liveAgr?.helper_id;
  const isPostOwner = Boolean(currentUser?.id && postOwnerId === currentUser.id);
  const ownerIsHelper = postOwnerId === liveAgr?.helper_id;

  const ownerConfirmed = ownerIsHelper
    ? Boolean(liveAgr?.helper_agreed)
    : Boolean(liveAgr?.requester_agreed);
  const joinerConfirmed = ownerIsHelper
    ? Boolean(liveAgr?.requester_agreed)
    : Boolean(liveAgr?.helper_agreed);

  useEffect(() => {
    setLiveAgr(agreement || null);
  }, [agreement]);

  useEffect(() => {
    if (!agreement) return;
    setErrorBanner(null);

    if (!isLiveDbAgreement) {
      setMessages(agreement.messages || []);
      return;
    }

    let channel;
    (async () => {
      const [{ data: msgRows }, { data: freshAgr }] = await Promise.all([
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

      if (msgRows) setMessages(msgRows);
      if (freshAgr) {
        setLiveAgr((prev) => ({ ...(prev || {}), ...freshAgr }));
      }

      channel = supabase
        .channel(`agreement-room-${agreement.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `agreement_id=eq.${agreement.id}` },
          (payload) => {
            setMessages((prev) =>
              prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]
            );
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'agreements', filter: `id=eq.${agreement.id}` },
          (payload) => {
            setLiveAgr((prev) => ({ ...(prev || {}), ...payload.new }));
            if (onAgreementUpdated) onAgreementUpdated(payload.new);
          }
        )
        .subscribe();
    })();

    return () => {
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, [agreement?.id, isLiveDbAgreement]);

  // Élő koordináták (driver_lat/lng, passenger_lat/lng) 3 másodperces frissítése aktív út alatt
  useEffect(() => {
    if (!isRideAgreement || !liveAgr?.id || !supabase) return;
    if (!['agreed', 'started', 'arrived'].includes(status)) return;

    const syncCoords = async () => {
      const { data } = await supabase
        .from('agreements')
        .select('status, driver_lat, driver_lng, driver_updated_at, passenger_lat, passenger_lng, passenger_updated_at')
        .eq('id', liveAgr.id)
        .maybeSingle();
      if (data) {
        setLiveAgr((prev) => ({ ...prev, ...data }));
      }
    };

    syncCoords();
    const timer = setInterval(syncCoords, 3000);
    return () => clearInterval(timer);
  }, [isRideAgreement, liveAgr?.id, status]);

  // Screen Wake Lock: ébren tartja a kijelzőt, amíg az élő GPS-követés ('started') fut
  useEffect(() => {
    let wakeLock = null;
    const shouldKeepAwake = isRideAgreement && status === 'started';

    const requestWakeLock = async () => {
      if (!shouldKeepAwake) return;
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch {}
    };

    requestWakeLock();

    const handleVis = () => {
      if (document.visibilityState === 'visible' && shouldKeepAwake) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVis);

    return () => {
      document.removeEventListener('visibilitychange', handleVis);
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, [isRideAgreement, status]);

  // Sofőr élő GPS-közvetítése (csak status === 'started' esetén és csak a sofőrnél)
  useEffect(() => {
    const shouldBroadcast =
      isLiveDbAgreement &&
      isRideAgreement &&
      isHelper &&
      status === 'started' &&
      typeof navigator !== 'undefined' &&
      'geolocation' in navigator;

    if (!shouldBroadcast) {
      if (watchIdRef.current !== null && navigator?.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setGpsActive(false);
      return;
    }

    setGpsActive(true);
    let lastSentAt = 0;

    const pushCoords = async (lat, lng) => {
      const now = Date.now();
      if (now - lastSentAt < 3500) return;
      lastSentAt = now;
      await supabase
        .from('agreements')
        .update({
          driver_lat: lat,
          driver_lng: lng,
          driver_updated_at: new Date().toISOString()
        })
        .eq('id', liveAgr.id);
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => pushCoords(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => pushCoords(pos.coords.latitude, pos.coords.longitude),
      () => setGpsActive(false),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current !== null && navigator?.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setGpsActive(false);
    };
  }, [isLiveDbAgreement, isRideAgreement, isHelper, status, liveAgr?.id]);

  // Élő mini-térkép inicializálása útközben
  useEffect(() => {
    const showLiveMap = isRideAgreement && status === 'started';
    if (!showLiveMap || !liveMapContainerRef.current) {
      if (liveMapRef.current) {
        liveMapRef.current.remove();
        liveMapRef.current = null;
        liveLayerRef.current = null;
      }
      return;
    }

    if (!liveMapRef.current) {
      const map = L.map(liveMapContainerRef.current, {
        center: [47.676, 19.065],
        zoom: 14,
        zoomControl: false
      });
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        { attribution: '&copy; Esri, OpenStreetMap' }
      ).addTo(map);
      liveLayerRef.current = L.layerGroup().addTo(map);
      liveMapRef.current = map;
      setTimeout(() => map.invalidateSize(), 150);
    }
  }, [isRideAgreement, status]);

  // Élő jelölők frissítése
  useEffect(() => {
    const map = liveMapRef.current;
    const layer = liveLayerRef.current;
    if (!map || !layer || status !== 'started') return;

    layer.clearLayers();
    const bounds = [];

    const pickupFallback = liveAgr?.pickup_stop_name
      ? resolveCoordsFromText(liveAgr.pickup_stop_name.replace(/^\d{2}:\d{2}\s*/, ''))
      : null;

    const passengerCoord =
      liveAgr?.passenger_lat && liveAgr?.passenger_lng
        ? { lat: liveAgr.passenger_lat, lng: liveAgr.passenger_lng }
        : pickupFallback;

    const driverCoord =
      liveAgr?.driver_lat && liveAgr?.driver_lng
        ? { lat: liveAgr.driver_lat, lng: liveAgr.driver_lng }
        : null;

    if (passengerCoord) {
      const paxIcon = L.divIcon({
        className: '',
        html: `<div style="background:#C86446;color:#fff;font-weight:800;font-size:11px;padding:3px 8px;border-radius:99px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);white-space:nowrap">Felszállópont</div>`,
        iconSize: [96, 24],
        iconAnchor: [48, 12]
      });
      L.marker([passengerCoord.lat, passengerCoord.lng], { icon: paxIcon }).addTo(layer);
      bounds.push([passengerCoord.lat, passengerCoord.lng]);
    }

    if (driverCoord) {
      const carIcon = L.divIcon({
        className: '',
        html: `<div style="background:#1E4635;color:#fff;font-weight:800;font-size:11px;padding:4px 9px;border-radius:99px;border:2.5px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.45);white-space:nowrap">Autó úton</div>`,
        iconSize: [86, 26],
        iconAnchor: [43, 13]
      });
      L.marker([driverCoord.lat, driverCoord.lng], { icon: carIcon }).addTo(layer);
      bounds.push([driverCoord.lat, driverCoord.lng]);
    }

    if (driverCoord && passengerCoord) {
      L.polyline(
        [
          [driverCoord.lat, driverCoord.lng],
          [passengerCoord.lat, passengerCoord.lng]
        ],
        { color: '#1E4635', weight: 3, dashArray: '6 6' }
      ).addTo(layer);
    }

    if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    } else if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [32, 32], maxZoom: 15 });
    }
  }, [
    status,
    liveAgr?.driver_lat,
    liveAgr?.driver_lng,
    liveAgr?.passenger_lat,
    liveAgr?.passenger_lng,
    liveAgr?.pickup_stop_name,
    liveAgr?.title
  ]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  if (!liveAgr) return null;

  const sendMessage = async (bodyText) => {
    const clean = (bodyText || '').trim();
    if (!clean) return;

    if (!isLiveDbAgreement) {
      setMessages((prev) => [...prev, { id: `local-${Date.now()}`, sender_id: currentUser.id, body: clean }]);
      return;
    }

    const { error } = await supabase.from('messages').insert({
      agreement_id: liveAgr.id,
      sender_id: currentUser.id,
      body: clean,
      is_system_event: false
    });
    if (error) setErrorBanner(error.message);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const msg = text;
    setText('');
    await sendMessage(msg);
  };

  // 1. lépés: Hirdetés feladója jóváhagyja -> 2. lépés: Csatlakozó fél véglegesíti
  const handleSequentialApproval = async () => {
    if (!isLiveDbAgreement) return;
    setBusy(true);
    setErrorBanner(null);

    try {
      let nextReqAgreed = Boolean(liveAgr.requester_agreed);
      let nextHelperAgreed = Boolean(liveAgr.helper_agreed);

      if (isPostOwner && !ownerConfirmed) {
        if (ownerIsHelper) nextHelperAgreed = true;
        else nextReqAgreed = true;
      } else if (!isPostOwner && ownerConfirmed && !joinerConfirmed) {
        if (ownerIsHelper) nextReqAgreed = true;
        else nextHelperAgreed = true;
      } else {
        setBusy(false);
        return;
      }

      const bothConfirmed = nextReqAgreed && nextHelperAgreed;
      const patch = {
        requester_agreed: nextReqAgreed,
        helper_agreed: nextHelperAgreed,
        status: bothConfirmed ? 'agreed' : 'chatting'
      };

      const { data, error } = await supabase
        .from('agreements')
        .update(patch)
        .eq('id', liveAgr.id)
        .select('*')
        .single();
      if (error) throw error;

      await supabase.from('messages').insert({
        agreement_id: liveAgr.id,
        sender_id: currentUser.id,
        body: bothConfirmed
          ? `${currentUser?.display_name || 'A csatlakozó'} véglegesítette – a megállapodás rögzítve.`
          : `${currentUser?.display_name || 'A hirdető'} elfogadta a jelentkezést.`,
        is_system_event: true
      });

      setLiveAgr((prev) => ({ ...prev, ...data }));
      if (onAgreementUpdated) onAgreementUpdated(data);
    } catch (err) {
      setErrorBanner(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateStatus = async (nextStatus) => {
    setBusy(true);
    setErrorBanner(null);
    const systemTexts = {
      started: 'A sofőr elindult – élő helyzetkövetés bekapcsolva.',
      arrived: 'Megérkezés rögzítve.'
    };

    try {
      if (isLiveDbAgreement) {
        const patch = { status: nextStatus };
        if (nextStatus === 'started') {
          patch.started_at = new Date().toISOString();
        }
        if (nextStatus === 'arrived') {
          patch.arrived_at = new Date().toISOString();
          patch.driver_lat = null;
          patch.driver_lng = null;
          patch.passenger_lat = null;
          patch.passenger_lng = null;
        }

        const { data, error } = await supabase
          .from('agreements')
          .update(patch)
          .eq('id', liveAgr.id)
          .select('*')
          .single();
        if (error) throw error;

        await supabase.from('messages').insert({
          agreement_id: liveAgr.id,
          sender_id: currentUser.id,
          body: systemTexts[nextStatus] || nextStatus,
          is_system_event: true
        });

        setLiveAgr((prev) => ({ ...prev, ...data }));
        if (onAgreementUpdated) onAgreementUpdated(data);
      }
    } catch (err) {
      setErrorBanner(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSharePassengerLocation = () => {
    if (!navigator.geolocation || !isLiveDbAgreement) return;
    setSharingPassengerPin(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const { data } = await supabase
          .from('agreements')
          .update({ passenger_lat: lat, passenger_lng: lng })
          .eq('id', liveAgr.id)
          .select('*')
          .single();
        if (data) setLiveAgr((prev) => ({ ...prev, ...data }));
        await supabase.from('messages').insert({
          agreement_id: liveAgr.id,
          sender_id: currentUser.id,
          body: 'Pontos várakozási hely megosztva a térképen.',
          is_system_event: true
        });
        setSharingPassengerPin(false);
      },
      () => {
        setSharingPassengerPin(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleGiveKudos = async () => {
    setBusy(true);
    setErrorBanner(null);
    const isRide = Boolean(liveAgr.ride_id);

    try {
      if (isLiveDbAgreement) {
        const { error } = await supabase.from('kudos').insert({
          agreement_id: liveAgr.id,
          giver_id: currentUser.id,
          receiver_id: liveAgr.helper_id,
          kudos_type: isRide ? 'ride' : 'favor'
        });
        if (error && !String(error.message || '').includes('duplicate')) {
          throw error;
        }

        await supabase
          .from('agreements')
          .update({ status: 'completed' })
          .eq('id', liveAgr.id);

        if (liveAgr.helper_id) {
          const { data: helperProf } = await supabase
            .from('profiles')
            .select('ride_hearts, favor_hearts')
            .eq('id', liveAgr.helper_id)
            .maybeSingle();

          const { count: exactCount } = await supabase
            .from('kudos')
            .select('id', { count: 'exact', head: true })
            .eq('receiver_id', liveAgr.helper_id)
            .eq('kudos_type', isRide ? 'ride' : 'favor');

          if (helperProf) {
            const col = isRide ? 'ride_hearts' : 'favor_hearts';
            const nextVal = Math.max((helperProf[col] || 0) + 1, exactCount || 1);
            await supabase
              .from('profiles')
              .update({ [col]: nextVal })
              .eq('id', liveAgr.helper_id);
          }
        }

        await supabase.from('messages').insert({
          agreement_id: liveAgr.id,
          sender_id: currentUser.id,
          body: 'Segítség visszaigazolva.',
          is_system_event: true
        });

        const updated = { ...liveAgr, status: 'completed' };
        setLiveAgr(updated);
        if (onAgreementUpdated) onAgreementUpdated(updated);
      }
    } catch (err) {
      setErrorBanner(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleReport = async () => {
    const reason = window.prompt('Írd le röviden a problémát:');
    if (!reason || reason.trim().length < 5) return;

    if (isLiveDbAgreement) {
      const reportedUserId =
        liveAgr.requester_id === currentUser.id ? liveAgr.helper_id : liveAgr.requester_id;
      if (reportedUserId) {
        const { error } = await supabase.from('reports').insert({
          agreement_id: liveAgr.id,
          reporter_id: currentUser.id,
          reported_user_id: reportedUserId,
          reason: reason.trim()
        });
        if (error) {
          setErrorBanner(error.message);
          return;
        }
      }
    }
    onClose();
  };

  const etaSummary = (() => {
    if (status !== 'started' || !liveAgr.driver_lat || !liveAgr.driver_lng) return null;
    const pickupFallback = liveAgr.pickup_stop_name
      ? resolveCoordsFromText(liveAgr.pickup_stop_name.replace(/^\d{2}:\d{2}\s*/, ''))
      : null;
    const target =
      liveAgr.passenger_lat && liveAgr.passenger_lng
        ? { lat: liveAgr.passenger_lat, lng: liveAgr.passenger_lng }
        : pickupFallback;
    if (!target) return 'Élő helyzet aktív';
    const meters = Math.round(
      haversineMeters(liveAgr.driver_lat, liveAgr.driver_lng, target.lat, target.lng)
    );
    const mins = Math.max(1, Math.round(meters / 550));
    return meters < 1000
      ? `Kb. ${mins} perc • ${meters} m`
      : `Kb. ${mins} perc • ${(meters / 1000).toFixed(1)} km`;
  })();

  const quickReplies = isProInquiry
    ? ['Szia! Mikor lenne szabad időpontod?', 'Szentendrén belül kiszállással is vállalod?', 'Köszönöm a gyors választ!']
    : ['Ott leszek a megállóban.', '2 perc és érkezem.', 'Köszönöm a segítséget!'];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-limestone w-full max-w-lg h-[100dvh] sm:h-[660px] rounded-none sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl border-0 sm:border sm:border-[#DFD9CE] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        {/* Fejléc */}
        <div className="bg-white px-4 py-3 border-b border-[#DFD9CE] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button onClick={onClose} className="text-2xl font-bold text-[#18261F] px-1">
              ‹
            </button>
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                const partnerId =
                  liveAgr.requester_id === currentUser?.id
                    ? liveAgr.helper_id
                    : liveAgr.requester_id;
                if (onInspectUser && partnerId) {
                  onInspectUser({ userId: partnerId, name: liveAgr.partner_name });
                }
              }}
              className="flex items-center gap-2.5 min-w-0 cursor-pointer hover:opacity-80 transition"
              title="Adatlap megtekintése"
            >
            <div className="w-9 h-9 rounded-full bg-pilis text-white font-bold text-sm grid place-items-center shrink-0">
              {liveAgr.partner_name?.[0] || 'S'}
            </div>
            <div className="truncate">
              <div className="font-bold text-sm truncate flex items-center gap-1.5">
                <span className="truncate">{liveAgr.partner_name}</span>
                {liveAgr.car_info && (
                  <span className="text-[10px] font-bold bg-[#ECE7DC] text-[#18261F] px-2 py-0.5 rounded-full shrink-0">
                    🚗 {liveAgr.car_info}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[#5C6B62] truncate">
                {liveAgr.title}
                {liveAgr.pickup_stop_name ? ` • ${liveAgr.pickup_stop_name}` : ''}
              </div>
            </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isProInquiry && status !== 'chatting' && (
              <button
                onClick={handleReport}
                className="text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg"
              >
                Jelentés
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-bold text-[#5C6B62] hover:text-black bg-limestone px-2.5 py-1.5 rounded-lg"
            >
              Bezárás ✕
            </button>
          </div>
        </div>

        {errorBanner && (
          <div className="bg-red-100 text-red-900 text-xs font-semibold px-4 py-2 border-b border-red-200">
            {errorBanner}
          </div>
        )}

        {/* Regisztrált szaki 2 lépéses munka-visszaigazolása az ajánláshoz */}
        {isProInquiry && liveAgr.helper_id && (
          <div className="bg-[#ECE7DC] px-4 py-2.5 border-b border-[#DFD9CE] flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-[#18261F] min-w-0">
              {status === 'chatting' && (
                isHelper
                  ? 'Érdeklődés érkezett • Fogadd el, ha elvállalod'
                  : 'Egyeztetés folyamatban a szakemberrel'
              )}
              {status === 'agreed' && (
                isRequester
                  ? 'Elvállalva • Ha elkészült a munka, zárd le és ajánld'
                  : 'Elvállalva • Várakozás a megrendelő lezárására'
              )}
              {status === 'completed' && 'Munka lezárva ✓ • Ajánlás megnyitva'}
            </div>

            <div className="shrink-0">
              {status === 'chatting' && isHelper && (
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const { data } = await supabase
                      .from('agreements')
                      .update({ status: 'agreed', helper_agreed: true })
                      .eq('id', liveAgr.id)
                      .select('*')
                      .single();
                    if (data) setLiveAgr((prev) => ({ ...prev, ...data }));
                    await supabase.from('messages').insert({
                      agreement_id: liveAgr.id,
                      sender_id: currentUser.id,
                      body: 'A szakember elvállalta a munkát.',
                      is_system_event: true
                    });
                    setBusy(false);
                  }}
                  className="bg-pilis hover:bg-pilis-light text-white text-xs font-bold px-3 py-1.5 rounded-xl"
                >
                  Elvállaltam
                </button>
              )}

              {status === 'agreed' && isRequester && (
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const { data } = await supabase
                      .from('agreements')
                      .update({ status: 'completed', requester_agreed: true })
                      .eq('id', liveAgr.id)
                      .select('*')
                      .single();
                    if (data) setLiveAgr((prev) => ({ ...prev, ...data }));
                    await supabase.from('messages').insert({
                      agreement_id: liveAgr.id,
                      sender_id: currentUser.id,
                      body: 'Munka lezárva – az ajánlás megnyílt a szakember adatlapján.',
                      is_system_event: true
                    });
                    setBusy(false);
                  }}
                  className="bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow"
                >
                  Elkészült, ajánlom
                </button>
              )}
            </div>
          </div>
        )}

        {/* Szekvenciális (1. Hirdető -> 2. Csatlakozó) jóváhagyási és útkövetési állapotsáv */}
        {!isProInquiry && (
          <div className="bg-[#ECE7DC] px-4 py-2.5 border-b border-[#DFD9CE] flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-[#18261F] min-w-0">
              {status === 'chatting' && !ownerConfirmed && (
                isPostOwner
                  ? 'Új jelentkezés • Fogadd el, ha belefér az útba'
                  : 'Várakozás a hirdető jóváhagyására'
              )}
              {status === 'chatting' && ownerConfirmed && !joinerConfirmed && (
                isPostOwner
                  ? 'Elfogadtad • Várakozás a csatlakozó véglegesítésére'
                  : 'A hirdető elfogadta • Véglegesítsd a csatlakozást'
              )}
              {status === 'agreed' && (
                isHelper
                  ? 'Megállapodva • Induláskor indítsd a követést'
                  : 'Megállapodva • Várakozás a sofőr indulására'
              )}
              {status === 'started' && (
                <span className="flex items-center gap-1.5 text-pilis font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse shrink-0" />
                  <span className="truncate">
                    {etaSummary || (gpsActive ? 'Élő helyzet megosztva' : 'Sofőr úton van')}
                  </span>
                </span>
              )}
              {status === 'arrived' && (
                isRequester
                  ? `Megérkeztetek • Igazold vissza: ${liveAgr.partner_name} elvitt`
                  : 'Megérkezve • Várakozás az utas visszaigazolására'
              )}
              {status === 'completed' && 'Lezárva ✓'}
            </div>

            <div className="shrink-0 flex items-center gap-1.5">
              {/* 1. lépés: Csak a hirdető látja az Elfogadom gombot */}
              {status === 'chatting' && isPostOwner && !ownerConfirmed && (
                <button
                  disabled={busy}
                  onClick={handleSequentialApproval}
                  className="bg-pilis hover:bg-pilis-light text-white text-xs font-bold px-3 py-1.5 rounded-xl"
                >
                  Elfogadom
                </button>
              )}

              {/* 2. lépés: Miután a hirdető elfogadta, a csatlakozó véglegesíti */}
              {status === 'chatting' && !isPostOwner && ownerConfirmed && !joinerConfirmed && (
                <button
                  disabled={busy}
                  onClick={handleSequentialApproval}
                  className="bg-pilis hover:bg-pilis-light text-white text-xs font-bold px-3 py-1.5 rounded-xl"
                >
                  Véglegesítem
                </button>
              )}

              {status === 'agreed' && isRideAgreement && isHelper && (
                <button
                  disabled={busy}
                  onClick={() => handleUpdateStatus('started')}
                  className="bg-pilis hover:bg-pilis-light text-white text-xs font-bold px-3 py-1.5 rounded-xl"
                >
                  Elindultam
                </button>
              )}

              {status === 'started' && (
                <>
                  {isRequester && (
                    <button
                      type="button"
                      disabled={sharingPassengerPin}
                      onClick={handleSharePassengerLocation}
                      className="bg-white text-[#18261F] border border-[#DFD9CE] text-xs font-bold px-2.5 py-1.5 rounded-xl"
                    >
                      {sharingPassengerPin ? '...' : 'Itt állok'}
                    </button>
                  )}
                  {isHelper && (
                    <button
                      disabled={busy}
                      onClick={() => handleUpdateStatus('arrived')}
                      className="bg-terracotta text-white text-xs font-bold px-3 py-1.5 rounded-xl"
                    >
                      Megérkeztem
                    </button>
                  )}
                </>
              )}

              {(status === 'arrived' || (!isRideAgreement && status === 'agreed')) && isRequester && (
                <button
                  disabled={busy}
                  onClick={handleGiveKudos}
                  className="bg-emerald-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow"
                >
                  Segített nekem
                </button>
              )}
            </div>
          </div>
        )}

        {/* Élő mini-térkép a chatben, amíg az autó úton van */}
        {isRideAgreement && status === 'started' && (
          <div className="relative bg-[#E8E4DA] border-b border-[#DFD9CE]">
            <div ref={liveMapContainerRef} className="w-full h-40" />
            {!liveAgr.driver_lat && (
              <div className="absolute bottom-2 left-2 right-2 z-[400] bg-white/95 text-[#18261F] text-[11px] font-semibold px-3 py-1.5 rounded-lg shadow border border-[#DFD9CE] text-center">
                {isHelper
                  ? 'A telefonod megosztja a helyzetedet az utassal, amíg meg nem érkezel.'
                  : 'Várakozás a sofőr első GPS-jelére...'}
              </div>
            )}
          </div>
        )}

        {/* Üzenetek */}
        {isRideAgreement && ['agreed', 'started'].includes(status) && gpsErrorMsg && (
          <div className="bg-amber-50 border-b border-amber-200 px-3.5 py-2 flex items-center justify-between gap-2 text-[11px] text-amber-950">
            <span className="leading-tight">{gpsErrorMsg}</span>
            <button
              type="button"
              onClick={async () => {
                const fallbackLat = isHelper ? 47.6842 : 47.6768;
                const fallbackLng = isHelper ? 19.0628 : 19.0705;
                const patch = isHelper
                  ? {
                      driver_lat: fallbackLat,
                      driver_lng: fallbackLng,
                      driver_updated_at: new Date().toISOString()
                    }
                  : {
                      passenger_lat: fallbackLat,
                      passenger_lng: fallbackLng,
                      passenger_updated_at: new Date().toISOString()
                    };
                const { data } = await supabase
                  .from('agreements')
                  .update(patch)
                  .eq('id', liveAgr.id)
                  .select('*')
                  .single();
                if (data) setLiveAgr((prev) => ({ ...prev, ...data }));
                setGpsErrorMsg(null);
              }}
              className="shrink-0 bg-amber-900 text-white font-bold px-2.5 py-1 rounded-lg"
            >
              Pozíció küldése
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm ${
                m.is_system_event
                  ? 'mx-auto bg-emerald-50 text-emerald-900 text-xs font-semibold text-center border border-emerald-200'
                  : m.sender_id === currentUser?.id
                  ? 'ml-auto bg-pilis text-white rounded-br-sm'
                  : 'bg-white text-[#18261F] border border-[#DFD9CE] rounded-bl-sm'
              }`}
            >
              {m.body}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Gyorsválaszok */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-4 pb-2">
          {quickReplies.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => sendMessage(q)}
              className="shrink-0 text-xs bg-white border border-[#DFD9CE] px-3 py-1.5 rounded-full hover:border-pilis"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Üzenetküldő */}
        <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-[#DFD9CE] flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Üzenet írása..."
            className="flex-1 min-w-0 bg-limestone border border-[#DFD9CE] rounded-full px-4 py-2.5 text-base focus:outline-none focus:border-pilis"
          />
          <button type="submit" className="shrink-0 bg-pilis text-white font-bold text-sm px-5 py-2.5 rounded-full">
            Küldés
          </button>
        </form>
      </div>
    </div>
  );
}

