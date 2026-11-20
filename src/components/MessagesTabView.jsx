import React from 'react';
import AvatarBadge from './AvatarBadge.jsx';

export default function MessagesTabView({
  visibleAgreements,
  onOpenAgreement,
  onHideCompletedAgreement,
  showPushBanner,
  onOpenPushSettings
}) {
  return (
    <div className="space-y-2.5">
      <h2 className="font-display font-extrabold text-lg">
        Beszélgetéseim ({visibleAgreements.length})
      </h2>

      {showPushBanner && onOpenPushSettings && (
        <div className="bg-pilis-soft/70 border border-pilis/20 rounded-2xl p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-[#18261F]">
              Azonnali jelzés új üzenetről
            </div>
            <p className="text-[11px] text-[#5C6B62] leading-snug">
              Kapcsold be az értesítéseket, hogy zárt appnál is szóljunk, ha jelentkezik egy szomszéd.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenPushSettings}
            className="shrink-0 bg-pilis hover:bg-pilis-light text-white text-xs font-bold px-3 py-2 rounded-xl transition"
          >
            Bekapcsolás ›
          </button>
        </div>
      )}

      {visibleAgreements.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 text-center text-xs text-[#5C6B62] border border-[#DFD9CE] space-y-2">
          <div className="font-bold text-sm text-[#18261F]">
            Még nincs aktív beszélgetésed.
          </div>
          <p>Csatlakozz egy fuvarhoz vagy Kaláka-kéréshez az egyeztetéshez.</p>
        </div>
      ) : (
        visibleAgreements.map((agr) => {
          const isDone = agr.status === 'completed' || agr.status === 'cancelled';
          return (
            <div
              key={agr.id}
              onClick={() => onOpenAgreement(agr)}
              className={`bg-white rounded-2xl p-3.5 sm:p-4 border shadow-sm flex items-center justify-between gap-3 cursor-pointer transition ${
                agr.has_unread
                  ? 'border-terracotta ring-1 ring-terracotta/30'
                  : 'border-[#DFD9CE] hover:border-pilis'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="relative shrink-0 mt-0.5">
                  <AvatarBadge
                    src={agr.partner_avatar}
                    name={agr.partner_name}
                    sizeClass="w-9 h-9 text-xs"
                  />
                  {agr.has_unread && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-terracotta ring-2 ring-white" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-[#18261F] truncate">
                      {agr.partner_name}
                    </span>
                    {isDone && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          agr.status === 'cancelled'
                            ? 'bg-gray-200 text-gray-700'
                            : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {agr.status === 'cancelled' ? 'Lemondva' : 'Lezárva'}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#5C6B62] truncate">
                    {agr.title}
                  </div>
                  {agr.last_message_body && (
                    <div
                      className={`text-xs mt-1 truncate ${
                        agr.has_unread
                          ? 'font-bold text-[#18261F]'
                          : 'text-[#5C6B62]'
                      }`}
                    >
                      {agr.last_message_body}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={(e) => onHideCompletedAgreement(e, agr.id)}
                  className="text-[11px] font-bold text-[#5C6B62] hover:text-red-700 bg-limestone px-2.5 py-1.5 rounded-xl border border-[#DFD9CE]"
                >
                  Törlés
                </button>
                <span
                  className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                    agr.has_unread
                      ? 'bg-terracotta text-white'
                      : 'bg-pilis-soft text-pilis'
                  }`}
                >
                  {agr.has_unread ? 'Új üzenet' : 'Megnyitás ›'}
                </span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
