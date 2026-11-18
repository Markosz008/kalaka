import React from 'react';
import { ROAD_LOCATION_PREFIXES, ROAD_QUICK_PRESETS } from '../lib/appStorage.js';

export default function RoadAlertsModal({
  isOpen,
  onClose,
  roadAlerts,
  currentUserId,
  customRoadLevel,
  setCustomRoadLevel,
  customRoadText,
  setCustomRoadText,
  selectedRoadHub,
  roadInputRef,
  onSelectRoadPrefix,
  onAddRoadAlert,
  onClearRoadAlert,
  onDeleteRoadAlert
}) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Közlekedési és helyi helyzetkép"
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="bg-limestone w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-3 border border-[#DFD9CE] shadow-2xl max-h-[90vh] overflow-y-auto box-border">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-display font-extrabold text-lg text-[#18261F]">
              Közlekedési és helyi helyzetkép
            </h3>
            <p className="text-[11px] text-[#5C6B62]">
              A beküldött jelzések minden szentendrei felhasználónál megjelennek.
            </p>
          </div>
          <button
            type="button"
            aria-label="Ablak bezárása"
            onClick={onClose}
            className="text-sm font-bold text-[#5C6B62] px-2 py-1 shrink-0"
          >
            Bezárás ✕
          </button>
        </div>

        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
          {roadAlerts.map((al) => {
            const badgeTone =
              al.status_level === 'danger'
                ? 'bg-red-100 text-red-900 border-red-200'
                : al.status_level === 'warn'
                ? 'bg-amber-100 text-amber-900 border-amber-200'
                : 'bg-emerald-100 text-emerald-900 border-emerald-200';
            const badgeLabel =
              al.status_level === 'danger'
                ? 'Akadály / Lezárás'
                : al.status_level === 'warn'
                ? 'Torlódás'
                : 'Normál';

            return (
              <div
                key={al.id}
                className="bg-white rounded-xl p-3 border border-[#DFD9CE] text-xs space-y-1.5 flex items-start justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] text-[#5C6B62]">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${badgeTone}`}
                    >
                      {badgeLabel}
                    </span>
                    <span className="font-bold text-[#18261F]">
                      {al.author_name || 'Helyi lakos'}
                    </span>
                    <span>
                      {new Date(al.created_at).toLocaleTimeString('hu-HU', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="font-semibold text-[#18261F] break-words">
                    {al.message}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {al.id !== 'default-ok' && (
                    <button
                      type="button"
                      onClick={() => onClearRoadAlert(al.id)}
                      className="text-[10px] font-bold bg-limestone hover:bg-emerald-50 text-[#18261F] hover:text-emerald-900 border border-[#DFD9CE] px-2.5 py-1 rounded-lg transition"
                    >
                      Megszűnt ✓
                    </button>
                  )}
                  {currentUserId && al.reporter_id === currentUserId && (
                    <button
                      type="button"
                      onClick={() => onDeleteRoadAlert(al.id)}
                      className="text-[11px] font-bold text-red-700 hover:underline px-1"
                    >
                      Törlés
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onAddRoadAlert(customRoadLevel, customRoadText);
          }}
          className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-2.5"
        >
          <div className="text-xs font-bold text-[#18261F]">
            Új jelzés beküldése
          </div>

          <div className="grid grid-cols-3 gap-1 bg-limestone p-1 rounded-lg text-[11px] font-bold">
            {[
              ['warn', 'Torlódás'],
              ['danger', 'Akadály / Lezárás'],
              ['ok', 'Tiszta út']
            ].map(([lvl, lbl]) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setCustomRoadLevel(lvl)}
                className={`py-1.5 rounded transition ${
                  customRoadLevel === lvl
                    ? 'bg-pilis text-white shadow-sm'
                    : 'text-[#5C6B62]'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {ROAD_LOCATION_PREFIXES.map((locPrefix) => {
              const isActivePrefix = selectedRoadHub === locPrefix;
              return (
                <button
                  key={locPrefix}
                  type="button"
                  onClick={() => onSelectRoadPrefix(locPrefix)}
                  className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${
                    isActivePrefix
                      ? 'bg-pilis-soft text-pilis border-pilis/40'
                      : 'bg-limestone text-[#5C6B62] border-[#DFD9CE] hover:border-pilis'
                  }`}
                >
                  {locPrefix}
                </button>
              );
            })}
          </div>

          {ROAD_QUICK_PRESETS[selectedRoadHub] && (
            <div className="grid grid-cols-3 gap-1.5">
              {ROAD_QUICK_PRESETS[selectedRoadHub].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onAddRoadAlert(preset.level, preset.text)}
                  className={`text-[11px] font-bold py-2 px-2 rounded-xl border text-center leading-tight transition active:scale-95 ${
                    preset.level === 'danger'
                      ? 'bg-red-50 hover:bg-red-100 text-red-900 border-red-200'
                      : preset.level === 'warn'
                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-200'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}

          <input
            ref={roadInputRef}
            type="text"
            required
            value={customRoadText}
            onChange={(e) => setCustomRoadText(e.target.value)}
            placeholder="Pl. 11-es út: Papírgyártól lépésben halad, vagy HÉV P+R megtelt..."
            className="w-full bg-limestone border border-[#DFD9CE] rounded-xl px-3 py-2 text-base box-border focus:outline-none focus:border-pilis"
          />
          <button
            type="submit"
            className="w-full bg-pilis hover:bg-pilis-light text-white font-bold py-2.5 rounded-xl text-xs transition"
          >
            Közzététel
          </button>
        </form>
      </div>
    </div>
  );
}
