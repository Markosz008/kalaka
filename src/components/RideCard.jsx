import React, { useState } from 'react';
import { formatRemainingTime } from '../constants/szentendreData.js';

export default function RideCard({
  kudosCount = 0,
  onInspectUser,
  ride,
  currentUserId,
  onStartAgreement,
  onShowOnMap,
  onEditRide,
  onDeleteRide
}) {
  const [selectedStop, setSelectedStop] = useState(null);
  const isOwner = Boolean(currentUserId && ride.user_id === currentUserId);

  const scheduleSubtitle = ride.is_recurring
    ? ride.schedule_text || 'Munkanapokon (H–P)'
    : ride.date_label || 'Ma';

  const activeBadge = formatRemainingTime(ride.expires_at);

  return (
    <article className="bg-white rounded-2xl p-3.5 sm:p-4 border border-[#DFD9CE] shadow-sm hover:border-pilis transition w-full">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-display font-extrabold text-xl sm:text-2xl text-[#18261F] shrink-0">
            {ride.time_label}
          </span>
          <span className="text-[11px] font-semibold text-pilis bg-pilis-soft px-2 py-0.5 rounded-full truncate">
            {scheduleSubtitle}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onShowOnMap(ride)}
            className="text-[11px] font-semibold text-[#5C6B62] hover:text-pilis bg-limestone px-2 py-1 rounded-full border border-[#DFD9CE]"
          >
            Útvonal
          </button>
          <span
            className={`text-[11px] font-bold px-2 py-1 rounded-full ${
              ride.kind === 'offer'
                ? 'bg-[#E6F2EC] text-pilis'
                : 'bg-terracotta-soft text-terracotta'
            }`}
          >
            {ride.kind === 'offer' ? `${ride.seats} hely` : 'Utat keres'}
          </span>
        </div>
      </div>

      <div className="my-2.5 space-y-1.5 font-semibold text-sm text-[#18261F]">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full border-[2.5px] border-pilis shrink-0" />
          <span className="truncate">{ride.origin_text}</span>
        </div>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-terracotta shrink-0" />
          <span className="truncate">{ride.dest_text}</span>
        </div>
      </div>

      {ride.stops && ride.stops.length > 0 && (
        <div className="my-2.5 pt-2 border-t border-[#ECE7DC]">
          <div className="text-[11px] font-medium text-[#5C6B62] mb-1.5">
            Felszállási pontok útközben:
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {ride.stops.map((st) => {
              const active = selectedStop?.name === st.name;
              return (
                <button
                  key={st.name}
                  type="button"
                  onClick={() => {
                    setSelectedStop(active ? null : st);
                    onShowOnMap(ride);
                  }}
                  className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border transition flex items-center gap-1.5 ${
                    active
                      ? 'bg-pilis text-white border-pilis'
                      : 'bg-limestone text-[#18261F] border-[#DFD9CE] hover:border-pilis'
                  }`}
                >
                  <span className="font-bold">{st.time}</span>
                  <span>{st.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {ride.note && (
        <p className="text-xs text-[#5C6B62] mb-2.5 leading-relaxed">{ride.note}</p>
      )}

      <div className="flex items-center justify-between pt-2.5 border-t border-[#ECE7DC] gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onInspectUser && ride.user_id) {
              onInspectUser({
                userId: ride.user_id,
                name: ride.author_name,
                zone: ride.author_zone
              });
            }
          }}
          className="flex items-center gap-2 min-w-0 text-left group cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-pilis group-hover:bg-pilis-light text-white font-bold text-xs grid place-items-center shrink-0 transition">
            {ride.author_name?.[0] || 'S'}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs text-[#18261F] group-hover:text-pilis flex flex-wrap items-center gap-1.5">
              <span className="underline decoration-[#DFD9CE] underline-offset-2 truncate">
                {ride.author_name} • {ride.author_zone}
              </span>
              <span className="text-[10px] font-extrabold bg-emerald-50 text-emerald-900 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                ✓ {kudosCount} ajánlás
              </span>
            </div>
            <div className="text-[11px] text-[#5C6B62]">
              Adatlap és visszajelzések ›
            </div>
          </div>
        </button>
            )}
          </div>
        </div>

        {isOwner ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onEditRide(ride)}
              className="bg-limestone hover:bg-[#E5DFD3] text-[#18261F] border border-[#DFD9CE] font-bold text-xs px-2.5 py-2 rounded-xl transition"
            >
              Szerkesztés
            </button>
            <button
              type="button"
              onClick={() => onDeleteRide(ride.id)}
              className="bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 font-bold text-xs px-2.5 py-2 rounded-xl transition"
            >
              Törlés
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onStartAgreement(ride, selectedStop)}
            className="bg-pilis hover:bg-pilis-light text-white font-bold text-xs px-3.5 py-2 rounded-xl shrink-0 transition"
          >
            {selectedStop
              ? `Felszállok (${selectedStop.time})`
              : ride.kind === 'offer'
              ? 'Csatlakozom'
              : 'Elviszem'}
          </button>
        )}
      </div>
    </article>
  );
}

