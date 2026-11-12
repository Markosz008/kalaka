import React from 'react';
import { formatRemainingTime } from '../constants/szentendreData.js';

export default function FavorCard({
  hasExistingAgreement = false,
  kudosCount = 0,
  onInspectUser,
  favor,
  currentUserId,
  userFavorHearts,
  onStartFavorAgreement,
  onEditFavor,
  onDeleteFavor
}) {
  const isOwner = Boolean(currentUserId && favor.user_id === currentUserId);
  const minReq = favor.min_favor_hearts || 0;
  const isLocked = !isOwner && minReq > 0 && userFavorHearts < minReq;
  const isFeaturedHelper = (favor.author_favor_hearts || 0) >= 10;
  const activeBadge = formatRemainingTime(favor.expires_at);

  return (
    <article
      className={`bg-white rounded-2xl p-4 border shadow-sm transition ${
        isFeaturedHelper
          ? 'border-2 border-pilis bg-gradient-to-b from-white to-[#F7FBF8]'
          : 'border-[#DFD9CE]'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold bg-[#ECE7DC] text-[#5C6B62] px-2.5 py-0.5 rounded-full">
            📍 {favor.zone}
          </span>
          {activeBadge && (
            <span className="text-[11px] font-medium text-[#5C6B62]">
              • {activeBadge}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {isFeaturedHelper && (
            <span className="text-[11px] font-bold bg-pilis-soft text-pilis px-2.5 py-0.5 rounded-full">
              Kiemelt segítő
            </span>
          )}
          {minReq > 0 && (
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                isLocked
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-emerald-100 text-emerald-900'
              }`}
            >
              {isLocked ? `Legalább ${minReq} segítés szükséges` : `${minReq}+ segítés teljesítve`}
            </span>
          )}
        </div>
      </div>

      <h3 className="font-display font-bold text-base text-[#18261F]">
        {favor.title}
      </h3>
      {favor.description && (
        <p className="text-xs text-[#5C6B62] mt-1 mb-3 leading-relaxed">
          {favor.description}
        </p>
      )}

      <div className="flex items-center justify-between pt-2.5 border-t border-[#ECE7DC] gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onInspectUser && favor.user_id) {
              onInspectUser({
                userId: favor.user_id,
                name: favor.author_name,
                zone: favor.author_zone
              });
            }
          }}
          className="flex items-center gap-2 min-w-0 text-left group cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-pilis group-hover:bg-pilis-light text-white font-bold text-xs grid place-items-center shrink-0 transition">
            {favor.author_name?.[0] || 'K'}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs text-[#18261F] group-hover:text-pilis flex flex-wrap items-center gap-1.5">
              <span className="underline decoration-[#DFD9CE] underline-offset-2 truncate">
                {favor.author_name}{favor.author_zone ? ` • ${favor.author_zone}` : ''}
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

        {isOwner ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onEditFavor(favor)}
              className="bg-limestone hover:bg-[#E5DFD3] text-[#18261F] border border-[#DFD9CE] font-bold text-xs px-3 py-2 rounded-xl transition"
            >
              Szerkesztés
            </button>
            <button
              type="button"
              onClick={() => onDeleteFavor(favor.id)}
              className="bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 font-bold text-xs px-3 py-2 rounded-xl transition"
            >
              Törlés
            </button>
          </div>
        ) : (
          <button
            disabled={isLocked}
            onClick={() => onStartFavorAgreement(favor)}
            className={`font-bold text-xs px-4 py-2 rounded-xl transition ${
              isLocked
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-pilis hover:bg-pilis-light text-white'
            }`}
          >
            {hasExistingAgreement ? 'Egyeztetés ›' : isLocked ? `Legalább ${minReq} segítés` : 'Segítek / Írok'}
          </button>
        )}
      </div>
    </article>
  );
}

