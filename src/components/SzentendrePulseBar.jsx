import React, { useMemo, useState } from 'react';
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

  const zoneInfo = ZONE_TRANSIT_INFO[userZone] || {
    lines: '870–889',
    driveMins: 8
  };

  const nextRegularRide = useMemo(() => {
    return (rides || []).find((r) => r.is_recurring && r.kind === 'offer') || null;
  }, [rides]);

  return (
    <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] shadow-sm space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex bg-limestone p-1 rounded-xl border border-[#DFD9CE] text-xs font-bold">
          <button
            type="button"
            onClick={() => setDirection('to_hev')}
            className={`px-3 py-1.5 rounded-lg transition ${
              direction === 'to_hev'
                ? 'bg-pilis text-white shadow-sm'
                : 'text-[#4A5850]'
            }`}
          >
            HÉV-hez (Pestre)
          </button>
          <button
            type="button"
            onClick={() => setDirection('from_hev')}
            className={`px-3 py-1.5 rounded-lg transition ${
              direction === 'from_hev'
                ? 'bg-terracotta text-white shadow-sm'
                : 'text-[#4A5850]'
            }`}
          >
            HÉV-ről haza
          </button>
        </div>

        <a
          href="https://futar.bkk.hu/?routeIds=BKK_H5"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-pilis hover:underline px-2 py-1"
        >
          Élő H5 menetrend (BKK) ↗
        </a>
      </div>

      {direction === 'to_hev' ? (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-bold text-[#18261F] truncate">
              {userZone} → Szentendre HÉV-állomás
            </div>
            <div className="text-xs text-[#4A5850]">
              Autóval kb. {zoneInfo.driveMins} perc • Helyi buszok: {zoneInfo.lines}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectHevRoute && onSelectHevRoute(userZone, 'to_hev')}
            className="shrink-0 bg-pilis-soft hover:bg-pilis text-pilis hover:text-white font-bold text-xs px-3.5 py-2.5 rounded-xl border border-pilis/20 transition active:scale-95"
          >
            Fuvart kérek le ›
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-bold text-[#18261F] truncate">
              Szentendre HÉV-állomás → {userZone}
            </div>
            <div className="text-xs text-[#4A5850]">
              Helyi csatlakozás ({zoneInfo.lines}) helyett közvetlen fuvar felfelé
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectHevRoute && onSelectHevRoute(userZone, 'from_hev')}
            className="shrink-0 bg-terracotta-soft hover:bg-terracotta text-terracotta hover:text-white font-bold text-xs px-3.5 py-2.5 rounded-xl border border-terracotta/25 transition active:scale-95"
          >
            Fuvart kérek fel ›
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
