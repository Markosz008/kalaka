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

const ENDORSEMENT_STRENGTH_TAGS = [
  'Pontos',
  'Szépen dolgozik',
  'Korrekt ár',
  'Segítőkész'
];

export default function ProsDirectoryView({
  pros,
  session,
  profile,
  onOpenAuthModal,
  onRefreshPros,
  onStartProAgreement
}) {
  const currentUserId = session?.user?.id || null;

  // Szűrők
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [professionFilter, setProfessionFilter] = useState('all');
  const [showMap, setShowMap] = useState(true);

  // Kiválasztott szakember részletes névjegykártyája (Bottom Sheet)
  const [selectedPro, setSelectedPro] = useState(null);

  // Felhasználó interakciói és leadott ajánlásai
  const [interactedProIds, setInteractedProIds] = useState(new Set());
  const [endorsedProIds, setEndorsedProIds] = useState(new Set());
  const [endorsementsByPro, setEndorsementsByPro] = useState({});

  // Ajánlás-küldő állapot a részletlapon
  const [selectedTags, setSelectedTags] = useState([]);
  const [endorseNote, setEndorseNote] = useState('');
  const [endorseSaving, setEndorseSaving] = useState(false);

  // Új szakember / szolgáltató felvétele és szerkesztése
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingProId, setEditingProId] = useState(null);
  const [bizName, setBizName] = useState('');
  const [bizGroup, setBizGroup] = useState('szepseg_egeszseg');
  const [professionInput, setProfessionInput] = useState('');
  const [showProfessionDropdown, setShowProfessionDropdown] = useState(false);
  const [bizSpec, setBizSpec] = useState('');
  const [bizExperienceYears, setBizExperienceYears] = useState('');
  const [bizBio, setBizBio] = useState('');
  const [bizPhone, setBizPhone] = useState('');
  const [bizBaseZone, setBizBaseZone] = useState(profile?.zone || 'Belváros');
  const [bizActiveToday, setBizActiveToday] = useState(true);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersLayer = useRef(null);

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

  const visibleProfessionChips = useMemo(() => {
    const usedNames = new Set(
      (pros || [])
        .filter((p) => groupFilter === 'all' || normalizeServiceGroup(p.category) === groupFilter)
        .map((p) => (p.profession_name || '').trim())
        .filter(Boolean)
    );
    return Array.from(usedNames);
  }, [pros, groupFilter]);

  const loadInteractionAndEndorsementState = async () => {
    if (!supabase) return;

    const { data: allEndorsements } = await supabase
      .from('pro_endorsements')
      .select('id, pro_id, user_id, comment, tags, created_at, author:profiles!pro_endorsements_user_id_fkey(display_name, zone)')
      .order('created_at', { ascending: false });

    if (allEndorsements) {
      const myEndorsed = new Set();
      const grouped = {};
      allEndorsements.forEach((e) => {
        if (currentUserId && e.user_id === currentUserId) {
          myEndorsed.add(e.pro_id);
        }
        if (!grouped[e.pro_id]) grouped[e.pro_id] = [];
        grouped[e.pro_id].push({
          id: e.id,
          authorName: e.author?.display_name || 'Szentendrei szomszéd',
          authorZone: e.author?.zone || '',
          tags: Array.isArray(e.tags) ? e.tags : [],
          comment: (e.comment || '').trim()
        });
      });
      setEndorsedProIds(myEndorsed);
      setEndorsementsByPro(grouped);
    }

    if (currentUserId) {
      const [{ data: myInts }, { data: myAgrs }] = await Promise.all([
        supabase.from('pro_interactions').select('pro_id').eq('user_id', currentUserId),
        supabase.from('agreements').select('pro_id').eq('requester_id', currentUserId).not('pro_id', 'is', null)
      ]);
      const combined = new Set();
      (myInts || []).forEach((i) => combined.add(i.pro_id));
      (myAgrs || []).forEach((a) => combined.add(a.pro_id));
      setInteractedProIds(combined);
    } else {
      setInteractedProIds(new Set());
      setEndorsedProIds(new Set());
    }
  };

  useEffect(() => {
    loadInteractionAndEndorsementState();
  }, [currentUserId, pros?.length]);

  // Frissítjük a kiválasztott kártya adatait is, ha a háttérben változott (pl. új ajánlás)
  useEffect(() => {
    if (!selectedPro) return;
    const updated = (pros || []).find((p) => p.id === selectedPro.id);
    if (updated) setSelectedPro(updated);
  }, [pros]);

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
        const hay = `${p.business_name} ${p.profession_name || ''} ${p.specialty || ''} ${p.bio || ''} ${p.base_zone || ''} ${p.active_zone_today || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [pros, groupFilter, professionFilter, searchQuery]);

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
        };color:#fff;font-weight:700;font-size:11px;padding:3px 8px;border-radius:99px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);white-space:nowrap;cursor:pointer">${
          p.profession_name || p.business_name
        }</div>`,
        iconSize: [120, 24],
        iconAnchor: [60, 12]
      });

      const marker = L.marker([lat, lng], { icon: pin }).bindTooltip(
        `${p.business_name} (${p.profession_name || ''}) • ${zoneLabel}`,
        { direction: 'top' }
      );
      marker.on('click', () => setSelectedPro(p));
      marker.addTo(group);
    });
  }, [filteredPros, showMap]);

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

  const handleMessageClick = async (pro) => {
    if (!currentUserId) {
      setSelectedPro(null);
      onOpenAuthModal();
      return;
    }
    await handleRecordInteraction(pro, 'message');
    setSelectedPro(null);
    if (onStartProAgreement) {
      await onStartProAgreement(pro);
    }
  };

  const toggleStrengthTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmitEndorsement = async (pro) => {
    if (!currentUserId) {
      setSelectedPro(null);
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
          tags: selectedTags,
          comment: cleanComment || null
        });
        if (error) throw error;
      }

      setEndorsedProIds((prev) => new Set([...prev, pro.id]));
      setSelectedTags([]);
      setEndorseNote('');
      await loadInteractionAndEndorsementState();
      if (onRefreshPros) await onRefreshPros();
    } catch (err) {
      alert(`Nem sikerült menteni az ajánlást: ${err.message}`);
    } finally {
      setEndorseSaving(false);
    }
  };

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
    setBizExperienceYears('');
    setBizBio('');
    setBizPhone('');
    setBizBaseZone(profile?.zone || 'Belváros');
    setBizActiveToday(true);
    setFormError(null);
    setShowFormModal(true);
  };

  const openEditForm = (pro) => {
    setSelectedPro(null);
    setEditingProId(pro.id);
    setBizName(pro.business_name || '');
    setBizGroup(normalizeServiceGroup(pro.category));
    setProfessionInput(pro.profession_name || '');
    setBizSpec(pro.specialty || '');
    setBizExperienceYears(pro.experience_years ? String(pro.experience_years) : '');
    setBizBio(pro.bio || '');
    setBizPhone(pro.phone || '');
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
      setFormError('Add meg a nevet, a szakmát vagy szolgáltatást és a telefonszámot.');
      return;
    }

    setFormSaving(true);
    setFormError(null);

    try {
      const expNum = parseInt(bizExperienceYears, 10);
      const payload = {
        business_name: bizName.trim(),
        category: bizGroup,
        profession_name:
          cleanProfession.charAt(0).toUpperCase() + cleanProfession.slice(1),
        specialty: bizSpec.trim() || cleanProfession,
        experience_years: !isNaN(expNum) && expNum > 0 ? expNum : null,
        bio: bizBio.trim() || null,
        phone: bizPhone.trim(),
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
    if (!window.confirm('Biztosan törlöd ezt az adatlapot?')) return;
    setSelectedPro(null);
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
      {/* Kereső és szűrő kártya */}
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

        {showMap && (
          <div className="rounded-xl overflow-hidden border border-[#DFD9CE]">
            <div ref={mapRef} className="w-full h-44" />
          </div>
        )}

        <button
          type="button"
          onClick={openCreateForm}
          className="w-full bg-pilis-soft hover:bg-pilis text-pilis hover:text-white font-bold text-xs py-2.5 px-4 rounded-xl border border-pilis/20 transition"
        >
          + Szakember vagy szolgáltatás felvétele
        </button>
      </div>

      {/* Szellős, kattintható kártyák listája */}
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
          const proEndorsements = endorsementsByPro[pro.id] || [];
          const firstRecommender = proEndorsements[0];

          return (
            <article
              key={pro.id}
              onClick={() => {
                setSelectedTags([]);
                setEndorseNote('');
                setSelectedPro(pro);
              }}
              className="bg-white rounded-2xl p-3.5 sm:p-4 border border-[#DFD9CE] hover:border-pilis shadow-sm space-y-2.5 cursor-pointer transition box-border"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    {pro.profession_name && (
                      <span className="text-[11px] font-bold bg-pilis-soft text-pilis px-2.5 py-0.5 rounded-full">
                        {pro.profession_name}
                      </span>
                    )}
                    {pro.experience_years > 0 && (
                      <span className="text-[11px] font-semibold bg-[#ECE7DC] text-[#18261F] px-2 py-0.5 rounded-full">
                        {pro.experience_years} év tapasztalat
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
                  <p className="text-xs text-[#5C6B62] mt-0.5 line-clamp-1">
                    {pro.specialty}
                  </p>
                </div>

                <span className="text-xs font-bold text-[#5C6B62] shrink-0 pt-0.5">
                  Részletek ›
                </span>
              </div>

              {/* Kompakt lábléc: ajánlás összegző + közvetlen Üzenet és Hívás gombok */}
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-between pt-2.5 border-t border-[#ECE7DC] gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#18261F]">
                    {pro.endorsement_count || 0} helyi ajánlás
                  </div>
                  {firstRecommender && (
                    <div className="text-[11px] text-[#5C6B62] truncate">
                      Ajánlotta: {firstRecommender.authorName}
                      {firstRecommender.authorZone ? ` (${firstRecommender.authorZone})` : ''}
                    </div>
                  )}
                </div>

                {isOwner ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditForm(pro)}
                      className="bg-limestone hover:bg-[#E5DFD3] text-[#18261F] border border-[#DFD9CE] font-bold text-xs px-2.5 py-2 rounded-xl"
                    >
                      Szerkesztés
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePro(pro.id)}
                      className="bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 font-bold text-xs px-2.5 py-2 rounded-xl"
                    >
                      Törlés
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMessageClick(pro)}
                      className="bg-limestone hover:bg-[#E5DFD3] text-[#18261F] border border-[#DFD9CE] font-bold text-xs px-3 py-2 rounded-xl transition"
                    >
                      Üzenet
                    </button>
                    <a
                      href={`tel:${pro.phone}`}
                      onClick={() => handleRecordInteraction(pro, 'call')}
                      className="bg-pilis hover:bg-pilis-light text-white font-bold text-xs px-3.5 py-2 rounded-xl transition"
                    >
                      Hívás
                    </a>
                  </div>
                )}
              </div>
            </article>
          );
        })
      )}

      {/* KATTINTHATÓ RÉSZLETES BEMUTATKOZÓ ÉS AJÁNLÁS LAP (Bottom Sheet / Modal) */}
      {selectedPro && (() => {
        const isOwner = Boolean(currentUserId && selectedPro.owner_id === currentUserId);
        const hasInteracted = interactedProIds.has(selectedPro.id);
        const hasEndorsed = endorsedProIds.has(selectedPro.id);
        const proEndorsements = endorsementsByPro[selectedPro.id] || [];

        return (
          <div
            onClick={() => setSelectedPro(null)}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-limestone w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-3.5 border border-[#DFD9CE] shadow-2xl max-h-[90vh] overflow-y-auto box-border"
            >
              {/* Fejléc */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    {selectedPro.profession_name && (
                      <span className="text-[11px] font-bold bg-pilis-soft text-pilis px-2.5 py-0.5 rounded-full">
                        {selectedPro.profession_name}
                      </span>
                    )}
                    {selectedPro.experience_years > 0 && (
                      <span className="text-[11px] font-bold bg-[#ECE7DC] text-[#18261F] px-2.5 py-0.5 rounded-full">
                        {selectedPro.experience_years} éve a szakmában
                      </span>
                    )}
                  </div>
                  <h3 className="font-display font-extrabold text-xl text-[#18261F] break-words">
                    {selectedPro.business_name}
                  </h3>
                  <div className="text-xs font-medium text-[#5C6B62] mt-0.5">
                    {selectedPro.active_zone_today
                      ? `Ma elérhető itt: ${selectedPro.active_zone_today}`
                      : selectedPro.base_zone || 'Szentendre'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedPro(null)}
                  className="text-sm font-bold text-[#5C6B62] hover:text-black px-2 py-1 shrink-0"
                >
                  Bezárás ✕
                </button>
              </div>

              {/* Szakterület és részletes bemutatkozás */}
              <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-2">
                <div>
                  <div className="text-[11px] font-bold text-[#5C6B62] uppercase tracking-wide">
                    Miben segít
                  </div>
                  <div className="text-sm font-semibold text-[#18261F] mt-0.5">
                    {selectedPro.specialty}
                  </div>
                </div>

                {selectedPro.bio && (
                  <div className="pt-2 border-t border-[#ECE7DC]">
                    <div className="text-[11px] font-bold text-[#5C6B62] uppercase tracking-wide">
                      Bemutatkozás
                    </div>
                    <p className="text-xs text-[#18261F] mt-1 leading-relaxed whitespace-pre-line">
                      {selectedPro.bio}
                    </p>
                  </div>
                )}
              </div>

              {/* Közvetlen kapcsolatfelvétel gombok (Üzenet + Hívás) */}
              {!isOwner ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleMessageClick(selectedPro)}
                    className="bg-white hover:bg-gray-50 text-[#18261F] border border-[#DFD9CE] font-bold text-sm py-3 rounded-xl transition"
                  >
                    Üzenet írása
                  </button>
                  <a
                    href={`tel:${selectedPro.phone}`}
                    onClick={() => handleRecordInteraction(selectedPro, 'call')}
                    className="bg-pilis hover:bg-pilis-light text-white font-bold text-sm py-3 rounded-xl text-center transition"
                  >
                    Hívás indítása
                  </a>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openEditForm(selectedPro)}
                    className="bg-white text-[#18261F] border border-[#DFD9CE] font-bold text-xs py-2.5 rounded-xl"
                  >
                    Adatlap szerkesztése
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePro(selectedPro.id)}
                    className="bg-red-50 text-red-800 border border-red-200 font-bold text-xs py-2.5 rounded-xl"
                  >
                    Adatlap törlése
                  </button>
                </div>
              )}

              {/* Szomszédok ajánlásai + Egyszeri hitelesített ajánlás küldése */}
              <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#18261F]">
                    Helyi ajánlások ({selectedPro.endorsement_count || 0})
                  </span>
                  {hasEndorsed && (
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                      Ajánlva ✓
                    </span>
                  )}
                </div>

                {/* Ajánlás írása, ha már volt kapcsolatfelvétel és még nem ajánlotta */}
                {!isOwner && !hasEndorsed && (
                  hasInteracted ? (
                    <div className="bg-limestone p-3 rounded-xl border border-pilis/25 space-y-2">
                      <div className="text-xs font-bold text-[#18261F]">
                        Milyen tapasztalatod volt vele?
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {ENDORSEMENT_STRENGTH_TAGS.map((tag) => {
                          const active = selectedTags.includes(tag);
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => toggleStrengthTag(tag)}
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition ${
                                active
                                  ? 'bg-pilis text-white border-pilis'
                                  : 'bg-white text-[#18261F] border-[#DFD9CE]'
                              }`}
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                      <input
                        type="text"
                        value={endorseNote}
                        onChange={(e) => setEndorseNote(e.target.value)}
                        placeholder="Írj egy rövid mondatot a szomszédoknak..."
                        className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3 py-2 text-base box-border"
                      />
                      <button
                        type="button"
                        disabled={endorseSaving}
                        onClick={() => handleSubmitEndorsement(selectedPro)}
                        className="w-full bg-pilis hover:bg-pilis-light text-white font-bold text-xs py-2.5 rounded-xl transition"
                      >
                        {endorseSaving ? 'Mentés...' : 'Ajánlás közzététele'}
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-[#5C6B62] bg-limestone p-2.5 rounded-xl">
                      Ajánlást azután tudsz írni, hogy üzenetben vagy telefonon egyeztettél vele.
                    </div>
                  )
                )}

                {/* Korábbi ajánlások listája */}
                {proEndorsements.length === 0 ? (
                  <div className="text-xs text-[#7A867E]">
                    Még nem érkezett szöveges ajánlás.
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    {proEndorsements.map((item) => (
                      <div
                        key={item.id}
                        className="bg-limestone rounded-xl p-2.5 border border-[#ECE7DC] space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-[#18261F]">
                            {item.authorName}
                            {item.authorZone ? ` • ${item.authorZone}` : ''}
                          </span>
                        </div>
                        {item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {item.tags.map((t) => (
                              <span
                                key={t}
                                className="text-[10px] font-bold bg-pilis-soft text-pilis px-2 py-0.5 rounded-full"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.comment && (
                          <p className="text-xs text-[#18261F] leading-relaxed">
                            „{item.comment}”
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Új szakember / szolgáltató űrlap modal (tapasztalattal és bemutatkozással) */}
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
                : 'Közzététel'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

