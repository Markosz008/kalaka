import React from 'react';
import {
  ENDORSEMENT_STRENGTH_TAGS,
  isLivePresenceActive,
  formatRemainingLiveTime,
  buildNavigationUrl
} from '../lib/prosHelpers.js';

export default function ProDetailModal({
  pro,
  currentUserId,
  isFav,
  eligibility,
  proEndorsements,
  claimRequests,
  showClaimFormForId,
  setShowClaimFormForId,
  claimPhone,
  setClaimPhone,
  claimNote,
  setClaimNote,
  claimSaving,
  togglingLiveId,
  confirmDeleteProId,
  selectedTags,
  endorseNote,
  setEndorseNote,
  endorseSaving,
  onClose,
  onOpenAuthModal,
  onToggleFavorite,
  onMessageClick,
  onRecordInteraction,
  onSubmitClaim,
  onToggleLivePresence,
  onOpenEditForm,
  onDeletePro,
  onToggleStrengthTag,
  onSubmitEndorsement
}) {
  if (!pro) return null;

  const isOwner = Boolean(currentUserId && pro.owner_id === currentUserId);
  const liveNow = isLivePresenceActive(pro);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-limestone w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-3.5 border border-[#DFD9CE] shadow-2xl max-h-[90vh] overflow-y-auto box-border"
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
                <span className="text-[11px] font-bold bg-[#ECE7DC] text-[#18261F] px-2.5 py-0.5 rounded-full">
                  {pro.experience_years} éve a szakmában
                </span>
              )}
            </div>
            <h3 className="font-display font-extrabold text-xl text-[#18261F] break-words">
              {pro.business_name}
            </h3>
            <div className="text-xs font-medium text-[#5C6B62] mt-0.5">
              {liveNow
                ? `Most a közelben van (${formatRemainingLiveTime(pro.live_until)})`
                : pro.address_text || pro.base_zone || 'Szentendre'}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={(e) => onToggleFavorite(e, pro.id)}
              className={`text-xs font-bold px-2.5 py-1.5 rounded-xl border transition ${
                isFav
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-white text-[#5C6B62] border-[#DFD9CE]'
              }`}
            >
              {isFav ? '★ Kedvenc' : '☆ Mentés'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-bold text-[#5C6B62] hover:text-black px-2 py-1 shrink-0"
            >
              Bezárás ✕
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-2">
          <div>
            <div className="text-[11px] font-bold text-[#5C6B62] uppercase tracking-wide">
              Miben segít
            </div>
            <div className="text-sm font-semibold text-[#18261F] mt-0.5">
              {pro.specialty}
            </div>
          </div>

          {pro.bio && (
            <div className="pt-2 border-t border-[#ECE7DC]">
              <div className="text-[11px] font-bold text-[#5C6B62] uppercase tracking-wide">
                Bemutatkozás
              </div>
              <p className="text-xs text-[#18261F] mt-1 leading-relaxed whitespace-pre-line">
                {pro.bio}
              </p>
            </div>
          )}
        </div>

        {buildNavigationUrl(pro) && (
          <a
            href={buildNavigationUrl(pro)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 bg-white hover:bg-pilis-soft/40 border border-[#DFD9CE] rounded-2xl px-3.5 py-2.5 transition"
          >
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-[#5C6B62] uppercase tracking-wide">
                {liveNow ? 'Élő helyszín (4 órás jelenlét)' : 'Telephely / cím'}
              </div>
              <div className="text-xs font-bold text-[#18261F] truncate">
                {liveNow
                  ? `Szentendre • Most a közelben (${formatRemainingLiveTime(pro.live_until)})`
                  : pro.address_text || pro.base_zone}
              </div>
            </div>
            <span className="shrink-0 bg-pilis-soft text-pilis font-bold text-xs px-3 py-1.5 rounded-xl">
              Navigáció ↗
            </span>
          </a>
        )}

        {!isOwner ? (
          <div>
            {Boolean(pro.owner_id) ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onMessageClick(pro)}
                  className="bg-white hover:bg-gray-50 text-[#18261F] border border-[#DFD9CE] font-bold text-sm py-3 rounded-xl transition"
                >
                  Üzenet írása
                </button>
                <a
                  href={`tel:${pro.phone}`}
                  onClick={() => onRecordInteraction(pro, 'call')}
                  className="bg-pilis hover:bg-pilis-light text-white font-bold text-sm py-3 rounded-xl text-center transition"
                >
                  Hívás indítása
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                <a
                  href={`tel:${pro.phone}`}
                  onClick={() => onRecordInteraction(pro, 'call')}
                  className="block w-full bg-pilis hover:bg-pilis-light text-white font-bold text-sm py-3 rounded-xl text-center transition"
                >
                  Hívás indítása ({pro.phone})
                </a>

                {claimRequests.some((c) => c.pro_id === pro.id && c.status === 'pending') ? (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold p-2.5 rounded-xl text-center">
                    Profilátvételi kérelmed elbírálás alatt áll.
                  </div>
                ) : showClaimFormForId === pro.id ? (
                  <form onSubmit={(e) => onSubmitClaim(e, pro)} className="bg-limestone border border-[#DFD9CE] rounded-xl p-3 space-y-2">
                    <div className="text-xs font-bold text-[#18261F]">
                      Vállalkozás igazolása
                    </div>
                    <input
                      type="tel"
                      required
                      value={claimPhone}
                      onChange={(e) => setClaimPhone(e.target.value)}
                      placeholder="Vállalkozás telefonszáma (+36...)"
                      className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3 py-2 text-sm box-border"
                    />
                    <input
                      type="text"
                      value={claimNote}
                      onChange={(e) => setClaimNote(e.target.value)}
                      placeholder="Céges e-mail, weboldal vagy rövid igazolás"
                      className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3 py-2 text-sm box-border"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={claimSaving}
                        className="flex-1 bg-pilis text-white font-bold text-xs py-2 rounded-xl"
                      >
                        {claimSaving ? 'Küldés...' : 'Igénylés beküldése'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowClaimFormForId(null)}
                        className="bg-white text-[#5C6B62] border border-[#DFD9CE] font-bold text-xs px-3 py-2 rounded-xl"
                      >
                        Mégse
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (!currentUserId) {
                        onOpenAuthModal();
                        return;
                      }
                      setShowClaimFormForId(pro.id);
                      setClaimPhone(pro.phone || '');
                    }}
                    className="w-full bg-white hover:bg-limestone text-[#5C6B62] border border-[#DFD9CE] font-bold text-xs py-2.5 rounded-xl transition"
                  >
                    Ez az én vállalkozásom – profil átvétele
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              disabled={togglingLiveId === pro.id}
              onClick={() => onToggleLivePresence(pro)}
              className={`w-full text-xs font-bold py-2.5 px-3 rounded-xl border transition ${
                liveNow
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : 'bg-pilis text-white border-pilis'
              }`}
            >
              {liveNow
                ? `Élő jelenlét aktív (${formatRemainingLiveTime(pro.live_until)}) – Leállítás`
                : 'Most itt dolgozom (4 órára a térképre)'}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onOpenEditForm(pro)}
                className="bg-white text-[#18261F] border border-[#DFD9CE] font-bold text-xs py-2.5 rounded-xl"
              >
                Adatlap szerkesztése
              </button>
              <button
                type="button"
                onClick={() => onDeletePro(pro.id)}
                className={`${
                  confirmDeleteProId === pro.id
                    ? 'bg-red-700 text-white border-red-700'
                    : 'bg-red-50 text-red-800 border-red-200'
                } border font-bold text-xs py-2.5 rounded-xl transition`}
              >
                {confirmDeleteProId === pro.id ? 'Biztosan törlöd? ✕' : 'Adatlap törlése'}
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#18261F]">
              Helyi ajánlások ({pro.endorsement_count || 0})
            </span>
            {eligibility.alreadyEndorsed && (
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                Ajánlva ✓
              </span>
            )}
          </div>

          {!isOwner && !eligibility.alreadyEndorsed && (
            eligibility.canEndorse ? (
              <div className="bg-limestone p-3 rounded-xl border border-pilis/25 space-y-2">
                <div className="text-xs font-bold text-[#18261F]">
                  Milyen tapasztalatod volt vele?
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ENDORSEMENT_STRENGTH_TAGS.map((tag) => {
                    const active = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => onToggleStrengthTag(tag)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition ${
                          active
                            ? 'bg-pilis text-white border-pilis'
                            : 'bg-white text-[#18261F] border-[#DFD9CE]'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  value={endorseNote}
                  onChange={(e) => setEndorseNote(e.target.value)}
                  placeholder="Írj egy rövid mondatot a szomszédoknak..."
                  className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3 py-2 text-base box-border"
                />
                <button
                  type="button"
                  disabled={endorseSaving}
                  onClick={() => onSubmitEndorsement(pro)}
                  className="w-full bg-pilis hover:bg-pilis-light text-white font-bold text-xs py-2.5 rounded-xl transition"
                >
                  {endorseSaving ? 'Mentés...' : 'Ajánlás közzététele'}
                </button>
              </div>
            ) : (
              <div className="text-xs text-[#5C6B62] bg-limestone p-2.5 rounded-xl leading-relaxed">
                {eligibility.reason}
              </div>
            )
          )}

          {proEndorsements.length === 0 ? (
            <div className="text-xs text-[#7A867E]">
              Még nem érkezett szöveges ajánlás.
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              {proEndorsements.map((item) => (
                <div
                  key={item.id}
                  className="bg-limestone rounded-xl p-2.5 border border-[#ECE7DC] space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-[#18261F]">
                      {item.authorName}
                      {item.authorZone ? ` • ${item.authorZone}` : ''}
                    </span>
                  </div>
                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] font-bold bg-pilis-soft text-pilis px-2 py-0.5 rounded-full"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.comment && (
                    <p className="text-xs text-[#18261F] leading-relaxed">
                      „{item.comment}”
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
