import React, { useState, useEffect } from 'react';
import {
  getDeviceInstallInfo,
  hasNativeInstallPrompt,
  onInstallPromptChange,
  triggerNativeInstall,
  subscribeToWebPush
} from '../lib/webPush.js';

export default function MessagePushPromptModal({
  isOpen,
  title,
  subtitle,
  supabase,
  currentUserId,
  onClose,
  onSnooze,
  onEnabled
}) {
  const [info, setInfo] = useState(() => getDeviceInstallInfo());
  const [canNativeInstall, setCanNativeInstall] = useState(() => hasNativeInstallPrompt());
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => onInstallPromptChange((avail) => setCanNativeInstall(avail)), []);

  useEffect(() => {
    if (!isOpen) return;
    setInfo(getDeviceInstallInfo());
    setErrorMsg(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const needsIosInstall = info.isIOS && !info.isStandalone;

  const handleEnable = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      await subscribeToWebPush(supabase, currentUserId, []);
      if (onEnabled) onEnabled();
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleInstallAndClose = async () => {
    await triggerNativeInstall();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Üzenet-értesítések bekapcsolása"
      onClick={onSnooze}
      className="fixed inset-0 bg-black/55 z-[75] flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-limestone w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] border border-[#DFD9CE] shadow-2xl space-y-3.5"
      >
        <div className="space-y-1">
          <h3 className="font-display font-extrabold text-lg text-[#18261F] leading-snug">
            {title || 'Szóljunk, ha válasz érkezik?'}
          </h3>
          <p className="text-xs text-[#4A5850] leading-relaxed">
            {subtitle ||
              'Csak a saját üzeneteidről és fuvar-visszaigazolásokról küldünk jelzést. A Városi Radar híreivel nem zavarunk, amíg külön nem kéred.'}
          </p>
        </div>

        {info.isInAppBrowser && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3 text-xs text-amber-950 leading-snug">
            <strong>Nyisd meg Safariban vagy Chrome-ban:</strong> a Facebook / Messenger ablakából
            a telefon nem engedi az értesítéseket.
          </div>
        )}

        {needsIosInstall ? (
          <div className="bg-white border border-[#DFD9CE] rounded-2xl p-3.5 space-y-2.5 text-xs">
            <div className="font-extrabold text-[#18261F]">
              iPhone-on 1 perc alatt beállítható:
            </div>
            <ol className="space-y-2 text-[#18261F]">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-pilis text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  Nyomj alul a <strong>Megosztás</strong> ikonra (négyzet felfelé nyíllal).
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-pilis text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  Válaszd a <strong>Főképernyőhöz adás</strong> pontot, majd jobb felül:{' '}
                  <strong>Hozzáadás</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-pilis text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  Nyisd meg a Kalákát az új ikonról, és ott egy koppintással bekapcsolhatod.
                </span>
              </li>
            </ol>
          </div>
        ) : (
          <div className="space-y-2">
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-xs text-red-900 font-semibold">
                {errorMsg}
              </div>
            )}

            <button
              type="button"
              disabled={busy || !info.supportsPush}
              onClick={handleEnable}
              className="w-full bg-pilis hover:bg-pilis-light disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm shadow-sm transition"
            >
              {busy ? 'Bekapcsolás...' : 'Értesítések bekapcsolása'}
            </button>

            {info.isAndroid && !info.isStandalone && canNativeInstall && (
              <button
                type="button"
                onClick={handleInstallAndClose}
                className="w-full bg-white hover:bg-pilis-soft text-pilis border border-[#DFD9CE] font-bold py-2.5 rounded-xl text-xs transition"
              >
                Kaláka kitétele a főképernyőre
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onSnooze}
          className="w-full text-xs font-bold text-[#5C6B62] hover:text-[#18261F] py-1.5 transition"
        >
          {needsIosInstall ? 'Rendben, később megcsinálom' : 'Most nem'}
        </button>
      </div>
    </div>
  );
}
