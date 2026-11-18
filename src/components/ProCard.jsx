import React from 'react';
import {
  isLivePresenceActive,
  formatRemainingLiveTime,
  buildNavigationUrl
} from '../lib/prosHelpers.js';

export default function ProCard({
  pro,
  isOwner,
  isFav,
  firstRecommender,
  togglingLiveId,
  confirmDeleteProId,
  onSelectPro,
  onToggleFavorite,
  onToggleLivePresence,
  onOpenEditForm,
  onDeletePro,
  onMessageClick,
  onRecordInteraction
}) {
  const liveNow = isLivePresenceActive(pro);

  return (
    <article
      onClick={() => onSelectPro(pro)}
      className="bg-white rounded-2xl p-3.5 sm:p-4 border border-[#DFD9CE] hover:border-pilis shadow-sm space-y-2.5 cursor-pointer transition box-border"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            {pro.profession_name && (
              <span className="text-[11px] font-bold bg-pilis-soft text-pilis px-2.5 py-0.5 rounded-full">
                {pro.profession_name}
              </span>
            )}
            {pro.experience_years > 0 && (
              <span className="text-[11px] font-semibold bg-[#ECE7DC] text-[#18261F] px-2 py-0.5 rounded-full">
                {pro.experience_years} év tapasztalat
              </span>
            )}
            {liveNow ? (
              <a
                href={buildNavigationUrl(pro)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-0.5 rounded-full inline-flex items-center gap-1"
              >
                <span>● Most a közelben ({formatRemainingLiveTime(pro.live_until)})</span>
                <span>↗</span>
              </a>
            ) : pro.address_text ? (
              <a
                href={buildNavigationUrl(pro)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] font-semibold bg-limestone hover:bg-[#E5DFD3] text-[#18261F] px-2.5 py-0.5 rounded-full border border-[#DFD9CE] inline-flex items-center gap-1"
              >
                <span>{pro.address_text}</span>
                <span className="text-pilis font-bold">↗</span>
              </a>
            ) : pro.active_zone_today ? (
              <span className="text-[11px] font-bold bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full">
                Ma itt: {pro.active_zone_today}
              </span>
            ) : pro.base_zone ? (
              <span className="text-[11px] font-medium bg-limestone text-[#5C6B62] px-2.5 py-0.5 rounded-full">
                {pro.base_zone}
              </span>
            ) : null}
          </div>

          <h3 className="font-display font-bold text-base text-[#18261F] break-words">
            {pro.business_name}
          </h3>
          <p className="text-xs text-[#5C6B62] mt-0.5 line-clamp-1">
            {pro.specialty}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={(e) => onToggleFavorite(e, pro.id)}
            aria-label={isFav ? 'Eltávolítás a kedvencekből' : 'Mentés kedvencnek'}
            title={isFav ? 'Mentve a kedvencek közé' : 'Mentés kedvencnek'}
            className={`w-7 h-7 rounded-full border grid place-items-center text-sm font-bold transition ${
              isFav
                ? 'bg-amber-50 text-amber-500 border-amber-300'
                : 'bg-limestone text-[#9AA59E] hover:text-amber-500 border-[#DFD9CE]'
            }`}
          >
            {isFav ? '★' : '☆'}
          </button>
          <span className="text-xs font-bold text-[#5C6B62]">
            Részletek ›
          </span>
        </div>
      </div>

      {isOwner && (
        <div onClick={(e) => e.stopPropagation()} className="pt-1">
          <button
            type="button"
            disabled={togglingLiveId === pro.id}
            onClick={() => onToggleLivePresence(pro)}
            className={`w-full text-xs font-bold py-2 px-3 rounded-xl border transition ${
              liveNow
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : 'bg-pilis-soft/70 hover:bg-pilis text-pilis hover:text-white border-pilis/20'
            }`}
          >
            {togglingLiveId === pro.id
              ? 'GPS helyzet lekérése...'
              : liveNow
              ? `Élő jelenlét aktív (${formatRemainingLiveTime(pro.live_until)}) – Leállítás`
              : 'Most itt dolgozom (4 órára a térképre)'}
          </button>
        </div>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        className="flex items-center justify-between pt-2.5 border-t border-[#ECE7DC] gap-2"
      >
        <div className="min-w-0">
          <div className="text-xs font-bold text-[#18261F]">
            {pro.endorsement_count || 0} helyi ajánlás
          </div>
          {firstRecommender && (
            <div className="text-[11px] text-[#5C6B62] truncate">
              Ajánlotta: {firstRecommender.authorName}
              {firstRecommender.authorZone ? ` (${firstRecommender.authorZone})` : ''}
            </div>
          )}
        </div>

        {isOwner ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onOpenEditForm(pro)}
              className="bg-limestone hover:bg-[#E5DFD3] text-[#18261F] border border-[#DFD9CE] font-bold text-xs px-2.5 py-2 rounded-xl"
            >
              Szerkesztés
            </button>
            <button
              type="button"
              onClick={() => onDeletePro(pro.id)}
              className={`${
                confirmDeleteProId === pro.id
                  ? 'bg-red-700 text-white border-red-700'
                  : 'bg-red-50 hover:bg-red-100 text-red-800 border-red-200'
              } border font-bold text-xs px-2.5 py-2 rounded-xl transition`}
            >
              {confirmDeleteProId === pro.id ? 'Biztos? ✕' : 'Törlés'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0">
            {Boolean(pro.owner_id) && (
              <button
                type="button"
                onClick={() => onMessageClick(pro)}
                className="bg-limestone hover:bg-[#E5DFD3] text-[#18261F] border border-[#DFD9CE] font-bold text-xs px-3 py-2 rounded-xl transition"
              >
                Üzenet
              </button>
            )}
            <a
              href={`tel:${pro.phone}`}
              onClick={() => onRecordInteraction(pro, 'call')}
              className="bg-pilis hover:bg-pilis-light text-white font-bold text-xs px-3.5 py-2 rounded-xl transition"
            >
              Hívás
            </a>
          </div>
        )}
      </div>
    </article>
  );
}
