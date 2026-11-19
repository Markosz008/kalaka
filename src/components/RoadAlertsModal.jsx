import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  RADAR_CATEGORIES,
  RADAR_CATEGORY_MAP,
  formatMinutesLeft,
  formatShortTime
} from '../constants/cityRadar.js';
import { getCurrentPushSubscription, getDeviceInstallInfo } from '../lib/webPush.js';
import InstallPushGuideModal from './InstallPushGuideModal.jsx';

const SEVERITY_RANK = { danger: 3, warn: 2, ok: 1 };

export default function RoadAlertsModal({
  isOpen,
  onClose,
  roadAlerts,
  myAlertVotes,
  currentUserId,
  supabase,
  showNotice,
  onNeedAuth,
  onSubmitCityAlert,
  onVoteCityAlert,
  onDeleteRoadAlert
}) {
  const [filterCat, setFilterCat] = useState('all');
  const [formCat, setFormCat] = useState('traffic');
  const [formZone, setFormZone] = useState(RADAR_CATEGORIES[0].zones[0]);
  const [formLevel, setFormLevel] = useState('warn');
  const [formText, setFormText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [noteOpenId, setNoteOpenId] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [vpStyle, setVpStyle] = useState(null);
  const [showPushGuide, setShowPushGuide] = useState(false);
  const [pushActive, setPushActive] = useState(false);
  const scrollAreaRef = useRef(null);

  const scrollFocusedInput = useCallback((explicitEl) => {
    const run = () => {
      const box = scrollAreaRef.current;
      const target = explicitEl || document.activeElement;
      if (!box || !target || !box.contains(target)) return;
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
      const boxRect = box.getBoundingClientRect();
      const elRect = target.getBoundingClientRect();
      const desiredBottom = boxRect.bottom - 76;
      if (elRect.bottom > desiredBottom) {
        box.scrollTop += elRect.bottom - desiredBottom;
      } else if (elRect.top < boxRect.top + 12) {
        box.scrollTop -= boxRect.top + 12 - elRect.top;
      }
    };
    setTimeout(run, 60);
    setTimeout(run, 260);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    getCurrentPushSubscription().then((sub) => {
      if (!alive) return;
      setPushActive(Boolean(sub) && getDeviceInstallInfo().permission === 'granted');
    });
    return () => {
      alive = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || !window.visualViewport) {
      setVpStyle(null);
      return;
    }
    const vv = window.visualViewport;
    const syncViewport = () => {
      setVpStyle({
        height: `${Math.round(vv.height)}px`,
        top: `${Math.round(vv.offsetTop)}px`
      });
      scrollFocusedInput();
    };
    syncViewport();
    vv.addEventListener('resize', syncViewport);
    vv.addEventListener('scroll', syncViewport);
    return () => {
      vv.removeEventListener('resize', syncViewport);
      vv.removeEventListener('scroll', syncViewport);
    };
  }, [isOpen, scrollFocusedInput]);

  const activeCategoryConfig = RADAR_CATEGORY_MAP[formCat] || RADAR_CATEGORIES[0];

  useEffect(() => {
    if (!activeCategoryConfig.zones.includes(formZone)) {
      setFormZone(activeCategoryConfig.zones[0]);
    }
  }, [formCat, activeCategoryConfig, formZone]);

  const realAlerts = useMemo(() => {
    return (roadAlerts || [])
      .filter((a) => a && a.id !== 'default-ok')
      .sort((a, b) => {
        const sevDiff = (SEVERITY_RANK[b.status_level] || 1) - (SEVERITY_RANK[a.status_level] || 1);
        if (sevDiff !== 0) return sevDiff;
        const confDiff = (b.confirm_count || 1) - (a.confirm_count || 1);
        if (confDiff !== 0) return confDiff;
        return new Date(b.last_confirmed_at || b.created_at) - new Date(a.last_confirmed_at || a.created_at);
      });
  }, [roadAlerts]);

  const visibleAlerts = useMemo(() => {
    if (filterCat === 'all') return realAlerts;
    return realAlerts.filter((a) => (a.category || 'traffic') === filterCat);
  }, [realAlerts, filterCat]);

  const matchingActiveAlert = useMemo(() => {
    return realAlerts.find(
      (a) =>
        (a.category || 'traffic') === formCat &&
        a.zone === formZone &&
        a.status_level !== 'ok'
    );
  }, [realAlerts, formCat, formZone]);

  if (!isOpen) return null;

  const handleSubmit = async (levelOverride, textOverride) => {
    const finalLevel = levelOverride || formLevel;
    const finalText = (textOverride !== undefined ? textOverride : formText).trim();
    if (finalText.length < 4 || submitting) return;
    setSubmitting(true);
    const ok = await onSubmitCityAlert({
      category: formCat,
      zone: formZone,
      level: finalLevel,
      message: finalText
    });
    setSubmitting(false);
    if (ok) {
      setFormText('');
    }
  };

  const handleNoteSubmit = async (alertId) => {
    const clean = noteText.trim();
    if (clean.length < 3 || submitting) return;
    setSubmitting(true);
    const ok = await onVoteCityAlert(alertId, 'confirm', clean);
    setSubmitting(false);
    if (ok) {
      setNoteText('');
      setNoteOpenId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Szentendrei Városi Radar"
      style={vpStyle || undefined}
      className="fixed inset-x-0 top-0 h-[100dvh] bg-black/50 z-50 flex items-end sm:items-center justify-center pt-[calc(env(safe-area-inset-top)+0.75rem)] px-0 pb-0 sm:p-4"
    >
      <div className="bg-limestone w-full max-w-md rounded-t-3xl sm:rounded-3xl px-4 sm:px-5 pt-4 sm:pt-5 pb-0 border border-[#DFD9CE] shadow-2xl max-h-full flex flex-col overflow-hidden box-border">
        <div className="flex justify-between items-start gap-2 pb-3 shrink-0">
          <div>
            <h3 className="font-display font-extrabold text-lg text-[#18261F]">
              Szentendrei Városi Radar
            </h3>
            <p className="text-[11px] text-[#5C6B62]">
              Forgalom, HÉV és fontos helyi hírek Szentendréről.
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

        <div
          ref={scrollAreaRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-3 pb-[calc(1.75rem+env(safe-area-inset-bottom))]"
        >

        <button
          type="button"
          onClick={() => setShowPushGuide(true)}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-2xl border text-left text-xs transition ${
            pushActive
              ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
              : 'bg-white border-[#DFD9CE] text-[#18261F] hover:border-pilis'
          }`}
        >
          <div className="min-w-0">
            <div className="font-bold text-[11px] truncate">
              {pushActive ? 'Értesítések bekapcsolva ✓' : 'Kérj értesítést dugóról és fontos hírekről'}
            </div>
            <div className="text-[10px] text-[#5C6B62] truncate">
              {pushActive ? 'Értesítési beállítások módosítása' : 'Telefonos jelzések és főképernyőre rakás'}
            </div>
          </div>
          <span className="shrink-0 text-[11px] font-bold bg-limestone px-2.5 py-1 rounded-full text-pilis">
            Beállítás ›
          </span>
        </button>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {[
            { id: 'all', label: `Mind (${realAlerts.length})` },
            ...RADAR_CATEGORIES.map((c) => ({
              id: c.id,
              label: c.shortLabel
            }))
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterCat(tab.id)}
              className={`shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full border transition ${
                filterCat === tab.id
                  ? 'bg-pilis text-white border-pilis'
                  : 'bg-white text-[#5C6B62] border-[#DFD9CE] hover:border-pilis'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-0.5">
          {visibleAlerts.length === 0 ? (
            <div className="bg-white rounded-2xl p-3.5 border border-emerald-200/80 text-xs flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <div>
                <div className="font-bold text-[#18261F]">
                  Minden rendben
                </div>
                <div className="text-[11px] text-[#5C6B62]">
                  Jelenleg nyugodt a helyzet. Ha látsz valamit, szólj a többieknek alul!
                </div>
              </div>
            </div>
          ) : (
            visibleAlerts.map((al) => {
              const catInfo = RADAR_CATEGORY_MAP[al.category] || RADAR_CATEGORIES[0];
              const myVote = myAlertVotes?.[al.id];
              const confirms = Math.max(1, Number(al.confirm_count) || 1);
              const clears = Number(al.clear_count) || 0;
              const updates = Array.isArray(al.updates) ? al.updates.slice(-3) : [];
              const isDanger = al.status_level === 'danger';
              const isWarn = al.status_level === 'warn';
              const badgeTone = isDanger
                ? 'bg-red-100 text-red-900 border-red-200'
                : isWarn
                ? 'bg-amber-100 text-amber-950 border-amber-200'
                : 'bg-emerald-100 text-emerald-900 border-emerald-200';

              return (
                <div
                  key={al.id}
                  className="bg-white rounded-2xl p-3 border border-[#DFD9CE] text-xs space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${badgeTone}`}
                      >
                        {al.zone || catInfo.shortLabel}
                      </span>
                      <span className="text-[10px] font-bold text-[#5C6B62] bg-limestone px-2 py-0.5 rounded-full">
                        {catInfo.shortLabel}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          confirms >= 3
                            ? 'bg-pilis-soft text-pilis'
                            : 'bg-limestone text-[#5C6B62]'
                        }`}
                      >
                        {confirms >= 3 ? `${confirms}-en megerősítették ✓` : `${confirms} jelzés`}
                      </span>
                    </div>

                    {currentUserId && al.reporter_id === currentUserId && (
                      <button
                        type="button"
                        onClick={() => onDeleteRoadAlert(al.id)}
                        className="text-[11px] font-bold text-red-700 hover:underline shrink-0"
                      >
                        Törlés
                      </button>
                    )}
                  </div>

                  <div className="font-semibold text-[#18261F] leading-snug break-words">
                    {al.message}
                  </div>

                  <div className="text-[10px] text-[#5C6B62] flex items-center justify-between gap-2">
                    <span>
                      {al.author_name || 'Helyi lakos'} • {formatShortTime(al.created_at)}
                    </span>
                    <span className="font-semibold">
                      {formatMinutesLeft(al.expires_at)}
                    </span>
                  </div>

                  {updates.length > 0 && (
                    <div className="bg-limestone/70 rounded-xl p-2 space-y-1 border border-[#E7E1D6]">
                      {updates.map((u, idx) => (
                        <div key={idx} className="text-[11px] text-[#2A3A31] leading-snug">
                          <span className="font-bold text-[#5C6B62] mr-1.5">
                            {formatShortTime(u.at)}
                          </span>
                          <span>{u.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {al.status_level !== 'ok' && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => onVoteCityAlert(al.id, 'confirm')}
                        className={`flex-1 text-[11px] font-bold py-1.5 px-2.5 rounded-xl border transition ${
                          myVote === 'confirm'
                            ? 'bg-pilis text-white border-pilis'
                            : 'bg-limestone hover:bg-pilis-soft text-[#18261F] border-[#DFD9CE]'
                        }`}
                      >
                        Még tart (+1)
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => onVoteCityAlert(al.id, 'clear')}
                        className={`flex-1 text-[11px] font-bold py-1.5 px-2.5 rounded-xl border transition ${
                          myVote === 'clear'
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-limestone hover:bg-emerald-50 text-[#18261F] hover:text-emerald-900 border-[#DFD9CE]'
                        }`}
                      >
                        {clears > 0 ? `Már tiszta (${clears})` : 'Már tiszta ✓'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNoteOpenId(noteOpenId === al.id ? null : al.id);
                          setNoteText('');
                        }}
                        className="text-[11px] font-bold py-1.5 px-2.5 rounded-xl border border-[#DFD9CE] bg-white text-[#5C6B62] hover:text-[#18261F]"
                      >
                        + Frissítés
                      </button>
                    </div>
                  )}

                  {noteOpenId === al.id && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleNoteSubmit(al.id);
                      }}
                      className="flex items-center gap-1.5 pt-1"
                    >
                      <input
                        type="text"
                        value={noteText}
                        onFocus={(e) => scrollFocusedInput(e.target)}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Rövid frissítés (pl. OMV-től 30 perc)..."
                        className="flex-1 min-w-0 bg-limestone border border-[#DFD9CE] rounded-xl px-2.5 py-1.5 text-base focus:outline-none focus:border-pilis"
                      />
                      <button
                        type="submit"
                        disabled={submitting}
                        className="bg-pilis text-white font-bold text-[11px] px-3 py-1.5 rounded-xl shrink-0"
                      >
                        Küld
                      </button>
                    </form>
                  )}
                </div>
              );
            })
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#18261F]">
              Írj új jelzést
            </span>
            <span className="text-[10px] font-semibold text-[#5C6B62]">
              {activeCategoryConfig.ttlLabel}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1 bg-limestone p-1 rounded-xl text-[11px] font-bold">
            {RADAR_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setFormCat(c.id)}
                className={`py-1.5 px-1 rounded-lg transition truncate ${
                  formCat === c.id
                    ? 'bg-pilis text-white shadow-sm'
                    : 'text-[#5C6B62]'
                }`}
              >
                {c.shortLabel}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {activeCategoryConfig.zones.map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setFormZone(z)}
                className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${
                  formZone === z
                    ? 'bg-pilis-soft text-pilis border-pilis/40'
                    : 'bg-limestone text-[#5C6B62] border-[#DFD9CE] hover:border-pilis'
                }`}
              >
                {z}
              </button>
            ))}
          </div>

          {matchingActiveAlert && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5 text-[11px] text-amber-950">
              Erről már szóltak mások — a jelzésedet ehhez adjuk hozzá.
            </div>
          )}

          <div className="grid grid-cols-3 gap-1.5">
            {activeCategoryConfig.presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                disabled={submitting}
                onClick={() => handleSubmit(preset.level, preset.text)}
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

          <div className="grid grid-cols-3 gap-1 bg-limestone p-1 rounded-lg text-[11px] font-bold">
            {[
              ['warn', 'Figyelem'],
              ['danger', 'Súlyos / Áll'],
              ['ok', 'Rendben']
            ].map(([lvl, lbl]) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setFormLevel(lvl)}
                className={`py-1 rounded transition ${
                  formLevel === lvl
                    ? 'bg-white text-[#18261F] shadow-sm'
                    : 'text-[#5C6B62]'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          <input
            type="text"
            required
            value={formText}
            onFocus={(e) => scrollFocusedInput(e.target)}
            onChange={(e) => setFormText(e.target.value)}
            placeholder="Mi a helyzet? (pl. OMV kúttól áll a sor)"
            className="w-full bg-limestone border border-[#DFD9CE] rounded-xl px-3 py-2 text-base box-border focus:outline-none focus:border-pilis"
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-pilis hover:bg-pilis-light disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-xs transition"
          >
            {matchingActiveAlert ? 'Hozzáadás a meglévőhöz' : 'Küldés'}
          </button>
        </form>
        </div>
      </div>

      <InstallPushGuideModal
        isOpen={showPushGuide}
        onClose={() => setShowPushGuide(false)}
        supabase={supabase}
        currentUserId={currentUserId}
        onNeedAuth={onNeedAuth}
        showNotice={showNotice}
        onStatusChange={setPushActive}
      />
    </div>
  );
}
