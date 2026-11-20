import React, { useMemo, useState } from 'react';
import {
  resolvePointCoords,
  estimateRideDetour,
  getSuggestedPickupOptions
} from '../lib/detourCalc.js';

export default function PickupSelectorModal({
  isOpen,
  ride,
  initialStop,
  displayOrigin,
  displayDest,
  onClose,
  onConfirm
}) {
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState(() =>
    initialStop?.name ? { name: initialStop.name, time: initialStop.time || '' } : null
  );

  const originCoords = useMemo(
    () =>
      ride?.origin_lat && ride?.origin_lng
        ? { lat: ride.origin_lat, lng: ride.origin_lng }
        : resolvePointCoords(ride?.origin_text),
    [ride?.origin_lat, ride?.origin_lng, ride?.origin_text]
  );

  const destCoords = useMemo(
    () =>
      ride?.dest_lat && ride?.dest_lng
        ? { lat: ride.dest_lat, lng: ride.dest_lng }
        : resolvePointCoords(ride?.dest_text),
    [ride?.dest_lat, ride?.dest_lng, ride?.dest_text]
  );

  const allOptions = useMemo(
    () => getSuggestedPickupOptions(originCoords, destCoords, ride?.stops || []),
    [originCoords, destCoords, ride?.stops]
  );

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allOptions.slice(0, 8);
    return allOptions
      .filter(
        (opt) =>
          opt.name.toLowerCase().includes(q) ||
          opt.subtitle.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [allOptions, query]);

  if (!isOpen || !ride) return null;

  const customText = query.trim();
  const activeSelection = chosen || (customText.length >= 3 ? { name: customText, time: '' } : null);
  const activeDetour = activeSelection
    ? activeSelection.detour ||
      estimateRideDetour(originCoords, destCoords, resolvePointCoords(activeSelection.name))
    : null;

  const handleConfirm = () => {
    if (!activeSelection?.name) return;
    onConfirm({
      name: activeSelection.name,
      time: activeSelection.time || '',
      detourLabel: activeDetour?.label || null
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-limestone w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] border border-[#DFD9CE] shadow-2xl max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="font-display font-extrabold text-base text-[#18261F]">
            Hol tudsz felszállni?
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-[#5C6B62] hover:text-black px-2 py-1"
          >
            Bezárás ✕
          </button>
        </div>

        <div className="text-xs text-[#4A5850] bg-white border border-[#DFD9CE] rounded-xl px-3 py-2 mb-3">
          <span className="font-bold text-[#18261F]">{displayOrigin}</span> →{' '}
          <span className="font-bold text-[#18261F]">{displayDest}</span>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setChosen(null);
          }}
          placeholder="Megálló, városrész vagy utcanév..."
          className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-sm mb-2.5 focus:outline-none focus:border-pilis"
        />

        <div className="text-[11px] font-bold text-[#5C6B62] mb-1.5">
          {query.trim() ? 'Találatok' : 'Legközelebbi megállók az útvonalhoz'}
        </div>

        <div className="overflow-y-auto space-y-1.5 pr-0.5 flex-1 min-h-0 max-h-64">
          {filteredOptions.map((opt) => {
            const isSelected = chosen?.name === opt.name;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setChosen(opt)}
                className={`w-full text-left px-3 py-2 rounded-xl border transition flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'bg-pilis text-white border-pilis'
                    : 'bg-white text-[#18261F] border-[#DFD9CE] hover:border-pilis'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">
                    {opt.time ? `${opt.time} ` : ''}
                    {opt.name}
                  </div>
                  <div
                    className={`text-[10px] truncate ${
                      isSelected ? 'text-white/80' : 'text-[#5C6B62]'
                    }`}
                  >
                    {opt.subtitle}
                  </div>
                </div>
                {opt.detour && (
                  <span
                    className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isSelected
                        ? 'bg-white/20 text-white border-white/30'
                        : opt.detour.badgeClass
                    }`}
                  >
                    {opt.detour.extraKm < 0.3
                      ? 'Útba esik'
                      : `+${opt.detour.extraKm.toFixed(1).replace('.', ',')} km`}
                  </span>
                )}
              </button>
            );
          })}

          {filteredOptions.length === 0 && customText.length >= 3 && (
            <div className="text-xs text-[#4A5850] bg-white border border-[#DFD9CE] rounded-xl p-3">
              Egyedi felszállópontként küldjük el: <strong>{customText}</strong>
            </div>
          )}
        </div>

        {activeSelection && (
          <div className="mt-3 pt-2.5 border-t border-[#DFD9CE] space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-[#5C6B62] truncate">
                Kiválasztva: <strong className="text-[#18261F]">{activeSelection.name}</strong>
              </span>
              {activeDetour && (
                <span
                  className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${activeDetour.badgeClass}`}
                >
                  {activeDetour.label}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleConfirm}
              className="w-full bg-pilis hover:bg-pilis-light text-white font-bold py-2.5 rounded-xl text-sm transition"
            >
              Jelentkezés küldése
            </button>
          </div>
        )}

        {!activeSelection && (
          <div className="mt-3 pt-2 border-t border-[#DFD9CE] text-[11px] text-[#5C6B62] text-center">
            Válassz megállót vagy írj be egy helyszínt, hogy a sofőr lássa, útba esel-e.
          </div>
        )}
      </div>
    </div>
  );
}
