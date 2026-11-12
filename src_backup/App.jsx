import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { SZENTENDRE_ZONES, reverseGeocodePoint } from './constants/szentendreData';
import HeaderRoadBar from './components/HeaderRoadBar';
import AddressAutocompleteInput from './components/AddressAutocompleteInput';
import InteractiveRouteMap from './components/InteractiveRouteMap';
import RideCard from './components/RideCard';
import FavorCard from './components/FavorCard';
import ProsDirectoryView from './components/ProsDirectoryView';
import AgreementChatModal from './components/AgreementChatModal';
import AuthModal from './components/AuthModal';
import ProfileModal from './components/ProfileModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('rides');
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [rides, setRides] = useState([]);
  const [favors, setFavors] = useState([]);
  const [pros, setPros] = useState([]);
  const [transitStops, setTransitStops] = useState([]);
  const [myAgreements, setMyAgreements] = useState([]);
  const [latestAlert, setLatestAlert] = useState(null);
  const [activeAgreement, setActiveAgreement] = useState(null);
  const [endorsedIds, setEndorsedIds] = useState([]);

  const [rideDirection, setRideDirection] = useState('all');
  const [showBrowseMap, setShowBrowseMap] = useState(false);
  const [showRideForm, setShowRideForm] = useState(true);
  const [editingRideId, setEditingRideId] = useState(null);

  const [rideKind, setRideKind] = useState('offer');
  const [originPlace, setOriginPlace] = useState({ label: '', lat: null, lng: null });
  const [destPlace, setDestPlace] = useState({ label: '', lat: null, lng: null });
  const [departureTime, setDepartureTime] = useState('07:30');
  const [seats, setSeats] = useState(2);
  const [rideNote, setRideNote] = useState('');
  const [validityHours, setValidityHours] = useState(4);
  const [activePin, setActivePin] = useState('origin');
  const [showPickerMap, setShowPickerMap] = useState(true);

  const [showFavorForm, setShowFavorForm] = useState(false);
  const [editingFavorId, setEditingFavorId] = useState(null);
  const [favorTitle, setFavorTitle] = useState('');
  const [favorDesc, setFavorDesc] = useState('');
  const [favorZone, setFavorZone] = useState(SZENTENDRE_ZONES[0].name);
  const [minFavorHearts, setMinFavorHearts] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data?.session?.user || null;
      setCurrentUser(user);
      if (user) {
        fetchProfile(user.id);
        loadEndorsedFromStorage(user.id);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user || null;
      setCurrentUser(user);
      if (user) {
        fetchProfile(user.id);
        loadEndorsedFromStorage(user.id);
      } else {
        setUserProfile(null);
        setEndorsedIds([]);
      }
    });

    loadAllData();

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const loadEndorsedFromStorage = (userId) => {
    try {
      const raw = localStorage.getItem(`kalaka_endorsed_${userId}`);
      if (raw) setEndorsedIds(JSON.parse(raw));
      else setEndorsedIds([]);
    } catch {
      setEndorsedIds([]);
    }
  };

  const saveEndorsedToStorage = (userId, nextList) => {
    setEndorsedIds(nextList);
    try {
      localStorage.setItem(`kalaka_endorsed_${userId}`, JSON.stringify(nextList));
    } catch {
      // ignore storage errors
    }
  };

  const fetchProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (data) {
      setUserProfile(data);
      if (data.zone) {
        setFavorZone(data.zone);
        const foundZone = SZENTENDRE_ZONES.find(
          (z) => z.name.toLowerCase() === data.zone.toLowerCase()
        );
        setOriginPlace((prev) => {
          if (prev.label) return prev;
          return foundZone
            ? { label: `Szentendre, ${foundZone.name}`, lat: foundZone.lat, lng: foundZone.lng }
            : { label: `Szentendre, ${data.zone}`, lat: 47.6694, lng: 19.0756 };
        });
      }
    }

    const { data: agrs } = await supabase
      .from('agreements')
      .select('*')
      .or(`requester_id.eq.${userId},helper_id.eq.${userId}`)
      .order('started_at', { ascending: false });
    if (agrs) setMyAgreements(agrs);
  };

  const loadAllData = async () => {
    const nowIso = new Date().toISOString();

    const [ridesRes, favorsRes, prosRes, alertRes, stopsRes] = await Promise.all([
      supabase
        .from('rides')
        .select('*, profiles(display_name, zone, ride_hearts)')
        .eq('status', 'open')
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false }),
      supabase
        .from('favors')
        .select('*, profiles(display_name, zone, favor_hearts)')
        .eq('status', 'open')
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false }),
      supabase
        .from('local_pros')
        .select('*')
        .eq('is_active', true)
        .order('endorsement_count', { ascending: false }),
      supabase
        .from('road_alerts')
        .select('*')
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('transit_stops').select('*').order('stop_order', { ascending: true })
    ]);

    if (ridesRes.data) setRides(ridesRes.data);
    if (favorsRes.data) setFavors(favorsRes.data);
    if (prosRes.data) setPros(prosRes.data);
    if (stopsRes.data) setTransitStops(stopsRes.data);
    setLatestAlert(alertRes.data || null);
  };

  const defaultUserOrigin = useMemo(() => {
    if (!userProfile?.zone) return { label: '', lat: null, lng: null };
    const found = SZENTENDRE_ZONES.find(
      (z) => z.name.toLowerCase() === userProfile.zone.toLowerCase()
    );
    return found
      ? { label: `Szentendre, ${found.name}`, lat: found.lat, lng: found.lng }
      : { label: `Szentendre, ${userProfile.zone}`, lat: 47.6694, lng: 19.0756 };
  }, [userProfile]);

  const handleReportAlert = async (statusLevel, message) => {
    if (!currentUser) {
      setAuthOpen(true);
      return;
    }
    const expiresAt = new Date(Date.now() + 90 * 60000).toISOString();
    await supabase.from('road_alerts').insert({
      reporter_id: currentUser.id,
      status_level: statusLevel,
      message,
      expires_at: expiresAt
    });
    loadAllData();
  };

  const resetRideForm = () => {
    setEditingRideId(null);
    setOriginPlace(defaultUserOrigin);
    setDestPlace({ label: '', lat: null, lng: null });
    setRideNote('');
    setSeats(2);
    setDepartureTime('07:30');
  };

  const handleSwapEndpoints = () => {
    const temp = { ...originPlace };
    setOriginPlace({ ...destPlace });
    setDestPlace(temp);
  };

  const handlePickMapPoint = async (which, lat, lng) => {
    const fallbackLabel =
      which === 'origin' ? 'Kijelölt indulási pont' : 'Kijelölt érkezési pont';
    if (which === 'origin') {
      setOriginPlace({ label: fallbackLabel, lat, lng });
      setActivePin('dest');
    } else {
      setDestPlace({ label: fallbackLabel, lat, lng });
    }

    const resolvedName = await reverseGeocodePoint(lat, lng);
    if (resolvedName) {
      if (which === 'origin') {
        setOriginPlace({ label: resolvedName, lat, lng });
      } else {
        setDestPlace({ label: resolvedName, lat, lng });
      }
    }
  };

  const handleSaveRide = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      setAuthOpen(true);
      return;
    }
    if (!originPlace.label.trim() || !destPlace.label.trim()) return;

    const [hh, mm] = departureTime.split(':').map(Number);
    const depDate = new Date();
    depDate.setHours(hh || 7, mm || 30, 0, 0);

    const expiresAt = new Date(Date.now() + Number(validityHours) * 3600000).toISOString();

    const payload = {
      kind: rideKind,
      origin_text: originPlace.label.trim(),
      dest_text: destPlace.label.trim(),
      origin_lat: originPlace.lat,
      origin_lng: originPlace.lng,
      dest_lat: destPlace.lat,
      dest_lng: destPlace.lng,
      schedule_label: departureTime,
      departure_at: depDate.toISOString(),
      seats: rideKind === 'offer' ? Number(seats) : 1,
      note: rideNote.trim() || null,
      status: 'open',
      expires_at: expiresAt
    };

    if (editingRideId) {
      await supabase
        .from('rides')
        .update(payload)
        .eq('id', editingRideId)
        .eq('user_id', currentUser.id);
    } else {
      await supabase.from('rides').insert({
        user_id: currentUser.id,
        ...payload
      });
    }

    resetRideForm();
    setShowRideForm(false);
    loadAllData();
  };

  const handleStartEditRide = (ride) => {
    setEditingRideId(ride.id);
    setRideKind(ride.kind || 'offer');
    setOriginPlace({
      label: ride.origin_text || '',
      lat: ride.origin_lat || null,
      lng: ride.origin_lng || null
    });
    setDestPlace({
      label: ride.dest_text || '',
      lat: ride.dest_lat || null,
      lng: ride.dest_lng || null
    });
    setDepartureTime(
      ride.schedule_label ||
        (ride.departure_at
          ? new Date(ride.departure_at).toLocaleTimeString('hu-HU', {
              hour: '2-digit',
              minute: '2-digit'
            })
          : '07:30')
    );
    setSeats(ride.seats || 2);
    setRideNote(ride.note || '');
    setShowRideForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteRide = async (rideId) => {
    if (!currentUser) return;
    setRides((prev) => prev.filter((r) => r.id !== rideId));

    const { error: delError } = await supabase
      .from('rides')
      .delete()
      .eq('id', rideId)
      .eq('user_id', currentUser.id);

    if (delError) {
      const pastIso = new Date(Date.now() - 60000).toISOString();
      await supabase
        .from('rides')
        .update({ expires_at: pastIso })
        .eq('id', rideId)
        .eq('user_id', currentUser.id);
    }
    loadAllData();
  };

  const handleSaveFavor = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      setAuthOpen(true);
      return;
    }
    if (!favorTitle.trim()) return;

    const expiresAt = new Date(Date.now() + 72 * 3600000).toISOString();
    const payload = {
      title: favorTitle.trim(),
      description: favorDesc.trim() || null,
      zone: favorZone,
      min_favor_hearts: Number(minFavorHearts) || 0,
      status: 'open',
      expires_at: expiresAt
    };

    if (editingFavorId) {
      await supabase
        .from('favors')
        .update(payload)
        .eq('id', editingFavorId)
        .eq('user_id', currentUser.id);
    } else {
      await supabase.from('favors').insert({
        user_id: currentUser.id,
        ...payload
      });
    }

    setEditingFavorId(null);
    setShowFavorForm(false);
    setFavorTitle('');
    setFavorDesc('');
    setMinFavorHearts(0);
    loadAllData();
  };

  const handleStartEditFavor = (favor) => {
    setEditingFavorId(favor.id);
    setFavorTitle(favor.title || '');
    setFavorDesc(favor.description || '');
    setFavorZone(favor.zone || userProfile?.zone || SZENTENDRE_ZONES[0].name);
    setMinFavorHearts(favor.min_favor_hearts || 0);
    setShowFavorForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteFavor = async (favorId) => {
    if (!currentUser) return;
    setFavors((prev) => prev.filter((f) => f.id !== favorId));

    const { error: delError } = await supabase
      .from('favors')
      .delete()
      .eq('id', favorId)
      .eq('user_id', currentUser.id);

    if (delError) {
      const pastIso = new Date(Date.now() - 60000).toISOString();
      await supabase
        .from('favors')
        .update({ expires_at: pastIso })
        .eq('id', favorId)
        .eq('user_id', currentUser.id);
    }
    loadAllData();
  };

  const handleConnectRide = async (ride) => {
    if (!currentUser) {
      setAuthOpen(true);
      return;
    }
    const requesterId = ride.kind === 'offer' ? currentUser.id : ride.user_id;
    const helperId = ride.kind === 'offer' ? ride.user_id : currentUser.id;

    const { data: existing } = await supabase
      .from('agreements')
      .select('*')
      .eq('ride_id', ride.id)
      .eq('requester_id', requesterId)
      .eq('helper_id', helperId)
      .maybeSingle();

    if (existing) {
      setActiveAgreement(existing);
      return;
    }

    const { data: created } = await supabase
      .from('agreements')
      .insert({
        ride_id: ride.id,
        requester_id: requesterId,
        helper_id: helperId,
        status: 'chatting'
      })
      .select('*')
      .single();

    if (created) {
      setActiveAgreement(created);
      fetchProfile(currentUser.id);
    }
  };

  const handleConnectFavor = async (favor) => {
    if (!currentUser) {
      setAuthOpen(true);
      return;
    }
    const requesterId = currentUser.id;
    const helperId = favor.user_id;

    const { data: existing } = await supabase
      .from('agreements')
      .select('*')
      .eq('favor_id', favor.id)
      .eq('requester_id', requesterId)
      .eq('helper_id', helperId)
      .maybeSingle();

    if (existing) {
      setActiveAgreement(existing);
      return;
    }

    const { data: created } = await supabase
      .from('agreements')
      .insert({
        favor_id: favor.id,
        requester_id: requesterId,
        helper_id: helperId,
        status: 'chatting'
      })
      .select('*')
      .single();

    if (created) {
      setActiveAgreement(created);
      fetchProfile(currentUser.id);
    }
  };

  const handleAgreementStatus = async (agreementId, nextStatus) => {
    const { data } = await supabase
      .from('agreements')
      .update({ status: nextStatus })
      .eq('id', agreementId)
      .select('*')
      .single();
    if (data) {
      setActiveAgreement(data);
      if (currentUser) fetchProfile(currentUser.id);
    }
  };

  const handleSendKudos = async (agreement) => {
    const kudosType = agreement.ride_id ? 'ride' : 'favor';
    const { error } = await supabase.from('kudos').insert({
      agreement_id: agreement.id,
      giver_id: currentUser.id,
      receiver_id: agreement.helper_id,
      kudos_type: kudosType
    });
    if (!error) {
      loadAllData();
      if (currentUser) fetchProfile(currentUser.id);
      return true;
    }
    return false;
  };

  const handleSavePro = async (payload, editingId = null) => {
    if (!currentUser) {
      setAuthOpen(true);
      return 'Kérjük, jelentkezz be.';
    }
    if (editingId) {
      const { error } = await supabase
        .from('local_pros')
        .update(payload)
        .eq('id', editingId)
        .eq('owner_id', currentUser.id);
      if (error) return error.message;
    } else {
      const { error } = await supabase.from('local_pros').insert({
        owner_id: currentUser.id,
        ...payload
      });
      if (error) return error.message;
    }
    loadAllData();
    return null;
  };

  const handleDeletePro = async (proId) => {
    if (!currentUser) return;
    setPros((prev) => prev.filter((p) => p.id !== proId));
    const { error } = await supabase
      .from('local_pros')
      .delete()
      .eq('id', proId)
      .eq('owner_id', currentUser.id);
    if (error) {
      await supabase
        .from('local_pros')
        .update({ is_active: false })
        .eq('id', proId)
        .eq('owner_id', currentUser.id);
    }
    loadAllData();
  };

  const handleToggleEndorsePro = async (pro) => {
    if (!currentUser) {
      setAuthOpen(true);
      return;
    }
    if (pro.owner_id === currentUser.id) return;

    const alreadyEndorsed = endorsedIds.includes(pro.id);
    const nextCount = alreadyEndorsed
      ? Math.max(0, (pro.endorsement_count || 1) - 1)
      : (pro.endorsement_count || 0) + 1;

    const nextEndorsedIds = alreadyEndorsed
      ? endorsedIds.filter((id) => id !== pro.id)
      : [...endorsedIds, pro.id];

    saveEndorsedToStorage(currentUser.id, nextEndorsedIds);
    setPros((prev) =>
      prev.map((item) =>
        item.id === pro.id ? { ...item, endorsement_count: nextCount } : item
      )
    );

    await supabase
      .from('local_pros')
      .update({ endorsement_count: nextCount })
      .eq('id', pro.id);

    loadAllData();
  };

  const handleUpdateZoneToday = async (proId, zoneName) => {
    await supabase.from('local_pros').update({ active_zone_today: zoneName }).eq('id', proId);
    loadAllData();
  };

  const filteredRides = rides.filter((r) => {
    if (rideDirection === 'all') return true;
    const destLower = (r.dest_text || '').toLowerCase();
    const origLower = (r.origin_text || '').toLowerCase();
    const isToBp =
      destLower.includes('budapest') ||
      destLower.includes('árpád') ||
      destLower.includes('margit') ||
      destLower.includes('békásmegyer') ||
      destLower.includes('csillaghegy') ||
      destLower.includes('flórián');
    const isFromBp =
      origLower.includes('budapest') ||
      origLower.includes('árpád') ||
      origLower.includes('margit') ||
      origLower.includes('békásmegyer') ||
      origLower.includes('csillaghegy') ||
      origLower.includes('flórián');

    if (rideDirection === 'to_bp') return isToBp;
    if (rideDirection === 'from_bp') return isFromBp;
    return !isToBp && !isFromBp;
  });

  return (
    <div className="min-h-screen bg-limestone text-stone-900 flex flex-col">
      <HeaderRoadBar
        latestAlert={latestAlert}
        onReportAlert={handleReportAlert}
        currentUser={currentUser}
      />

      <header className="bg-pilis text-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">Kaláka • Szentendre</h1>
            <p className="text-xs text-pilis-soft/90">Szomszédsági fuvarmegosztás, segítség és helyi szakemberek</p>
          </div>

          {currentUser ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                className="text-right px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition cursor-pointer"
                title="Profil és beállítások megnyitása"
              >
                <div className="text-xs font-bold flex items-center justify-end gap-1.5">
                  <span>{userProfile?.display_name || currentUser.email.split('@')[0]}</span>
                  <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">Profil</span>
                </div>
                <div className="text-[11px] text-pilis-soft">
                  {userProfile?.zone || 'Szentendre'} • ♥ {userProfile?.ride_hearts || 0} • 🤝 {userProfile?.favor_hearts || 0}
                </div>
              </button>
              <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                className="px-3 py-2 rounded-xl text-xs font-medium bg-white/15 hover:bg-white/25 transition"
              >
                Kilépés
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white text-pilis hover:bg-pilis-soft transition"
            >
              Belépés
            </button>
          )}
        </div>

        <div className="max-w-3xl mx-auto px-4 flex gap-1 pt-1 overflow-x-auto">
          {[
            { id: 'rides', label: 'Fuvarok' },
            { id: 'favors', label: 'Kaláka és Szerszám' },
            { id: 'pros', label: 'Szakemberek és Szolgáltatók' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold shrink-0 transition ${
                activeTab === tab.id
                  ? 'bg-limestone text-pilis'
                  : 'text-pilis-soft hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-3xl w-full mx-auto px-4 py-5 flex-1 space-y-4">
        {activeTab === 'rides' && (
          <>
            <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex rounded-xl bg-stone-100 p-1 flex-wrap">
                  {[
                    { id: 'all', label: 'Összes' },
                    { id: 'to_bp', label: 'Budapest felé' },
                    { id: 'from_bp', label: 'Szentendre felé' },
                    { id: 'local', label: 'Városon belül' }
                  ].map((dir) => (
                    <button
                      key={dir.id}
                      type="button"
                      onClick={() => setRideDirection(dir.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                        rideDirection === dir.id ? 'bg-white text-pilis shadow-sm' : 'text-stone-600'
                      }`}
                    >
                      {dir.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBrowseMap(!showBrowseMap)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold border border-stone-300 text-stone-700 hover:bg-stone-100 transition"
                  >
                    {showBrowseMap ? 'Fuvar-térkép elrejtése' : 'Aktív fuvarok térképen'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (showRideForm) {
                        resetRideForm();
                        setShowRideForm(false);
                      } else {
                        resetRideForm();
                        setShowRideForm(true);
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-pilis text-white hover:bg-pilis-light transition"
                  >
                    {showRideForm ? 'Űrlap elrejtése' : '+ Fuvar feladása'}
                  </button>
                </div>
              </div>

              {showBrowseMap && (
                <InteractiveRouteMap
                  mode="browse"
                  rides={filteredRides}
                  onSelectRide={handleConnectRide}
                />
              )}
            </div>

            {showRideForm && (
              <form
                onSubmit={handleSaveRide}
                className="bg-white rounded-2xl border-2 border-pilis/20 p-4 shadow-sm space-y-3.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-stone-900">
                    {editingRideId ? 'Fuvar adatainak módosítása' : 'Új fuvar megosztása vagy kérése'}
                  </h3>
                  <div className="inline-flex rounded-xl bg-stone-100 p-1 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setRideKind('offer')}
                      className={`px-3 py-1 rounded-lg transition ${
                        rideKind === 'offer' ? 'bg-pilis text-white' : 'text-stone-600'
                      }`}
                    >
                      Autóval megyek
                    </button>
                    <button
                      type="button"
                      onClick={() => setRideKind('ask')}
                      className={`px-3 py-1 rounded-lg transition ${
                        rideKind === 'ask' ? 'bg-terracotta text-white' : 'text-stone-600'
                      }`}
                    >
                      Fuvart keresek
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-end gap-2">
                  <AddressAutocompleteInput
                    label="Honnan indulsz?"
                    placeholder="Kattints a listához vagy írd be az utcát..."
                    value={originPlace.label}
                    onSelect={setOriginPlace}
                    transitStops={transitStops}
                  />

                  <button
                    type="button"
                    onClick={handleSwapEndpoints}
                    className="self-center sm:mb-1 px-2.5 py-2 rounded-xl border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-100 transition"
                    title="Indulás és érkezés felcserélése"
                  >
                    ⇅
                  </button>

                  <AddressAutocompleteInput
                    label="Hová érkezel?"
                    placeholder="Kattints a listához vagy írd be az úti célt..."
                    value={destPlace.label}
                    onSelect={setDestPlace}
                    transitStops={transitStops}
                  />
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-stone-600 font-medium">Térképes kijelölés:</span>
                      <button
                        type="button"
                        onClick={() => setActivePin('origin')}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                          activePin === 'origin' ? 'bg-pilis text-white' : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        1. Indulás pontja
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivePin('dest')}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                          activePin === 'dest' ? 'bg-terracotta text-white' : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        2. Érkezés pontja
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowPickerMap(!showPickerMap)}
                      className="text-xs font-medium text-pilis hover:underline"
                    >
                      {showPickerMap ? 'Térkép elrejtése' : 'Térkép megjelenítése'}
                    </button>
                  </div>

                  {showPickerMap && (
                    <InteractiveRouteMap
                      mode="picker"
                      originPoint={originPlace}
                      destPoint={destPlace}
                      activePin={activePin}
                      onPickPoint={handlePickMapPoint}
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Indulás ideje</label>
                    <input
                      type="time"
                      value={departureTime}
                      onChange={(e) => setDepartureTime(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300"
                      required
                    />
                  </div>

                  {rideKind === 'offer' && (
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">Szabad helyek száma</label>
                      <select
                        value={seats}
                        onChange={(e) => setSeats(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 bg-white"
                      >
                        {[1, 2, 3, 4].map((n) => (
                          <option key={n} value={n}>
                            {n} szabad hely
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Érvényesség</label>
                    <select
                      value={validityHours}
                      onChange={(e) => setValidityHours(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 bg-white"
                    >
                      <option value={2}>2 órán át</option>
                      <option value={4}>4 órán át</option>
                      <option value={12}>Ma estig</option>
                      <option value={24}>Holnapig</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Megjegyzés (opcionális)</label>
                  <input
                    type="text"
                    value={rideNote}
                    onChange={(e) => setRideNote(e.target.value)}
                    placeholder="Pl. A Cseresznyés úton tudok megállni, babakocsi is befér..."
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  {editingRideId && (
                    <button
                      type="button"
                      onClick={() => {
                        resetRideForm();
                        setShowRideForm(false);
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-100"
                    >
                      Mégse
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-pilis text-white hover:bg-pilis-light"
                  >
                    {editingRideId ? 'Módosítások mentése' : 'Fuvar közzététele'}
                  </button>
                </div>
              </form>
            )}

            {filteredRides.length === 0 ? (
              <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-sm text-stone-500">
                Jelenleg nincs aktív fuvar ebben az irányban.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredRides.map((ride) => (
                  <RideCard
                    key={ride.id}
                    ride={ride}
                    currentUser={currentUser}
                    onConnect={handleConnectRide}
                    onEdit={handleStartEditRide}
                    onDelete={handleDeleteRide}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'favors' && (
          <>
            <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-stone-900">Szomszédsági segítség és szerszámkölcsönzés</h2>
                <p className="text-xs text-stone-600">
                  Kérj vagy ajánlj fel szerszámot, létrát, kerti gépet vagy gyors segítséget a környéken
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (showFavorForm) {
                    setEditingFavorId(null);
                    setShowFavorForm(false);
                  } else {
                    setEditingFavorId(null);
                    setFavorTitle('');
                    setFavorDesc('');
                    setFavorZone(userProfile?.zone || SZENTENDRE_ZONES[0].name);
                    setMinFavorHearts(0);
                    setShowFavorForm(true);
                  }
                }}
                className="shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold bg-pilis text-white hover:bg-pilis-light transition"
              >
                {showFavorForm ? 'Bezárás' : '+ Új bejegyzés'}
              </button>
            </div>

            {showFavorForm && (
              <form
                onSubmit={handleSaveFavor}
                className="bg-white rounded-2xl border-2 border-pilis/20 p-4 shadow-sm space-y-3"
              >
                <h3 className="text-sm font-bold text-stone-900">
                  {editingFavorId ? 'Bejegyzés módosítása' : 'Új kaláka vagy szerszám bejegyzés'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Miben kérsz vagy ajánlasz segítséget?</label>
                    <input
                      type="text"
                      value={favorTitle}
                      onChange={(e) => setFavorTitle(e.target.value)}
                      placeholder="Pl. Magasnyomású mosó kölcsönbe / Segítség bútor mozgatásban"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Városrész</label>
                    <select
                      value={favorZone}
                      onChange={(e) => setFavorZone(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 bg-white"
                    >
                      {SZENTENDRE_ZONES.map((z) => (
                        <option key={z.id} value={z.name}>
                          {z.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Részletek (opcionális)</label>
                  <textarea
                    rows={2}
                    value={favorDesc}
                    onChange={(e) => setFavorDesc(e.target.value)}
                    placeholder="Mikorra lenne rá szükség, vagy milyen feltétellel adod kölcsön..."
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Kölcsönzés feltétele (értékesebb eszköz esetén)
                  </label>
                  <select
                    value={minFavorHearts}
                    onChange={(e) => setMinFavorHearts(e.target.value)}
                    className="w-full sm:w-72 px-3 py-2 text-sm rounded-xl border border-stone-300 bg-white"
                  >
                    <option value={0}>Bárki jelentkezhet a közösségből</option>
                    <option value={1}>Legalább 1 korábbi közösségi segítség</option>
                    <option value={3}>Legalább 3 korábbi közösségi segítség</option>
                    <option value={5}>Legalább 5 korábbi közösségi segítség</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingFavorId(null);
                      setShowFavorForm(false);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-100"
                  >
                    Mégse
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-pilis text-white hover:bg-pilis-light"
                  >
                    {editingFavorId ? 'Módosítások mentése' : 'Közzététel'}
                  </button>
                </div>
              </form>
            )}

            {favors.length === 0 ? (
              <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-sm text-stone-500">
                Még nincs aktív kaláka bejegyzés.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {favors.map((favor) => (
                  <FavorCard
                    key={favor.id}
                    favor={favor}
                    currentUser={currentUser}
                    userProfile={userProfile}
                    onConnect={handleConnectFavor}
                    onEdit={handleStartEditFavor}
                    onDelete={handleDeleteFavor}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'pros' && (
          <ProsDirectoryView
            pros={pros}
            currentUser={currentUser}
            endorsedIds={endorsedIds}
            onSavePro={handleSavePro}
            onDeletePro={handleDeletePro}
            onToggleEndorsePro={handleToggleEndorsePro}
            onUpdateZoneToday={handleUpdateZoneToday}
          />
        )}
      </main>

      <AgreementChatModal
        agreement={activeAgreement}
        currentUser={currentUser}
        onClose={() => setActiveAgreement(null)}
        onStatusChange={handleAgreementStatus}
        onSendKudos={handleSendKudos}
      />

      <ProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        currentUser={currentUser}
        userProfile={userProfile}
        myAgreements={myAgreements}
        onOpenAgreement={(agr) => setActiveAgreement(agr)}
        onProfileUpdated={() => currentUser && fetchProfile(currentUser.id)}
      />

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={loadAllData}
      />
    </div>
  );
}
