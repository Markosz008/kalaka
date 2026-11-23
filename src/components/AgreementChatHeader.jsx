import React from 'react';
import AvatarBadge from './AvatarBadge.jsx';

export default function AgreementChatHeader({
  liveAgr,
  currentUser,
  onInspectUser,
  onClose,
  isRideAgreement,
  isHelper,
  isProInquiry,
  status,
  showHeaderCancel,
  busy,
  editingCar,
  setEditingCar,
  carDraft,
  setCarDraft,
  savingCar,
  onSaveRideCar,
  onCancelAgreement,
  onReport,
  errorBanner,
  showReportBox,
  setShowReportBox,
  reportReason,
  setReportReason,
  onSubmitReport
}) {
  return (
    <>
      <div className="bg-white px-3.5 py-2.5 border-b border-[#DFD9CE] space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={onClose}
              className="text-2xl font-bold text-[#18261F] px-1 shrink-0 leading-none"
            >
              ‹
            </button>
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                const partnerId =
                  liveAgr.requester_id === currentUser?.id
                    ? liveAgr.helper_id
                    : liveAgr.requester_id;
                if (onInspectUser && partnerId) {
                  onInspectUser({ userId: partnerId, name: liveAgr.partner_name });
                }
              }}
              className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer hover:opacity-80 transition"
              title="Adatlap megtekintése"
            >
              <AvatarBadge
                src={liveAgr.partner_avatar}
                name={liveAgr.partner_name}
                sizeClass="w-9 h-9 text-sm shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm text-[#18261F] truncate">
                  {liveAgr.partner_name}
                </div>
                <div className="text-[11px] text-[#5C6B62] truncate">
                  {liveAgr.title}
                  {liveAgr.pickup_stop_name ? ` • ${liveAgr.pickup_stop_name}` : ''}
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-[#5C6B62] hover:text-black bg-limestone px-2.5 py-1.5 rounded-lg shrink-0"
          >
            Bezárás ✕
          </button>
        </div>

        {(liveAgr.car_info ||
          (isRideAgreement && isHelper && !editingCar) ||
          showHeaderCancel ||
          (!isProInquiry && status !== 'chatting')) && (
          <div className="flex items-center justify-between gap-2 flex-wrap pt-1.5 border-t border-[#ECE7DC]">
            <div className="flex items-center gap-1.5 flex-wrap">
              {liveAgr.car_info && (
                <span className="text-[11px] font-bold bg-[#ECE7DC] text-[#18261F] px-2.5 py-1 rounded-full">
                  {liveAgr.car_info}
                </span>
              )}
              {isRideAgreement && isHelper && !editingCar && (
                <button
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setCarDraft(liveAgr.car_info || '');
                    setEditingCar(true);
                  }}
                  className="text-[11px] font-bold text-pilis bg-pilis-soft px-2.5 py-1 rounded-full hover:bg-pilis hover:text-white transition"
                >
                  {liveAgr.car_info ? 'Autó módosítása' : '+ Autó megadása'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              {showHeaderCancel && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onCancelAgreement}
                  className="text-[11px] font-bold text-[#5C6B62] hover:text-red-700 bg-limestone px-2.5 py-1 rounded-lg border border-[#DFD9CE]"
                >
                  Lemondás
                </button>
              )}
              {!isProInquiry && status !== 'chatting' && (
                <button
                  type="button"
                  onClick={onReport}
                  className="text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg"
                >
                  Jelentés
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {editingCar && (
        <form
          onSubmit={onSaveRideCar}
          className="px-3.5 py-2 bg-limestone border-t border-[#DFD9CE] flex items-center gap-2"
        >
          <input
            type="text"
            value={carDraft}
            onChange={(e) => setCarDraft(e.target.value)}
            placeholder="Milyen autóval mész? (pl. Kék kombi)"
            className="flex-1 min-w-0 bg-white border border-[#DFD9CE] rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-pilis"
          />
          <button
            type="submit"
            disabled={savingCar}
            className="bg-pilis text-white font-bold text-xs px-3 py-1.5 rounded-xl shrink-0"
          >
            {savingCar ? '...' : 'Mentés'}
          </button>
          <button
            type="button"
            onClick={() => setEditingCar(false)}
            className="bg-white text-[#5C6B62] border border-[#DFD9CE] font-bold text-xs px-2.5 py-1.5 rounded-xl shrink-0"
          >
            ✕
          </button>
        </form>
      )}

      {errorBanner && (
        <div className="bg-red-100 text-red-900 text-xs font-semibold px-4 py-2 border-b border-red-200">
          {errorBanner}
        </div>
      )}

      {showReportBox && (
        <form
          onSubmit={onSubmitReport}
          className="bg-red-50 px-4 py-2.5 border-b border-red-200 flex items-center gap-2"
        >
          <input
            type="text"
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Írd le röviden a problémát..."
            className="flex-1 min-w-0 bg-white border border-red-300 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={busy}
            className="shrink-0 bg-red-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl"
          >
            Küldés
          </button>
          <button
            type="button"
            onClick={() => setShowReportBox(false)}
            className="shrink-0 text-xs font-bold text-[#5C6B62] px-1.5"
          >
            ✕
          </button>
        </form>
      )}
    </>
  );
}
