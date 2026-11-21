import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { SZENTENDRE_ZONES } from '../constants/szentendreData.js';
import AvatarBadge from './AvatarBadge.jsx';
import AvatarCropModal from './AvatarCropModal.jsx';
import { unsubscribeFromWebPush } from '../lib/webPush.js';

export default function UserProfileModal({
  userId,
  initialName,
  initialZone,
  currentUser,
  onClose,
  onProfileUpdated,
  pushEnabled,
  onOpenPushSettings
}) {
  const [profileData, setProfileData] = useState(null);
  const [kudosList, setKudosList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [inviterName, setInviterName] = useState(null);
  const [verifyingGps, setVerifyingGps] = useState(false);
  const [gpsFeedback, setGpsFeedback] = useState(null);

  const isOwnProfile = Boolean(currentUser?.id && userId === currentUser.id);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editZone, setEditZone] = useState('Pismány');
  const [editBio, setEditBio] = useState('');
  const [editCar, setEditCar] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [pendingAvatarFile, setPendingAvatarFile] = useState(null);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    if (!userId || !supabase) return;
    let mounted = true;

    (async () => {
      setLoading(true);
      const [{ data: prof }, { data: rawKudos }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name, zone, bio, car_info, avatar_url, ride_hearts, favor_hearts, is_gps_local_verified, invited_by, invite_code, created_at')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('kudos')
          .select('*')
          .eq('receiver_id', userId)
      ]);

      let resolvedKudos = [];
      if (rawKudos && rawKudos.length > 0) {
        const giverIds = Array.from(
          new Set(rawKudos.map((k) => k.giver_id || k.sender_id).filter(Boolean))
        );
        const giverMap = {};
        if (giverIds.length > 0) {
          const { data: givers } = await supabase
            .from('profiles')
            .select('id, display_name, zone')
            .in('id', giverIds);
          (givers || []).forEach((g) => {
            giverMap[g.id] = g;
          });
        }
        resolvedKudos = rawKudos.map((k, idx) => {
          const gid = k.giver_id || k.sender_id;
          return {
            id: k.id || `kudos-${idx}`,
            kudos_type: k.kudos_type || k.type || 'ride',
            giver: gid ? giverMap[gid] || null : null
          };
        });
      }

      if (!mounted) return;
      if (prof) {
        setProfileData(prof);
        if (prof.invited_by) {
          const { data: inv } = await supabase
            .from('profiles')
            .select('display_name, zone')
            .eq('id', prof.invited_by)
            .maybeSingle();
          if (mounted && inv?.display_name) {
            setInviterName(`${inv.display_name}${inv.zone ? ' • ' + inv.zone : ''}`);
          }
        }
        setEditName(prof.display_name || '');
        setEditZone(prof.zone || 'Pismány');
        setEditBio(prof.bio || '');
        setEditCar(prof.car_info || '');
      }
      setKudosList(resolvedKudos);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [userId]);

  if (!userId) return null;

  const cleanInitialName = (initialName || '').split('•')[0].trim();
  const displayName = profileData?.display_name || cleanInitialName || 'Szentendrei lakos';
  const displayZone =
    profileData?.zone ||
    initialZone ||
    ((initialName || '').includes('•') ? initialName.split('•')[1].trim() : 'Szentendre');

  const listRideCount = kudosList.filter((k) => k.kudos_type === 'ride').length;
  const listFavorCount = kudosList.filter((k) => k.kudos_type === 'favor').length;

  const rideKudosCount = Math.max(profileData?.ride_hearts || 0, listRideCount);
  const favorKudosCount = Math.max(profileData?.favor_hearts || 0, listFavorCount);
  const totalKudos = rideKudosCount + favorKudosCount;

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
      setGpsFeedback(`Mentési hiba: ${error.message}`);
      return;
    }
    setProfileData(data);
    setEditing(false);
    if (onProfileUpdated) onProfileUpdated(data);
  };

  const handleAvatarFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file || !isOwnProfile || !supabase) return;
    setPendingAvatarFile(file);
    e.target.value = '';
  };

  const handleConfirmCroppedAvatar = async (blob) => {
    if (!blob || !isOwnProfile || !supabase) return;
    setPendingAvatarFile(null);
    setUploadingAvatar(true);
    setGpsFeedback(null);
    try {
      const filePath = `${userId}/avatar_${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const avatarUrl = pub?.publicUrl;
      const { data: updatedProf, error: dbErr } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', userId)
        .select('*')
        .single();
      if (dbErr) throw dbErr;
      setProfileData(updatedProf);
      if (onProfileUpdated) onProfileUpdated(updatedProf);
      setGpsFeedback('Profilkép frissítve ✓');
    } catch (err) {
      setGpsFeedback(`Képfeltöltési hiba: ${err.message}`);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleVerifyLocalGps = () => {
    if (!navigator.geolocation || !isOwnProfile || !supabase) return;
    setVerifyingGps(true);
    setGpsFeedback(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const { data: verified, error: rpcErr } = await supabase.rpc('verify_local_gps', {
          p_lat: latitude,
          p_lng: longitude
        });
        if (rpcErr) {
          setVerifyingGps(false);
          setGpsFeedback(`Hiba az igazoláskor: ${rpcErr.message}`);
          return;
        }
        if (!verified) {
          setVerifyingGps(false);
          setGpsFeedback('A jelenlegi helyzeted kívül esik Szentendre térségén.');
          return;
        }
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        setVerifyingGps(false);
        if (data) {
          setProfileData(data);
          if (onProfileUpdated) onProfileUpdated(data);
        }
        setGpsFeedback('Szentendrei jelenlét sikeresen igazolva ✓');
      },
      () => {
        setVerifyingGps(false);
        setGpsFeedback('Engedélyezd a helymeghatározást a böngészőben.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleDeleteOwnAccount = async () => {
    if (!isOwnProfile || !supabase || !userId) return;
    if (!confirmDeleteAccount) {
      setConfirmDeleteAccount(true);
      setTimeout(() => setConfirmDeleteAccount(false), 4500);
      return;
    }
    setDeletingAccount(true);
    try {
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            const ep = sub.endpoint;
            await sub.unsubscribe().catch(() => {});
            await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', ep);
          }
        }
      } catch {}

      try {
        const { data: profRow } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', userId)
          .maybeSingle();
        if (profRow?.avatar_url) {
          const parts = profRow.avatar_url.split('/object/public/avatars/');
          if (parts[1]) {
            const storagePath = decodeURIComponent(parts[1].split('?')[0]);
            await supabase.storage.from('avatars').remove([storagePath]);
          }
        }
      } catch {}

      try {
        localStorage.removeItem(`kalaka_read_${userId}`);
        localStorage.removeItem(`kalaka_hidden_${userId}`);
        localStorage.removeItem(`kalaka_routines_${userId}`);
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith('kalaka_') && k.includes(userId)) {
            localStorage.removeItem(k);
          }
        });
      } catch {}

      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw error;
      await supabase.auth.signOut();
      onClose();
    } catch (err) {
      setGpsFeedback(`Hiba a törléskor: ${err.message}`);
      setDeletingAccount(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await unsubscribeFromWebPush(supabase, currentUser?.id).catch(() => {});
    await supabase.auth.signOut();
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-limestone w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-4 border border-[#DFD9CE] shadow-2xl max-h-[90vh] overflow-y-auto box-border"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <AvatarBadge
                src={profileData?.avatar_url}
                name={displayName}
                sizeClass="w-14 h-14 text-lg shadow"
              />
              {isOwnProfile && (
                <>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileSelected}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={uploadingAvatar}
                    onClick={() => avatarInputRef.current?.click()}
                    className="mt-1 block w-full text-center text-[10px] font-bold text-pilis hover:underline"
                  >
                    {uploadingAvatar ? 'Feltöltés...' : 'Fotó csere'}
                  </button>
                </>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="font-display font-extrabold text-lg text-[#18261F] truncate">
                  {displayName}
                </h3>
                <span className="text-[11px] font-bold bg-pilis-soft text-pilis px-2.5 py-0.5 rounded-full">
                  {displayZone}
                </span>
                {profileData?.is_gps_local_verified && (
                  <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full">
                    ✓ Igazolt helyi
                  </span>
                )}
              </div>
              <div className="text-xs text-[#5C6B62] mt-0.5">
                Közösségi tag • {joinedLabel} óta
                {inviterName ? ` • Meghívta: ${inviterName}` : ''}
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

            {isOwnProfile && profileData?.invite_code && (
              <div className="pt-2 border-t border-[#ECE7DC] flex items-center justify-between text-xs">
                <span className="font-semibold text-[#5C6B62]">Meghívókódod:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(profileData.invite_code);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="font-mono font-extrabold bg-[#ECE7DC] hover:bg-[#DFD9CE] px-2.5 py-1 rounded-lg text-xs transition"
                  >
                    {copiedCode ? 'Másolva ✓' : profileData.invite_code}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const inviteUrl = `${window.location.origin}/?meghivo=${encodeURIComponent(profileData.invite_code)}`;
                      const text = `Csatlakozz a Kaláka Szentendre szomszédsági közösséghez! Ezzel a meghívóval egyből be tudsz lépni (${profileData.invite_code}):`;
                      if (navigator.share) {
                        try {
                          await navigator.share({ title: 'Kaláka Szentendre meghívó', text, url: inviteUrl });
                          return;
                        } catch {}
                      }
                      navigator.clipboard?.writeText(`${text} ${inviteUrl}`);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="bg-pilis-soft text-pilis font-bold px-2 py-1 rounded-lg text-[11px]"
                  >
                    Küldés ↗
                  </button>
                </div>
              </div>
            )}

            {isOwnProfile && !profileData?.is_gps_local_verified && (
              <div className="pt-2 border-t border-[#ECE7DC]">
                <button
                  type="button"
                  disabled={verifyingGps}
                  onClick={handleVerifyLocalGps}
                  className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 font-bold text-xs py-2 rounded-xl transition"
                >
                  {verifyingGps ? 'GPS ellenőrzése...' : '📍 Szentendrei tartózkodás igazolása (GPS)'}
                </button>
              </div>
            )}
            {gpsFeedback && (
              <div className="text-[11px] font-semibold text-pilis bg-pilis-soft px-3 py-1.5 rounded-xl">
                {gpsFeedback}
              </div>
            )}
            {isOwnProfile && onOpenPushSettings && (
              <div className="pt-2.5 border-t border-[#ECE7DC] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#18261F]">
                    Telefonos értesítések
                  </div>
                  <div className="text-[11px] text-[#5C6B62]">
                    {pushEnabled
                      ? 'Aktív — fuvarokról és üzenetekről szólunk'
                      : 'Kikapcsolva — nem kapsz jelzést zárt appnál'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenPushSettings}
                  className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl border transition ${
                    pushEnabled
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-pilis text-white border-pilis hover:bg-pilis-light'
                  }`}
                >
                  {pushEnabled ? 'Beállítás ›' : 'Bekapcsolás ›'}
                </button>
              </div>
            )}
            {isOwnProfile && (
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="flex-1 bg-limestone hover:bg-[#E5DFD3] text-[#18261F] font-bold text-xs py-2.5 rounded-xl border border-[#DFD9CE] transition"
                >
                  Adatlap szerkesztése
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 font-bold text-xs px-3.5 py-2.5 rounded-xl transition"
                >
                  Kilépés
                </button>
              </div>
            )}
            {isOwnProfile && (
              <div className="pt-2 border-t border-[#ECE7DC] flex justify-end">
                <button
                  type="button"
                  disabled={deletingAccount}
                  onClick={handleDeleteOwnAccount}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition ${
                    confirmDeleteAccount
                      ? 'bg-red-700 text-white'
                      : 'text-[#7A867E] hover:text-red-700'
                  }`}
                >
                  {deletingAccount
                    ? 'Adatok törlése...'
                    : confirmDeleteAccount
                    ? 'Biztosan végleg törlöd a fiókodat? Koppints újra ✕'
                    : 'Fiók és adatok végleges törlése'}
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

        <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-2">
          <div className="text-[11px] font-bold text-[#5C6B62] uppercase tracking-wide">
            Legutóbbi visszaigazolások ({totalKudos})
          </div>
          {loading ? (
            <div className="text-xs text-[#7A867E]">Adatok betöltése...</div>
          ) : kudosList.length === 0 ? (
            <div className="text-xs text-[#7A867E]">
              {totalKudos > 0
                ? `${totalKudos} sikeres közösségi visszaigazolás rögzítve.`
                : 'Még nincs lezárt visszaigazolása.'}
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

      {pendingAvatarFile && (
        <AvatarCropModal
          file={pendingAvatarFile}
          onCancel={() => setPendingAvatarFile(null)}
          onConfirm={handleConfirmCroppedAvatar}
        />
      )}
    </div>
  );
}
