import React from 'react';

export default function FavorCard({ favor, currentUser, userProfile, onConnect, onEdit, onDelete }) {
  const isOwner = currentUser?.id === favor.user_id;
  const authorName = favor.profiles?.display_name || 'Szentendrei lakos';
  const favorHearts = favor.profiles?.favor_hearts || 0;
  const requiredHearts = favor.min_favor_hearts || 0;
  const myFavorHearts = userProfile?.favor_hearts || 0;
  const isLocked = !isOwner && requiredHearts > 0 && myFavorHearts < requiredHearts;

  return (
    <div className="bg-white rounded-2xl border border-stone-200/90 p-4 shadow-sm hover:border-stone-300 transition flex flex-col justify-between gap-3">
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-700">
            {favor.zone || 'Szentendre'}
          </span>

          {requiredHearts > 0 && (
            <span className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
              Kölcsönzés feltétele: {requiredHearts} korábbi segítség
            </span>
          )}
        </div>

        <h3 className="text-base font-bold text-stone-900">{favor.title}</h3>
        {favor.description && (
          <p className="text-xs sm:text-sm text-stone-600 mt-1 leading-relaxed">{favor.description}</p>
        )}
      </div>

      <div className="pt-2.5 border-t border-stone-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-stone-600">
          <span className="font-semibold text-stone-800">{authorName}</span>
          {favorHearts > 0 && (
            <span className="inline-flex items-center gap-1 text-terracotta font-medium bg-terracotta/10 px-2 py-0.5 rounded-full">
              🤝 {favorHearts}
            </span>
          )}
        </div>

        {isOwner ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onEdit(favor)}
              className="text-xs font-semibold text-pilis hover:bg-pilis-soft px-2.5 py-1.5 rounded-lg transition"
            >
              Szerkesztés
            </button>
            <button
              type="button"
              onClick={() => onDelete(favor.id)}
              className="text-xs font-semibold text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition"
            >
              Törlés
            </button>
          </div>
        ) : isLocked ? (
          <span className="text-xs font-medium text-stone-500 bg-stone-100 px-3 py-1.5 rounded-xl">
            Még {requiredHearts - myFavorHearts} segítség szükséges
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onConnect(favor)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-pilis text-white hover:bg-pilis-light transition"
          >
            Egyeztetés
          </button>
        )}
      </div>
    </div>
  );
}
