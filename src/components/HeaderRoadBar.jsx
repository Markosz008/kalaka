import React, { useState, useEffect, useMemo } from 'react';
import { RADAR_CATEGORY_MAP } from '../constants/cityRadar.js';

const SEVERITY_RANK = { danger: 3, warn: 2, ok: 1 };

export default function HeaderRoadBar({
  session,
  profile,
  roadAlerts,
  onOpenRoadModal,
  onOpenAuthModal
}) {
  const isLoggedIn = Boolean(session?.user);

  const { displayAlerts, activeProblemCount } = useMemo(() => {
    const realAlerts = (roadAlerts || []).filter((a) => a && a.id !== 'default-ok');
    const sorted = [...realAlerts].sort((a, b) => {
      const sevDiff = (SEVERITY_RANK[b.status_level] || 1) - (SEVERITY_RANK[a.status_level] || 1);
      if (sevDiff !== 0) return sevDiff;
      const confDiff = (b.confirm_count || 1) - (a.confirm_count || 1);
      if (confDiff !== 0) return confDiff;
      return new Date(b.last_confirmed_at || b.created_at) - new Date(a.last_confirmed_at || a.created_at);
    });

    const problems = sorted.filter((a) => a.status_level === 'danger' || a.status_level === 'warn');
    if (problems.length > 0) {
      return { displayAlerts: problems, activeProblemCount: problems.length };
    }
    if (sorted.length > 0) {
      return { displayAlerts: sorted, activeProblemCount: 0 };
    }
    return {
      displayAlerts: [
        {
          id: 'default-ok',
          status_level: 'ok',
          zone: '',
          category: 'traffic',
          confirm_count: 0,
          message: 'Folyamatos haladás a 11-es úton • Hegyi utak tiszták'
        }
      ],
      activeProblemCount: 0
    };
  }, [roadAlerts]);

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [displayAlerts.length]);

  useEffect(() => {
    if (displayAlerts.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % displayAlerts.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [displayAlerts.length]);

  const currentAlert = displayAlerts[activeIndex] || displayAlerts[0];
  const cleanZone = (profile?.zone || '').replace(/\s*\(.*?\)\s*/g, '').trim();
  const catShort = RADAR_CATEGORY_MAP[currentAlert.category]?.shortLabel;
  const isReal = currentAlert.id !== 'default-ok';

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
    <header className="bg-gradient-to-br from-pilis to-pilis-light text-[#F7F4EC] pt-[calc(1rem+env(safe-area-inset-top))] px-4 pb-5 rounded-b-3xl shadow-md">
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
          {isReal && currentAlert.zone && (
            <span className="text-[10px] font-extrabold bg-white/15 px-1.5 py-0.5 rounded text-white shrink-0">
              {currentAlert.zone}
            </span>
          )}
          <span className="truncate font-medium">
            {currentAlert.message}
          </span>
          {isReal && (currentAlert.confirm_count || 1) > 1 && (
            <span className="text-[10px] font-bold text-white/80 shrink-0">
              ({currentAlert.confirm_count} jelzés)
            </span>
          )}
        </div>

        <span className="shrink-0 bg-white/15 px-2.5 py-0.5 rounded-full font-semibold text-[11px]">
          {activeProblemCount > 1
            ? `${activeProblemCount} aktív ›`
            : activeProblemCount === 1
            ? `${catShort || 'Radar'} ›`
            : 'Radar ›'}
        </span>
      </button>
    </header>
  );
}
