import React from 'react';
import { SZENTENDRE_ZONES, SERVICE_GROUPS } from '../constants/szentendreData.js';

export default function ProFormModal({
  isOpen,
  editingProId,
  formError,
  bizGroup,
  setBizGroup,
  professionInput,
  setProfessionInput,
  showProfessionDropdown,
  setShowProfessionDropdown,
  exactProfessionExists,
  matchingProfessionsInForm,
  bizName,
  setBizName,
  bizExperienceYears,
  setBizExperienceYears,
  bizSpec,
  setBizSpec,
  bizAddress,
  setBizAddress,
  bizCoords,
  setBizCoords,
  locatingAddress,
  onCapturePinFromGps,
  bizBio,
  setBizBio,
  bizPhone,
  setBizPhone,
  bizBaseZone,
  setBizBaseZone,
  bizIsSelfProvider,
  setBizIsSelfProvider,
  formSaving,
  onClose,
  onSubmit
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <form
        onSubmit={onSubmit}
        className="bg-limestone w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-3 border border-[#DFD9CE] shadow-2xl max-h-[90vh] overflow-y-auto box-border"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display font-extrabold text-lg text-[#18261F]">
            {editingProId ? 'Adatlap szerkesztése' : 'Szakember vagy szolgáltatás felvétele'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-bold text-[#5C6B62] px-2 py-1 shrink-0"
          >
            Bezárás ✕
          </button>
        </div>

        {formError && (
          <div className="bg-red-100 text-red-900 border border-red-300 rounded-xl p-2.5 text-xs font-semibold">
            {formError}
          </div>
        )}

        <div>
          <label className="text-xs font-bold block mb-1">Terület</label>
          <select
            value={bizGroup}
            onChange={(e) => setBizGroup(e.target.value)}
            className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-base font-semibold box-border"
          >
            {SERVICE_GROUPS.filter((g) => g.id !== 'all').map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </div>

        <div className="relative">
          <label className="text-xs font-bold block mb-1">
            Szakma vagy szolgáltatás
          </label>
          <input
            type="text"
            required
            value={professionInput}
            onFocus={() => setShowProfessionDropdown(true)}
            onChange={(e) => {
              setProfessionInput(e.target.value);
              setShowProfessionDropdown(true);
            }}
            placeholder="Pl. Fodrász, Masszőr, Ötvös, Autószerelő..."
            className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-base font-semibold box-border"
            autoComplete="off"
          />

          {showProfessionDropdown && (
            <div className="mt-1 bg-white border border-[#DFD9CE] rounded-xl shadow-lg max-h-36 overflow-y-auto divide-y divide-[#ECE7DC]">
              {!exactProfessionExists && professionInput.trim().length >= 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const formatted =
                      professionInput.trim().charAt(0).toUpperCase() +
                      professionInput.trim().slice(1);
                    setProfessionInput(formatted);
                    setShowProfessionDropdown(false);
                  }}
                  className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-pilis bg-pilis-soft/40 hover:bg-pilis-soft"
                >
                  + Új szakma felvétele: „{professionInput.trim()}”
                </button>
              )}

              {matchingProfessionsInForm.slice(0, 8).map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => {
                    setProfessionInput(item.name);
                    setBizGroup(item.group);
                    setShowProfessionDropdown(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs font-medium hover:bg-limestone flex items-center justify-between"
                >
                  <span>{item.name}</span>
                  <span className="text-[11px] text-[#5C6B62]">Kiválaszt</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-bold block mb-1">Név vagy vállalkozás</label>
            <input
              type="text"
              required
              value={bizName}
              onChange={(e) => setBizName(e.target.value)}
              placeholder="Pl. Kovács Anna – Fodrászat"
              className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-base box-border"
            />
          </div>

          <div>
            <label className="text-xs font-bold block mb-1">Tapasztalat (év)</label>
            <input
              type="number"
              min="1"
              max="60"
              value={bizExperienceYears}
              onChange={(e) => setBizExperienceYears(e.target.value)}
              placeholder="Pl. 10"
              className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-base box-border"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold block mb-1">Fő szakterület (1 sorban)</label>
          <input
            type="text"
            required
            value={bizSpec}
            onChange={(e) => setBizSpec(e.target.value)}
            placeholder="Pl. Női és férfi hajvágás, festés bejelentkezéssel"
            className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-base box-border"
          />
        </div>

        <div>
          <label className="text-xs font-bold block mb-1">
            Fix telephely / utca (opcionális – mozgó szaki üresen hagyhatja)
          </label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={bizAddress}
              onChange={(e) => {
                setBizAddress(e.target.value);
                setBizCoords(null);
              }}
              placeholder="Pl. Szentendre, Dumtsa Jenő u. 14."
              className="flex-1 min-w-0 bg-white border border-[#DFD9CE] rounded-xl px-3 py-2 text-base box-border"
            />
            <button
              type="button"
              disabled={locatingAddress}
              onClick={onCapturePinFromGps}
              className="shrink-0 bg-pilis-soft text-pilis font-bold text-xs px-3 py-2 rounded-xl border border-pilis/20"
            >
              {locatingAddress ? '...' : bizCoords ? 'GPS rögzítve ✓' : 'GPS pont'}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold block mb-1">
            Rövid bemutatkozás (mivel, mióta foglalkozol)
          </label>
          <textarea
            rows={3}
            value={bizBio}
            onChange={(e) => setBizBio(e.target.value)}
            placeholder="Írj pár mondatot magadról, a munkádról vagy arról, hogyan érdemes időpontot egyeztetni..."
            className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-base box-border"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-bold block mb-1">Telefonszám</label>
            <input
              type="tel"
              required
              value={bizPhone}
              onChange={(e) => setBizPhone(e.target.value)}
              placeholder="+36 30 123 4567"
              className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-base box-border"
            />
          </div>

          <div>
            <label className="text-xs font-bold block mb-1">Városrész</label>
            <select
              value={bizBaseZone}
              onChange={(e) => setBizBaseZone(e.target.value)}
              className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-base font-semibold box-border"
            >
              {SZENTENDRE_ZONES.map((z) => (
                <option key={z.id} value={z.name}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!editingProId && (
          <label className="flex items-start gap-2.5 bg-white border border-[#DFD9CE] rounded-xl p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={bizIsSelfProvider}
              onChange={(e) => setBizIsSelfProvider(e.target.checked)}
              className="mt-0.5 rounded border-[#DFD9CE] text-pilis focus:ring-pilis"
            />
            <span className="text-xs font-semibold text-[#18261F] leading-snug">
              Én vagyok a szolgáltató (szeretnék üzeneteket is fogadni itt)
            </span>
          </label>
        )}

        <button
          type="submit"
          disabled={formSaving}
          className="w-full bg-pilis hover:bg-pilis-light text-white font-bold py-3 rounded-xl text-sm transition"
        >
          {formSaving
            ? 'Mentés...'
            : editingProId
            ? 'Módosítások mentése'
            : 'Közzététel'}
        </button>
      </form>
    </div>
  );
}
