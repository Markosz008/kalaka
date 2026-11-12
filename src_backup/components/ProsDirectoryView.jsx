import React, { useState } from 'react';
import { PRO_GROUPS, PRO_CATEGORIES, SZENTENDRE_ZONES } from '../constants/szentendreData';

export default function ProsDirectoryView({
  pros,
  currentUser,
  endorsedIds = [],
  onSavePro,
  onDeletePro,
  onToggleEndorsePro,
  onUpdateZoneToday
}) {
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('villany');
  const [specialty, setSpecialty] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [activeZoneToday, setActiveZoneToday] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const visibleCategories =
    selectedGroup === 'all'
      ? PRO_CATEGORIES
      : PRO_CATEGORIES.filter((c) => c.group === selectedGroup);

  const selectedCatMeta = PRO_CATEGORIES.find((c) => c.id === category) || PRO_CATEGORIES[0];

  const filteredPros = pros.filter((pro) => {
    const catMeta = PRO_CATEGORIES.find((c) => c.id === pro.category);
    if (selectedGroup !== 'all' && catMeta?.group !== selectedGroup) return false;
    if (selectedCategory !== 'all' && pro.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = pro.business_name?.toLowerCase().includes(q);
      const matchSpec = pro.specialty?.toLowerCase().includes(q);
      const matchZone = pro.active_zone_today?.toLowerCase().includes(q);
      if (!matchName && !matchSpec && !matchZone) return false;
    }
    return true;
  });

  const resetForm = () => {
    setEditingId(null);
    setBusinessName('');
    setCategory('villany');
    setSpecialty('');
    setTaxNumber('');
    setPhone('');
    setActiveZoneToday('');
    setErrorMsg('');
  };

  const handleStartEdit = (pro) => {
    setEditingId(pro.id);
    setBusinessName(pro.business_name || '');
    setCategory(pro.category || 'villany');
    setSpecialty(pro.specialty || '');
    setTaxNumber(pro.tax_number || '');
    setPhone(pro.phone || '');
    setActiveZoneToday(pro.active_zone_today || '');
    setErrorMsg('');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!businessName.trim() || !specialty.trim() || !phone.trim() || !taxNumber.trim()) {
      setErrorMsg('Minden kötelező mezőt tölts ki.');
      return;
    }
    setSubmitting(true);
    const err = await onSavePro(
      {
        business_name: businessName.trim(),
        category,
        specialty: specialty.trim(),
        tax_number: taxNumber.trim(),
        phone: phone.trim(),
        active_zone_today: activeZoneToday || null
      },
      editingId
    );
    setSubmitting(false);
    if (err) {
      setErrorMsg(err);
    } else {
      resetForm();
      setShowForm(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-stone-900">Szentendrei szakemberek és szolgáltatók</h2>
            <p className="text-xs text-stone-600">
              Helyi mesterek, szakemberek és szolgáltatások a szomszédok ajánlásával
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (showForm) {
                resetForm();
                setShowForm(false);
              } else {
                resetForm();
                setShowForm(true);
              }
            }}
            className="self-start sm:self-auto px-3.5 py-2 rounded-xl text-xs font-semibold bg-pilis text-white hover:bg-pilis-light transition"
          >
            {showForm ? 'Űrlap bezárása' : '+ Szakember vagy szolgáltató felvétele'}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <div className="inline-flex rounded-xl bg-stone-100 p-1 shrink-0">
            {PRO_GROUPS.map((grp) => (
              <button
                key={grp.id}
                type="button"
                onClick={() => {
                  setSelectedGroup(grp.id);
                  setSelectedCategory('all');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  selectedGroup === grp.id ? 'bg-white text-pilis shadow-sm' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {grp.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Keresés név, tevékenység vagy városrész alapján (pl. fodrász, hőszivattyú, Pismány)..."
            className="flex-1 px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-stone-200 focus:outline-none focus:border-pilis"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition ${
              selectedCategory === 'all'
                ? 'bg-pilis text-white'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            Összes kategória
          </button>
          {visibleCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition ${
                selectedCategory === cat.id
                  ? 'bg-pilis text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border-2 border-pilis/30 p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-stone-900">
            {editingId ? 'Szakember vagy szolgáltatás adatainak módosítása' : 'Új szakember vagy szolgáltatás felvétele'}
          </h3>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">{errorMsg}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Név vagy vállalkozás neve</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Pl. Kovács Gábor EV / Pilis Masszázs Stúdió"
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Szakterület</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 bg-white"
              >
                <optgroup label="Ház és Kert (kiszállásos szakemberek)">
                  {PRO_CATEGORIES.filter((c) => c.group === 'haz_kert').map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Szolgáltatások (személyes és szakmai)">
                  {PRO_CATEGORIES.filter((c) => c.group === 'szolgaltatas').map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Tevékenység és szakterület részletezése
              </label>
              <input
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder={selectedCatMeta.placeholder}
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Telefonszám</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+36 30 123 4567"
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Adószám</label>
              <input
                type="text"
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value)}
                placeholder="12345678-1-13"
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                {selectedCatMeta.isMobileTrade
                  ? 'Melyik városrészben dolgozol ma? (opcionális)'
                  : 'Melyik városrészben található a rendelő / szalon / helyszín?'}
              </label>
              <select
                value={activeZoneToday}
                onChange={(e) => setActiveZoneToday(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 bg-white"
              >
                <option value="">Nincs megadva / Szentendre egész területén</option>
                {SZENTENDRE_ZONES.map((z) => (
                  <option key={z.id} value={z.name}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-100"
            >
              Mégse
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-pilis text-white hover:bg-pilis-light disabled:opacity-50"
            >
              {editingId ? 'Módosítások mentése' : 'Mentés a névjegyzékbe'}
            </button>
          </div>
        </form>
      )}

      {filteredPros.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-sm text-stone-500">
          Ebben a kategóriában még nincs felvett szakember vagy szolgáltató.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredPros.map((pro) => {
            const catMeta = PRO_CATEGORIES.find((c) => c.id === pro.category);
            const isOwner = currentUser?.id === pro.owner_id;
            const isMobileTrade = catMeta ? catMeta.isMobileTrade : true;
            const hasEndorsed = endorsedIds.includes(pro.id);

            return (
              <div
                key={pro.id}
                className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pilis-soft text-pilis">
                      {catMeta?.label || pro.category}
                    </span>

                    {pro.active_zone_today && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-900 border border-amber-200">
                        {isMobileTrade ? `Ma itt dolgozik: ${pro.active_zone_today}` : `Helyszín: ${pro.active_zone_today}`}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-stone-900">{pro.business_name}</h3>
                  <p className="text-xs sm:text-sm text-stone-600 mt-1 leading-relaxed">{pro.specialty}</p>

                  {isOwner && (
                    <div className="mt-2.5 pt-2.5 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-stone-500">
                          {isMobileTrade ? 'Mai munkaterület:' : 'Helyszín:'}
                        </span>
                        <select
                          value={pro.active_zone_today || ''}
                          onChange={(e) => onUpdateZoneToday(pro.id, e.target.value || null)}
                          className="text-xs px-2 py-1 rounded-lg border border-stone-300 bg-white"
                        >
                          <option value="">Nincs kijelölve</option>
                          {SZENTENDRE_ZONES.map((z) => (
                            <option key={z.id} value={z.name}>
                              {z.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(pro)}
                          className="text-xs font-semibold text-pilis hover:bg-pilis-soft px-2 py-1 rounded-lg"
                        >
                          Szerkesztés
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeletePro(pro.id)}
                          className="text-xs font-semibold text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg"
                        >
                          Törlés
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2.5 border-t border-stone-100 flex items-center justify-between gap-2">
                  {isOwner ? (
                    <span className="text-xs font-medium text-stone-500 px-2 py-1">
                      👍 {pro.endorsement_count || 0} ajánlás
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onToggleEndorsePro(pro)}
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition ${
                        hasEndorsed
                          ? 'bg-pilis text-white border-pilis'
                          : 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-pilis-soft hover:text-pilis'
                      }`}
                    >
                      <span>{hasEndorsed ? '✓ Ajánlottad' : '👍 Ajánlom'}</span>
                      {pro.endorsement_count > 0 && <span>({pro.endorsement_count})</span>}
                    </button>
                  )}

                  <a
                    href={`tel:${pro.phone}`}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-pilis text-white hover:bg-pilis-light transition"
                  >
                    Hívás: {pro.phone}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
