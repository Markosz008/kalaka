import React, { useMemo } from 'react';

const ZONE_DRIVE_MINS = {
  'Belváros': 4,
  'Bükkös-part': 5,
  'Dunakorzó': 5,
  'Vasúti villasor': 3,
  'Püspökmajor': 6,
  'Kálvária': 6,
  'Szamárhegy': 6,
  'Pannóniatelep': 4,
  'Pismány': 9,
  'Sztaravoda': 8,
  'Izbég': 8,
  'Szarvashegy': 12,
  'Tyúkosdűlő és Dera-part': 10,
  'Derecske': 7
};

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

export default function SzentendrePulseBar({
  nowTick,
  userZone = 'Pismány',
  rides = [],
  onSelectHevRoute,
  onSelectRide
}) {
  const nextTrains = useMemo(() => getNextHevDepartures(nowTick), [nowTick]);
  const driveMins = ZONE_DRIVE_MINS[userZone] || 8;
  const firstTrain = nextTrains[0];
  const secondTrain = nextTrains[1];
  const isAfternoon = new Date(nowTick).getHours() >= 13;

  const nextRegularRide = useMemo(() => {
    return (rides || []).find((r) => r.is_recurring && r.kind === 'offer') || null;
  }, [rides]);

  return (
    <div className="bg-white rounded-2xl p-3 border border-[#DFD9CE] shadow-sm space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${isAfternoon ? 'bg-terracotta' : 'bg-pilis'}`} />
            <span className="text-[11px] font-extrabold text-pilis uppercase tracking-wide">
              {isAfternoon ? `Hazafelé • HÉV → ${userZone}` : 'H5 HÉV • Batthyány tér felé'}
            </span>
          </div>
          {firstTrain && (
            <div className="text-xs font-semibold text-[#18261F] mt-0.5 truncate">
              {isAfternoon
                ? `HÉV indulás: ${firstTrain.timeStr} (${firstTrain.inMins} p) • Hegyre fel: ~${driveMins} perc`
                : <>Indul: <strong>{firstTrain.timeStr}</strong> ({firstTrain.inMins} perc múlva){secondTrain ? ` • utána ${secondTrain.timeStr}` : ''}</>}
            </div>
          )}
          {!isAfternoon && (
            <div className="text-[11px] text-[#5C6B62]">
              {userZone} térségéből autóval kb. {driveMins} perc a végállomás
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onSelectHevRoute && onSelectHevRoute(userZone, isAfternoon ? 'from_hev' : 'to_hev')}
          className={`shrink-0 font-bold text-[11px] px-3 py-2 rounded-xl border transition active:scale-95 ${
            isAfternoon
              ? 'bg-terracotta-soft hover:bg-terracotta text-terracotta hover:text-white border-terracotta/25'
              : 'bg-pilis-soft hover:bg-pilis text-pilis hover:text-white border-pilis/20'
          }`}
        >
          {isAfternoon ? 'HÉV-től felfelé ›' : 'Fuvart kérek a HÉV-hez ›'}
        </button>
      </div>

      {nextRegularRide && (
        <div className="pt-2 border-t border-[#ECE7DC] flex items-center justify-between gap-2 text-xs">
          <div className="min-w-0 truncate text-[#5C6B62]">
            <span className="font-bold text-[#18261F]">Következő rendszeres járat:</span>{' '}
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
