import React from 'react';

export default function HeaderRoadBar({
  session,
  profile,
  roadAlerts,
  onOpenRoadModal,
  onOpenAuthModal
}) {
  const isLoggedIn = Boolean(session?.user);
  const latestAlert = roadAlerts?.[0] || {
    status_level: 'ok',
    message: 'Folyamatos haladás a 11-es úton'
  };
  const activeCount = roadAlerts?.length || 0;
  const cleanZone = (profile?.zone || '').replace(/\s*\(.*?\)\s*/g, '').trim();

  const statusStyles = {
    ok: 'bg-emerald-950/35 border-emerald-300/25 text-emerald-50',
    warn: 'bg-amber-950/55 border-amber-300/40 text-amber-50',
    danger: 'bg-red-950/55 border-red-300/40 text-red-50'
  };

  const dotColor = {
    ok: 'bg-emerald-400',
    warn: 'bg-amber-400',
    danger: 'bg-red-400'
  };

  return (
    <header className="bg-gradient-to-br from-pilis to-pilis-light text-[#F7F4EC] pt-4 px-4 pb-5 rounded-b-3xl shadow-md">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="font-display font-extrabold text-xl tracking-tight">
            Kaláka
          </span>
          <span className="text-xs font-medium text-white/70">Szentendre</span>
        </div>

        {isLoggedIn ? (
          <button
            onClick={onOpenAuthModal}
            className="text-xs font-semibold bg-white/15 hover:bg-white/25 border border-white/20 px-3 py-1.5 rounded-full flex items-center gap-2 transition"
          >
            <span className="font-bold">
              {profile?.display_name && profile.display_name !== 'Belépés'
                ? profile.display_name
                : 'Profilom'}
            </span>
            {cleanZone && (
              <span className="text-white/75 hidden sm:inline">• {cleanZone}</span>
            )}
          </button>
        ) : (
          <button
            onClick={onOpenAuthModal}
            className="text-xs font-bold bg-white text-pilis hover:bg-limestone px-3.5 py-1.5 rounded-full shadow-sm transition"
          >
            Belépés
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onOpenRoadModal}
        className={`mt-3 w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs text-left transition hover:bg-white/10 ${
          statusStyles[latestAlert.status_level] || statusStyles.ok
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              dotColor[latestAlert.status_level] || dotColor.ok
            }`}
          />
          <span className="truncate font-medium">{latestAlert.message}</span>
        </div>

        <span className="shrink-0 bg-white/15 px-2.5 py-0.5 rounded-full font-semibold text-[11px]">
          {activeCount > 1 ? `${activeCount} jelzés ›` : 'Útinfó ›'}
        </span>
      </button>
    </header>
  );
}
