import React, { useState } from 'react';
import { formatRemainingTime, maskAddressForPublic } from '../constants/szentendreData.js';

export default function RideCard({
  ride,
  currentUserId,
  hasExistingAgreement = false,
  kudosCount = 0,
  onStartAgreement,
  onShowOnMap,
  onEditRide,
  onDeleteRide,
  onInspectUser
}) {
  const [selectedStop, setSelectedStop] = useState(ride.stops?.[0] || null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isAsk = ride.kind === 'ask';
  const isRecurring = Boolean(ride.is_recurring);
  const isOwnRide = Boolean(currentUserId && ride.user_id === currentUserId);
  const remainingLabel = isRecurring ? null : formatRemainingTime(ride.expires_at);
  const totalHelps = Math.max(
    kudosCount,
    (ride.author_ride_hearts || 0) + (ride.author_favor_hearts || 0)
  );

  const displayOrigin = isOwnRide
    ? ride.origin_text
    : ride.public_origin_text || maskAddressForPublic(ride.origin_text);
  const displayDest = isOwnRide
    ? ride.dest_text
    : ride.public_dest_text || maskAddressForPublic(ride.dest_text);

  return (
    <article
      className={`rounded-2xl p-4 shadow-sm border transition ${
        isAsk
          ? 'bg-[#FFFDFB] border-[#E8D5CE] border-l-4 border-l-terracotta'
          : 'bg-white border-[#DFD9CE] hover:border-pilis/40'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`font-display font-extrabold text-base px-3 py-1 rounded-xl ${
              isAsk
                ? 'bg-terracotta-soft text-terracotta'
                : 'bg-pilis text-white'
            }`}
          >
            {ride.depart_time || ride.time_label}
          </span>

          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-limestone text-[#18261F] border border-[#DFD9CE]">
            {ride.date_label || 'Ma'}
          </span>

          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              isAsk
                ? 'bg-terracotta text-white'
                : 'bg-pilis-soft text-pilis'
            }`}
          >
            {isAsk
              ? `Utat keres • ${ride.seats || 1} utas`
              : `${ride.seats} szabad hely`}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onShowOnMap && onShowOnMap(ride)}
          className="shrink-0 text-xs font-bold text-pilis hover:underline px-2 py-1"
        >
          Térképen ›
        </button>
      </div>

      <div className="mt-3 space-y-1.5 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full border-2 border-pilis shrink-0" />
          <span className="font-bold text-[#18261F]">{displayOrigin}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-terracotta shrink-0" />
          <span className="font-bold text-[#18261F]">{displayDest}</span>
        </div>
      </div>

      {ride.note && (
        <p className="mt-2 text-xs text-[#4A5850] bg-limestone px-3 py-2 rounded-xl">
          „{ride.note}”
        </p>
      )}

      {!isAsk && Array.isArray(ride.stops) && ride.stops.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-[#ECE7DC]">
          <div className="text-xs font-bold text-[#4A5850] mb-1.5">
            Útba eső megállók (válassz felszállópontot):
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {ride.stops.map((st, idx) => {
              const active = selectedStop?.name === st.name;
              return (
                <button
                  key={`${st.name}-${idx}`}
                  type="button"
                  onClick={() => setSelectedStop(st)}
                  className={`shrink-0 text-xs px-3 py-1.5 rounded-lg border transition ${
                    active
                      ? 'bg-pilis text-white border-pilis font-bold'
                      : 'bg-limestone text-[#18261F] border-[#DFD9CE] hover:border-pilis'
                  }`}
                >
                  {st.time} {st.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-3.5 pt-2.5 border-t border-[#ECE7DC] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            role="button"
            tabIndex={0}
            onClick={() =>
              onInspectUser &&
              onInspectUser({
                userId: ride.user_id,
                name: ride.author_name,
                zone: ride.author_zone
              })
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter' && onInspectUser) {
                onInspectUser({
                  userId: ride.user_id,
                  name: ride.author_name,
                  zone: ride.author_zone
                });
              }
            }}
            className="flex items-center gap-2 min-w-0 cursor-pointer hover:opacity-80 transition"
            title="Adatlap és ajánlások megtekintése"
          >
            <div className="w-8 h-8 rounded-full bg-pilis-soft text-pilis font-bold text-xs grid place-items-center shrink-0">
              {ride.author_name?.[0] || 'S'}
            </div>
            <div className="text-xs truncate">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-[#18261F] underline decoration-[#DFD9CE] underline-offset-2">
                  {ride.author_name}
                </span>
                {ride.author_zone && (
                  <span className="text-[#4A5850]">• {ride.author_zone}</span>
                )}
                {totalHelps > 0 && (
                  <span className="text-[11px] font-bold text-pilis bg-pilis-soft px-2 py-0.5 rounded-full">
                    ♥ {totalHelps}
                  </span>
                )}
              </div>
              {remainingLabel && (
                <div className="text-[11px] text-[#4A5850]">
                  {remainingLabel}
                </div>
              )}
            </div>
          </div>
        </div>

        {isOwnRide ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onEditRide && onEditRide(ride)}
              className="text-xs font-bold px-3 py-2 rounded-xl bg-limestone hover:bg-pilis-soft text-[#18261F] border border-[#DFD9CE] transition"
            >
              Szerkesztés
            </button>
            {!confirmingDelete ? (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="text-xs font-bold px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 transition"
              >
                Törlés
              </button>
            ) : (
              <div className="flex items-center gap-1 bg-red-50 px-2 py-1 rounded-xl border border-red-200">
                <button
                  type="button"
                  onClick={() => onDeleteRide && onDeleteRide(ride.id)}
                  className="text-xs font-extrabold text-white bg-red-700 px-2.5 py-1 rounded-lg"
                >
                  Igen, törlöm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="text-xs font-bold text-[#4A5850] px-1.5 py-1"
                >
                  Mégse
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onStartAgreement(ride, selectedStop)}
            className={`shrink-0 text-xs font-bold px-4 py-2.5 rounded-xl text-white shadow-sm transition active:scale-95 ${
              hasExistingAgreement
                ? 'bg-emerald-700 hover:bg-emerald-800'
                : isAsk
                ? 'bg-terracotta hover:bg-[#b55538]'
                : 'bg-pilis hover:bg-pilis-light'
            }`}
          >
            {hasExistingAgreement
              ? 'Egyeztetés megnyitása ›'
              : isAsk
              ? 'Elviszem'
              : 'Csatlakozom'}
          </button>
        )}
      </div>
    </article>
  );
}
