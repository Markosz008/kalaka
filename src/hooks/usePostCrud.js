import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { resolveCoordsFromText } from '../constants/szentendreData.js';
import { parseFavorTag } from '../components/FavorCard.jsx';
import { triggerNewRidePush } from '../lib/webPush.js';
import {
  geocodeAddressFallback,
  getNextQuarterHourHHMM,
  getPersonalRoutines,
  recordPersonalRoutine
} from '../lib/appStorage.js';

function computeRideTiming(timeStr, isRec, actualKind) {
  const [hh, mm] = (timeStr || '05:50').split(':').map(Number);
  const dep = new Date();
  dep.setHours(Number.isFinite(hh) ? hh : 5, Number.isFinite(mm) ? mm : 50, 0, 0);
  if (dep < new Date()) dep.setDate(dep.getDate() + 1);

  const exp = isRec
    ? new Date(Date.now() + 30 * 24 * 3600000)
    : actualKind === 'ask'
    ? new Date(dep.getTime() + 30 * 60000)
    : new Date(dep.getTime() + 45 * 60000);

  return { depIso: dep.toISOString(), expIso: exp.toISOString() };
}

async function insertRideWithFallback(payload) {
  const { data: insRide, error } = await supabase
    .from('rides')
    .insert(payload)
    .select('id')
    .single();
  if (!error) return { id: insRide?.id || null, error: null };

  const { origin_lat, origin_lng, dest_lat, dest_lng, ...basicPayload } = payload;
  const { data: retryRide, error: retryErr } = await supabase
    .from('rides')
    .insert(basicPayload)
    .select('id')
    .single();
  if (retryErr) return { id: null, error: retryErr };
  return { id: retryRide?.id || null, error: null };
}

export function usePostCrud({
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
}) {
  const [inlineComposerMode, setInlineComposerMode] = useState(null);
  const [inlineTime, setInlineTime] = useState(() => getNextQuarterHourHHMM());
  const [inlineSchedule, setInlineSchedule] = useState('Munkanapokon (H–P)');
  const [inlineSeats, setInlineSeats] = useState(3);
  const [inlineNote, setInlineNote] = useState('');
  const [inlineCarInfo, setInlineCarInfo] = useState('');
  const [inlineSaving, setInlineSaving] = useState(false);

  const [showNewModal, setShowNewModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
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

  const handlePublishInlineRide = async (e) => {
    e.preventDefault();
    if (!filterFrom.trim() || !filterTo.trim()) return;
    if (!session?.user) {
      setShowAuthModal(true);
      return;
    }

    setInlineSaving(true);
    try {
      const isRec = inlineComposerMode === 'recurring';
      const dbKind = inlineComposerMode === 'ask' ? 'ask' : 'offer';
      const { depIso, expIso } = computeRideTiming(inlineTime, isRec, dbKind);

      const startPt = fromCoords || resolveCoordsFromText(filterFrom) || (await geocodeAddressFallback(filterFrom));
      const endPt = toCoords || resolveCoordsFromText(filterTo) || (await geocodeAddressFallback(filterTo));
      const chosenCar =
        dbKind === 'offer' ? inlineCarInfo.trim() || profile?.car_info || null : null;

      const payload = {
        user_id: session.user.id,
        kind: dbKind,
        origin_text: filterFrom.trim(),
        dest_text: filterTo.trim(),
        departure_at: depIso,
        expires_at: expIso,
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

      const { id: insertedRideId, error } = await insertRideWithFallback(payload);
      if (error) throw error;
      if (insertedRideId) triggerNewRidePush(supabase, insertedRideId);

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
      maybeOpenJitPushPrompt(
        'Szóljunk, ha jelentkezik valaki az utadra?',
        'Csak a saját üzeneteidről és fuvar-visszaigazolásokról küldünk jelzést. Városi hírekkel nem zavarunk, amíg külön nem kéred.'
      );
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
      const rawClean = newFrom.replace(/^\[(Felajánlás\vert{}Kérés)\]\s*/i, '').trim();
      if (!rawClean) return;

      const prefix = newFavorMode === 'offer' ? '[Felajánlás] ' : '[Kérés] ';
      const favPayload = {
        title: `${prefix}${rawClean}`,
        description: newNote.trim(),
        zone: profile.zone || 'Pismány',
        min_favor_hearts: Number(newMinHearts) || 0,
        expires_at: expIso
      };

      const { error } = editingItemId
        ? await supabase.from('favors').update(favPayload).eq('id', editingItemId)
        : await supabase.from('favors').insert({ ...favPayload, user_id: session.user.id });
      if (error) {
        showNotice(`${editingItemId ? 'Szerkesztési' : 'Mentési'} hiba: ${error.message}`, 'err');
        return;
      }
      setActiveTab('favors');
    } else {
      if (!newFrom.trim() || !newTo.trim()) return;
      const isRec = newKind === 'recurring';
      const actualKind = isRec ? 'offer' : newKind;
      const { depIso, expIso } = computeRideTiming(newTime, isRec, actualKind);

      const startPt = newFromCoords || resolveCoordsFromText(newFrom);
      const endPt = newToCoords || resolveCoordsFromText(newTo);
      const ridePayload = {
        kind: actualKind,
        origin_text: newFrom.trim(),
        dest_text: newTo.trim(),
        departure_at: depIso,
        expires_at: expIso,
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
        const { error } = await supabase.from('rides').update(ridePayload).eq('id', editingItemId);
        if (error) {
          const { origin_lat, origin_lng, dest_lat, dest_lng, ...basic } = ridePayload;
          const { error: retryErr } = await supabase.from('rides').update(basic).eq('id', editingItemId);
          if (retryErr) {
            showNotice(`Szerkesztési hiba: ${retryErr.message}`, 'err');
            return;
          }
        }
      } else {
        const { id: insertedRideId, error } = await insertRideWithFallback({
          ...ridePayload,
          user_id: session.user.id
        });
        if (error) {
          showNotice(`Mentési hiba: ${error.message}`, 'err');
          return;
        }
        if (insertedRideId) triggerNewRidePush(supabase, insertedRideId);
      }

      recordPersonalRoutine(session.user.id, newFrom.trim(), newTo.trim(), startPt, endPt);
      setPersonalRoutines(getPersonalRoutines(session.user.id));
      setActiveTab('rides');
    }

    const wasEditing = Boolean(editingItemId);
    setShowNewModal(false);
    setEditingItemId(null);
    setNewFrom('');
    setNewTo('');
    setNewNote('');
    showNotice(wasEditing ? 'Módosítások mentve ✓' : 'Közzétéve ✓');
    fetchAllLiveData(session.user.id);
    if (!wasEditing) {
      maybeOpenJitPushPrompt(
        newKind === 'favor'
          ? 'Szóljunk, ha jelentkezik egy szomszéd?'
          : 'Szóljunk, ha jelentkezik valaki az utadra?',
        'Csak a saját üzeneteidről és visszaigazolásokról kapsz jelzést — a Városi Radart külön kapcsolhatod be.'
      );
    }
  };

  return {
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
  };
}
