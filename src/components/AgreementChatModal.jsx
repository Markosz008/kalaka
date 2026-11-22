import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { resolveCoordsFromText } from '../constants/szentendreData.js';
import { triggerAgreementPush } from '../lib/webPush.js';
import { estimateRideDetour, resolvePointCoords } from '../lib/detourCalc.js';
import AvatarBadge from './AvatarBadge.jsx';
import ChatEmojiPicker from './ChatEmojiPicker.jsx';
import ChatMessageBubble from './ChatMessageBubble.jsx';

const LiveRideMap = React.lazy(() => import('./LiveRideMap.jsx'));
const DetourPreviewMap = React.lazy(() => import('./DetourPreviewMap.jsx'));

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
  onAgreementUpdated,
  showPushBanner = false,
  onOpenPushSettings
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
  const [showDetourMap, setShowDetourMap] = useState(false);
  const [activeMsgId, setActiveMsgId] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [confirmDeleteMsgId, setConfirmDeleteMsgId] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const bottomRef = useRef(null);
  const watchIdRef = useRef(null);
  const inputRef = useRef(null);

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
    if (error) {
      setErrorBanner(error.message);
    } else {
      triggerAgreementPush(supabase, liveAgr.id, 'Új üzenet a Kalákán', clean);
    }
  };

  const handleStartEditMessage = (msg) => {
    setEditingMsg({ id: msg.id, body: msg.body });
    setText(msg.body || '');
    setActiveMsgId(null);
    setConfirmDeleteMsgId(null);
    setShowEmojiPicker(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleCancelEditMessage = () => {
    setEditingMsg(null);
    setText('');
  };

  const handleDeleteMessage = async (msgId) => {
    setActiveMsgId(null);
    setConfirmDeleteMsgId(null);
    if (editingMsg?.id === msgId) {
      setEditingMsg(null);
      setText('');
    }
    const nowIso = new Date().toISOString();
    if (!isLiveDbAgreement) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, body: 'Üzenet törölve', deleted_at: nowIso } : m
        )
      );
      return;
    }
    const { data, error } = await supabase
      .from('messages')
      .update({ deleted_at: nowIso, body: 'Üzenet törölve' })
      .eq('id', msgId)
      .eq('sender_id', currentUser.id)
      .select('*')
      .single();
    if (error) {
      setErrorBanner(error.message);
      return;
    }
    if (data) {
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, ...data } : m)));
    }
  };

  const handlePickEmoji = (emoji) => {
    const el = inputRef.current;
    if (el && typeof el.selectionStart === 'number') {
      const start = el.selectionStart;
      const end = el.selectionEnd ?? start;
      const next = text.slice(0, start) + emoji + text.slice(end);
      setText(next);
      setTimeout(() => {
        el.focus();
        const pos = start + emoji.length;
        el.setSelectionRange(pos, pos);
      }, 0);
    } else {
      setText((prev) => prev + emoji);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    setShowEmojiPicker(false);

    if (editingMsg) {
      const targetId = editingMsg.id;
      if (clean === (editingMsg.body || '').trim()) {
        setEditingMsg(null);
        setText('');
        return;
      }
      const nowIso = new Date().toISOString();
      if (!isLiveDbAgreement) {
        setMessages((prev) =>
          prev.map((m) => (m.id === targetId ? { ...m, body: clean, edited_at: nowIso } : m))
        );
        setEditingMsg(null);
        setText('');
        return;
      }
      const { data, error } = await supabase
        .from('messages')
        .update({ body: clean, edited_at: nowIso })
        .eq('id', targetId)
        .eq('sender_id', currentUser.id)
        .select('*')
        .single();
      if (error) {
        setErrorBanner(error.message);
        return;
      }
      if (data) {
        setMessages((prev) => prev.map((m) => (m.id === targetId ? { ...m, ...data } : m)));
      }
      setEditingMsg(null);
      setText('');
      return;
    }

    setText('');
    await sendMessage(clean);
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

      const approvalText = bothConfirmed
        ? `${currentUser?.display_name || 'A csatlakozó'} véglegesítette – a megállapodás rögzítve.`
        : `${currentUser?.display_name || 'A hirdető'} elfogadta a jelentkezést.`;
      await supabase.from('messages').insert({
        agreement_id: liveAgr.id,
        sender_id: currentUser.id,
        body: approvalText,
        is_system_event: true
      });
      triggerAgreementPush(
        supabase,
        liveAgr.id,
        bothConfirmed ? 'Megállapodás véglegesítve' : 'Jelentkezés elfogadva',
        approvalText
      );

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
        triggerAgreementPush(
          supabase,
          liveAgr.id,
          nextStatus === 'started' ? 'A sofőr elindult' : 'Megérkezés rögzítve',
          systemTexts[nextStatus] || nextStatus
        );

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
        triggerAgreementPush(
          supabase,
          liveAgr.id,
          'Pontos várakozási hely',
          'Pontos várakozási hely megosztva a térképen.'
        );
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

  const pickupDetourData = (() => {
    if (!isRideAgreement || !liveAgr.pickup_stop_name) return null;
    const cleanPickup = liveAgr.pickup_stop_name.replace(/^\d{2}:\d{2}\s*/, '').trim();
    const pickupCoords = resolvePointCoords(cleanPickup);
    const titleParts = String(liveAgr.title || '').split('→').map((s) => s.trim());
    const originText = liveAgr.ride_origin_text || liveAgr.ride?.origin_text || titleParts[0] || '';
    const destText = liveAgr.ride_dest_text || liveAgr.ride?.dest_text || titleParts[1] || '';
    const originCoords = resolvePointCoords(originText);
    const destCoords = resolvePointCoords(destText);
    const detour = estimateRideDetour(originCoords, destCoords, pickupCoords);
    return {
      pickupLabel: liveAgr.pickup_stop_name,
      originLabel: originText,
      destLabel: destText,
      originCoords,
      destCoords,
      pickupCoords,
      detour
    };
  })();

  const quickReplies = isProInquiry
    ? ['Szia! Mikor lenne szabad időpontod?', 'Szentendrén belül kiszállással is vállalod?', 'Köszönöm a gyors választ!']
    : ['Ott leszek a megállóban.', '2 perc és érkezem.', 'Köszönöm a segítséget!'];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-limestone w-full max-w-lg h-[100dvh] sm:h-[660px] rounded-none sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl border-0 sm:border sm:border-[#DFD9CE] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="bg-white px-3.5 py-2.5 border-b border-[#DFD9CE] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button type="button" onClick={onClose} className="text-2xl font-bold text-[#18261F] px-1 shrink-0 leading-none">
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
                className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer hover:opacity-80 transition"
                title="Adatlap megtekintése"
              >
                <AvatarBadge
                  src={liveAgr.partner_avatar}
                  name={liveAgr.partner_name}
                  sizeClass="w-9 h-9 text-sm shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm text-[#18261F] truncate">
                    {liveAgr.partner_name}
                  </div>
                  <div className="text-[11px] text-[#5C6B62] truncate">
                    {liveAgr.title}
                    {liveAgr.pickup_stop_name ? ` • ${liveAgr.pickup_stop_name}` : ''}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-xs font-bold text-[#5C6B62] hover:text-black bg-limestone px-2.5 py-1.5 rounded-lg shrink-0"
            >
              Bezárás ✕
            </button>
          </div>

          {(liveAgr.car_info ||
            (isRideAgreement && isHelper && !editingCar) ||
            (!isProInquiry && ['chatting', 'agreed', 'started'].includes(status)) ||
            (!isProInquiry && status !== 'chatting')) && (
            <div className="flex items-center justify-between gap-2 flex-wrap pt-1.5 border-t border-[#ECE7DC]">
              <div className="flex items-center gap-1.5 flex-wrap">
                {liveAgr.car_info && (
                  <span className="text-[11px] font-bold bg-[#ECE7DC] text-[#18261F] px-2.5 py-1 rounded-full">
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
                    className="text-[11px] font-bold text-pilis bg-pilis-soft px-2.5 py-1 rounded-full hover:bg-pilis hover:text-white transition"
                  >
                    {liveAgr.car_info ? 'Autó módosítása' : '+ Autó megadása'}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                {!isProInquiry && ['chatting', 'agreed', 'started'].includes(status) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleCancelAgreement}
                    className="text-[11px] font-bold text-[#5C6B62] hover:text-red-700 bg-limestone px-2.5 py-1 rounded-lg border border-[#DFD9CE]"
                  >
                    Lemondás
                  </button>
                )}
                {!isProInquiry && status !== 'chatting' && (
                  <button
                    type="button"
                    onClick={handleReport}
                    className="text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg"
                  >
                    Jelentés
                  </button>
                )}
              </div>
            </div>
          )}
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
          <div
            className={`bg-[#ECE7DC] px-4 py-2.5 border-b border-[#DFD9CE] flex gap-2 ${
              (status === 'arrived' || (!isRideAgreement && status === 'agreed')) && isRequester
                ? 'flex-col items-stretch'
                : 'flex-wrap items-center justify-between'
            }`}
          >
            <div className="text-xs font-semibold text-[#18261F] min-w-0">
              {status === 'chatting' && !ownerConfirmed && (
                isPostOwner
                  ? isRideAgreement
                    ? ownerIsHelper
                      ? 'Új jelentkezés • Fogadd el, ha belefér az útba'
                      : 'Új fuvarajánlat • Fogadd el, ha jó az indulás'
                    : 'Új jelentkezés • Fogadd el, ha megfelel'
                  : 'Várakozás a hirdető jóváhagyására'
              )}
              {status === 'chatting' && ownerConfirmed && !joinerConfirmed && (
                isPostOwner
                  ? 'Elfogadtad • Várakozás a csatlakozó véglegesítésére'
                  : 'A hirdető elfogadta • Véglegesítsd a csatlakozást'
              )}
              {status === 'agreed' && (
                isRideAgreement
                  ? isHelper
                    ? 'Megállapodva • Induláskor indítsd a követést'
                    : 'Megállapodva • Várakozás a sofőr indulására'
                  : isRequester
                    ? `Megállapodva • Ha ${liveAgr.partner_name} segített, igazold vissza`
                    : 'Megállapodva • Várakozás a másik fél visszaigazolására'
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

            <div
              className={`flex items-center gap-1.5 ${
                (status === 'arrived' || (!isRideAgreement && status === 'agreed')) && isRequester
                  ? 'w-full'
                  : 'shrink-0'
              }`}
            >
              {status === 'chatting' && isPostOwner && !ownerConfirmed && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleCancelAgreement}
                    className="bg-white hover:bg-red-50 text-red-700 border border-red-200 text-xs font-bold px-2.5 py-1.5 rounded-xl"
                  >
                    {isRideAgreement && ownerIsHelper ? 'Nem esik útba' : 'Nem jó'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleSequentialApproval}
                    className="bg-pilis hover:bg-pilis-light text-white text-xs font-bold px-3 py-1.5 rounded-xl"
                  >
                    Elfogadom
                  </button>
                </>
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
                <div className="w-full flex items-center gap-2">
                  <select
                    value={kudosTag}
                    onChange={(e) => setKudosTag(e.target.value)}
                    aria-label="Visszajelzés típusa"
                    className="flex-1 min-w-0 bg-white border border-[#DFD9CE] text-[#18261F] text-xs font-bold px-2.5 py-2 rounded-xl"
                  >
                    <option value="Pontos és segítőkész">👏 Pontos, segítőkész</option>
                    <option value="Szuper útitárs">🚗 Szuper útitárs</option>
                    <option value="Gyors segítség">⚡ Gyors segítség</option>
                    <option value="Igazi jó szomszéd">🤝 Igazi jó szomszéd</option>
                  </select>
                  <button
                    disabled={busy}
                    onClick={handleGiveKudos}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow shrink-0"
                  >
                    Segített nekem ✓
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {pickupDetourData && ['chatting', 'agreed'].includes(status) && (
          <div className="bg-white border-b border-[#DFD9CE]">
            <div className="px-3.5 py-2 flex items-center justify-between gap-2 flex-wrap">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-[11px] text-[#5C6B62] truncate">
                  Felszállópont: <strong className="text-[#18261F]">{pickupDetourData.pickupLabel}</strong>
                </div>
                {pickupDetourData.detour && (
                  <span
                    className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full border ${pickupDetourData.detour.badgeClass}`}
                  >
                    {pickupDetourData.detour.label}
                  </span>
                )}
              </div>
              {pickupDetourData.pickupCoords && (
                <button
                  type="button"
                  onClick={() => setShowDetourMap((prev) => !prev)}
                  className="shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-limestone hover:bg-pilis-soft text-pilis border border-[#DFD9CE] transition"
                >
                  {showDetourMap ? 'Térkép elrejtése' : 'Térképen ›'}
                </button>
              )}
            </div>
            {showDetourMap && pickupDetourData.pickupCoords && (
              <div className="border-t border-[#ECE7DC]">
                <React.Suspense
                  fallback={
                    <div className="w-full h-40 flex items-center justify-center text-xs font-semibold text-[#5C6B62] bg-[#E8E4DA]">
                      Térkép betöltése...
                    </div>
                  }
                >
                  <DetourPreviewMap
                    originCoords={pickupDetourData.originCoords}
                    destCoords={pickupDetourData.destCoords}
                    pickupCoords={pickupDetourData.pickupCoords}
                    pickupLabel={pickupDetourData.pickupLabel}
                  />
                </React.Suspense>
              </div>
            )}
          </div>
        )}

        {isRideAgreement && status === 'started' && (
          <div className="relative bg-[#E8E4DA] border-b border-[#DFD9CE]">
            <React.Suspense
              fallback={
                <div className="w-full h-48 flex items-center justify-center text-xs font-semibold text-[#5C6B62]">
                  Élő térkép betöltése...
                </div>
              }
            >
              <LiveRideMap
                driverLat={liveAgr.driver_lat}
                driverLng={liveAgr.driver_lng}
                passengerLat={liveAgr.passenger_lat}
                passengerLng={liveAgr.passenger_lng}
                pickupStopName={liveAgr.pickup_stop_name}
                isHelper={isHelper}
              />
            </React.Suspense>
            {!liveAgr.driver_lat && (
              <div className="absolute bottom-2 left-2 right-2 z-[400] bg-white/95 text-[#18261F] text-[11px] font-semibold px-3 py-1.5 rounded-lg shadow border border-[#DFD9CE] text-center">
                {isHelper
                  ? 'A telefonod megosztja a helyzetedet az utassal, amíg nyitva van ez az ablak.'
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

        {showPushBanner && onOpenPushSettings && (
          <div className="bg-pilis-soft/80 border-b border-pilis/20 px-3.5 py-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-[#18261F] leading-tight">
              Bezárt appnál most nem kapsz jelzést a válaszokról.
            </span>
            <button
              type="button"
              onClick={onOpenPushSettings}
              className="shrink-0 bg-pilis hover:bg-pilis-light text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition"
            >
              Bekapcsolom
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {messages.map((m) => (
            <ChatMessageBubble
              key={m.id}
              message={m}
              isOwn={!m.is_system_event && m.sender_id === currentUser?.id}
              isMenuOpen={activeMsgId === m.id}
              isBeingEdited={editingMsg?.id === m.id}
              isConfirmingDelete={confirmDeleteMsgId === m.id}
              onToggleMenu={() => {
                setActiveMsgId((prev) => (prev === m.id ? null : m.id));
                setConfirmDeleteMsgId(null);
              }}
              onStartEdit={() => handleStartEditMessage(m)}
              onRequestDelete={() => setConfirmDeleteMsgId(m.id)}
              onCancelDelete={() => setConfirmDeleteMsgId(null)}
              onConfirmDelete={() => handleDeleteMessage(m.id)}
            />
          ))}
          <div ref={bottomRef} />
        </div>

        {!editingMsg && (
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
        )}

        {editingMsg && (
          <div className="px-3.5 py-2 bg-pilis-soft/70 border-t border-[#DFD9CE] flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-pilis truncate">
              Szerkesztés: „{editingMsg.body}”
            </span>
            <button
              type="button"
              onClick={handleCancelEditMessage}
              className="shrink-0 font-bold text-[#5C6B62] hover:text-black px-2 py-0.5 rounded-lg bg-white border border-[#DFD9CE]"
            >
              Mégse
            </button>
          </div>
        )}

        {showEmojiPicker && (
          <ChatEmojiPicker
            onSelect={handlePickEmoji}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}

        <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-[#DFD9CE] flex items-center gap-2">
          <button
            type="button"
            aria-label="Hangulatjelek"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className={`shrink-0 w-10 h-10 rounded-full border flex items-center justify-center text-lg transition ${
              showEmojiPicker
                ? 'bg-pilis-soft border-pilis'
                : 'bg-limestone border-[#DFD9CE] hover:border-pilis'
            }`}
          >
            😊
          </button>
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setShowEmojiPicker(false)}
            placeholder={editingMsg ? 'Üzenet módosítása...' : 'Üzenet írása...'}
            className="flex-1 min-w-0 bg-limestone border border-[#DFD9CE] rounded-full px-4 py-2.5 text-base focus:outline-none focus:border-pilis"
          />
          <button type="submit" className="shrink-0 bg-pilis text-white font-bold text-sm px-4 sm:px-5 py-2.5 rounded-full">
            {editingMsg ? 'Mentés' : 'Küldés'}
          </button>
        </form>
      </div>
    </div>
  );
}
