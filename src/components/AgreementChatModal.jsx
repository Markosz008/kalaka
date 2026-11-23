import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { resolveCoordsFromText } from '../constants/szentendreData.js';
import { triggerAgreementPush } from '../lib/webPush.js';
import { estimateRideDetour, resolvePointCoords } from '../lib/detourCalc.js';
import ChatEmojiPicker from './ChatEmojiPicker.jsx';
import ChatMessageBubble from './ChatMessageBubble.jsx';
import AgreementStatusBar from './AgreementStatusBar.jsx';
import AgreementChatHeader from './AgreementChatHeader.jsx';
import { useAgreementSync } from '../hooks/useAgreementSync.js';

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
  const {
    messages,
    setMessages,
    liveAgr,
    setLiveAgr,
    gpsErrorMsg,
    setGpsErrorMsg,
    gpsActive,
    isLiveDbAgreement
  } = useAgreementSync(agreement, currentUser?.id);

  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorBanner, setErrorBanner] = useState(null);
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
  const inputRef = useRef(null);

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
    setEditingCar(false);
    setCarDraft(agreement?.car_info || '');
    setErrorBanner(null);
  }, [agreement?.id]);

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
        if (ownerIsHelper) {
          nextHelperAgreed = true;
        } else {
          nextReqAgreed = true;
          if (isRideAgreement) nextHelperAgreed = true;
        }
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
        ? isPostOwner && isRideAgreement && !ownerIsHelper
          ? `${currentUser?.display_name || 'Az utas'} elfogadta a fuvarajánlatot – a megállapodás rögzítve.`
          : `${currentUser?.display_name || 'A csatlakozó'} véglegesítette – a megállapodás rögzítve.`
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

  const handleProAccept = async () => {
    setBusy(true);
    try {
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
    } finally {
      setBusy(false);
    }
  };

  const handleProComplete = async () => {
    setBusy(true);
    try {
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
        .update({ status: 'cancelled', driver_lat: null, driver_lng: null })
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

  const showHeaderCancel =
    !isProInquiry &&
    ['chatting', 'agreed', 'started'].includes(status) &&
    !(status === 'chatting' && isPostOwner && !ownerConfirmed);

  const rideDepRaw = liveAgr.ride_departure_at || liveAgr.ride?.departure_at || null;
  const rideDepLabel = (() => {
    if (!rideDepRaw) return '';
    const d = new Date(rideDepRaw);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  })();

  const fullRouteLabel =
    liveAgr.ride_origin_text && liveAgr.ride_dest_text
      ? `${liveAgr.ride_origin_text} → ${liveAgr.ride_dest_text}`
      : liveAgr.title || '';

  const quickReplies = isProInquiry
    ? [
        'Szia! Mikor lenne szabad időpontod?',
        'Szentendrén belül kiszállással is vállalod?',
        'Köszönöm a gyors választ!'
      ]
    : isRideAgreement
    ? isHelper
      ? ['2 perc és érkezem.', 'Most indulok, nemsokára ott vagyok.', 'Hol találkozunk pontosan?']
      : ['Mikor indulsz kb.?', 'Ott leszek a megállóban.', 'Köszönöm a fuvart!']
    : ['Mikor lenne jó neked?', 'Megbeszéltük, köszi!', 'Köszönöm a segítséget!'];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-limestone w-full max-w-lg h-[100dvh] sm:h-[660px] rounded-none sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl border-0 sm:border sm:border-[#DFD9CE] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <AgreementChatHeader
          liveAgr={liveAgr}
          currentUser={currentUser}
          onInspectUser={onInspectUser}
          onClose={onClose}
          isRideAgreement={isRideAgreement}
          isHelper={isHelper}
          isProInquiry={isProInquiry}
          status={status}
          showHeaderCancel={showHeaderCancel}
          busy={busy}
          editingCar={editingCar}
          setEditingCar={setEditingCar}
          carDraft={carDraft}
          setCarDraft={setCarDraft}
          savingCar={savingCar}
          onSaveRideCar={handleSaveRideCar}
          onCancelAgreement={handleCancelAgreement}
          onReport={handleReport}
          errorBanner={errorBanner}
          showReportBox={showReportBox}
          setShowReportBox={setShowReportBox}
          reportReason={reportReason}
          setReportReason={setReportReason}
          onSubmitReport={handleSubmitReport}
        />

        <AgreementStatusBar
          isProInquiry={isProInquiry}
          isRideAgreement={isRideAgreement}
          liveAgr={liveAgr}
          status={status}
          isHelper={isHelper}
          isRequester={isRequester}
          isPostOwner={isPostOwner}
          ownerIsHelper={ownerIsHelper}
          ownerConfirmed={ownerConfirmed}
          joinerConfirmed={joinerConfirmed}
          fullRouteLabel={fullRouteLabel}
          rideDepLabel={rideDepLabel}
          etaSummary={etaSummary}
          gpsActive={gpsActive}
          busy={busy}
          sharingPassengerPin={sharingPassengerPin}
          kudosTag={kudosTag}
          onChangeKudosTag={setKudosTag}
          onProAccept={handleProAccept}
          onProComplete={handleProComplete}
          onCancelAgreement={handleCancelAgreement}
          onSequentialApproval={handleSequentialApproval}
          onUpdateStatus={handleUpdateStatus}
          onSharePassengerLocation={handleSharePassengerLocation}
          onGiveKudos={handleGiveKudos}
        />

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
