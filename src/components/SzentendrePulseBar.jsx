import React, { useMemo, useState } from 'react';
import { ZONE_TRANSIT_INFO } from '../constants/szentendreData.js';

function getNextHevDepartures(nowMs) {
  const now = new Date(nowMs);
  const results = [];

  for (let dayOffset = 0; dayOffset <= 1 && results.length < 2; dayOffset++) {
    const base = new Date(now);
    base.setDate(now.getDate() + dayOffset);
    const isWeekend = base.getDay() === 0 || base.getDay() === 6;

    for (let h = 4; h <= 23 && results.length < 2; h++) {
      let minsList = [14, 34, 54];
      if (!isWeekend && ((h >= 6 && h <= 8) || (h >= 15 && h <= 17))) {
        minsList = [4, 14, 24, 34, 44, 54];
      } else if (h === 4) {
        minsList = [34, 54];
      } else if (h === 23) {
        minsList = [14, 34];
      }

      for (const m of minsList) {
        const dep = new Date(base);
        dep.setHours(h, m, 0, 0);
        const diffMins = Math.round((dep.getTime() - nowMs) / 60000);
        if (diffMins >= 2) {
          results.push({
            timeStr: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
            inMins: diffMins
          });
          if (results.length >= 2) break;
        }
      }
    }
  }
  return results;
}

function getNextHevArrivals(nowMs) {
  const now = new Date(nowMs);
  const results = [];

  for (let dayOffset = 0; dayOffset <= 1 && results.length < 2; dayOffset++) {
    const base = new Date(now);
    base.setDate(now.getDate() + dayOffset);
    const isWeekend = base.getDay() === 0 || base.getDay() === 6;

    for (let h = 5; h <= 24 && results.length < 2; h++) {
      const hourVal = h % 24;
      let minsList = [3, 23, 43];
      if (!isWeekend && ((hourVal >= 7 && hourVal <= 9) || (hourVal >= 16 && hourVal <= 19))) {
        minsList = [3, 13, 23, 33, 43, 53];
      }

      for (const m of minsList) {
        const arr = new Date(base);
        arr.setHours(hourVal, m, 0, 0);
        if (h === 24) arr.setDate(arr.getDate() + 1);
        const diffMins = Math.round((arr.getTime() - nowMs) / 60000);
        if (diffMins >= 1) {
          results.push({
            dateObj: arr,
            timeStr: `${String(hourVal).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
            inMins: diffMins
          });
          if (results.length >= 2) break;
        }
      }
    }
  }
  return results;
}

function computeNextBusGapAfterArrival(arrivalDate, busMinsList) {
  if (!arrivalDate || !Array.isArray(busMinsList) || busMinsList.length === 0) return null;
  const arrMin = arrivalDate.getMinutes();
  const arrHour = arrivalDate.getHours();

  for (const bm of busMinsList) {
    if (bm >= arrMin + 4) {
      const waitMins = bm - arrMin;
      return {
        busTimeStr: `${String(arrHour).padStart(2, '0')}:${String(bm).padStart(2, '0')}`,
        waitMins
      };
    }
  }
  const nextHour = (arrHour + 1) % 24;
  const firstNextBm = busMinsList[0];
  const waitMins = 60 - arrMin + firstNextBm;
  return {
    busTimeStr: `${String(nextHour).padStart(2, '0')}:${String(firstNextBm).padStart(2, '0')}`,
    waitMins
  };
}

export default function SzentendrePulseBar({
  nowTick,
  userZone = 'Pismány',
  rides = [],
  onSelectHevRoute,
  onSelectRide
}) {
  const [direction, setDirection] = useState(() =>
    new Date(nowTick).getHours() >= 13 ? 'from_hev' : 'to_hev'
  );

  const zoneInfo = ZONE_TRANSIT_INFO[userZone] || {
    lines: '870–889',
    busMinsAfterHev: [15, 45],
    driveMins: 8
  };

  const nextDepartures = useMemo(() => getNextHevDepartures(nowTick), [nowTick]);
  const nextArrivals = useMemo(() => getNextHevArrivals(nowTick), [nowTick]);

  const firstDep = nextDepartures[0];
  const firstArr = nextArrivals[0];
  const busGap = useMemo(
    () => computeNextBusGapAfterArrival(firstArr?.dateObj, zoneInfo.busMinsAfterHev),
    [firstArr, zoneInfo.busMinsAfterHev]
  );

  const nextRegularRide = useMemo(() => {
    return (rides || []).find((r) => r.is_recurring && r.kind === 'offer') || null;
  }, [rides]);

  return (
    <div className="bg-white rounded-2xl p-3 border border-[#DFD9CE] shadow-sm space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex bg-limestone p-0.5 rounded-xl border border-[#DFD9CE] text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setDirection('to_hev')}
            className={`px-2.5 py-1 rounded-lg transition ${
              direction === 'to_hev'
                ? 'bg-pilis text-white shadow-sm'
                : 'text-[#5C6B62]'
            }`}
          >
            HÉV-hez (Pestre)
          </button>
          <button
            type="button"
            onClick={() => setDirection('from_hev')}
            className={`px-2.5 py-1 rounded-lg transition ${
              direction === 'from_hev'
                ? 'bg-terracotta text-white shadow-sm'
                : 'text-[#5C6B62]'
            }`}
          >
            HÉV-ről haza
          </button>
        </div>

        <span className="text-[11px] font-semibold text-[#5C6B62] truncate">
          {userZone} • {zoneInfo.lines} busz
        </span>
      </div>

      {direction === 'to_hev' ? (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            {firstDep && (
              <div className="text-xs font-semibold text-[#18261F] truncate">
                Következő HÉV: <strong>{firstDep.timeStr}</strong> ({firstDep.inMins} perc múlva)
              </div>
            )}
            <div className="text-[11px] text-[#5C6B62]">
              {userZone} felől autóval ~{zoneInfo.driveMins} p
              {firstDep && firstDep.inMins >= zoneInfo.driveMins + 2
                ? ' • még elérhető'
                : ' • következőre kényelmes'}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectHevRoute && onSelectHevRoute(userZone, 'to_hev', firstDep?.timeStr)}
            className="shrink-0 bg-pilis-soft hover:bg-pilis text-pilis hover:text-white font-bold text-[11px] px-3 py-2 rounded-xl border border-pilis/20 transition active:scale-95"
          >
            Fuvart kérek le ›
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            {firstArr && (
              <div className="text-xs font-semibold text-[#18261F] truncate">
                Beérkező HÉV: <strong>{firstArr.timeStr}</strong> ({firstArr.inMins} p múlva)
              </div>
            )}
            {busGap && (
              <div className="text-[11px] text-[#5C6B62] truncate">
                Következő busz ({zoneInfo.lines.split(',')[0]}): <strong>{busGap.busTimeStr}</strong> ({busGap.waitMins} p várakozás)
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onSelectHevRoute && onSelectHevRoute(userZone, 'from_hev', firstArr?.timeStr)}
            className="shrink-0 bg-terracotta-soft hover:bg-terracotta text-terracotta hover:text-white font-bold text-[11px] px-3 py-2 rounded-xl border border-terracotta/25 transition active:scale-95"
          >
            Fuvart kérek fel ›
          </button>
        </div>
      )}

      {nextRegularRide && (
        <div className="pt-2 border-t border-[#ECE7DC] flex items-center justify-between gap-2 text-xs">
          <div className="min-w-0 truncate text-[#5C6B62]">
            <span className="font-bold text-[#18261F]">Rendszeres járat:</span>{' '}
            {nextRegularRide.time_label} • {nextRegularRide.author_name} ({nextRegularRide.origin_text.split(',')[0]} → {nextRegularRide.dest_text.split(',')[0]})
          </div>
          <button
            type="button"
            onClick={() => onSelectRide && onSelectRide(nextRegularRide)}
            className="shrink-0 font-bold text-[11px] text-pilis underline"
          >
            Megnézem
          </button>
        </div>
      )}
    </div>
  );
}
