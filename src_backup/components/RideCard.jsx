import React from 'react';

export default function RideCard({ ride, currentUser, onConnect, onEdit, onDelete }) {
  const isOffer = ride.kind === 'offer';
  const isOwner = currentUser?.id === ride.user_id;
  const authorName = ride.profiles?.display_name || 'Szentendrei lakos';
  const authorZone = ride.profiles?.zone || '';
  const rideHearts = ride.profiles?.ride_hearts || 0;

  const departureTime = ride.schedule_label
    ? ride.schedule_label
    : ride.departure_at
    ? new Date(ride.departure_at).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="bg-white rounded-2xl border border-stone-200/90 p-4 shadow-sm hover:border-stone-300 transition flex flex-col justify-between gap-3">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isOffer ? 'bg-pilis-soft text-pilis' : 'bg-terracotta/15 text-terracotta'
              }`}
            >
              {isOffer ? 'Autóval megyek' : 'Fuvart keresek'}
            </span>
            {departureTime && (
              <span className="text-xs font-semibold text-stone-700 bg-stone-100 px-2.5 py-0.5 rounded-full">
                Indulás: {departureTime}
              </span>
            )}
          </div>

          {isOffer && ride.seats > 0 && (
            <span className="text-xs font-medium text-stone-600">{ride.seats} szabad hely</span>
          )}
        </div>

        <div className="flex items-center gap-2 text-base font-bold text-stone-900 flex-wrap">
          <span>{ride.origin_text}</span>
          <span className="text-stone-400 font-normal">→</span>
          <span>{ride.dest_text}</span>
        </div>

        {ride.note && <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">{ride.note}</p>}
      </div>

      <div className="pt-2.5 border-t border-stone-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-stone-600">
          <span className="font-semibold text-stone-800">{authorName}</span>
          {authorZone && <span className="text-stone-400">• {authorZone}</span>}
          {rideHearts > 0 && (
            <span className="inline-flex items-center gap-1 text-pilis font-medium bg-pilis-soft/60 px-2 py-0.5 rounded-full">
              ♥ {rideHearts}
            </span>
          )}
        </div>

        {isOwner ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onEdit(ride)}
              className="text-xs font-semibold text-pilis hover:bg-pilis-soft px-2.5 py-1.5 rounded-lg transition"
            >
              Szerkesztés
            </button>
            <button
              type="button"
              onClick={() => onDelete(ride.id)}
              className="text-xs font-semibold text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition"
            >
              Törlés
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onConnect(ride)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white transition ${
              isOffer ? 'bg-pilis hover:bg-pilis-light' : 'bg-terracotta hover:opacity-95'
            }`}
          >
            {isOffer ? 'Csatlakozom' : 'Elviszem'}
          </button>
        )}
      </div>
    </div>
  );
}
