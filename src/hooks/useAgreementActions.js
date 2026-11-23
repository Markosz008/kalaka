import { supabase } from '../lib/supabase.js';
import { triggerAgreementPush } from '../lib/webPush.js';
import {
  formatAgreementRideTitle,
  markAgreementReadStorage
} from '../lib/appStorage.js';

export function useAgreementActions({
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
}) {
  const handleOpenAgreement = (agr) => {
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
    const stopLabel = selectedStop
      ? [selectedStop.time, selectedStop.name].filter(Boolean).join(' ').trim()
      : null;

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
        ride_origin_text: ride.origin_text || null,
        ride_dest_text: ride.dest_text || null,
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

    const initialRideMsg =
      ride.kind === 'ask'
        ? 'Szia! Szívesen elviszlek erre az útra.'
        : stopLabel
        ? selectedStop?.detourLabel
          ? `Szia! Felszállnék itt: ${stopLabel} (${selectedStop.detourLabel}).`
          : `Szia! Felszállnék itt: ${stopLabel}.`
        : 'Szia! Csatlakoznék az úthoz.';

    await supabase.from('messages').insert({
      agreement_id: createdAgr.id,
      sender_id: session.user.id,
      body: initialRideMsg
    });

    triggerAgreementPush(
      supabase,
      createdAgr.id,
      ride.kind === 'ask' ? 'Új fuvarajánlat érkezett' : 'Valaki csatlakozna a fuvarodhoz',
      initialRideMsg
    );

    const resolvedCar = ride.car_info || (ride.kind === 'ask' ? profile?.car_info || null : null);
    handleOpenAgreement({
      ...createdAgr,
      post_owner_id: ride.user_id,
      car_info: resolvedCar,
      ride_origin_text: ride.origin_text || null,
      ride_dest_text: ride.dest_text || null,
      ride_departure_at: ride.departure_at || null,
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

    const initialFavorMsg = `Szia! Érdekelne: ${favor.title}`;
    await supabase.from('messages').insert({
      agreement_id: createdAgr.id,
      sender_id: session.user.id,
      body: initialFavorMsg
    });

    triggerAgreementPush(
      supabase,
      createdAgr.id,
      'Új jelentkező a Kalákádra',
      initialFavorMsg
    );

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

  return {
    handleOpenAgreement,
    handleStartRideAgreement,
    handleStartFavorAgreement,
    handleStartProAgreement,
    handleHideCompletedAgreement
  };
}
