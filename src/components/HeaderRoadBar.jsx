import React, { useState, useEffect } from 'react';

export default function HeaderRoadBar({
  session,
  profile,
  roadAlerts,
  onOpenRoadModal,
  onOpenAuthModal
}) {
  const isLoggedIn = Boolean(session?.user);
  const alerts = roadAlerts && roadAlerts.length > 0
    ? roadAlerts
    : [
        {
          id: 'default-ok',
          status_level: 'ok',
          message: 'Folyamatos haladás a 11-es úton • HÉV P+R szabad'
        }
      ];

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [alerts.length]);

  useEffect(() => {
    if (alerts.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % alerts.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [alerts.length]);

  const currentAlert = alerts[activeIndex] || alerts[0];
  const activeCount = alerts.length;
  const cleanZone = (profile?.zone || '').replace(/\s*\(.*?\)\s*/g, '').trim();

  const statusStyles = {
    ok: 'bg-emerald-950/35 border-emerald-300/25 text-emerald-50',
    warn: 'bg-amber-950/60 border-amber-300/45 text-amber-50',
    danger: 'bg-red-950/60 border-red-300/45 text-red-50'
  };

  const dotColor = {
    ok: 'bg-emerald-400',
    warn: 'bg-amber-400 animate-pulse',
    danger: 'bg-red-400 animate-ping'
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
          statusStyles[currentAlert.status_level] || statusStyles.ok
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              dotColor[currentAlert.status_level] || dotColor.ok
            }`}
          />
          {activeCount > 1 && (
            <span className="text-[10px] font-extrabold bg-white/20 px-1.5 py-0.2 rounded text-white shrink-0">
              {activeIndex + 1}/{activeCount}
            </span>
          )}
          <span className="truncate font-medium">{currentAlert.message}</span>
        </div>

        <span className="shrink-0 bg-white/15 px-2.5 py-0.5 rounded-full font-semibold text-[11px]">
          {activeCount > 1 || currentAlert.id !== 'default-ok'
            ? `Pulzus (${activeCount}) ›`
            : '+ Helyi infó ›'}
        </span>
      </button>
    </header>
  );
}
