import React, { useState, useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import { supabase } from '../lib/supabase.js';
import { resolveCoordsFromText } from '../constants/szentendreData.js';
import AvatarBadge from './AvatarBadge.jsx';

const VECTOR_STYLE_URL = 'https://tiles.openfreemap.org/styles/bright';

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
  const [showReportBox, setShowReportBox] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [kudosTag, setKudosTag] = useState('Pontos és segítőkész');
  const [editingCar, setEditingCar] = useState(false);
  const [carDraft, setCarDraft] = useState('');
  const [savingCar, setSavingCar] = useState(false);

  const bottomRef = useRef(null);
  const liveMapContainerRef = useRef(null);
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
    setEditingCar(false);
    setCarDraft(agreement?.car_info || '');
    setErrorBanner(null);
    setGpsErrorMsg(null);
    if (!agreement?.id || !supabase || !isUuid(agreement.id)) {
      setMessages([]);
      return;
    }

    let mounted = true;

    supabase
      .from('messages')
      .select('*')
      .eq('agreement_id', agreement.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (mounted && data) setMessages(data);
      });

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
          table: 'agreements',
          filter: `id=eq.${agreement.id}`
        },
        (payload) => {
          if (!mounted || !payload.new) return;
          setLiveAgr((prev) => (prev ? { ...prev, ...payload.new } : payload.new));
        }
      )
      .subscribe();

    return () => {
      mounted = false;
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
        if (now - lastSentAt < 6000) return;
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

  const handleSaveRideCar = async (e) => {
    e.preventDefault();
    if (!currentUser?.id) return;
    const cleanCar = carDraft.trim() || null;
    setSavingCar(true);
    try {
      if (isLiveDbAgreement && liveAgr?.ride_id) {
        await supabase
          .from('rides')
          .update({ car_info: cleanCar })
          .eq('id', liveAgr.ride_id);
      }
      if (cleanCar && isLiveDbAgreement) {
        await supabase
          .from('profiles')
          .update({ car_info: cleanCar })
          .eq('id', currentUser.id);
      }
      setLiveAgr((prev) => (prev ? { ...prev, car_info: cleanCar } : prev));
      setEditingCar(false);
      if (cleanCar && isLiveDbAgreement && liveAgr?.id) {
        await supabase.from('messages').insert({
          agreement_id: liveAgr.id,
          sender_id: currentUser.id,
          body: `Ezzel az autóval érkezem: ${cleanCar}`
        });
      }
      if (onAgreementUpdated) onAgreementUpdated();
    } finally {
      setSavingCar(false);
    }
  };

  useEffect(() => {
    if (!liveMapContainerRef.current || status !== 'started') return;

    const pickupFallback = liveAgr?.pickup_stop_name
      ? resolveCoordsFromText(liveAgr.pickup_stop_name.replace(/^\d{2}:\d{2}\s*/, ''))
      : null;

    const passengerCoord =
      liveAgr?.passenger_lat && liveAgr?.passenger_lng
        ? { lat: Number(liveAgr.passenger_lat), lng: Number(liveAgr.passenger_lng) }
        : pickupFallback;

    const driverCoord =
      liveAgr?.driver_lat && liveAgr?.driver_lng
        ? { lat: Number(liveAgr.driver_lat), lng: Number(liveAgr.driver_lng) }
        : null;

    const centerCoord = driverCoord || passengerCoord || { lat: 47.6694, lng: 19.0756 };

    let map = null;
    const markers = [];

    try {
      map = new maplibregl.Map({
        container: liveMapContainerRef.current,
        style: VECTOR_STYLE_URL,
        center: [centerCoord.lng, centerCoord.lat],
        zoom: 14.5,
        attributionControl: false
      });

      map.on('load', () => {
        map.resize();

        if (passengerCoord && !isNaN(passengerCoord.lat) && !isNaN(passengerCoord.lng)) {
          const paxEl = document.createElement('div');
          paxEl.style.cssText =
            'background:#C86446;color:#fff;font-weight:800;font-size:11px;padding:3px 8px;border-radius:99px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);white-space:nowrap';
          paxEl.textContent = 'Felszállópont';
          markers.push(
            new maplibregl.Marker({ element: paxEl })
              .setLngLat([passengerCoord.lng, passengerCoord.lat])
              .addTo(map)
          );
        }

        if (driverCoord && !isNaN(driverCoord.lat) && !isNaN(driverCoord.lng)) {
          const carEl = document.createElement('div');
          carEl.style.cssText =
            'background:#1E4635;color:#fff;font-weight:800;font-size:11px;padding:4px 9px;border-radius:99px;border:2.5px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.45);white-space:nowrap';
          carEl.textContent = '🚗 Autó úton';
          markers.push(
            new maplibregl.Marker({ element: carEl })
              .setLngLat([driverCoord.lng, driverCoord.lat])
              .addTo(map)
          );
        }

        if (driverCoord && passengerCoord) {
          const bounds = new maplibregl.LngLatBounds()
            .extend([driverCoord.lng, driverCoord.lat])
            .extend([passengerCoord.lng, passengerCoord.lat]);
          map.fitBounds(bounds, { padding: 36, maxZoom: 15, duration: 0 });

          map.addSource('live-approach', {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [
                  [driverCoord.lng, driverCoord.lat],
                  [passengerCoord.lng, passengerCoord.lat]
                ]
              }
            }
          });
          map.addLayer({
            id: 'live-approach-line',
            type: 'line',
            source: 'live-approach',
            paint: {
              'line-color': '#1E4635',
              'line-width': 3,
              'line-dasharray': [2, 2]
            }
          });
        }
      });
    } catch {}

    return () => {
      markers.forEach((m) => m.remove());
      if (map) {
        try {
          map.remove();
        } catch {}
      }
    };
  }, [
    status,
    liveAgr?.driver_lat,
    liveAgr?.driver_lng,
    liveAgr?.passenger_lat,
    liveAgr?.passenger_lng,
    liveAgr?.pickup_stop_name
  ]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  if (!liveAgr) return null;

  const sendMessage = async (bodyText) => {
    const clean = (bodyText || '').trim();
    if (!clean) return;

    if (!isLiveDbAgreement) {
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}`, sender_id: currentUser.id, body: clean }
      ]);
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

      if (bothConfirmed && liveAgr.ride_id) {
        const { data: rideRow } = await supabase
          .from('rides')
          .select('id, kind, seats')
          .eq('id', liveAgr.ride_id)
          .maybeSingle();
        if (rideRow && rideRow.kind === 'offer' && Number(rideRow.seats) > 0) {
          await supabase
            .from('rides')
            .update({ seats: Math.max(0, Number(rideRow.seats) - 1) })
            .eq('id', rideRow.id);
        }
      }

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
          body: `Segítség visszaigazolva ✓ (${kudosTag})`,
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

  const handleCancelAgreement = async () => {
    if (!isLiveDbAgreement || isProInquiry || busy) return;
    setBusy(true);
    setErrorBanner(null);
    try {
      const wasAgreed = ['agreed', 'started'].includes(status);
      const { data, error } = await supabase
        .from('agreements')
        .update({ status: 'cancelled' })
        .eq('id', liveAgr.id)
        .select('*')
        .single();
      if (error) throw error;

      if (wasAgreed && liveAgr.ride_id) {
        const { data: rideRow } = await supabase
          .from('rides')
          .select('id, kind, seats')
          .eq('id', liveAgr.ride_id)
          .maybeSingle();
        if (rideRow && rideRow.kind === 'offer') {
          await supabase
            .from('rides')
            .update({ seats: Number(rideRow.seats || 0) + 1 })
            .eq('id', rideRow.id);
        }
      }

      await supabase.from('messages').insert({
        agreement_id: liveAgr.id,
        sender_id: currentUser.id,
        body: `${currentUser?.display_name || 'A partner'} lemondta az egyeztetést.`,
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

  const handleReport = () => {
    setShowReportBox((v) => !v);
    setErrorBanner(null);
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!reportReason || reportReason.trim().length < 4) {
      setErrorBanner('Kérlek, írd le röviden (legalább pár szóban) a problémát.');
      return;
    }
    setBusy(true);
    if (isLiveDbAgreement) {
      const reportedUserId =
        liveAgr.requester_id === currentUser.id ? liveAgr.helper_id : liveAgr.requester_id;
      if (reportedUserId) {
        const { error } = await supabase.from('reports').insert({
          agreement_id: liveAgr.id,
          reporter_id: currentUser.id,
          reported_user_id: reportedUserId,
          reason: reportReason.trim()
        });
        if (error) {
          setBusy(false);
          setErrorBanner(error.message);
          return;
        }
      }
    }
    setBusy(false);
    setShowReportBox(false);
    setReportReason('');
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
              <AvatarBadge
                src={liveAgr.partner_avatar}
                name={liveAgr.partner_name}
                sizeClass="w-9 h-9 text-sm"
              />
              <div className="truncate">
                <div className="font-bold text-sm truncate flex items-center gap-1.5">
                  <span className="truncate">{liveAgr.partner_name}</span>
                  {liveAgr.car_info && (
                    <span className="text-[10px] font-bold bg-[#ECE7DC] text-[#18261F] px-2 py-0.5 rounded-full shrink-0">
                      {liveAgr.car_info}
                    </span>
                  )}
                  {isRideAgreement && isHelper && !editingCar && (
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setCarDraft(liveAgr.car_info || '');
                        setEditingCar(true);
                      }}
                      className="text-[10px] font-bold text-pilis bg-pilis-soft px-2 py-0.5 rounded-full shrink-0 hover:bg-pilis hover:text-white transition"
                    >
                      {liveAgr.car_info ? 'Autó módosítása' : '+ Autó megadása'}
                    </button>
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
            {!isProInquiry && ['chatting', 'agreed', 'started'].includes(status) && (
              <button
                type="button"
                disabled={busy}
                onClick={handleCancelAgreement}
                className="text-xs font-bold text-[#5C6B62] hover:text-red-700 bg-limestone px-2.5 py-1.5 rounded-lg border border-[#DFD9CE]"
              >
                Lemondás
              </button>
            )}
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

        {editingCar && (
          <form onSubmit={handleSaveRideCar} className="px-3.5 py-2 bg-limestone border-t border-[#DFD9CE] flex items-center gap-2">
            <input
              type="text"
              value={carDraft}
              onChange={(e) => setCarDraft(e.target.value)}
              placeholder="Milyen autóval mész? (pl. Kék kombi)"
              className="flex-1 min-w-0 bg-white border border-[#DFD9CE] rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-pilis"
            />
            <button
              type="submit"
              disabled={savingCar}
              className="bg-pilis text-white font-bold text-xs px-3 py-1.5 rounded-xl shrink-0"
            >
              {savingCar ? '...' : 'Mentés'}
            </button>
            <button
              type="button"
              onClick={() => setEditingCar(false)}
              className="bg-white text-[#5C6B62] border border-[#DFD9CE] font-bold text-xs px-2.5 py-1.5 rounded-xl shrink-0"
            >
              ✕
            </button>
          </form>
        )}

        {errorBanner && (
          <div className="bg-red-100 text-red-900 text-xs font-semibold px-4 py-2 border-b border-red-200">
            {errorBanner}
          </div>
        )}

        {showReportBox && (
          <form
            onSubmit={handleSubmitReport}
            className="bg-red-50 px-4 py-2.5 border-b border-red-200 flex items-center gap-2"
          >
            <input
              type="text"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Írd le röviden a problémát..."
              className="flex-1 min-w-0 bg-white border border-red-300 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
              autoFocus
            />
            <button
              type="submit"
              disabled={busy}
              className="shrink-0 bg-red-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl"
            >
              Küldés
            </button>
            <button
              type="button"
              onClick={() => setShowReportBox(false)}
              className="shrink-0 text-xs font-bold text-[#5C6B62] px-1.5"
            >
              ✕
            </button>
          </form>
        )}

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
              {status === 'cancelled' && 'Lemondva ✕'}
            </div>

            <div className="shrink-0 flex items-center gap-1.5">
              {status === 'chatting' && isPostOwner && !ownerConfirmed && (
                <button
                  disabled={busy}
                  onClick={handleSequentialApproval}
                  className="bg-pilis hover:bg-pilis-light text-white text-xs font-bold px-3 py-1.5 rounded-xl"
                >
                  Elfogadom
                </button>
              )}

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
                <div className="flex items-center gap-1.5">
                  <select
                    value={kudosTag}
                    onChange={(e) => setKudosTag(e.target.value)}
                    aria-label="Visszajelzés típusa"
                    className="bg-white border border-[#DFD9CE] text-[#18261F] text-[11px] font-bold px-2 py-1.5 rounded-xl"
                  >
                    <option value="Pontos és segítőkész">👏 Pontos, segítőkész</option>
                    <option value="Szuper útitárs">🚗 Szuper útitárs</option>
                    <option value="Gyors segítség">⚡ Gyors segítség</option>
                    <option value="Igazi jó szomszéd">🤝 Igazi jó szomszéd</option>
                  </select>
                  <button
                    disabled={busy}
                    onClick={handleGiveKudos}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow shrink-0"
                  >
                    Segített nekem ✓
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

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
