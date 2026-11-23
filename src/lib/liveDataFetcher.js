import { supabase } from './supabase.js';
import { computeStopsAlongRoute } from './routing.js';
import {
  formatAgreementRideTitle,
  getReadTimestamps,
  formatDayLabelFromIso
} from './appStorage.js';

export const DEFAULT_PROFILE = {
  id: 'guest-user',
  display_name: '',
  zone: 'Pismány',
  ride_hearts: 0,
  favor_hearts: 0
};

export function createDefaultRoadAlert() {
  return {
    id: 'default-ok',
    category: 'traffic',
    zone: 'Szentendre',
    status_level: 'ok',
    message: 'Folyamatos haladás a 11-es úton • Hegyi utak tiszták',
    author_name: 'Közösségi útinfó',
    confirm_count: 0,
    clear_count: 0,
    updates: [],
    created_at: new Date().toISOString()
  };
}

export async function fetchLiveSnapshot(currentUserId) {
  if (!supabase) return null;
  const nowIso = new Date().toISOString();

  const [
    { data: rideRows },
    { data: favorRows },
    { data: allProfs },
    { data: allKudosRows },
    { data: proRows },
    { data: alertRows }
  ] = await Promise.all([
    supabase
      .from('rides')
      .select('*, author:profiles!rides_user_id_fkey(display_name, ride_hearts, favor_hearts, zone, car_info, avatar_url)')
      .eq('status', 'open')
      .gt('expires_at', nowIso)
      .order('departure_at', { ascending: true }),
    supabase
      .from('favors')
      .select('*, author:profiles!favors_user_id_fkey(display_name, favor_hearts, zone, avatar_url)')
      .eq('status', 'open')
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, ride_hearts, favor_hearts'),
    supabase.from('kudos').select('receiver_id'),
    supabase
      .from('local_pros')
      .select('*')
      .eq('is_active', true)
      .order('endorsement_count', { ascending: false }),
    supabase
      .from('road_alerts')
      .select('*, reporter:profiles!road_alerts_reporter_id_fkey(display_name, zone)')
      .gt('expires_at', nowIso)
      .order('last_confirmed_at', { ascending: false })
      .limit(20)
  ]);

  const kudosMap = {};
  (allProfs || []).forEach((p) => {
    kudosMap[p.id] = (p.ride_hearts || 0) + (p.favor_hearts || 0);
  });
  const rawCounts = {};
  (allKudosRows || []).forEach((kr) => {
    if (kr.receiver_id) rawCounts[kr.receiver_id] = (rawCounts[kr.receiver_id] || 0) + 1;
  });
  Object.keys(rawCounts).forEach((uid) => {
    kudosMap[uid] = Math.max(kudosMap[uid] || 0, rawCounts[uid]);
  });

  let mappedRides = null;
  if (rideRows) {
    mappedRides = rideRows.map((r) => {
      const dt = new Date(r.departure_at);
      const timeStr = dt.toTimeString().slice(0, 5);
      const recMatch = r.note?.match(/^\[Rendszeres:\s*(.*?)\]\s*(.*)$/);
      const isRec = Boolean(r.recurring_id || r.schedule_label || recMatch);
      const scheduleLabel =
        r.schedule_label || (recMatch ? recMatch[1] : isRec ? 'Munkanapokon (H–P)' : null);
      const cleanNote = recMatch ? recMatch[2] : r.note;

      let effectiveDepIso = r.departure_at;
      if (isRec) {
        const [hh, mm] = timeStr.split(':').map(Number);
        const nextDep = new Date();
        nextDep.setHours(hh || 6, mm || 0, 0, 0);
        if (nextDep.getTime() < Date.now() - 15 * 60000) {
          nextDep.setDate(nextDep.getDate() + 1);
        }
        effectiveDepIso = nextDep.toISOString();
      }

      let fixedOriginLat = r.origin_lat;
      let fixedOriginLng = r.origin_lng;
      if (
        (r.origin_text || '').toLowerCase().includes('fogoly') &&
        (!fixedOriginLng || Number(fixedOriginLng) < 19.059)
      ) {
        fixedOriginLat = 47.69031;
        fixedOriginLng = 19.06172;
      }

      return {
        ...r,
        origin_lat: fixedOriginLat,
        origin_lng: fixedOriginLng,
        departure_at: effectiveDepIso,
        note: cleanNote,
        author_name: r.author?.display_name || 'Szomszéd',
        author_zone: r.author?.zone || '',
        author_avatar: r.author?.avatar_url || null,
        author_car: r.car_info || r.author?.car_info || null,
        car_info: r.car_info || r.author?.car_info || null,
        author_ride_hearts: r.author?.ride_hearts || 0,
        author_favor_hearts: r.author?.favor_hearts || 0,
        is_recurring: isRec,
        schedule_text: scheduleLabel,
        depart_time: timeStr,
        time_label: timeStr,
        date_label: formatDayLabelFromIso(effectiveDepIso, isRec, scheduleLabel),
        stops: []
      };
    });
    mappedRides.sort((a, b) => new Date(a.departure_at) - new Date(b.departure_at));
  }

  const mappedFavors = favorRows
    ? favorRows.map((f) => ({
        ...f,
        author_name: f.author?.display_name || 'Szomszéd',
        author_zone: f.author?.zone || '',
        author_avatar: f.author?.avatar_url || null,
        author_favor_hearts: f.author?.favor_hearts || 0
      }))
    : null;

  const mappedAlerts =
    alertRows && alertRows.length > 0
      ? alertRows.map((a) => ({
          ...a,
          author_name: a.reporter?.display_name || 'Helyi lakos'
        }))
      : null;

  let mappedAgreements = null;
  if (currentUserId && currentUserId !== 'guest-user') {
    const { data: agrRows } = await supabase
      .from('agreements')
      .select(`
        *,
        requester:profiles!agreements_requester_id_fkey(display_name, avatar_url),
        helper:profiles!agreements_helper_id_fkey(display_name, car_info, avatar_url),
        ride:rides(origin_text, dest_text, kind, user_id, car_info, departure_at),
        favor:favors(title),
        pro:local_pros(business_name, profession_name)
      `)
      .or(`requester_id.eq.${currentUserId},helper_id.eq.${currentUserId}`)
      .order('created_at', { ascending: false });

    if (agrRows) {
      const agrIds = agrRows.map((x) => x.id);
      const latestMsgByAgr = {};
      if (agrIds.length > 0) {
        const { data: recentMsgs } = await supabase
          .from('messages')
          .select('agreement_id, sender_id, body, created_at')
          .in('agreement_id', agrIds)
          .order('created_at', { ascending: false })
          .limit(80);
        (recentMsgs || []).forEach((m) => {
          if (!latestMsgByAgr[m.agreement_id]) {
            latestMsgByAgr[m.agreement_id] = m;
          }
        });
      }

      const readMap = getReadTimestamps(currentUserId);
      mappedAgreements = agrRows.map((a) => {
        const isReq = a.requester_id === currentUserId;
        const lastMsg = latestMsgByAgr[a.id] || null;
        const lastActivityAt = lastMsg?.created_at || a.created_at;
        const lastReadAt = readMap[a.id];
        const isUnread = Boolean(
          lastMsg &&
            lastMsg.sender_id !== currentUserId &&
            (!lastReadAt || new Date(lastMsg.created_at) > new Date(lastReadAt))
        );

        return {
          ...a,
          partner_name: a.pro
            ? a.pro.business_name
            : isReq
            ? a.helper?.display_name || 'Szomszéd'
            : a.requester?.display_name || 'Szomszéd',
          partner_avatar: a.pro
            ? null
            : isReq
            ? a.helper?.avatar_url || null
            : a.requester?.avatar_url || null,
          post_owner_id: a.ride?.user_id || a.helper_id,
          car_info: a.ride?.car_info || a.helper?.car_info || null,
          ride_origin_text: a.ride?.origin_text || null,
          ride_dest_text: a.ride?.dest_text || null,
          ride_departure_at: a.ride?.departure_at || null,
          title: a.ride
            ? formatAgreementRideTitle(a.ride.origin_text, a.ride.dest_text, a.status)
            : a.pro
            ? a.pro.profession_name || 'Szakmai megkeresés'
            : a.favor?.title || 'Egyeztetés',
          last_message_body: lastMsg?.body || '',
          last_activity_at: lastActivityAt,
          has_unread: isUnread
        };
      });

      mappedAgreements.sort(
        (x, y) => new Date(y.last_activity_at) - new Date(x.last_activity_at)
      );
    }
  }

  return {
    kudosMap,
    mappedRides,
    mappedFavors,
    proRows,
    alertRows,
    mappedAlerts,
    mappedAgreements
  };
}

export async function enrichOfferRidesWithStops(mappedRides) {
  return Promise.all(
    mappedRides.map(async (rideItem) => {
      if (rideItem.kind !== 'offer') return rideItem;
      const computedStops = await computeStopsAlongRoute(rideItem);
      return { ...rideItem, stops: computedStops };
    })
  );
}
