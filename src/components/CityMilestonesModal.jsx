import React from 'react';

const MILESTONES = [
  { target: 25, label: 'Első közös lépések' },
  { target: 100, label: 'Összeszokott szomszédság' },
  { target: 250, label: 'Élő helyi hálózat' },
  { target: 500, label: 'Szentendre mozgásban' },
  { target: 1000, label: 'Példamutató kisváros' },
  { target: 2500, label: 'Dunakanyar szíve' }
];

export default function CityMilestonesModal({ isOpen, onClose, stats, loading }) {
  if (!isOpen) return null;

  const total = Number(stats?.total_hearts || 0);
  const rides = Number(stats?.ride_hearts || 0);
  const favors = Number(stats?.favor_hearts || 0);

  const nextMilestone =
    MILESTONES.find((m) => total < m.target) || MILESTONES[MILESTONES.length - 1];
  const prevTarget =
    [...MILESTONES].reverse().find((m) => total >= m.target)?.target || 0;
  const span = Math.max(1, nextMilestone.target - prevTarget);
  const progressPct =
    total >= nextMilestone.target
      ? 100
      : Math.min(100, Math.max(4, Math.round(((total - prevTarget) / span) * 100)));
  const remaining = Math.max(0, nextMilestone.target - total);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-limestone w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-5 border border-[#DFD9CE] shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] font-bold text-pilis uppercase tracking-wide">
              Közös szentendrei eredmény
            </div>
            <h3 className="font-display font-extrabold text-xl text-[#18261F]">
              Szentendre összefogása
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-bold text-[#5C6B62] hover:text-black px-2 py-1 shrink-0"
          >
            Bezárás ✕
          </button>
        </div>

        <div className="bg-gradient-to-br from-pilis to-pilis-light text-[#F7F4EC] rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-white/75 font-medium">
                Összes visszaigazolt segítség
              </div>
              <div className="font-display font-extrabold text-3xl mt-0.5 flex items-center gap-2">
                <svg
                  className="w-6 h-6 text-terracotta fill-current shrink-0"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                <span>{loading ? '...' : total}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-white/75 font-medium">Következő cél</div>
              <div className="text-sm font-extrabold">{nextMilestone.target} segítség</div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="w-full h-2.5 bg-white/15 rounded-full overflow-hidden">
              <div
                className="h-full bg-terracotta rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-white/80 font-medium">
              <span>{nextMilestone.label}</span>
              <span>
                {remaining > 0 ? `Még ${remaining} hiányzik` : 'Mérföldkő elérve'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-white rounded-2xl p-3 border border-[#DFD9CE]">
            <div className="text-[11px] font-bold text-pilis">Fuvarok</div>
            <div className="font-display font-extrabold text-2xl text-[#18261F] mt-0.5">
              {loading ? '...' : rides}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-[#DFD9CE]">
            <div className="text-[11px] font-bold text-amber-900">Kaláka segítések</div>
            <div className="font-display font-extrabold text-2xl text-[#18261F] mt-0.5">
              {loading ? '...' : favors}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-2">
          <div className="text-xs font-bold text-[#18261F]">Városi mérföldkövek</div>
          <div className="space-y-1.5">
            {MILESTONES.map((m) => {
              const reached = total >= m.target;
              const isCurrent = nextMilestone.target === m.target && !reached;
              return (
                <div
                  key={m.target}
                  className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs border ${
                    reached
                      ? 'bg-pilis-soft/70 border-pilis/20 text-pilis font-bold'
                      : isCurrent
                        ? 'bg-amber-50/70 border-amber-200 text-[#18261F] font-semibold'
                        : 'bg-limestone/60 border-transparent text-[#5C6B62]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-4 text-center shrink-0">
                      {reached ? '✓' : isCurrent ? '•' : '○'}
                    </span>
                    <span className="truncate">{m.label}</span>
                  </div>
                  <span className="font-mono text-[11px] font-bold shrink-0">
                    {m.target}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
