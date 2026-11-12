import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { SZENTENDRE_ZONES } from '../constants/szentendreData';

export default function ProfileModal({
  isOpen,
  onClose,
  currentUser,
  userProfile,
  myAgreements = [],
  onOpenAgreement,
  onProfileUpdated
}) {
  const [displayName, setDisplayName] = useState('');
  const [zone, setZone] = useState(SZENTENDRE_ZONES[0].name);
  const [telegramChatId, setTelegramChatId] = useState('');
  const [saving, setSaving] = useState(false);
  const [verifyingGps, setVerifyingGps] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.display_name || '');
      setZone(userProfile.zone || SZENTENDRE_ZONES[0].name);
      setTelegramChatId(userProfile.telegram_chat_id || '');
    }
    setStatusMsg('');
  }, [userProfile, isOpen]);

  if (!isOpen || !currentUser) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg('');

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: currentUser.id,
        display_name: displayName.trim() || currentUser.email.split('@')[0],
        zone,
        telegram_chat_id: telegramChatId.trim() || null
      });

    setSaving(false);
    if (error) {
      setStatusMsg(`Hiba: ${error.message}`);
    } else {
      setStatusMsg('Profil adatok sikeresen elmentve.');
      onProfileUpdated && onProfileUpdated();
    }
  };

  const handleVerifyLocalGps = () => {
    if (!navigator.geolocation) {
      setStatusMsg('A böngésződ nem támogatja a helymeghatározást.');
      return;
    }
    setVerifyingGps(true);
    setStatusMsg('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const inDunakanyar =
          latitude >= 47.55 && latitude <= 47.82 && longitude >= 18.92 && longitude <= 19.22;

        if (!inDunakanyar) {
          setVerifyingGps(false);
          setStatusMsg('A jelenlegi helyzeted kívül esik Szentendre és a Dunakanyar területén.');
          return;
        }

        await supabase
          .from('profiles')
          .update({ is_gps_local_verified: true })
          .eq('id', currentUser.id);

        setVerifyingGps(false);
        setStatusMsg('Szentendrei tartózkodás sikeresen megerősítve!');
        onProfileUpdated && onProfileUpdated();
      },
      () => {
        setVerifyingGps(false);
        setStatusMsg('Nem sikerült lekérni a helyzetet. Engedélyezd a helymeghatározást a böngészőben.');
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div>
            <h3 className="text-base font-bold text-stone-900">Saját profilom és beállítások</h3>
            <p className="text-xs text-stone-500">{currentUser.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200"
          >
            Bezárás
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center bg-stone-50 p-3 rounded-xl border border-stone-200/80">
          <div>
            <div className="text-lg font-extrabold text-pilis">♥ {userProfile?.ride_hearts || 0}</div>
            <div className="text-[11px] text-stone-600">Fuvar köszönet</div>
          </div>
          <div>
            <div className="text-lg font-extrabold text-terracotta">🤝 {userProfile?.favor_hearts || 0}</div>
            <div className="text-[11px] text-stone-600">Kaláka segítség</div>
          </div>
          <div>
            <div className="text-xs font-bold text-stone-800 pt-1">
              {userProfile?.is_gps_local_verified ? '✓ Igazolt helyi' : 'Nincs megerősítve'}
            </div>
            <div className="text-[11px] text-stone-600 mt-0.5">Helyi státusz</div>
          </div>
        </div>

        {statusMsg && (
          <div className="p-2.5 rounded-xl bg-pilis-soft text-pilis text-xs font-medium">
            {statusMsg}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Megjelenő neved</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Városrészed Szentendrén</label>
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

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Telegram azonosító értesítésekhez (opcionális)
            </label>
            <input
              type="text"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              placeholder="Pl. 123456789"
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300"
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            {!userProfile?.is_gps_local_verified ? (
              <button
                type="button"
                onClick={handleVerifyLocalGps}
                disabled={verifyingGps}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100"
              >
                {verifyingGps ? 'Ellenőrzés...' : '📍 Szentendrei helyzet megerősítése'}
              </button>
            ) : (
              <span className="text-xs font-semibold text-emerald-700">
                ✓ Szentendrei tartózkodás megerősítve
              </span>
            )}

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-pilis text-white hover:bg-pilis-light disabled:opacity-50"
            >
              {saving ? 'Mentés...' : 'Profil mentése'}
            </button>
          </div>
        </form>

        {userProfile?.invite_code && (
          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-stone-700">Saját meghívókódod szomszédoknak</div>
              <div className="text-sm font-mono font-bold text-pilis">{userProfile.invite_code}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(userProfile.invite_code);
                setStatusMsg('Meghívókód a vágólapra másolva.');
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-stone-300 hover:bg-stone-100"
            >
              Másolás
            </button>
          </div>
        )}

        {myAgreements.length > 0 && (
          <div className="pt-2 border-t border-stone-200 space-y-2">
            <h4 className="text-xs font-bold text-stone-700">Aktív egyeztetéseim ({myAgreements.length})</h4>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {myAgreements.map((agr) => (
                <div
                  key={agr.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs"
                >
                  <div>
                    <span className="font-semibold text-stone-800">
                      {agr.ride_id ? '🚗 Fuvar egyeztetés' : '🤝 Kaláka egyeztetés'}
                    </span>
                    <span className="text-stone-500 ml-2">({agr.status})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAgreement(agr);
                    }}
                    className="px-2.5 py-1 rounded-lg font-semibold bg-pilis text-white"
                  >
                    Megnyitás
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
