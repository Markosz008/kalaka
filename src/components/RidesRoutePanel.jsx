import React from 'react';
import AddressAutocompleteInput from './AddressAutocompleteInput.jsx';
import InteractiveRouteMap from './InteractiveRouteMap.jsx';
import { resolveCoordsFromText } from '../constants/szentendreData.js';
import {
  getUpcomingRoundTimeSlots,
  resolveAutoDayForTime,
  recordPersonalRoutine,
  getPersonalRoutines
} from '../lib/appStorage.js';

export default function RidesRoutePanel({
  session,
  profile,
  filterFrom,
  setFilterFrom,
  filterTo,
  setFilterTo,
  fromCoords,
  setFromCoords,
  toCoords,
  setToCoords,
  setActiveSearchField,
  isFromSaved,
  isToSaved,
  toggleSavePersonalPlace,
  locatingOriginGps,
  onFillOriginFromCurrentGps,
  onSwapOriginDest,
  onClearRouteInputs,
  hasRouteFilter,
  hasBothRouteEnds,
  personalRoutines,
  setPersonalRoutines,
  onLoadPersonalRoutine,
  savedPlaces,
  smartQuickChips,
  onSelectQuickLocation,
  showMap,
  setShowMap,
  hasOpenedMap,
  filteredRides,
  roadAlerts,
  selectedRideForMap,
  setSelectedRideForMap,
  isCurrentRouteSaved,
  inlineComposerMode,
  setInlineComposerMode,
  inlineTime,
  setInlineTime,
  inlineSeats,
  setInlineSeats,
  inlineSchedule,
  setInlineSchedule,
  inlineCarInfo,
  setInlineCarInfo,
  inlineNote,
  setInlineNote,
  inlineSaving,
  onPublishInlineRide,
  onOpenLegalModal,
  showNotice
}) {
  return (
    <section className="mx-3 sm:mx-4 -mt-3 bg-white rounded-2xl p-3 sm:p-3.5 shadow-lg border border-[#DFD9CE] relative z-20 space-y-2.5 box-border">
      {!session?.user && (
        <div className="flex items-center justify-between gap-2 bg-limestone px-3 py-1.5 rounded-xl border border-[#DFD9CE] text-[11px] text-[#5C6B62]">
          <span>
            <strong className="text-[#18261F]">Szentendrei szomszédsági háló:</strong> közös utak, szívességek és helyi szakemberek.
          </span>
          <button
            type="button"
            onClick={onOpenLegalModal}
            className="shrink-0 font-bold text-pilis underline"
          >
            Részletek
          </button>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <div className="flex-1 min-w-0 space-y-1">
          <AddressAutocompleteInput
            value={filterFrom}
            onFocus={() => setActiveSearchField('from')}
            isSavedPlace={isFromSaved}
            onToggleSavePlace={() => toggleSavePersonalPlace(filterFrom, fromCoords)}
            onChange={(val) => {
              setSelectedRideForMap(null);
              setFromCoords(null);
              setFilterFrom(val);
            }}
            onSelectPlace={(place) => {
              setFromCoords(place ? { lat: place.lat, lng: place.lng } : null);
              if (place) setShowMap(true);
              setActiveSearchField('to');
            }}
            placeholder="Honnan indulsz?"
            dotColor="border-pilis"
          />

          <div className="border-t border-[#ECE7DC] pt-1">
            <AddressAutocompleteInput
              value={filterTo}
              onFocus={() => setActiveSearchField('to')}
              isSavedPlace={isToSaved}
              onToggleSavePlace={() => toggleSavePersonalPlace(filterTo, toCoords)}
              onChange={(val) => {
                setSelectedRideForMap(null);
                setToCoords(null);
                setFilterTo(val);
              }}
              onSelectPlace={(place) => {
                setToCoords(place ? { lat: place.lat, lng: place.lng } : null);
                if (place) setShowMap(true);
              }}
              placeholder="Hová tartasz?"
              isSolidDot
            />
          </div>
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <button
            type="button"
            onClick={onFillOriginFromCurrentGps}
            disabled={locatingOriginGps}
            aria-label="Jelenlegi GPS helyzetem betöltése"
            title="Jelenlegi GPS helyzetem"
            className="w-8 h-8 rounded-xl bg-limestone hover:bg-pilis-soft text-pilis border border-[#DFD9CE] grid place-items-center text-xs font-bold transition active:scale-95"
          >
            {locatingOriginGps ? '…' : '📍'}
          </button>
          <button
            type="button"
            onClick={onSwapOriginDest}
            aria-label="Indulás és érkezés megfordítása"
            title="Irány megfordítása"
            className="w-8 h-8 rounded-xl bg-limestone hover:bg-pilis-soft text-[#18261F] border border-[#DFD9CE] grid place-items-center text-xs font-bold transition active:scale-95"
          >
            ⇅
          </button>
          {hasRouteFilter && (
            <button
              type="button"
              onClick={onClearRouteInputs}
              aria-label="Útvonal törlése"
              title="Útvonal törlése"
              className="w-8 h-7 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 grid place-items-center text-xs font-bold transition active:scale-95"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {personalRoutines.length > 0 && !filterFrom && !filterTo && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="shrink-0 text-[11px] font-bold text-[#5C6B62]">
            Útvonalaid:
          </span>
          {personalRoutines.slice(0, 3).map((rt) => (
            <button
              key={rt.key}
              type="button"
              onClick={() => onLoadPersonalRoutine(rt)}
              className="shrink-0 bg-pilis-soft/60 hover:bg-pilis text-pilis hover:text-white border border-pilis/20 text-[11px] font-bold px-2.5 py-1 rounded-xl transition active:scale-95"
            >
              {rt.origin.replace(/^Szentendre,\s*/i, '')} → {rt.dest.replace(/^Szentendre,\s*/i, '')}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-[#ECE7DC] min-w-0">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5 pr-3 min-w-0 flex-1 [mask-image:linear-gradient(to_right,black_88%,transparent_100%)]">
          {savedPlaces.map((sp) => {
            const isSelected = filterFrom === sp.label || filterTo === sp.label;
            return (
              <button
                key={`saved-${sp.label}`}
                type="button"
                onClick={() =>
                  onSelectQuickLocation(
                    sp.label,
                    sp.lat && sp.lng ? { lat: sp.lat, lng: sp.lng } : null
                  )
                }
                className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border transition flex items-center gap-1 ${
                  isSelected
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-amber-50 text-amber-950 border-amber-300 hover:border-amber-500'
                }`}
              >
                <span>★</span>
                <span>{sp.label.replace(/^Szentendre,\s*/i, '')}</span>
              </button>
            );
          })}

          {smartQuickChips.map((chipObj) => {
            const isSelected = filterFrom === chipObj.label || filterTo === chipObj.label;
            return (
              <button
                key={chipObj.label}
                type="button"
                onClick={() => onSelectQuickLocation(chipObj.label)}
                className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border transition flex items-center gap-1 ${
                  isSelected
                    ? 'bg-pilis text-white border-pilis'
                    : 'bg-limestone text-[#5C6B62] border-[#DFD9CE] hover:border-pilis'
                }`}
              >
                <span>{chipObj.label.replace('Szentendre ', '')}</span>
                {chipObj.liveCount > 0 && (
                  <span
                    className={`text-[10px] font-extrabold px-1.5 rounded-full ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-pilis-soft text-pilis'
                    }`}
                  >
                    {chipObj.liveCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowMap((v) => !v)}
          aria-expanded={showMap}
          className="shrink-0 text-xs font-bold text-pilis bg-pilis-soft px-2.5 py-1 rounded-lg transition active:scale-95"
        >
          {showMap ? 'Térkép ▴' : 'Térkép ▾'}
        </button>
      </div>

      {hasOpenedMap && (
        <div className={showMap ? 'block' : 'hidden'}>
          <InteractiveRouteMap
            isVisible={showMap}
            rides={filteredRides}
            roadAlerts={roadAlerts}
            fromText={filterFrom}
            toText={filterTo}
            fromCoords={fromCoords || resolveCoordsFromText(filterFrom)}
            toCoords={toCoords || resolveCoordsFromText(filterTo)}
            selectedRide={selectedRideForMap}
            onSelectRideOnMap={(rideObj) => setSelectedRideForMap(rideObj)}
            onClearSelectedRide={() => setSelectedRideForMap(null)}
            onPickLocation={(label, coordsObj, forcedField) =>
              onSelectQuickLocation(label, coordsObj, forcedField)
            }
            onUpdatePinCoords={(which, coordsObj) => {
              if (which === 'from') setFromCoords(coordsObj);
              else setToCoords(coordsObj);
            }}
          />
        </div>
      )}

      {hasBothRouteEnds && (
        <div className="pt-2.5 border-t border-[#ECE7DC]">
          {!inlineComposerMode ? (
            <div className="space-y-2 bg-limestone p-2.5 rounded-xl border border-[#DFD9CE]">
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="text-xs font-bold text-[#18261F]">
                  Kiírod ezt az útvonalat?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (isCurrentRouteSaved) {
                      const uid = session?.user?.id || null;
                      const next = personalRoutines.filter(
                        (r) =>
                          !(
                            r.origin.toLowerCase() === filterFrom.trim().toLowerCase() &&
                            r.dest.toLowerCase() === filterTo.trim().toLowerCase()
                          )
                      );
                      setPersonalRoutines(next);
                      try {
                        localStorage.setItem(
                          `kalaka_routines_${uid || 'guest'}`,
                          JSON.stringify(next)
                        );
                      } catch {}
                      showNotice('Útvonal eltávolítva.');
                    } else {
                      const startPt = fromCoords || resolveCoordsFromText(filterFrom);
                      const endPt = toCoords || resolveCoordsFromText(filterTo);
                      recordPersonalRoutine(
                        session?.user?.id || null,
                        filterFrom.trim(),
                        filterTo.trim(),
                        startPt,
                        endPt
                      );
                      setPersonalRoutines(getPersonalRoutines(session?.user?.id || null));
                      showNotice('Útvonal elmentve ★');
                    }
                  }}
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border transition ${
                    isCurrentRouteSaved
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-white text-[#5C6B62] border-[#DFD9CE] hover:border-amber-400'
                  }`}
                >
                  {isCurrentRouteSaved ? '★ Mentett útvonal' : '☆ Útvonal mentése'}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setInlineSeats(3);
                    setInlineCarInfo(profile?.car_info || '');
                    setInlineComposerMode('offer');
                  }}
                  className="bg-pilis hover:bg-pilis-light text-white font-bold text-xs px-2.5 py-2 rounded-lg transition active:scale-95"
                >
                  Van helyem
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInlineSeats(3);
                    setInlineCarInfo(profile?.car_info || '');
                    setInlineComposerMode('recurring');
                  }}
                  className="bg-white hover:border-pilis text-pilis border border-[#DFD9CE] font-bold text-xs px-2.5 py-2 rounded-lg transition active:scale-95"
                >
                  Rendszeres
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInlineSeats(1);
                    setInlineComposerMode('ask');
                  }}
                  className="bg-terracotta hover:bg-[#b55538] text-white font-bold text-xs px-2.5 py-2 rounded-lg transition active:scale-95"
                >
                  Utat keresek
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={onPublishInlineRide}
              className="bg-limestone p-3 rounded-xl border border-pilis/30 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1 bg-white p-1 rounded-lg border border-[#DFD9CE] text-[11px] font-bold">
                  {[
                    ['offer', 'Van helyem'],
                    ['recurring', 'Rendszeres'],
                    ['ask', 'Utat keresek']
                  ].map(([m, lbl]) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setInlineComposerMode(m);
                        if (m === 'ask') setInlineSeats(1);
                        else if (inlineSeats === 1) setInlineSeats(3);
                      }}
                      className={`px-2 py-1 rounded-md transition ${
                        inlineComposerMode === m
                          ? 'bg-pilis text-white'
                          : 'text-[#5C6B62]'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setInlineComposerMode(null)}
                  className="text-xs font-bold text-[#5C6B62] hover:text-black px-1"
                >
                  Mégse ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between bg-white border border-[#DFD9CE] rounded-xl px-3 py-2">
                  <span className="text-xs text-[#5C6B62] font-semibold">Indulás:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="time"
                      value={inlineTime}
                      onChange={(e) => setInlineTime(e.target.value)}
                      className="text-sm font-bold focus:outline-none bg-transparent"
                    />
                    {inlineComposerMode !== 'recurring' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pilis-soft text-pilis shrink-0">
                        {resolveAutoDayForTime(inlineTime, false)}
                      </span>
                    )}
                  </div>
                </div>

                <select
                  value={inlineSeats}
                  onChange={(e) => setInlineSeats(Number(e.target.value))}
                  aria-label="Helyek vagy utasok száma"
                  className="bg-white border border-[#DFD9CE] rounded-xl px-3 py-2 text-xs font-bold"
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {inlineComposerMode === 'ask' ? `${n} utas` : `${n} szabad hely`}
                    </option>
                  ))}
                </select>

                {inlineComposerMode !== 'recurring' ? (
                  <div className="col-span-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {getUpcomingRoundTimeSlots().map((slotTime) => (
                      <button
                        key={slotTime}
                        type="button"
                        onClick={() => setInlineTime(slotTime)}
                        className={`shrink-0 text-[11px] font-bold border px-2.5 py-1 rounded-lg transition ${
                          inlineTime === slotTime
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
                    value={inlineSchedule}
                    onChange={(e) => setInlineSchedule(e.target.value)}
                    aria-label="Rendszeres ütemezés"
                    className="col-span-2 bg-white border border-[#DFD9CE] rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value="Munkanapokon (H–P)">Munkanapokon (H–P)</option>
                    <option value="Minden nap">Minden nap</option>
                    <option value="Hétvégén (Szo–V)">Hétvégén (Szo–V)</option>
                    <option value="Hétfő, Szerda, Péntek">Hétfő, Szerda, Péntek</option>
                    <option value="Kedd, Csütörtök">Kedd, Csütörtök</option>
                  </select>
                )}
              </div>

              {inlineComposerMode !== 'ask' && (
                <input
                  type="text"
                  value={inlineCarInfo}
                  onChange={(e) => setInlineCarInfo(e.target.value)}
                  placeholder="Autód erre az útra (opcionális, pl. Fehér Suzuki)"
                  className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-pilis"
                />
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={inlineNote}
                  onChange={(e) => setInlineNote(e.target.value)}
                  placeholder="Megjegyzés (nem kötelező)..."
                  className="flex-1 min-w-0 bg-white border border-[#DFD9CE] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pilis"
                />
                <button
                  type="submit"
                  disabled={inlineSaving}
                  className="shrink-0 bg-pilis hover:bg-pilis-light text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition"
                >
                  {inlineSaving ? 'Mentés...' : 'Közzététel'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
