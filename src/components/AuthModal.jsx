import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { SZENTENDRE_ZONES } from '../constants/szentendreData.js';
import {
  BETA_INVITE_ONLY,
  getPendingInviteCode,
  savePendingInviteCode,
  clearPendingInviteCode
} from '../constants/betaConfig.js';
import KalakaLogo from './KalakaLogo.jsx';

function translateAuthError(rawMessage) {
  const msg = String(rawMessage || '').trim();
  const lower = msg.toLowerCase();
  if (!msg) return 'Ismeretlen hiba történt. Próbáld újra.';
  if (lower.includes('invalid login credentials')) return 'Hibás e-mail cím vagy jelszó.';
  if (lower.includes('email not confirmed')) return 'Még nem erősítetted meg az e-mail címedet. Nézd meg a Spam mappát is.';
  if (lower.includes('user already registered')) return 'Ezzel az e-mail címmel már regisztráltak. Lépj be, vagy kérj új jelszót.';
  if (lower.includes('password should be at least')) return 'A jelszónak legalább 6 karakter hosszúnak kell lennie.';
  if (lower.includes('unable to validate email') || lower.includes('invalid email')) return 'Érvénytelen e-mail cím formátum.';
  if (lower.includes('rate limit') || lower.includes('for security purposes') || lower.includes('too many requests')) return 'Túl sok próbálkozás, várj egy percet és próbáld újra.';
  if (lower.includes('different from the old password')) return 'Az új jelszó nem egyezhet meg a régivel.';
  if (lower.includes('expired') || lower.includes('invalid token')) return 'A link lejárt vagy érvénytelen. Kérj újat.';
  if (lower.includes('profiles_display_name_unique') || lower.includes('duplicate key')) return 'Ez a név már foglalt — tegyél hozzá egy kezdőbetűt (pl. Péter K.).';
  return msg;
}

export default function AuthModal({
  isOpen,
  onClose,
  session,
  profile,
  initialMode = 'login',
  onProfileUpdated,
  onOpenLegalModal
}) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [zone, setZone] = useState('Pismány');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (session?.user && profile?.display_name && profile.display_name !== 'Belépés') {
      setDisplayName(profile.display_name);
      setZone(profile.zone || 'Pismány');
    } else {
      setDisplayName('');
    }
    if (isOpen && initialMode === 'recovery') {
      setMode('recovery');
      setPassword('');
      setPasswordConfirm('');
    } else if (isOpen && !session?.user) {
      setMode(initialMode || 'login');
      const savedCode = getPendingInviteCode();
      if (savedCode) setInviteCodeInput(savedCode);
    }
    setFeedback(null);
  }, [session?.user, profile?.display_name, profile?.zone, isOpen, initialMode]);

  if (!isOpen) return null;

  const handleEmailPasswordAuth = async (e) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setFeedback(null);

    try {
      const cleanName = displayName.trim() || email.split('@')[0];

      if (mode === 'forgot') {
        const cleanEmail = email.trim();
        if (!cleanEmail) throw new Error('Add meg az e-mail címed.');
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: window.location.origin
        });
        if (error) throw error;
        setFeedback({
          type: 'ok',
          text: 'Jelszó-visszaállító linket küldtünk az e-mail címedre. Nézd meg a Spam mappát is.'
        });
      } else if (mode === 'recovery') {
        if (password.length < 6) throw new Error('Az új jelszó legyen legalább 6 karakter hosszú.');
        if (password !== passwordConfirm) throw new Error('A két jelszó nem egyezik.');
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setFeedback({ type: 'ok', text: 'Új jelszó sikeresen beállítva.' });
        setPassword('');
        setPasswordConfirm('');
        setTimeout(() => onClose(), 900);
      } else if (mode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: cleanName, zone }
          }
        });
        if (error) throw error;
        setFeedback({ type: 'ok', text: 'Belépési link elküldve az e-mail címedre.' });
      } else if (mode === 'register') {
        if (!cleanName || cleanName.length < 2) {
          throw new Error('Add meg a keresztneved vagy beceneved.');
        }
        if (!adultConfirmed) {
          throw new Error('A regisztrációhoz fogadd el az ÁSZF-et és az Adatkezelési tájékoztatót.');
        }

        const { data: nameFree } = await supabase.rpc('is_display_name_available', {
          p_name: cleanName
        });
        if (nameFree === false) {
          throw new Error('Ez a név már foglalt — tegyél hozzá egy kezdőbetűt (pl. Péter K.).');
        }

        const cleanInvite = inviteCodeInput.trim().toUpperCase();
        if (BETA_INVITE_ONLY) {
          if (!cleanInvite) {
            throw new Error('A zárt szentendrei teszthez add meg a meghívókódot.');
          }
          const { data: isValidCode, error: valErr } = await supabase.rpc('validate_beta_invite', {
            p_code: cleanInvite
          });
          if (valErr || !isValidCode) {
            throw new Error('Érvénytelen vagy már betelt meghívókód.');
          }
        }
        if (cleanInvite) savePendingInviteCode(cleanInvite);

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: cleanName, zone } }
        });
        if (error) throw error;

        if (data?.session && cleanInvite) {
          const { data: redeemRes } = await supabase.rpc('redeem_beta_invite', {
            p_code: cleanInvite
          });
          if (redeemRes?.ok) clearPendingInviteCode();
        }

        if (data.session) {
          onClose();
        } else {
          setFeedback({ type: 'ok', text: 'Fiók létrehozva. Ellenőrizd az e-mail fiókodat.' });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (error) throw error;
        onClose();
      }
    } catch (err) {
      setFeedback({ type: 'err', text: translateAuthError(err?.message) });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!supabase) return;
    if (mode === 'register' && !adultConfirmed) {
      setFeedback({
        type: 'err',
        text: 'A regisztrációhoz pipáld be, hogy elmúltál 18 éves és elfogadod a feltételeket.'
      });
      return;
    }
    const cleanInvite = inviteCodeInput.trim().toUpperCase();
    if (mode === 'register' && BETA_INVITE_ONLY) {
      if (!cleanInvite) {
        setFeedback({
          type: 'err',
          text: 'A zárt teszthez add meg a meghívókódot a Google-regisztráció előtt.'
        });
        return;
      }
      const { data: isValidCode, error: valErr } = await supabase.rpc('validate_beta_invite', {
        p_code: cleanInvite
      });
      if (valErr || !isValidCode) {
        setFeedback({
          type: 'err',
          text: 'Érvénytelen vagy már betelt meghívókód.'
        });
        return;
      }
    }
    if (cleanInvite) savePendingInviteCode(cleanInvite);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!supabase || !session?.user) return;
    setLoading(true);
    setFeedback(null);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          zone,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.user.id)
        .select('*')
        .single();

      if (error) throw error;
      onProfileUpdated(data);
      setFeedback({ type: 'ok', text: 'Profil mentve.' });
    } catch (err) {
      setFeedback({ type: 'err', text: translateAuthError(err?.message) });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-limestone w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] border border-[#DFD9CE] shadow-2xl max-h-[90vh] overflow-y-auto box-border">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="font-display font-extrabold text-lg text-[#18261F] truncate">
            {mode === 'recovery'
              ? 'Új jelszó beállítása'
              : session?.user
              ? 'Profilom'
              : mode === 'forgot'
              ? 'Elfelejtett jelszó'
              : 'Belépés / Regisztráció'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-bold text-[#5C6B62] hover:text-black shrink-0 px-2 py-1"
          >
            Bezárás ✕
          </button>
        </div>

        {!session?.user && (
          <div className="flex justify-center mb-3">
            <KalakaLogo className="w-14 h-14 shadow-sm rounded-2xl" />
          </div>
        )}

        {feedback && (
          <div className={`p-3 rounded-xl text-xs font-semibold mb-3 ${
            feedback.type === 'ok'
              ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
              : 'bg-red-100 text-red-900 border border-red-300'
          }`}>
            {feedback.text}
          </div>
        )}

        {mode === 'recovery' ? (
          <form onSubmit={handleEmailPasswordAuth} className="space-y-3">
            <p className="text-xs text-[#5C6B62]">
              Adj meg egy új jelszót a fiókodhoz (legalább 6 karakter).
            </p>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Új jelszó (min. 6 karakter)"
              className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-base box-border"
            />
            <input
              type="password"
              required
              minLength={6}
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="Új jelszó mégegyszer"
              className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-base box-border"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-pilis hover:bg-pilis-light text-white font-bold py-3 rounded-xl text-sm transition"
            >
              {loading ? 'Mentés...' : 'Új jelszó mentése'}
            </button>
          </form>
        ) : session?.user ? (
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div className="grid grid-cols-2 gap-2 bg-white p-3 rounded-2xl border border-[#DFD9CE]">
              <div className="bg-pilis-soft/60 p-2.5 rounded-xl">
                <div className="text-[11px] font-bold text-pilis">Fuvarok</div>
                <div className="font-display font-extrabold text-2xl text-pilis">
                  {profile?.ride_hearts || 0}
                </div>
              </div>
              <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200/60">
                <div className="text-[11px] font-bold text-amber-900">Kaláka segítések</div>
                <div className="font-display font-extrabold text-2xl text-amber-900">
                  {profile?.favor_hearts || 0}
                </div>
              </div>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-[#DFD9CE] flex items-center justify-between text-xs">
              <span className="text-[#5C6B62] font-medium">Meghívókódod:</span>
              <span className="font-mono font-extrabold bg-[#ECE7DC] px-2.5 py-1 rounded-lg text-sm">
                {profile?.invite_code || '------'}
              </span>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">Név / Becenév</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-base font-semibold box-border"
              />
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">Városrész</label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-base font-semibold box-border"
              >
                {SZENTENDRE_ZONES.map((z) => (
                  <option key={z.id} value={z.name}>{z.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-pilis text-white font-bold py-2.5 rounded-xl text-sm"
              >
                {loading ? 'Mentés...' : 'Mentés'}
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="bg-red-50 hover:bg-red-100 text-red-800 font-bold px-4 py-2.5 rounded-xl text-xs"
              >
                Kilépés
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1 bg-[#ECE7DC] p-1 rounded-xl text-xs font-bold">
              {[['login', 'Belépés'], ['register', 'Regisztráció'], ['magic', 'Belépési link']].map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setFeedback(null); }}
                  className={`py-2 rounded-lg transition ${mode === m ? 'bg-white text-pilis shadow-sm' : 'text-[#5C6B62]'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <form onSubmit={handleEmailPasswordAuth} className="space-y-2.5">
              {mode === 'forgot' && (
                <p className="text-xs text-[#5C6B62] leading-snug">
                  Add meg a regisztrált e-mail címed, és küldünk egy linket, amivel új jelszót állíthatsz be.
                </p>
              )}

              {(mode === 'register' || mode === 'magic') && (
                <>
                  <input
                    type="text"
                    required={mode === 'register'}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Keresztneved vagy beceneved"
                    className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-base box-border"
                  />
                  <select
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                    className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-base font-medium box-border"
                  >
                    {SZENTENDRE_ZONES.map((z) => (
                      <option key={z.id} value={z.name}>{z.name}</option>
                    ))}
                  </select>
                </>
              )}

              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail címed"
                className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-base box-border"
              />

              {mode !== 'magic' && mode !== 'forgot' && (
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Jelszó (min. 6 karakter)"
                  className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-base box-border"
                />
              )}

              {mode === 'login' && (
                <div className="flex justify-end -mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setFeedback(null);
                    }}
                    className="text-xs font-semibold text-pilis hover:underline"
                  >
                    Elfelejtett jelszó?
                  </button>
                </div>
              )}

              {mode === 'register' && (
                <>
                  <input
                    type="text"
                    value={inviteCodeInput}
                    onChange={(e) => setInviteCodeInput(e.target.value)}
                    placeholder={BETA_INVITE_ONLY ? 'Meghívókód (kötelező)' : 'Meghívókód (opcionális)'}
                    className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2 text-base font-mono uppercase box-border"
                  />
                  <label className="flex items-start gap-2 text-xs text-[#5C6B62] pt-1 cursor-pointer leading-snug">
                    <input
                      type="checkbox"
                      checked={adultConfirmed}
                      onChange={(e) => setAdultConfirmed(e.target.checked)}
                      className="accent-pilis w-4 h-4 mt-0.5 shrink-0"
                    />
                    <span>
                      Elmúltam 18 éves, elfogadom az{' '}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (onOpenLegalModal) onOpenLegalModal();
                        }}
                        className="text-pilis font-bold underline"
                      >
                        ÁSZF-et és a Házirendet
                      </button>
                      , és megismertem az Adatkezelési tájékoztatót.
                    </span>
                  </label>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-pilis hover:bg-pilis-light text-white font-bold py-3 rounded-xl text-sm transition"
              >
                {loading
                  ? 'Folyamatban...'
                  : mode === 'forgot'
                  ? 'Visszaállító link küldése'
                  : mode === 'magic'
                  ? 'Link küldése'
                  : mode === 'register'
                  ? 'Regisztráció'
                  : 'Belépés'}
              </button>
            </form>

            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => { setMode('login'); setFeedback(null); }}
                className="w-full text-xs font-bold text-[#5C6B62] hover:text-pilis py-1"
              >
                ← Vissza a belépéshez
              </button>
            )}

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full bg-white hover:bg-gray-50 text-[#18261F] border border-[#DFD9CE] font-bold py-2.5 rounded-xl text-xs transition"
            >
              Folytatás Google-fiókkal
            </button>
            <p className="text-[11px] text-[#5C6B62] text-center leading-snug pt-0.5">
              A belépéssel igazolod, hogy elmúltál 18 éves, elfogadod az{' '}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (onOpenLegalModal) onOpenLegalModal();
                }}
                className="text-pilis font-bold underline"
              >
                ÁSZF-et és a Házirendet
              </button>
              , valamint megismerted az Adatkezelési tájékoztatót.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
