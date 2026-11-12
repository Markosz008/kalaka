import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { SZENTENDRE_ZONES } from '../constants/szentendreData.js';

export default function UserProfileModal({
  userId,
  initialName,
  initialZone,
  currentUser,
  onClose,
  onProfileUpdated
}) {
  const [profileData, setProfileData] = useState(null);
  const [kudosList, setKudosList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Saját profil szerkesztése
  const isOwnProfile = Boolean(currentUser?.id && userId === currentUser.id);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editZone, setEditZone] = useState('Pismány');
  const [editBio, setEditBio] = useState('');
  const [editCar, setEditCar] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId || !supabase) return;
    let mounted = true;

    (async () => {
      setLoading(true);
      const [{ data: prof }, { data: kudosRows }] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('kudos')
          .select('id, kudos_type, created_at, giver:profiles!kudos_giver_id_fkey(display_name, zone)')
          .eq('receiver_id', userId)
          .order('created_at', { ascending: false })
      ]);

      if (!mounted) return;
      if (prof) {
        setProfileData(prof);
        setEditName(prof.display_name || '');
        setEditZone(prof.zone || 'Pismány');
        setEditBio(prof.bio || '');
        setEditCar(prof.car_info || '');
      }
      setKudosList(kudosRows || []);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [userId]);

  if (!userId) return null;

  const displayName = profileData?.display_name || initialName || 'Szentendrei lakos';
  const displayZone = profileData?.zone || initialZone || 'Szentendre';
  const rideKudosCount = kudosList.filter((k) => k.kudos_type === 'ride').length;
  const favorKudosCount = kudosList.filter((k) => k.kudos_type === 'favor').length;
  const totalKudos = kudosList.length;

  const joinedLabel = profileData?.created_at
    ? new Date(profileData.created_at).toLocaleDateString('hu-HU', {
        year: 'numeric',
        month: 'long'
      })
    : '2026. november';

  const handleSaveOwnProfile = async (e) => {
    e.preventDefault();
    if (!isOwnProfile || !supabase) return;
    setSaving(true);
    const patch = {
      display_name: editName.trim() || displayName,
      zone: editZone,
      bio: editBio.trim() || null,
      car_info: editCar.trim() || null
    };

    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', userId)
      .select('*')
      .single();

    setSaving(false);
    if (error) {
      alert(`Mentési hiba: ${error.message}`);
      return;
    }
    setProfileData(data);
    setEditing(false);
    if (onProfileUpdated) onProfileUpdated(data);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-limestone w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-4 border border-[#DFD9CE] shadow-2xl max-h-[90vh] overflow-y-auto box-border"
      >
        {/* Fejléc */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-full bg-pilis text-white font-display font-extrabold text-lg grid place-items-center shrink-0 shadow">
              {displayName[0]?.toUpperCase() || 'S'}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="font-display font-extrabold text-lg text-[#18261F] truncate">
                  {displayName}
                </h3>
                <span className="text-[11px] font-bold bg-pilis-soft text-pilis px-2.5 py-0.5 rounded-full">
                  {displayZone}
                </span>
              </div>
              <div className="text-xs text-[#5C6B62] mt-0.5">
                Közösségi tag • {joinedLabel} óta
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-[#5C6B62] hover:text-black bg-white px-2.5 py-1.5 rounded-xl border border-[#DFD9CE] shrink-0"
          >
            Bezárás ✕
          </button>
        </div>

        {/* Közösségi bizalmi mutatók */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-2xl p-3 border border-[#DFD9CE] text-center">
            <div className="font-display font-extrabold text-xl text-pilis">
              {totalKudos}
            </div>
            <div className="text-[11px] font-semibold text-[#5C6B62]">
              Összes köszönet
            </div>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-[#DFD9CE] text-center">
            <div className="font-display font-extrabold text-xl text-[#18261F]">
              {rideKudosCount}
            </div>
            <div className="text-[11px] font-semibold text-[#5C6B62]">
              Sikeres fuvar
            </div>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-[#DFD9CE] text-center">
            <div className="font-display font-extrabold text-xl text-[#18261F]">
              {favorKudosCount}
            </div>
            <div className="text-[11px] font-semibold text-[#5C6B62]">
              Kaláka segítség
            </div>
          </div>
        </div>

        {/* Bemutatkozás és opcionális autó infó */}
        {!editing ? (
          <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-2">
            <div className="text-[11px] font-bold text-[#5C6B62] uppercase tracking-wide">
              Bemutatkozás
            </div>
            {profileData?.bio ? (
              <p className="text-xs text-[#18261F] leading-relaxed">
                {profileData.bio}
              </p>
            ) : (
              <p className="text-xs text-[#7A867E] italic">
                {isOwnProfile
                  ? 'Még nem írtál rövid bemutatkozást (pl. merre szoktál ingázni).'
                  : 'Még nem adott meg bemutatkozást.'}
              </p>
            )}

            {profileData?.car_info && (
              <div className="pt-2 border-t border-[#ECE7DC] flex items-center justify-between text-xs">
                <span className="font-semibold text-[#5C6B62]">Szokásos autó:</span>
                <span className="font-bold text-[#18261F]">🚗 {profileData.car_info}</span>
              </div>
            )}

            {isOwnProfile && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="w-full bg-limestone hover:bg-[#E5DFD3] text-[#18261F] font-bold text-xs py-2 rounded-xl border border-[#DFD9CE] transition"
                >
                  Saját adatlap szerkesztése
                </button>
              </div>
            )}
          </div>
        ) : (
          <form
            onSubmit={handleSaveOwnProfile}
            className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-2.5"
          >
            <div className="text-xs font-bold text-[#18261F]">
              Saját közösségi adatlap szerkesztése
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-[#5C6B62] block mb-1">
                  Neved
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-limestone border border-[#DFD9CE] rounded-xl px-3 py-2 text-sm font-semibold"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#5C6B62] block mb-1">
                  Városrész
                </label>
                <select
                  value={editZone}
                  onChange={(e) => setEditZone(e.target.value)}
                  className="w-full bg-limestone border border-[#DFD9CE] rounded-xl px-3 py-2 text-sm font-semibold"
                >
                  {SZENTENDRE_ZONES.map((z) => (
                    <option key={z.id} value={z.name}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#5C6B62] block mb-1">
                Rövid bemutatkozás a szomszédoknak
              </label>
              <textarea
                rows={2}
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="Pl. Munkanapokon reggel Újpestre járok, szívesen elviszek bárkit a HÉV-ig..."
                className="w-full bg-limestone border border-[#DFD9CE] rounded-xl px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#5C6B62] block mb-1">
                Szokásos autó (opcionális – bármikor átírhatod)
              </label>
              <input
                type="text"
                value={editCar}
                onChange={(e) => setEditCar(e.target.value)}
                placeholder="Pl. Fehér Mini / Fekete Audi"
                className="w-full bg-limestone border border-[#DFD9CE] rounded-xl px-3 py-2 text-xs font-semibold"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex-1 bg-limestone text-[#5C6B62] font-bold text-xs py-2.5 rounded-xl border border-[#DFD9CE]"
              >
                Mégse
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-pilis text-white font-bold text-xs py-2.5 rounded-xl"
              >
                {saving ? 'Mentés...' : 'Mentés'}
              </button>
            </div>
          </form>
        )}

        {/* Kik igazolták vissza? (Utolsó visszajelzések) */}
        <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-2">
          <div className="text-[11px] font-bold text-[#5C6B62] uppercase tracking-wide">
            Legutóbbi visszaigazolások ({totalKudos})
          </div>
          {loading ? (
            <div className="text-xs text-[#7A867E]">Adatok betöltése...</div>
          ) : kudosList.length === 0 ? (
            <div className="text-xs text-[#7A867E]">
              Még nincs lezárt visszaigazolása.
            </div>
          ) : (
            <div className="space-y-1.5">
              {kudosList.slice(0, 6).map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between text-xs bg-limestone px-3 py-2 rounded-xl border border-[#ECE7DC]"
                >
                  <div className="font-semibold text-[#18261F]">
                    ✓ {k.giver?.display_name || 'Szomszéd'}
                    {k.giver?.zone ? ` (${k.giver.zone})` : ''}
                  </div>
                  <span className="text-[10px] font-bold text-pilis bg-pilis-soft px-2 py-0.5 rounded-full">
                    {k.kudos_type === 'ride' ? 'Fuvar' : 'Kaláka'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
