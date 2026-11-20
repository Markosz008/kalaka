import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RADAR_CATEGORY_MAP } from '../constants/cityRadar.js';
import { supabase } from '../lib/supabase.js';
import KalakaLogo from './KalakaLogo.jsx';
import CityMilestonesModal from './CityMilestonesModal.jsx';

const SEVERITY_RANK = { danger: 3, warn: 2, ok: 1 };

export default function HeaderRoadBar({
  session,
  profile,
  roadAlerts,
  onOpenRoadModal,
  onOpenAuthModal
}) {
  const isLoggedIn = Boolean(session?.user);
  const [cityStats, setCityStats] = useState({
    ride_hearts: 0,
    favor_hearts: 0,
    total_hearts: 0
  });
  const [loadingCityStats, setLoadingCityStats] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);

  const loadCityStats = useCallback(async () => {
    if (!supabase) return;
    setLoadingCityStats(true);
    try {
      const { data, error } = await supabase.rpc('get_city_heart_stats');
      if (!error && data) {
        setCityStats({
          ride_hearts: Number(data.ride_hearts || 0),
          favor_hearts: Number(data.favor_hearts || 0),
          total_hearts: Number(data.total_hearts || 0)
        });
      }
    } catch {
    } finally {
      setLoadingCityStats(false);
    }
  }, []);

  useEffect(() => {
    loadCityStats();
  }, [loadCityStats, profile?.ride_hearts, profile?.favor_hearts]);

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
    <>
      <header className="bg-gradient-to-br from-pilis to-pilis-light text-[#F7F4EC] pt-[calc(1rem+env(safe-area-inset-top))] px-4 pb-5 rounded-b-3xl shadow-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <KalakaLogo bare className="w-7 h-7 shrink-0" />
              <span className="font-display font-extrabold text-xl tracking-tight leading-none">
                Kaláka
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowCityModal(true);
                loadCityStats();
              }}
              className="flex items-center gap-1 text-[11px] font-semibold text-white/90 bg-white/10 hover:bg-white/20 border border-white/15 px-2 py-0.5 rounded-full transition shrink-0"
              title="Szentendre közös eredménye"
            >
              <span>Szentendre</span>
              <span className="text-white/40">·</span>
              <svg
                className="w-3 h-3 text-terracotta fill-current shrink-0"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              <span className="font-bold text-white">{cityStats.total_hearts}</span>
            </button>
          </div>

          {isLoggedIn ? (
            <button
              onClick={onOpenAuthModal}
              className="text-xs font-semibold bg-white/15 hover:bg-white/25 border border-white/20 px-3 py-1.5 rounded-full flex items-center gap-1.5 transition shrink-0 max-w-[150px] sm:max-w-[280px]"
            >
              <span className="font-bold truncate">
                {profile?.display_name && profile.display_name !== 'Belépés'
                  ? profile.display_name
                  : 'Profilom'}
              </span>
              {cleanZone && (
                <span className="text-white/75 hidden sm:inline-block truncate max-w-[120px] shrink-0">• {cleanZone}</span>
              )}
            </button>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="text-xs font-bold bg-white text-pilis hover:bg-limestone px-3.5 py-1.5 rounded-full shadow-sm transition shrink-0"
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

      <CityMilestonesModal
        isOpen={showCityModal}
        onClose={() => setShowCityModal(false)}
        stats={cityStats}
        loading={loadingCityStats}
      />
    </>
  );
}
