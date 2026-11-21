import React, { useState, useEffect } from 'react';
import { RADAR_CATEGORIES } from '../constants/cityRadar.js';
import {
  getDeviceInstallInfo,
  getCurrentPushSubscription,
  hasNativeInstallPrompt,
  onInstallPromptChange,
  triggerNativeInstall,
  subscribeToWebPush,
  updatePushCategories,
  unsubscribeFromWebPush
} from '../lib/webPush.js';

export default function InstallPushGuideModal({
  isOpen,
  onClose,
  supabase,
  currentUserId,
  onNeedAuth,
  showNotice,
  onStatusChange,
  initialFocus = 'messages'
}) {
  const [info, setInfo] = useState(() => getDeviceInstallInfo());
  const [canNativeInstall, setCanNativeInstall] = useState(() => hasNativeInstallPrompt());
  const [subEndpoint, setSubEndpoint] = useState(null);
  const [selectedCats, setSelectedCats] = useState([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [guideTab, setGuideTab] = useState(() => (getDeviceInstallInfo().isAndroid ? 'android' : 'ios'));
  const [showOtherGuide, setShowOtherGuide] = useState(false);

  useEffect(() => {
    return onInstallPromptChange((avail) => setCanNativeInstall(avail));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setInfo(getDeviceInstallInfo());
    setFeedback(null);

    let active = true;
    (async () => {
      const sub = await getCurrentPushSubscription();
      if (!active) return;
      if (sub?.endpoint) {
        setSubEndpoint(sub.endpoint);
        if (supabase && currentUserId) {
          const { data } = await supabase
            .from('push_subscriptions')
            .select('categories')
            .eq('user_id', currentUserId)
            .eq('endpoint', sub.endpoint)
            .maybeSingle();
          if (active && Array.isArray(data?.categories)) {
            setSelectedCats(data.categories);
          }
        }
      } else {
        setSubEndpoint(null);
        if (active) {
          setSelectedCats([]);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [isOpen, supabase, currentUserId]);

  if (!isOpen) return null;

  const isSubscribed = Boolean(subEndpoint) && info.permission === 'granted';
  const needsIosInstall = info.isIOS && !info.isStandalone;

  const handleToggleCategory = async (catId) => {
    const exists = selectedCats.includes(catId);
    const next = exists
      ? selectedCats.filter((c) => c !== catId)
      : [...selectedCats, catId];
    setSelectedCats(next);

    if (isSubscribed && supabase && currentUserId && subEndpoint) {
      try {
        await updatePushCategories(supabase, currentUserId, subEndpoint, next);
        if (showNotice) {
          showNotice(
            next.length === 0
              ? 'Városi Radar elnémítva (az üzeneteid továbbra is megérkeznek)'
              : 'Városi Radar témák elmentve ✓'
          );
        }
      } catch (err) {
        setFeedback({ type: 'err', text: err.message });
      }
    }
  };

  const handleEnablePush = async () => {
    if (!currentUserId) {
      onClose();
      if (onNeedAuth) onNeedAuth();
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const catsToSave = selectedCats;
      const sub = await subscribeToWebPush(supabase, currentUserId, catsToSave);
      setSubEndpoint(sub.endpoint);
      setInfo(getDeviceInstallInfo());
      if (onStatusChange) onStatusChange(true);
      setFeedback({
        type: 'ok',
        text: catsToSave.length > 0
          ? 'Üzenet- és Radar-értesítések bekapcsolva!'
          : 'Üzenet-értesítések bekapcsolva! A Városi Radar témáit lent bármikor hozzáadhatod.'
      });
    } catch (err) {
      setFeedback({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleDisablePush = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      await unsubscribeFromWebPush(supabase, currentUserId);
      setSubEndpoint(null);
      if (onStatusChange) onStatusChange(false);
      setFeedback({ type: 'ok', text: 'Értesítések kikapcsolva.' });
    } catch (err) {
      setFeedback({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleNativeInstall = async () => {
    const accepted = await triggerNativeInstall();
    if (accepted && showNotice) {
      showNotice('Kaláka hozzáadva a főképernyőhöz ✓');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Értesítések és főképernyőhöz adás"
      className="fixed inset-0 bg-black/60 z-[70] flex items-end sm:items-center justify-center pt-[calc(env(safe-area-inset-top)+0.75rem)] px-0 pb-0 sm:p-4"
    >
      <div className="bg-limestone w-full max-w-md rounded-t-3xl sm:rounded-3xl px-4 sm:px-5 pt-4 sm:pt-5 pb-0 border border-[#DFD9CE] shadow-2xl max-h-full flex flex-col overflow-hidden box-border">
        <div className="flex justify-between items-start gap-2 pb-3 shrink-0">
          <div>
            <h3 className="font-display font-extrabold text-lg text-[#18261F]">
              {initialFocus === 'radar' ? 'Városi Radar értesítések' : 'Telefonos értesítések'}
            </h3>
            <p className="text-[11px] text-[#5C6B62]">
              A privát üzenetek alapból külön működnek a Városi Radar riasztásaitól.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-bold text-[#5C6B62] px-2 py-1 shrink-0"
          >
            Bezárás ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {info.isInAppBrowser && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 text-xs text-amber-950 space-y-1.5">
              <div className="font-extrabold">Nyisd meg Safariban vagy Chrome-ban!</div>
              <p className="leading-snug">
                A Facebook / Messenger beépített ablakából a telefon nem engedi a főképernyőre
                rakást. Nyomj a jobb alsó vagy jobb felső menüre, és válaszd a{' '}
                <strong>Megnyitás külső böngészőben</strong> gombot.
              </p>
            </div>
          )}

          {needsIosInstall && (
            <div className="bg-white border border-[#DFD9CE] rounded-2xl p-3.5 space-y-2.5 text-xs">
              <div className="font-extrabold text-[#18261F]">
                iPhone-on 3 lépés az értesítésekhez
              </div>
              <p className="text-[11px] text-[#5C6B62] leading-snug">
                Az Apple csak a főképernyőre kitett alkalmazásból engedi az értesítéseket:
              </p>
              <ol className="space-y-2 text-[#18261F]">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-pilis text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Nyomj alul a <strong>Megosztás</strong> ikonra (négyzet felfelé mutató nyíllal).
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-pilis text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Görgess lejjebb, válaszd a <strong>Főképernyőhöz adás</strong> pontot, majd jobb felül: <strong>Hozzáadás</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-pilis text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Nyisd meg a Kalákát az új főképernyős ikonról, és kapcsold be itt az értesítéseket.
                  </span>
                </li>
              </ol>
            </div>
          )}

          {info.isAndroid && !info.isStandalone && (
            <div className="bg-white border border-[#DFD9CE] rounded-2xl p-3.5 space-y-2.5 text-xs">
              <div className="font-extrabold text-[#18261F]">
                Tedd ki ikonként a főképernyőre (Android)
              </div>
              {canNativeInstall ? (
                <button
                  type="button"
                  onClick={handleNativeInstall}
                  className="w-full bg-pilis hover:bg-pilis-light text-white font-bold py-2.5 rounded-xl text-xs transition"
                >
                  Kaláka hozzáadása a főképernyőhöz
                </button>
              ) : (
                <p className="text-[11px] text-[#5C6B62] leading-snug">
                  Chrome-ban nyomj a jobb felső <strong>⋮</strong> menüre, majd válaszd az{' '}
                  <strong>Alkalmazás telepítése</strong> vagy <strong>Hozzáadás a kezdőképernyőhöz</strong> opciót.
                </p>
              )}
            </div>
          )}

          {!needsIosInstall && (
            <>
              <div className="bg-white border border-[#DFD9CE] rounded-2xl p-3.5 space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-[#18261F]">Privát üzenetek és fuvarok</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isSubscribed
                        ? 'bg-emerald-100 text-emerald-900'
                        : 'bg-limestone text-[#5C6B62]'
                    }`}
                  >
                    {isSubscribed ? 'Aktív ✓' : 'Kikapcsolva'}
                  </span>
                </div>

                <p className="text-[11px] text-[#5C6B62] leading-snug">
                  Zárt appnál is azonnal szólunk új üzenetről, elfogadásról és indulásról. Városi hírekkel alapból nem zavarunk.
                </p>

                {info.permission === 'denied' && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-[11px] text-red-900">
                    Az értesítések le vannak tiltva ennél az oldalnál. A telefon Beállítások → Értesítések menüjében tudod újra engedélyezni.
                  </div>
                )}

                {feedback && (
                  <div
                    className={`rounded-xl p-2.5 text-[11px] font-semibold ${
                      feedback.type === 'ok'
                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                        : 'bg-red-50 text-red-900 border border-red-200'
                    }`}
                  >
                    {feedback.text}
                  </div>
                )}

                {!isSubscribed ? (
                  <button
                    type="button"
                    disabled={busy || !info.supportsPush}
                    onClick={handleEnablePush}
                    className="w-full bg-pilis hover:bg-pilis-light disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-xs transition"
                  >
                    {busy ? 'Bekapcsolás...' : 'Értesítések bekapcsolása'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleDisablePush}
                    className="w-full bg-limestone hover:bg-red-50 text-[#5C6B62] hover:text-red-800 border border-[#DFD9CE] font-bold py-2.5 px-3 rounded-xl text-xs transition"
                  >
                    {busy ? 'Folyamatban...' : 'Összes értesítés kikapcsolása'}
                  </button>
                )}
              </div>

              <div
                className={`bg-white rounded-2xl p-3.5 space-y-2.5 text-xs border ${
                  initialFocus === 'radar'
                    ? 'border-pilis ring-1 ring-pilis/30'
                    : 'border-[#DFD9CE]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-[#18261F]">Városi Radar témák (külön választható)</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isSubscribed && selectedCats.length > 0
                        ? 'bg-pilis-soft text-pilis'
                        : 'bg-limestone text-[#5C6B62]'
                    }`}
                  >
                    {isSubscribed && selectedCats.length > 0 ? `${selectedCats.length} aktív` : 'Kikapcsolva'}
                  </span>
                </div>

                <p className="text-[11px] text-[#5C6B62] leading-snug">
                  Csak akkor küldünk városi riasztást, ha legalább 3-an megerősítik. Ha mindet kikapcsolod, a Radar elnémul, de a saját üzeneteid továbbra is megérkeznek.
                </p>

                <div className="grid grid-cols-2 gap-1.5">
                  {RADAR_CATEGORIES.map((c) => {
                    const on = selectedCats.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleToggleCategory(c.id)}
                        className={`py-2 px-2.5 rounded-xl border text-left font-bold text-[11px] flex items-center justify-between transition ${
                          on
                            ? 'bg-pilis-soft text-pilis border-pilis/40'
                            : 'bg-limestone text-[#5C6B62] border-[#DFD9CE]'
                        }`}
                      >
                        <span>{c.label}</span>
                        <span>{on ? '✓' : '+'}</span>
                      </button>
                    );
                  })}
                </div>

                {!isSubscribed && selectedCats.length > 0 && (
                  <p className="text-[11px] font-semibold text-pilis">
                    Nyomj fent az „Értesítések bekapcsolása” gombra a kiválasztott témák mentéséhez.
                  </p>
                )}
              </div>
            </>
          )}

          {!info.isStandalone && (
          <div className="bg-white border border-[#DFD9CE] rounded-2xl p-3 text-xs">
            <button
              type="button"
              onClick={() => setShowOtherGuide((prev) => !prev)}
              className="w-full flex items-center justify-between font-bold text-[#18261F]"
            >
              <span>Hogyan tedd ki a főképernyőre?</span>
              <span className="text-[#5C6B62]">{showOtherGuide ? '▲' : '▼'}</span>
            </button>

            {showOtherGuide && (
              <div className="mt-2.5 space-y-2.5">
                <div className="grid grid-cols-2 gap-1 bg-limestone p-1 rounded-lg text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setGuideTab('ios')}
                    className={`py-1 rounded ${
                      guideTab === 'ios' ? 'bg-white text-[#18261F] shadow-sm' : 'text-[#5C6B62]'
                    }`}
                  >
                    iPhone (Safari)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuideTab('android')}
                    className={`py-1 rounded ${
                      guideTab === 'android' ? 'bg-white text-[#18261F] shadow-sm' : 'text-[#5C6B62]'
                    }`}
                  >
                    Android (Chrome)
                  </button>
                </div>

                {guideTab === 'ios' ? (
                  <ol className="space-y-1.5 text-[11px] text-[#2A3A31] list-decimal pl-4">
                    <li>Nyisd meg a Kalákát Safariban (ne a Facebookon belül).</li>
                    <li>Koppints alul a <strong>Megosztás</strong> ikonra (négyzet felfelé nyíllal).</li>
                    <li>Válaszd a <strong>Főképernyőhöz adás</strong> gombot, majd a <strong>Hozzáadás</strong>-t.</li>
                    <li>Indítsd el az új Kaláka ikonról, és kapcsold be a Radarban az értesítéseket.</li>
                  </ol>
                ) : (
                  <ol className="space-y-1.5 text-[11px] text-[#2A3A31] list-decimal pl-4">
                    <li>Nyisd meg a Kalákát Chrome-ban.</li>
                    <li>Koppints a jobb felső <strong>⋮</strong> menüre, majd az <strong>Alkalmazás telepítése</strong> pontra.</li>
                    <li>Nyisd meg az ikonról, majd a Radar ablakban nyomj az <strong>Értesítések bekapcsolása</strong> gombra.</li>
                  </ol>
                )}
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
