import React from 'react';
import AddressAutocompleteInput from './AddressAutocompleteInput.jsx';
import { VALIDITY_OPTIONS } from '../constants/szentendreData.js';
import { getUpcomingRoundTimeSlots, resolveAutoDayForTime } from '../lib/appStorage.js';

export default function NewPostModal({
  isOpen,
  editingItemId,
  newKind,
  setNewKind,
  newFavorMode,
  setNewFavorMode,
  newFrom,
  setNewFrom,
  setNewFromCoords,
  newTo,
  setNewTo,
  setNewToCoords,
  newTime,
  setNewTime,
  newSeats,
  setNewSeats,
  newScheduleText,
  setNewScheduleText,
  newNote,
  setNewNote,
  newValidMins,
  setNewValidMins,
  newMinHearts,
  setNewMinHearts,
  showModalAdvanced,
  setShowModalAdvanced,
  onClose,
  onSubmit
}) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={editingItemId ? 'Kiírás szerkesztése' : 'Új kiírás'}
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <form
        onSubmit={onSubmit}
        className="bg-limestone w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-3 border border-[#DFD9CE] max-h-[90vh] overflow-y-auto box-border"
      >
        <div className="flex justify-between items-center">
          <h3 className="font-display font-extrabold text-lg">
            {editingItemId ? 'Kiírás szerkesztése' : 'Új kiírás'}
          </h3>
          <button
            type="button"
            aria-label="Űrlap bezárása"
            onClick={onClose}
            className="text-sm font-bold text-[#5C6B62] px-2 py-1"
          >
            Bezárás ✕
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1 bg-[#ECE7DC] p-1 rounded-xl text-[11px] sm:text-xs font-bold">
          {[
            ['offer', 'Van helyem'],
            ['recurring', 'Rendszeres'],
            ['ask', 'Utat keresek'],
            ['favor', 'Kaláka']
          ].map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setNewKind(k);
                if (k === 'favor') {
                  setNewFrom('');
                  setShowModalAdvanced(false);
                }
              }}
              className={`py-2 rounded-lg truncate px-1 ${
                newKind === k ? 'bg-white text-pilis shadow-sm' : 'text-[#5C6B62]'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>

        {newKind === 'favor' ? (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-1.5 bg-white p-1 rounded-xl border border-[#DFD9CE] text-xs font-bold">
              <button
                type="button"
                onClick={() => setNewFavorMode('ask')}
                className={`py-2 rounded-lg transition ${
                  newFavorMode === 'ask'
                    ? 'bg-terracotta text-white shadow-sm'
                    : 'text-[#5C6B62]'
                }`}
              >
                Segítséget kérek
              </button>
              <button
                type="button"
                onClick={() => setNewFavorMode('offer')}
                className={`py-2 rounded-lg transition ${
                  newFavorMode === 'offer'
                    ? 'bg-pilis text-white shadow-sm'
                    : 'text-[#5C6B62]'
                }`}
              >
                Felajánlok
              </button>
            </div>

            <input
              type="text"
              required
              value={newFrom}
              onChange={(e) => setNewFrom(e.target.value)}
              placeholder={
                newFavorMode === 'offer'
                  ? 'Mit ajánlasz fel a szomszédoknak?'
                  : 'Miben kérsz segítséget?'
              }
              className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-base box-border"
            />
          </div>
        ) : (
          <div className="bg-white rounded-xl p-2 border border-[#DFD9CE] space-y-1.5">
            <AddressAutocompleteInput
              value={newFrom}
              onChange={(val) => {
                setNewFromCoords(null);
                setNewFrom(val);
              }}
              onSelectPlace={(pl) =>
                setNewFromCoords(pl ? { lat: pl.lat, lng: pl.lng } : null)
              }
              placeholder="Honnan indulsz?"
              dotColor="border-pilis"
            />
            <div className="border-t border-[#ECE7DC] pt-1.5">
              <AddressAutocompleteInput
                value={newTo}
                onChange={(val) => {
                  setNewToCoords(null);
                  setNewTo(val);
                }}
                onSelectPlace={(pl) =>
                  setNewToCoords(pl ? { lat: pl.lat, lng: pl.lng } : null)
                }
                placeholder="Hová mész?"
                isSolidDot
              />
            </div>
          </div>
        )}

        {newKind !== 'favor' ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white border border-[#DFD9CE] rounded-xl px-3 py-2 flex items-center justify-between gap-1">
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="text-base font-bold bg-transparent focus:outline-none"
                />
                {newKind !== 'recurring' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pilis-soft text-pilis">
                    {resolveAutoDayForTime(newTime, false)}
                  </span>
                )}
              </div>
              <select
                value={newSeats}
                onChange={(e) => setNewSeats(e.target.value)}
                aria-label="Szabad helyek száma"
                className="bg-white border border-[#DFD9CE] rounded-xl px-3 py-2.5 text-xs font-bold box-border"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {newKind === 'ask' ? `${n} utas` : `${n} szabad hely`}
                  </option>
                ))}
              </select>
            </div>

            {newKind !== 'recurring' ? (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {getUpcomingRoundTimeSlots().map((slotTime) => (
                  <button
                    key={slotTime}
                    type="button"
                    onClick={() => setNewTime(slotTime)}
                    className={`shrink-0 text-[11px] font-bold border px-2.5 py-1 rounded-lg transition ${
                      newTime === slotTime
                        ? 'bg-pilis text-white border-pilis'
                        : 'bg-white hover:bg-pilis-soft text-pilis border-[#DFD9CE]'
                    }`}
                  >
                    {slotTime}
                  </button>
                ))}
              </div>
            ) : (
              <select
                value={newScheduleText}
                onChange={(e) => setNewScheduleText(e.target.value)}
                aria-label="Rendszeres napok"
                className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3 py-2.5 text-xs font-bold box-border"
              >
                <option value="Munkanapokon (H–P)">Munkanapokon (H–P)</option>
                <option value="Minden nap">Minden nap</option>
                <option value="Hétvégén (Szo–V)">Hétvégén (Szo–V)</option>
                <option value="Hétfő, Szerda, Péntek">Hétfő, Szerda, Péntek</option>
                <option value="Kedd, Csütörtök">Kedd, Csütörtök</option>
              </select>
            )}
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setShowModalAdvanced((v) => !v)}
              className="text-xs font-bold text-[#5C6B62] hover:text-pilis text-left"
            >
              {showModalAdvanced
                ? 'Időtartam és feltétel elrejtése ▴'
                : 'Időtartam vagy bizalmi feltétel beállítása ▾'}
            </button>

            {showModalAdvanced && (
              <>
                <div className="bg-white border border-[#DFD9CE] rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#18261F]">Ki jelentkezhet?</span>
                    <span className="font-bold text-pilis">
                      {Number(newMinHearts) === 0
                        ? 'Bárki'
                        : `Min. ${newMinHearts} visszaigazolt segítség`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={newMinHearts}
                    onChange={(e) => setNewMinHearts(e.target.value)}
                    className="w-full accent-pilis"
                  />
                </div>

                <div className="bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#18261F]">
                    Érvényesség
                  </span>
                  <select
                    value={newValidMins}
                    onChange={(e) => setNewValidMins(Number(e.target.value))}
                    className="text-xs font-bold text-pilis bg-limestone px-2.5 py-1.5 rounded-lg border border-[#DFD9CE]"
                  >
                    {VALIDITY_OPTIONS.map((opt) => (
                      <option key={opt.minutes} value={opt.minutes}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </>
        )}

        <input
          type="text"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Megjegyzés (nem kötelező)"
          className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-base box-border"
        />

        <button
          type="submit"
          className="w-full bg-pilis text-white font-bold py-3 rounded-xl text-sm"
        >
          {editingItemId ? 'Módosítások mentése' : 'Közzététel'}
        </button>
      </form>
    </div>
  );
}
