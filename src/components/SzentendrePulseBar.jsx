import React, { useEffect, useMemo, useState } from 'react';
import { ZONE_TRANSIT_INFO } from '../constants/szentendreData.js';

export default function SzentendrePulseBar({
  userZone = 'Pismány',
  rides = [],
  onSelectHevRoute,
  onSelectRide
}) {
  const [direction, setDirection] = useState(() =>
    new Date().getHours() >= 13 ? 'from_hev' : 'to_hev'
  );
  const [liveHev, setLiveHev] = useState({
    loading: true,
    ok: false,
    departures: [],
    arrivals: []
  });

  const zoneInfo = ZONE_TRANSIT_INFO[userZone] || {
    lines: '870–889',
    driveMins: 8
  };

  useEffect(() => {
    let mounted = true;

    const loadLiveHev = async () => {
      try {
        const res = await fetch('/api/hev');
        if (!res.ok) throw new Error('hev_fetch_failed');
        const data = await res.json();
        if (!mounted) return;
        setLiveHev({
          loading: false,
          ok: Boolean(data?.ok),
          departures: Array.isArray(data?.departures) ? data.departures : [],
          arrivals: Array.isArray(data?.arrivals) ? data.arrivals : []
        });
      } catch {
        if (!mounted) return;
        setLiveHev((prev) => ({ ...prev, loading: false, ok: false }));
      }
    };

    loadLiveHev();
    const timer = setInterval(loadLiveHev, 45000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const nextRegularRide = useMemo(() => {
    return (rides || []).find((r) => r.is_recurring && r.kind === 'offer') || null;
  }, [rides]);

  const nextDep = liveHev.departures[0] || null;
  const secondDep = liveHev.departures[1] || null;
  const nextArr = liveHev.arrivals[0] || null;
  const secondArr = liveHev.arrivals[1] || null;

  return (
    <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] shadow-sm space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex bg-limestone p-1 rounded-xl border border-[#DFD9CE] text-xs font-bold">
          <button
            type="button"
            onClick={() => setDirection('to_hev')}
            className={`px-3.5 py-1.5 rounded-lg transition ${
              direction === 'to_hev'
                ? 'bg-pilis text-white shadow-sm'
                : 'text-[#4A5850]'
            }`}
          >
            Budapest felé
          </button>
          <button
            type="button"
            onClick={() => setDirection('from_hev')}
            className={`px-3.5 py-1.5 rounded-lg transition ${
              direction === 'from_hev'
                ? 'bg-terracotta text-white shadow-sm'
                : 'text-[#4A5850]'
            }`}
          >
            Hazafelé
          </button>
        </div>

        <span className="text-xs font-semibold text-[#4A5850] flex items-center gap-1.5">
          {liveHev.ok && (
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse shrink-0" />
          )}
          <span>H5 HÉV • {zoneInfo.lines} busz</span>
        </span>
      </div>

      {direction === 'to_hev' ? (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <div className="text-xs sm:text-sm font-bold text-[#18261F] truncate">
              {userZone} → HÉV-végállomás
            </div>
            {liveHev.loading ? (
              <div className="text-xs text-[#4A5850]">
                Élő indulások lekérése...
              </div>
            ) : nextDep ? (
              <div className="text-xs text-[#18261F]">
                Következő HÉV: <strong>{nextDep.timeStr}</strong>{' '}
                <span className="text-[#4A5850]">
                  ({nextDep.inMins === 0 ? 'most indul' : `${nextDep.inMins} perc múlva`})
                  {secondDep ? ` • utána ${secondDep.timeStr}` : ''}
                </span>
              </div>
            ) : (
              <div className="text-xs text-[#4A5850]">
                Autóval kb. {zoneInfo.driveMins} perc a végállomás
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onSelectHevRoute && onSelectHevRoute(userZone, 'to_hev')}
            className="shrink-0 bg-pilis-soft hover:bg-pilis text-pilis hover:text-white font-bold text-xs px-3.5 py-2.5 rounded-xl border border-pilis/20 transition active:scale-95"
          >
            Fuvart kérek ›
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <div className="text-xs sm:text-sm font-bold text-[#18261F] truncate">
              HÉV-végállomás → {userZone}
            </div>
            {liveHev.loading ? (
              <div className="text-xs text-[#4A5850]">
                Élő érkezések lekérése...
              </div>
            ) : nextArr ? (
              <div className="text-xs text-[#18261F]">
                Beérkező HÉV: <strong>{nextArr.timeStr}</strong>{' '}
                <span className="text-[#4A5850]">
                  ({nextArr.inMins === 0 ? 'most érkezik' : `${nextArr.inMins} perc múlva`})
                  {secondArr ? ` • utána ${secondArr.timeStr}` : ''}
                </span>
              </div>
            ) : (
              <div className="text-xs text-[#4A5850]">
                Közvetlen fuvar a végállomástól ({zoneInfo.lines} busz helyett)
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onSelectHevRoute && onSelectHevRoute(userZone, 'from_hev')}
            className="shrink-0 bg-terracotta-soft hover:bg-terracotta text-terracotta hover:text-white font-bold text-xs px-3.5 py-2.5 rounded-xl border border-terracotta/25 transition active:scale-95"
          >
            Fuvart kérek ›
          </button>
        </div>
      )}

      {nextRegularRide && (
        <div className="pt-2 border-t border-[#ECE7DC] flex items-center justify-between gap-2 text-xs">
          <div className="min-w-0 truncate text-[#4A5850]">
            <span className="font-bold text-[#18261F]">Rendszeres járat:</span>{' '}
            {nextRegularRide.time_label} • {nextRegularRide.author_name} ({(nextRegularRide.public_origin_text || nextRegularRide.origin_text).split(',')[0]} → {(nextRegularRide.public_dest_text || nextRegularRide.dest_text).split(',')[0]})
          </div>
          <button
            type="button"
            onClick={() => onSelectRide && onSelectRide(nextRegularRide)}
            className="shrink-0 font-bold text-xs text-pilis underline py-1"
          >
            Megnézem
          </button>
        </div>
      )}
    </div>
  );
}
