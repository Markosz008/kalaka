import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { SZENTENDRE_ZONES } from '../constants/szentendreData';

export default function AuthModal({ isOpen, onClose, onSuccess }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [zone, setZone] = useState(SZENTENDRE_ZONES[0].name);
  const [isAdult, setIsAdult] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!isAdult) {
          setError('A regisztrációhoz kérjük, igazolnod kell, hogy elmúltál 18 éves.');
          setLoading(false);
          return;
        }
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: email.trim(),
          password
        });
        if (signUpErr) throw signUpErr;

        if (data?.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            display_name: displayName.trim() || email.split('@')[0],
            zone,
            is_adult_confirmed: true
          });
        }
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (signInErr) throw signInErr;
      }

      onSuccess && onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Sikertelen művelet, kérjük próbáld újra.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-stone-900">
            {mode === 'login' ? 'Belépés' : 'Csatlakozás a szentendrei közösséghez'}
          </h3>
          <button type="button" onClick={onClose} className="text-xs text-stone-500 hover:text-stone-800">
            Bezárás
          </button>
        </div>

        <div className="grid grid-cols-2 bg-stone-100 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`py-1.5 rounded-lg ${mode === 'login' ? 'bg-white text-pilis shadow-sm' : 'text-stone-600'}`}
          >
            Belépés
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`py-1.5 rounded-lg ${mode === 'signup' ? 'bg-white text-pilis shadow-sm' : 'text-stone-600'}`}
          >
            Regisztráció
          </button>
        </div>

        {error && <div className="p-2.5 rounded-xl bg-red-50 text-xs text-red-700 border border-red-200">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Neved (ahogy a szomszédok látnak)</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Pl. Kardos Márk"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Melyik városrészben laksz?</label>
                <select
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 bg-white"
                >
                  {SZENTENDRE_ZONES.map((z) => (
                    <option key={z.id} value={z.name}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">E-mail cím</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Jelszó</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300"
              required
            />
          </div>

          {mode === 'signup' && (
            <label className="flex items-center gap-2 text-xs text-stone-700 pt-1">
              <input
                type="checkbox"
                checked={isAdult}
                onChange={(e) => setIsAdult(e.target.checked)}
                className="rounded border-stone-300 text-pilis"
              />
              <span>Elmúltam 18 éves, és szentendrei / környékbeli lakos vagyok.</span>
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-pilis text-white hover:bg-pilis-light disabled:opacity-50"
          >
            {loading ? 'Folyamatban...' : mode === 'login' ? 'Belépés' : 'Regisztráció'}
          </button>
        </form>
      </div>
    </div>
  );
}
