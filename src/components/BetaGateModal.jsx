import React, { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import {
  captureInviteFromUrl,
  getPendingInviteCode,
  savePendingInviteCode,
  clearPendingInviteCode
} from '../constants/betaConfig.js';

export default function BetaGateModal({
  session,
  profileLoading,
  onOpenAuth,
  onOpenLegalModal,
  onApproved
}) {
  const [code, setCode] = useState(
    () => captureInviteFromUrl() || (session?.user ? getPendingInviteCode() : '')
  );
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleGuestContinue = async (e) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean) {
      setErrorMsg('Add meg a meghívókódodat a regisztrációhoz.');
      return;
    }
    setBusy(true);
    setErrorMsg('');
    try {
      const { data: valid, error } = await supabase.rpc('validate_beta_invite', {
        p_code: clean
      });
      if (error || !valid) {
        setErrorMsg('Érvénytelen vagy már betelt meghívókód.');
        return;
      }
      savePendingInviteCode(clean);
      onOpenAuth('register');
    } catch {
      setErrorMsg('Nem sikerült ellenőrizni a kódot, próbáld újra.');
    } finally {
      setBusy(false);
    }
  };

  const handleLoggedInRedeem = async (e) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean) {
      setErrorMsg('Add meg a meghívókódot a belépéshez.');
      return;
    }
    setBusy(true);
    setErrorMsg('');
    try {
      const { data, error } = await supabase.rpc('redeem_beta_invite', {
        p_code: clean
      });
      if (error) throw error;
      if (!data?.ok) {
        setErrorMsg(data?.error || 'Érvénytelen vagy már betelt meghívókód.');
        return;
      }
      clearPendingInviteCode();
      if (onApproved) onApproved();
    } catch (err) {
      setErrorMsg(err?.message || 'Hiba történt a kód ellenőrzésekor.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  if (profileLoading) {
    return (
      <div className="fixed inset-0 z-40 bg-limestone/95 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl px-6 py-5 border border-[#DFD9CE] shadow-xl text-center">
          <div className="font-display font-extrabold text-base text-pilis">Kaláka Szentendre</div>
          <div className="text-xs text-[#5C6B62] mt-1">Fiók betöltése...</div>
        </div>
      </div>
    );
  }

  const isLoggedIn = Boolean(session?.user);

  return (
    <div className="fixed inset-0 z-40 bg-limestone/95 backdrop-blur-md overflow-y-auto flex items-center justify-center p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <div className="bg-white w-full max-w-sm rounded-3xl p-5 sm:p-6 border border-[#DFD9CE] shadow-2xl space-y-4">
        <div className="text-center space-y-1.5">
          <div className="inline-block text-[11px] font-bold text-pilis bg-pilis-soft px-3 py-1 rounded-full">
            Zárt szentendrei próbaidőszak
          </div>
          <h1 className="font-display font-extrabold text-2xl text-[#18261F]">
            Kaláka Szentendre
          </h1>
          <p className="text-xs text-[#5C6B62] leading-relaxed">
            {isLoggedIn
              ? 'Sikeresen beléptél, már csak egy szentendrei meghívókód kell a közösség feloldásához.'
              : 'Helyi telekocsi, szomszédsági segítség, városi radar és bevált szentendrei szakik — jelenleg meghívóval.'}
          </p>
        </div>

        <form
          onSubmit={isLoggedIn ? handleLoggedInRedeem : handleGuestContinue}
          className="space-y-2.5"
        >
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (errorMsg) setErrorMsg('');
            }}
            placeholder="Meghívókód"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="w-full bg-limestone border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-base font-mono uppercase text-center tracking-wider focus:outline-none focus:border-pilis box-border"
          />

          {errorMsg && (
            <div className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-center">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-pilis hover:bg-pilis-light disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition"
          >
            {busy
              ? 'Ellenőrzés...'
              : isLoggedIn
                ? 'Közösség feloldása'
                : 'Tovább a regisztrációhoz'}
          </button>
        </form>

        <div className="space-y-2 pt-1 border-t border-[#ECE7DC]">
          {!isLoggedIn ? (
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="w-full bg-limestone hover:bg-[#ECE7DC] text-[#18261F] font-bold py-2.5 rounded-xl text-xs border border-[#DFD9CE] transition"
            >
              Már van fiókom, belépek
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full bg-limestone hover:bg-[#ECE7DC] text-[#5C6B62] font-bold py-2.5 rounded-xl text-xs border border-[#DFD9CE] transition"
            >
              Kijelentkezés
            </button>
          )}

          <a
            href="mailto:markakardos@gmail.com?subject=Kal%C3%A1ka%20Szentendre%20%E2%80%93%20Megh%C3%ADv%C3%B3k%C3%B3d%20k%C3%A9r%C3%A9se&body=Szia!%20Szentendrei%20lakosk%C3%A9nt%20szeretn%C3%A9k%20megh%C3%ADv%C3%B3k%C3%B3dot%20k%C3%A9rni%20a%20Kal%C3%A1ka%20pr%C3%B3baid%C5%91szak%C3%A1hoz."
            className="block w-full text-center text-xs font-bold text-pilis hover:underline py-1"
          >
            Nincs még meghívód? Kérj egyet itt →
          </a>
        </div>

        <div className="text-center pt-1">
          <button
            type="button"
            onClick={onOpenLegalModal}
            className="text-[11px] text-[#5C6B62] hover:text-[#18261F] underline"
          >
            ÁSZF, Adatkezelési tájékoztató és Impresszum
          </button>
        </div>
      </div>
    </div>
  );
}
