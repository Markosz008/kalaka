import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { supabase } from '../lib/supabase.js';
import {
  SZENTENDRE_ZONES,
  SERVICE_GROUPS,
  DEFAULT_PROFESSIONS,
  normalizeServiceGroup,
  resolveCoordsFromText
} from '../constants/szentendreData.js';

export default function ProsDirectoryView({
  pros,
  session,
  profile,
  onOpenAuthModal,
  onRefreshPros
}) {
  const currentUserId = session?.user?.id || null;

  // Szűrők: Szabad kereső + Főterület + Dinamikus szakmacímke
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [professionFilter, setProfessionFilter] = useState('all');
  const [showMap, setShowMap] = useState(true);

  // Felhasználó saját interakciói és már leadott ajánlásai
  const [interactedProIds, setInteractedProIds] = useState(new Set());
  const [endorsedProIds, setEndorsedProIds] = useState(new Set());
  const [endorseCommentsByPro, setEndorseCommentsByPro] = useState({});

  // Inline ajánlás-író állapot (egy adott kártyához)
  const [endorsingProId, setEndorsingProId] = useState(null);
  const [endorseNote, setEndorseNote] = useState('');
  const [endorseSaving, setEndorseSaving] = useState(false);

  // Új szakember / szolgáltató űrlap modal (és szerkesztés)
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingProId, setEditingProId] = useState(null);
  const [bizName, setBizName] = useState('');
  const [bizGroup, setBizGroup] = useState('szepseg_egeszseg');
  const [professionInput, setProfessionInput] = useState('');
  const [showProfessionDropdown, setShowProfessionDropdown] = useState(false);
  const [bizSpec, setBizSpec] = useState('');
  const [bizPhone, setBizPhone] = useState('');
  const [bizTax, setBizTax] = useState('');
  const [bizBaseZone, setBizBaseZone] = useState(profile?.zone || 'Belváros');
  const [bizActiveToday, setBizActiveToday] = useState(true);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersLayer = useRef(null);

  // 1. Összes létező szakma dinamikus összegyűjtése (alaplista + adatbázisban felvett új szakmák)
  const allProfessions = useMemo(() => {
    const map = new Map();
    DEFAULT_PROFESSIONS.forEach((p) => {
      map.set(p.name.toLowerCase(), { name: p.name, group: p.group });
    });
    (pros || []).forEach((item) => {
      const pName = (item.profession_name || '').trim();
      if (pName && !map.has(pName.toLowerCase())) {
        map.set(pName.toLowerCase(), {
          name: pName,
          group: normalizeServiceGroup(item.category)
        });
      }
    });
    return Array.from(map.values());
  }, [pros]);

  // Aktív szakmacímkék a kiválasztott főterülethez
  const visibleProfessionChips = useMemo(() => {
    const usedNames = new Set(
      (pros || [])
        .filter((p) => groupFilter === 'all' || normalizeServiceGroup(p.category) === groupFilter)
        .map((p) => (p.profession_name || '').trim())
        .filter(Boolean)
    );
    return Array.from(usedNames);
  }, [pros, groupFilter]);

  // 2. Felhasználó interakcióinak és ajánlásainak betöltése
  const loadInteractionAndEndorsementState = async () => {
    if (!supabase) return;

    const { data: allEndorsements } = await supabase
      .from('pro_endorsements')
      .select('pro_id, user_id, comment, created_at')
      .order('created_at', { ascending: false });

    if (allEndorsements) {
      const myEndorsed = new Set();
      const commentsMap = {};
      allEndorsements.forEach((e) => {
        if (currentUserId && e.user_id === currentUserId) {
          myEndorsed.add(e.pro_id);
        }
        if (e.comment && e.comment.trim()) {
          if (!commentsMap[e.pro_id]) commentsMap[e.pro_id] = [];
          if (commentsMap[e.pro_id].length < 2) {
            commentsMap[e.pro_id].push(e.comment.trim());
          }
        }
      });
      setEndorsedProIds(myEndorsed);
      setEndorseCommentsByPro(commentsMap);
    }

    if (currentUserId) {
      const { data: myInts } = await supabase
        .from('pro_interactions')
        .select('pro_id')
        .eq('user_id', currentUserId);
      if (myInts) {
        setInteractedProIds(new Set(myInts.map((i) => i.pro_id)));
      }
    } else {
      setInteractedProIds(new Set());
      setEndorsedProIds(new Set());
    }
  };

  useEffect(() => {
    loadInteractionAndEndorsementState();
  }, [currentUserId, pros?.length]);

  // 3. Szűrt lista összeállítása
  const filteredPros = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (pros || []).filter((p) => {
      const grp = normalizeServiceGroup(p.category);
      if (groupFilter !== 'all' && grp !== groupFilter) return false;
      if (
        professionFilter !== 'all' &&
        (p.profession_name || '').toLowerCase() !== professionFilter.toLowerCase()
      ) {
        return false;
      }
      if (q) {
        const hay = `${p.business_name} ${p.profession_name || ''} ${p.specialty || ''} ${p.base_zone || ''} ${p.active_zone_today || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [pros, groupFilter, professionFilter, searchQuery]);

  // 4. Térkép inicializálása
  useEffect(() => {
    if (!showMap || !mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, {
      center: [47.674, 19.064],
      zoom: 13,
      zoomControl: false
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      { attribution: '&copy; Esri, OpenStreetMap' }
    ).addTo(map);

    markersLayer.current = L.layerGroup().addTo(map);
    mapInstance.current = map;
    const t = setTimeout(() => map.invalidateSize(), 150);

    return () => {
      clearTimeout(t);
      map.remove();
      mapInstance.current = null;
    };
  }, [showMap]);

  // 5. Szakik / szolgáltatók jelölése a térképen
  useEffect(() => {
    const group = markersLayer.current;
    if (!group || !showMap) return;
    group.clearLayers();

    filteredPros.forEach((p, idx) => {
      const zoneLabel = p.active_zone_today || p.base_zone;
      if (!zoneLabel) return;
      const coord = resolveCoordsFromText(zoneLabel);
      if (!coord) return;

      const lat = coord.lat + ((idx % 4) - 1.5) * 0.0007;
      const lng = coord.lng + ((idx % 3) - 1) * 0.0007;
      const isToday = Boolean(p.active_zone_today);

      const pin = L.divIcon({
        className: '',
        html: `<div style="background:${
          isToday ? '#1E4635' : '#5C6B62'
        };color:#fff;font-weight:700;font-size:11px;padding:3px 8px;border-radius:99px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);white-space:nowrap">${
          p.profession_name || p.business_name
        }</div>`,
        iconSize: [120, 24],
        iconAnchor: [60, 12]
      });

      L.marker([lat, lng], { icon: pin })
        .bindTooltip(
          `${p.business_name} (${p.profession_name || ''}) • ${zoneLabel}`,
          { direction: 'top' }
        )
        .addTo(group);
    });
  }, [filteredPros, showMap]);

  // 6. Kapcsolatfelvétel rögzítése (Hívás kattintáskor)
  const handleRecordInteraction = async (pro, type = 'call') => {
    if (!currentUserId) return;
    setInteractedProIds((prev) => new Set([...prev, pro.id]));

    if (supabase) {
      await supabase
        .from('pro_interactions')
        .upsert(
          { pro_id: pro.id, user_id: currentUserId, interaction_type: type },
          { onConflict: 'pro_id,user_id' }
        );
    }
  };

  // 7. Egyszeri, hitelesített ajánlás mentése
  const handleSubmitEndorsement = async (pro) => {
    if (!currentUserId) {
      onOpenAuthModal();
      return;
    }
    if (endorsedProIds.has(pro.id)) return;

    setEndorseSaving(true);
    try {
      const cleanComment = endorseNote.trim();
      if (supabase) {
        const { error } = await supabase.from('pro_endorsements').insert({
          pro_id: pro.id,
          user_id: currentUserId,
          comment: cleanComment || null
        });
        if (error) throw error;
      }

      setEndorsedProIds((prev) => new Set([...prev, pro.id]));
      if (cleanComment) {
        setEndorseCommentsByPro((prev) => ({
          ...prev,
          [pro.id]: [cleanComment, ...(prev[pro.id] || [])].slice(0, 2)
        }));
      }
      setEndorsingProId(null);
      setEndorseNote('');
      if (onRefreshPros) await onRefreshPros();
    } catch (err) {
      alert(`Nem sikerült menteni az ajánlást: ${err.message}`);
    } finally {
      setEndorseSaving(false);
    }
  };

  // 8. Új szaki / szolgáltató űrlap megnyitása
  const openCreateForm = () => {
    if (!currentUserId) {
      onOpenAuthModal();
      return;
    }
    setEditingProId(null);
    setBizName('');
    setBizGroup(groupFilter !== 'all' ? groupFilter : 'szepseg_egeszseg');
    setProfessionInput(professionFilter !== 'all' ? professionFilter : '');
    setBizSpec('');
    setBizPhone('');
    setBizTax('');
    setBizBaseZone(profile?.zone || 'Belváros');
    setBizActiveToday(true);
    setFormError(null);
    setShowFormModal(true);
  };

  const openEditForm = (pro) => {
    setEditingProId(pro.id);
    setBizName(pro.business_name || '');
    setBizGroup(normalizeServiceGroup(pro.category));
    setProfessionInput(pro.profession_name || '');
    setBizSpec(pro.specialty || '');
    setBizPhone(pro.phone || '');
    setBizTax(pro.tax_number || '');
    setBizBaseZone(pro.base_zone || pro.active_zone_today || 'Belváros');
    setBizActiveToday(Boolean(pro.active_zone_today));
    setFormError(null);
    setShowFormModal(true);
  };

  const handleSaveProForm = async (e) => {
    e.preventDefault();
    if (!currentUserId) {
      setShowFormModal(false);
      onOpenAuthModal();
      return;
    }

    const cleanProfession = professionInput.trim();
    if (!bizName.trim() || !cleanProfession || !bizPhone.trim()) {
      setFormError('Kérlek add meg a nevet, a szakmát/szolgáltatást és a telefonszámot.');
      return;
    }

    setFormSaving(true);
    setFormError(null);

    try {
      const payload = {
        business_name: bizName.trim(),
        category: bizGroup,
        profession_name:
          cleanProfession.charAt(0).toUpperCase() + cleanProfession.slice(1),
        specialty: bizSpec.trim() || cleanProfession,
        phone: bizPhone.trim(),
        tax_number: bizTax.trim() || '12345678-1-13',
        base_zone: bizBaseZone,
        active_zone_today: bizActiveToday ? bizBaseZone : null,
        is_active: true
      };

      if (editingProId) {
        const { error } = await supabase
          .from('local_pros')
          .update(payload)
          .eq('id', editingProId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('local_pros')
          .insert({ ...payload, owner_id: currentUserId, endorsement_count: 0 });
        if (error) throw error;
      }

      setShowFormModal(false);
      setEditingProId(null);
      if (onRefreshPros) await onRefreshPros();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeletePro = async (proId) => {
    if (!window.confirm('Biztosan törlöd ezt a szakmai adatlapot?')) return;
    if (supabase) {
      const { error } = await supabase.from('local_pros').delete().eq('id', proId);
      if (error) {
        alert(`Törlési hiba: ${error.message}`);
        return;
      }
      if (onRefreshPros) await onRefreshPros();
    }
  };

  const matchingProfessionsInForm = useMemo(() => {
    const q = professionInput.trim().toLowerCase();
    return allProfessions.filter(
      (p) => !q || p.name.toLowerCase().includes(q)
    );
  }, [allProfessions, professionInput]);

  const exactProfessionExists = useMemo(() => {
    const q = professionInput.trim().toLowerCase();
    if (!q) return true;
    return allProfessions.some((p) => p.name.toLowerCase() === q);
  }, [allProfessions, professionInput]);

  return (
    <div className="space-y-3 w-full overflow-x-hidden">
      {/* Fejléc kártya: Kereső + Új szakember / szolgáltató felvétele gomb */}
      <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] shadow-sm space-y-2.5 box-border">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display font-bold text-base text-[#18261F] truncate">
            Helyi szakemberek és szolgáltatások
          </h2>
          <button
            type="button"
            onClick={() => setShowMap((v) => !v)}
            className="shrink-0 text-xs font-bold text-pilis bg-pilis-soft px-2.5 py-1 rounded-lg"
          >
            {showMap ? 'Térkép elrejtése' : 'Térkép'}
          </button>
        </div>

        {/* Keresőmező */}
        <div className="flex items-center gap-2 bg-limestone border border-[#DFD9CE] focus-within:border-pilis rounded-xl px-3 py-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Keress szakmára vagy névre (pl. fodrász, ötvös, autószerelő)..."
            className="w-full text-base bg-transparent focus:outline-none text-[#18261F]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs font-bold text-[#5C6B62] px-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* 1. szintű szűrő: Fő területek */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {SERVICE_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                setGroupFilter(g.id);
                setProfessionFilter('all');
              }}
              className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border transition ${
                groupFilter === g.id
                  ? 'bg-pilis text-white border-pilis'
                  : 'bg-limestone text-[#5C6B62] border-[#DFD9CE] hover:border-pilis'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* 2. szintű szűrő: Dinamikus szakmacímkék */}
        {visibleProfessionChips.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-[#ECE7DC]">
            <button
              type="button"
              onClick={() => setProfessionFilter('all')}
              className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition ${
                professionFilter === 'all'
                  ? 'bg-[#18261F] text-white border-[#18261F]'
                  : 'bg-white text-[#5C6B62] border-[#DFD9CE]'
              }`}
            >
              Minden szakma
            </button>
            {visibleProfessionChips.map((profName) => (
              <button
                key={profName}
                type="button"
                onClick={() =>
                  setProfessionFilter(
                    professionFilter === profName ? 'all' : profName
                  )
                }
                className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition ${
                  professionFilter === profName
                    ? 'bg-[#18261F] text-white border-[#18261F]'
                    : 'bg-white text-[#18261F] border-[#DFD9CE] hover:border-pilis'
                }`}
              >
                {profName}
              </button>
            ))}
          </div>
        )}

        {/* Térkép */}
        {showMap && (
          <div className="rounded-xl overflow-hidden border border-[#DFD9CE]">
            <div ref={mapRef} className="w-full h-44" />
          </div>
        )}

        {/* Teljes szélességű Regisztrációs / Felvételi gomb */}
        <button
          type="button"
          onClick={openCreateForm}
          className="w-full bg-pilis-soft hover:bg-pilis text-pilis hover:text-white font-bold text-xs py-2.5 px-4 rounded-xl border border-pilis/20 transition"
        >
          + Szakember vagy szolgáltatás felvétele
        </button>
      </div>

      {/* Szakember / Szolgáltató kártyák */}
      {filteredPros.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 text-center border border-[#DFD9CE] space-y-2.5">
          <div className="text-sm font-bold text-[#18261F]">
            Nincs találat erre a szűrésre.
          </div>
          <p className="text-xs text-[#5C6B62]">
            Ismerős vagy te magad dolgozol ezen a területen Szentendrén? Vedd fel új szakmaként!
          </p>
          <button
            type="button"
            onClick={openCreateForm}
            className="bg-pilis text-white font-bold text-xs px-4 py-2.5 rounded-xl"
          >
            + Új szakma és szolgáltató felvétele
          </button>
        </div>
      ) : (
        filteredPros.map((pro) => {
          const isOwner = Boolean(currentUserId && pro.owner_id === currentUserId);
          const hasInteracted = interactedProIds.has(pro.id);
          const hasEndorsed = endorsedProIds.has(pro.id);
          const recentComments = endorseCommentsByPro[pro.id] || [];

          return (
            <article
              key={pro.id}
              className="bg-white rounded-2xl p-3.5 sm:p-4 border border-[#DFD9CE] shadow-sm space-y-2.5 box-border"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    {pro.profession_name && (
                      <span className="text-[11px] font-bold bg-pilis-soft text-pilis px-2.5 py-0.5 rounded-full">
                        {pro.profession_name}
                      </span>
                    )}
                    {pro.active_zone_today ? (
                      <span className="text-[11px] font-bold bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full">
                        Ma itt: {pro.active_zone_today}
                      </span>
                    ) : pro.base_zone ? (
                      <span className="text-[11px] font-medium bg-limestone text-[#5C6B62] px-2.5 py-0.5 rounded-full">
                        {pro.base_zone}
                      </span>
                    ) : null}
                  </div>

                  <h3 className="font-display font-bold text-base text-[#18261F] break-words">
                    {pro.business_name}
                  </h3>
                  <p className="text-xs text-[#5C6B62] mt-0.5 leading-relaxed">
                    {pro.specialty}
                  </p>
                </div>

                {/* Hívás gomb (kattintásra rögzíti a kapcsolatfelvételt) */}
                <a
                  href={`tel:${pro.phone}`}
                  onClick={() => handleRecordInteraction(pro, 'call')}
                  className="shrink-0 bg-pilis hover:bg-pilis-light text-white font-bold text-xs px-3.5 py-2.5 rounded-xl transition"
                >
                  Hívás
                </a>
              </div>

              {/* Szomszédok rövid szöveges visszajelzései */}
              {recentComments.length > 0 && (
                <div className="bg-limestone rounded-xl p-2.5 space-y-1 border border-[#ECE7DC]">
                  {recentComments.map((c, idx) => (
                    <div key={idx} className="text-[11px] text-[#18261F] italic">
                      „{c}”
                    </div>
                  ))}
                </div>
              )}

              {/* Alsó sáv: Ajánlások száma + Hitelesített 1x ajánlás / Saját szerkesztés */}
              <div className="flex items-center justify-between pt-2 border-t border-[#ECE7DC] gap-2">
                <div className="text-xs font-semibold text-[#5C6B62]">
                  {pro.endorsement_count || 0} helyi ajánlás
                </div>

                {isOwner ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditForm(pro)}
                      className="bg-limestone hover:bg-[#E5DFD3] text-[#18261F] border border-[#DFD9CE] font-bold text-xs px-2.5 py-1.5 rounded-xl"
                    >
                      Szerkesztés
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePro(pro.id)}
                      className="bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 font-bold text-xs px-2.5 py-1.5 rounded-xl"
                    >
                      Törlés
                    </button>
                  </div>
                ) : hasEndorsed ? (
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded-xl">
                    Ajánlva ✓
                  </span>
                ) : hasInteracted ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEndorsingProId(endorsingProId === pro.id ? null : pro.id);
                      setEndorseNote('');
                    }}
                    className="bg-pilis-soft hover:bg-pilis text-pilis hover:text-white font-bold text-xs px-3 py-1.5 rounded-xl transition"
                  >
                    Ajánlom
                  </button>
                ) : (
                  <span className="text-[11px] text-[#7A867E]">
                    Kapcsolatfelvétel után ajánlható
                  </span>
                )}
              </div>

              {/* Egyszeri ajánlás szöveges megerősítése */}
              {endorsingProId === pro.id && !hasEndorsed && (
                <div className="bg-limestone p-2.5 rounded-xl border border-pilis/30 space-y-2">
                  <input
                    type="text"
                    value={endorseNote}
                    onChange={(e) => setEndorseNote(e.target.value)}
                    placeholder="Rövid visszajelzés (pl. Pontos, szépen dolgozott)..."
                    className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3 py-2 text-base box-border"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEndorsingProId(null)}
                      className="text-xs font-bold text-[#5C6B62] px-3 py-1.5"
                    >
                      Mégse
                    </button>
                    <button
                      type="button"
                      disabled={endorseSaving}
                      onClick={() => handleSubmitEndorsement(pro)}
                      className="bg-pilis text-white font-bold text-xs px-3.5 py-1.5 rounded-xl"
                    >
                      {endorseSaving ? 'Mentés...' : 'Ajánlás elküldése'}
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })
      )}

      {/* Mobilbarát Űrlap Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleSaveProForm}
            className="bg-limestone w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-3 border border-[#DFD9CE] shadow-2xl max-h-[90vh] overflow-y-auto box-border"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display font-extrabold text-lg text-[#18261F]">
                {editingProId ? 'Adatlap szerkesztése' : 'Szakember vagy szolgáltatás felvétele'}
              </h3>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
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
                Szakma vagy szolgáltatás (válassz vagy írj be újat)
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
                <div className="mt-1 bg-white border border-[#DFD9CE] rounded-xl shadow-lg max-h-40 overflow-y-auto divide-y divide-[#ECE7DC]">
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

            <div>
              <label className="text-xs font-bold block mb-1">Név vagy vállalkozás neve</label>
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
              <label className="text-xs font-bold block mb-1">Miben tud segíteni? (rövid leírás)</label>
              <input
                type="text"
                required
                value={bizSpec}
                onChange={(e) => setBizSpec(e.target.value)}
                placeholder="Pl. Női-férfi hajvágás, festés bejelentkezéssel"
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

            <label className="flex items-center gap-2.5 bg-white border border-[#DFD9CE] rounded-xl p-3 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={bizActiveToday}
                onChange={(e) => setBizActiveToday(e.target.checked)}
                className="accent-pilis w-4 h-4 shrink-0"
              />
              <span>Ma elérhető / itt dolgozik Szentendrén</span>
            </label>

            <button
              type="submit"
              disabled={formSaving}
              className="w-full bg-pilis hover:bg-pilis-light text-white font-bold py-3 rounded-xl text-sm transition"
            >
              {formSaving
                ? 'Mentés...'
                : editingProId
                ? 'Módosítások mentése'
                : 'Közzététel a listában'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

