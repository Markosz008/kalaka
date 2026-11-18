const WEEKDAY_DEPARTURES = {
  4: [34, 54],
  5: [14, 24, 34, 44, 54],
  6: [4, 14, 24, 34, 44, 54],
  7: [4, 14, 24, 34, 44, 54],
  8: [4, 14, 24, 34, 44, 54],
  9: [4, 14, 34, 54],
  10: [14, 34, 54],
  11: [14, 34, 54],
  12: [14, 34, 54],
  13: [14, 34, 54],
  14: [14, 24, 34, 44, 54],
  15: [4, 14, 24, 34, 44, 54],
  16: [4, 14, 24, 34, 44, 54],
  17: [4, 14, 24, 34, 44, 54],
  18: [4, 14, 24, 34, 44, 54],
  19: [4, 14, 34, 54],
  20: [14, 34, 54],
  21: [14, 34, 54],
  22: [14, 34, 54],
  23: [14, 34]
};

const WEEKEND_DEPARTURES = {
  4: [34, 54],
  5: [14, 34, 54],
  6: [14, 34, 54],
  7: [14, 34, 54],
  8: [14, 34, 54],
  9: [14, 34, 54],
  10: [14, 34, 54],
  11: [14, 34, 54],
  12: [14, 34, 54],
  13: [14, 34, 54],
  14: [14, 34, 54],
  15: [14, 34, 54],
  16: [14, 34, 54],
  17: [14, 34, 54],
  18: [14, 34, 54],
  19: [14, 34, 54],
  20: [14, 34, 54],
  21: [14, 34, 54],
  22: [14, 34, 54],
  23: [14, 34]
};

const WEEKDAY_ARRIVALS = {
  5: [23, 43],
  6: [3, 23, 33, 43, 53],
  7: [3, 13, 23, 33, 43, 53],
  8: [3, 13, 23, 33, 43, 53],
  9: [3, 13, 23, 43],
  10: [3, 23, 43],
  11: [3, 23, 43],
  12: [3, 23, 43],
  13: [3, 23, 43],
  14: [3, 23, 33, 43, 53],
  15: [3, 13, 23, 33, 43, 53],
  16: [3, 13, 23, 33, 43, 53],
  17: [3, 13, 23, 33, 43, 53],
  18: [3, 13, 23, 33, 43, 53],
  19: [3, 13, 23, 43],
  20: [3, 23, 43],
  21: [3, 23, 43],
  22: [3, 23, 43],
  23: [3, 23, 43],
  0: [13, 33]
};

const WEEKEND_ARRIVALS = {
  5: [23, 43],
  6: [3, 23, 43],
  7: [3, 23, 43],
  8: [3, 23, 43],
  9: [3, 23, 43],
  10: [3, 23, 43],
  11: [3, 23, 43],
  12: [3, 23, 43],
  13: [3, 23, 43],
  14: [3, 23, 43],
  15: [3, 23, 43],
  16: [3, 23, 43],
  17: [3, 23, 43],
  18: [3, 23, 43],
  19: [3, 23, 43],
  20: [3, 23, 43],
  21: [3, 23, 43],
  22: [3, 23, 43],
  23: [3, 23, 43],
  0: [13, 33]
};

function getBudapestParts(dateObj) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Budapest',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = fmt.formatToParts(dateObj);
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  const isWeekend = map.weekday === 'Sat' || map.weekday === 'Sun';
  const hour = Number(map.hour) % 24;
  const minute = Number(map.minute);
  return { isWeekend, hour, minute };
}

function buildScheduledList(nowDate, isArrival = false) {
  const { isWeekend, hour, minute } = getBudapestParts(nowDate);
  const table = isArrival
    ? isWeekend
      ? WEEKEND_ARRIVALS
      : WEEKDAY_ARRIVALS
    : isWeekend
    ? WEEKEND_DEPARTURES
    : WEEKDAY_DEPARTURES;

  const nowTotalMins = hour * 60 + minute;
  const out = [];

  for (let offsetHours = 0; offsetHours <= 6 && out.length < 3; offsetHours++) {
    const h = (hour + offsetHours) % 24;
    const minsArr = table[h] || [];
    for (const m of minsArr) {
      const candidateTotal = (hour + offsetHours) * 60 + m;
      const diffMins = candidateTotal - nowTotalMins;
      if (diffMins >= 1) {
        out.push({
          timeStr: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
          inMins: diffMins,
          isLive: false
        });
        if (out.length >= 3) break;
      }
    }
  }
  return out;
}

export async function onRequestGet() {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=30'
  };

  const now = new Date();

  try {
    const baseUrl = 'https://futar.bkk.hu/api/query/v1/ws/otp/api/where';
    const commonParams = 'key=bkk-web&version=4&appVersion=web';
    const fetchOpts = {
      headers: {
        Accept: 'application/json',
        Origin: 'https://futar.bkk.hu',
        Referer: 'https://futar.bkk.hu/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    };

    const stopsRes = await fetch(
      `${baseUrl}/stops-for-location.json?${commonParams}&lat=47.6602&lon=19.0738&radius=280`,
      fetchOpts
    );

    if (stopsRes.ok) {
      const stopsJson = await stopsRes.json();
      const stopList = stopsJson?.data?.list || [];
      const h5StopIds = stopList
        .filter((s) => Array.isArray(s.routeIds) && s.routeIds.includes('BKK_H5'))
        .map((s) => s.id);

      if (h5StopIds.length > 0) {
        const stopQuery = h5StopIds.map((id) => `stopId=${encodeURIComponent(id)}`).join('&');
        const arrDepRes = await fetch(
          `${baseUrl}/arrivals-and-departures-for-stop.json?${commonParams}&${stopQuery}&minutesBefore=2&minutesAfter=90`,
          fetchOpts
        );

        if (arrDepRes.ok) {
          const arrDepJson = await arrDepRes.json();
          const entry = arrDepJson?.data?.entry || {};
          const refs = arrDepJson?.data?.references || {};
          const trips = refs.trips || {};
          const stopTimes = entry.stopTimes || [];
          const nowSec = Math.floor(now.getTime() / 1000);

          const liveDeps = [];
          const liveArrs = [];

          for (const st of stopTimes) {
            const trip = trips[st.tripId] || {};
            if (trip.routeId && trip.routeId !== 'BKK_H5') continue;

            const depSec = st.predictedDepartureTime || st.departureTime;
            const arrSec = st.predictedArrivalTime || st.arrivalTime;
            const isLive = Boolean(st.predictedDepartureTime || st.predictedArrivalTime);

            if (depSec && depSec >= nowSec - 30) {
              liveDeps.push({
                epochSec: depSec,
                timeStr: new Date(depSec * 1000).toLocaleTimeString('hu-HU', {
                  timeZone: 'Europe/Budapest',
                  hour: '2-digit',
                  minute: '2-digit'
                }),
                inMins: Math.max(0, Math.round((depSec - nowSec) / 60)),
                isLive
              });
            } else if (arrSec && arrSec >= nowSec - 30) {
              liveArrs.push({
                epochSec: arrSec,
                timeStr: new Date(arrSec * 1000).toLocaleTimeString('hu-HU', {
                  timeZone: 'Europe/Budapest',
                  hour: '2-digit',
                  minute: '2-digit'
                }),
                inMins: Math.max(0, Math.round((arrSec - nowSec) / 60)),
                isLive
              });
            }
          }

          const dedupe = (arr) => {
            arr.sort((a, b) => a.epochSec - b.epochSec);
            const res = [];
            const seen = new Set();
            for (const item of arr) {
              if (!seen.has(item.timeStr)) {
                seen.add(item.timeStr);
                res.push({ timeStr: item.timeStr, inMins: item.inMins, isLive: item.isLive });
              }
              if (res.length >= 3) break;
            }
            return res;
          };

          const dList = dedupe(liveDeps);
          const aList = dedupe(liveArrs);
          if (dList.length > 0 || aList.length > 0) {
            return new Response(
              JSON.stringify({
                ok: true,
                source: 'bkk_live',
                departures: dList.length > 0 ? dList : buildScheduledList(now, false),
                arrivals: aList.length > 0 ? aList : buildScheduledList(now, true)
              }),
              { status: 200, headers }
            );
          }
        }
      }
    }
  } catch {}

  return new Response(
    JSON.stringify({
      ok: true,
      source: 'schedule',
      departures: buildScheduledList(now, false),
      arrivals: buildScheduledList(now, true)
    }),
    { status: 200, headers }
  );
}
