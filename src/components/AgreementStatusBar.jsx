import React from 'react';

export default function AgreementStatusBar({
  isProInquiry,
  isRideAgreement,
  liveAgr,
  status,
  isHelper,
  isRequester,
  isPostOwner,
  ownerIsHelper,
  ownerConfirmed,
  joinerConfirmed,
  fullRouteLabel,
  rideDepLabel,
  etaSummary,
  gpsActive,
  busy,
  sharingPassengerPin,
  kudosTag,
  onChangeKudosTag,
  onProAccept,
  onProComplete,
  onCancelAgreement,
  onSequentialApproval,
  onUpdateStatus,
  onSharePassengerLocation,
  onGiveKudos
}) {
  if (isProInquiry) {
    if (!liveAgr.helper_id) return null;
    return (
      <div className="bg-[#ECE7DC] px-4 py-2.5 border-b border-[#DFD9CE] flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-[#18261F] min-w-0">
          {status === 'chatting' && (
            isHelper
              ? 'Érdeklődés érkezett • Fogadd el, ha elvállalod'
              : 'Egyeztetés folyamatban a szakemberrel'
          )}
          {status === 'agreed' && (
            isRequester
              ? 'Elvállalva • Ha elkészült a munka, zárd le és ajánld'
              : 'Elvállalva • Várakozás a megrendelő lezárására'
          )}
          {status === 'completed' && 'Munka lezárva ✓ • Ajánlás megnyitva'}
        </div>

        <div className="shrink-0">
          {status === 'chatting' && isHelper && (
            <button
              disabled={busy}
              onClick={onProAccept}
              className="bg-pilis hover:bg-pilis-light text-white text-xs font-bold px-3 py-1.5 rounded-xl"
            >
              Elvállaltam
            </button>
          )}

          {status === 'agreed' && isRequester && (
            <button
              disabled={busy}
              onClick={onProComplete}
              className="bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow"
            >
              Elkészült, ajánlom
            </button>
          )}
        </div>
      </div>
    );
  }

  const stackLayout =
    (status === 'chatting' && isPostOwner && !ownerConfirmed) ||
    ((status === 'arrived' || (!isRideAgreement && status === 'agreed')) && isRequester);

  return (
    <div
      className={`bg-[#ECE7DC] px-4 py-2.5 border-b border-[#DFD9CE] flex gap-2 ${
        stackLayout ? 'flex-col items-stretch' : 'flex-wrap items-center justify-between'
      }`}
    >
      <div className="text-xs font-semibold text-[#18261F] min-w-0 space-y-0.5">
        {status === 'chatting' && !ownerConfirmed && (
          <div>
            {isPostOwner
              ? isRideAgreement
                ? ownerIsHelper
                  ? 'Új jelentkezés • Fogadd el, ha belefér az útba'
                  : 'Új fuvarajánlat • Fogadd el, ha jó az indulás'
                : 'Új jelentkezés • Fogadd el, ha megfelel'
              : 'Várakozás a hirdető jóváhagyására'}
          </div>
        )}
        {status === 'chatting' && isPostOwner && !ownerConfirmed && isRideAgreement && fullRouteLabel && (
          <div className="text-[11px] font-medium text-[#4A5850] leading-snug">
            {fullRouteLabel}
            {rideDepLabel ? ` • Indulás: ${rideDepLabel}` : ''}
          </div>
        )}
        {status === 'chatting' && ownerConfirmed && !joinerConfirmed && (
          isPostOwner
            ? 'Elfogadtad • Várakozás a csatlakozó véglegesítésére'
            : 'A hirdető elfogadta • Véglegesítsd a csatlakozást'
        )}
        {status === 'agreed' && (
          isRideAgreement
            ? isHelper
              ? 'Megállapodva • Induláskor indítsd a követést'
              : 'Megállapodva • Várakozás a sofőr indulására'
            : isRequester
              ? `Megállapodva • Ha ${liveAgr.partner_name} segített, igazold vissza`
              : 'Megállapodva • Várakozás a másik fél visszaigazolására'
        )}
        {status === 'started' && (
          <span className="flex items-center gap-1.5 text-pilis font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse shrink-0" />
            <span className="truncate">
              {etaSummary || (gpsActive ? 'Élő helyzet megosztva' : 'Sofőr úton van')}
            </span>
          </span>
        )}
        {status === 'arrived' && (
          isRequester
            ? `Megérkeztetek • Igazold vissza: ${liveAgr.partner_name} elvitt`
            : 'Megérkezve • Várakozás az utas visszaigazolására'
        )}
        {status === 'completed' && 'Lezárva ✓'}
        {status === 'cancelled' && 'Lemondva ✕'}
      </div>

      <div className={`flex items-center gap-1.5 ${stackLayout ? 'w-full' : 'shrink-0'}`}>
        {status === 'chatting' && isPostOwner && !ownerConfirmed && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={onCancelAgreement}
              className="flex-1 bg-white hover:bg-red-50 text-red-700 border border-red-200 text-xs font-bold px-3 py-2 rounded-xl"
            >
              {isRideAgreement && ownerIsHelper ? 'Nem esik útba' : 'Nem jó'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onSequentialApproval}
              className="flex-[2] bg-pilis hover:bg-pilis-light text-white text-xs font-bold px-3 py-2 rounded-xl"
            >
              Elfogadom
            </button>
          </>
        )}

        {status === 'chatting' && !isPostOwner && ownerConfirmed && !joinerConfirmed && (
          <button
            disabled={busy}
            onClick={onSequentialApproval}
            className="bg-pilis hover:bg-pilis-light text-white text-xs font-bold px-3 py-1.5 rounded-xl"
          >
            Véglegesítem
          </button>
        )}

        {status === 'agreed' && isRideAgreement && isHelper && (
          <button
            disabled={busy}
            onClick={() => onUpdateStatus('started')}
            className="bg-pilis hover:bg-pilis-light text-white text-xs font-bold px-3 py-1.5 rounded-xl"
          >
            Elindultam
          </button>
        )}

        {status === 'started' && (
          <>
            {isRequester && (
              <button
                type="button"
                disabled={sharingPassengerPin}
                onClick={onSharePassengerLocation}
                className="bg-white text-[#18261F] border border-[#DFD9CE] text-xs font-bold px-2.5 py-1.5 rounded-xl"
              >
                {sharingPassengerPin ? '...' : 'Itt állok'}
              </button>
            )}
            {isHelper && (
              <button
                disabled={busy}
                onClick={() => onUpdateStatus('arrived')}
                className="bg-terracotta text-white text-xs font-bold px-3 py-1.5 rounded-xl"
              >
                Megérkeztem
              </button>
            )}
          </>
        )}

        {(status === 'arrived' || (!isRideAgreement && status === 'agreed')) && isRequester && (
          <div className="w-full flex items-center gap-2">
            <select
              value={kudosTag}
              onChange={(e) => onChangeKudosTag(e.target.value)}
              aria-label="Visszajelzés típusa"
              className="flex-1 min-w-0 bg-white border border-[#DFD9CE] text-[#18261F] text-xs font-bold px-2.5 py-2 rounded-xl"
            >
              <option value="Pontos és segítőkész">👏 Pontos, segítőkész</option>
              <option value="Szuper útitárs">🚗 Szuper útitárs</option>
              <option value="Gyors segítség">⚡ Gyors segítség</option>
              <option value="Igazi jó szomszéd">🤝 Igazi jó szomszéd</option>
            </select>
            <button
              disabled={busy}
              onClick={onGiveKudos}
              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow shrink-0"
            >
              Segített nekem ✓
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
