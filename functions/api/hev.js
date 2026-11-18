export async function onRequestGet() {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=30'
  };

  try {
    const baseUrl = 'https://futar.bkk.hu/api/query/v1/ws/otp/api/where';
    const commonParams = 'key=bkk-web&version=4&appVersion=web';

    const stopsRes = await fetch(
      `${baseUrl}/stops-for-location.json?${commonParams}&lat=47.6602&lon=19.0738&radius=280`,
      { headers: { Accept: 'application/json' } }
    );

    if (!stopsRes.ok) {
      return new Response(
        JSON.stringify({ ok: false, departures: [], arrivals: [] }),
        { status: 200, headers }
      );
    }

    const stopsJson = await stopsRes.json();
    const stopList = stopsJson?.data?.list || [];
    const h5StopIds = stopList
      .filter((s) => Array.isArray(s.routeIds) && s.routeIds.includes('BKK_H5'))
      .map((s) => s.id);

    if (h5StopIds.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, departures: [], arrivals: [] }),
        { status: 200, headers }
      );
    }

    const stopQuery = h5StopIds.map((id) => `stopId=${encodeURIComponent(id)}`).join('&');
    const arrDepRes = await fetch(
      `${baseUrl}/arrivals-and-departures-for-stop.json?${commonParams}&${stopQuery}&minutesBefore=2&minutesAfter=90`,
      { headers: { Accept: 'application/json' } }
    );

    if (!arrDepRes.ok) {
      return new Response(
        JSON.stringify({ ok: false, departures: [], arrivals: [] }),
        { status: 200, headers }
      );
    }

    const arrDepJson = await arrDepRes.json();
    const entry = arrDepJson?.data?.entry || {};
    const refs = arrDepJson?.data?.references || {};
    const trips = refs.trips || {};
    const stopTimes = entry.stopTimes || [];
    const nowSec = Math.floor(Date.now() / 1000);

    const departures = [];
    const arrivals = [];

    for (const st of stopTimes) {
      const trip = trips[st.tripId] || {};
      if (trip.routeId && trip.routeId !== 'BKK_H5') continue;

      const depSec = st.predictedDepartureTime || st.departureTime;
      const arrSec = st.predictedArrivalTime || st.arrivalTime;
      const isLive = Boolean(st.predictedDepartureTime || st.predictedArrivalTime);

      if (depSec && depSec >= nowSec - 30) {
        const diffMins = Math.max(0, Math.round((depSec - nowSec) / 60));
        const timeStr = new Date(depSec * 1000).toLocaleTimeString('hu-HU', {
          timeZone: 'Europe/Budapest',
          hour: '2-digit',
          minute: '2-digit'
        });
        departures.push({
          epochSec: depSec,
          timeStr,
          inMins: diffMins,
          isLive,
          headsign: trip.tripHeadsign || 'Batthyány tér'
        });
      } else if (arrSec && arrSec >= nowSec - 30) {
        const diffMins = Math.max(0, Math.round((arrSec - nowSec) / 60));
        const timeStr = new Date(arrSec * 1000).toLocaleTimeString('hu-HU', {
          timeZone: 'Europe/Budapest',
          hour: '2-digit',
          minute: '2-digit'
        });
        arrivals.push({
          epochSec: arrSec,
          timeStr,
          inMins: diffMins,
          isLive
        });
      }
    }

    const dedupeByMinute = (list) => {
      list.sort((a, b) => a.epochSec - b.epochSec);
      const out = [];
      const seen = new Set();
      for (const item of list) {
        if (!seen.has(item.timeStr)) {
          seen.add(item.timeStr);
          out.push(item);
        }
        if (out.length >= 3) break;
      }
      return out;
    };

    const cleanDeps = dedupeByMinute(departures);
    const cleanArrs = dedupeByMinute(arrivals);

    return new Response(
      JSON.stringify({
        ok: cleanDeps.length > 0 || cleanArrs.length > 0,
        departures: cleanDeps,
        arrivals: cleanArrs
      }),
      { status: 200, headers }
    );
  } catch {
    return new Response(
      JSON.stringify({ ok: false, departures: [], arrivals: [] }),
      { status: 200, headers }
    );
  }
}
