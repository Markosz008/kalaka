import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { supabase } from '../lib/supabase.js';
import {
  SZENTENDRE_ZONES,
  SERVICE_GROUPS,
  DEFAULT_PROFESSIONS,
  normalizeServiceGroup,
  resolveCoordsFromText
} from '../constants/szentendreData.js';

const VECTOR_STYLE_URL = 'https://tiles.openfreemap.org/styles/bright';

const ENDORSEMENT_STRENGTH_TAGS = [
  'Pontos',
  'Szépen dolgozik',
  'Korrekt ár',
  'Segítőkész'
];

const GROUP_ICON_SVGS = {
  otthon:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  szepseg_egeszseg:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  auto_muhely:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>',
  kezmuves_gasztro:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/></svg>',
  mozgas_oktatas:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>'
};

function isLivePresenceActive(pro) {
  if (!pro?.live_until || !pro?.live_lat || !pro?.live_lng) return false;
  return new Date(pro.live_until).getTime() > Date.now();
}

function formatRemainingLiveTime(liveUntil) {
  if (!liveUntil) return '';
  const diffMs = new Date(liveUntil).getTime() - Date.now();
  if (diffMs <= 0) return '';
  const mins = Math.ceil(diffMs / 60000);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h} óra ${m} p` : `${h} óra`;
  }
  return `${mins} perc`;
}

function buildNavigationUrl(pro) {
  if (!pro) return null;
  const liveNow = isLivePresenceActive(pro);
  if (liveNow) {
    return `https://www.google.com/maps/dir/?api=1&destination=${pro.live_lat},${pro.live_lng}`;
  }
  if (pro.lat && pro.lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${pro.lat},${pro.lng}`;
  }
  if (pro.address_text && pro.address_text.trim()) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pro.address_text.trim())}`;
  }
  return null;
}

function clusterPointsByPixelDistance(map, points, radiusPx = 36) {
  const clusters = [];
  for (const pt of points) {
    const projected = map.project([pt.lng, pt.lat]);
    let matched = null;
    for (const c of clusters) {
      const dist = Math.hypot(c.px - projected.x, c.py - projected.y);
      if (dist <= radiusPx) {
        matched = c;
        break;
      }
    }
    if (matched) {
      const n = matched.items.length;
      matched.lat = (matched.lat * n + pt.lat) / (n + 1);
      matched.lng = (matched.lng * n + pt.lng) / (n + 1);
      matched.items.push(pt);
    } else {
      clusters.push({
        lat: pt.lat,
        lng: pt.lng,
        px: projected.x,
        py: projected.y,
        items: [pt]
      });
    }
  }
  return clusters;
}

export default function ProsDirectoryView({
  pros,
  session,
  profile,
  onOpenAuthModal,
  onRefreshPros,
  onStartProAgreement
}) {
  const currentUserId = session?.user?.id || null;

  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [professionFilter, setProfessionFilter] = useState('all');
  const [showMap, setShowMap] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  const [previewPro, setPreviewPro] = useState(null);
  const [selectedPro, setSelectedPro] = useState(null);

  const [interactionsByPro, setInteractionsByPro] = useState({});
  const [agreementsByPro, setAgreementsByPro] = useState({});
  const [endorsedProIds, setEndorsedProIds] = useState(new Set());
  const [endorsementsByPro, setEndorsementsByPro] = useState({});

  const [selectedTags, setSelectedTags] = useState([]);
  const [endorseNote, setEndorseNote] = useState('');
  const [endorseSaving, setEndorseSaving] = useState(false);

  const [togglingLiveId, setTogglingLiveId] = useState(null);

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
  const [bizAddress, setBizAddress] = useState('');
  const [bizCoords, setBizCoords] = useState(null);
  const [locatingAddress, setLocatingAddress] = useState(false);
  const [bizActiveToday, setBizActiveToday] = useState(true);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [proBanner, setProBanner] = useState(null);
  const [confirmDeleteProId, setConfirmDeleteProId] = useState(null);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersLayer = useRef([]);
  const resolvedPointsRef = useRef([]);
  const previewProIdRef = useRef(null);

  useEffect(() => {
    previewProIdRef.current = previewPro?.id || null;
  }, [previewPro?.id]);

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
        supabase
          .from('pro_interactions')
          .select('pro_id, interaction_type, created_at')
          .eq('user_id', currentUserId),
        supabase
          .from('agreements')
          .select('id, pro_id, status, created_at')
          .eq('requester_id', currentUserId)
          .not('pro_id', 'is', null)
      ]);

      const intMap = {};
      (myInts || []).forEach((i) => {
        intMap[i.pro_id] = i;
      });
      setInteractionsByPro(intMap);

      const agrMap = {};
      (myAgrs || []).forEach((a) => {
        agrMap[a.pro_id] = a;
      });
      setAgreementsByPro(agrMap);
    } else {
      setInteractionsByPro({});
      setAgreementsByPro({});
      setEndorsedProIds(new Set());
    }
  };

  useEffect(() => {
    loadInteractionAndEndorsementState();
  }, [currentUserId, pros?.length]);

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
        const hay = `${p.business_name} ${p.profession_name || ''} ${p.specialty || ''} ${p.bio || ''} ${p.address_text || ''} ${p.base_zone || ''} ${p.active_zone_today || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [pros, groupFilter, professionFilter, searchQuery]);

  const renderClusteredMarkers = () => {
    const map = mapInstance.current;
    if (!map) return;

    (markersLayer.current || []).forEach((m) => m.remove());
    markersLayer.current = [];

    const points = resolvedPointsRef.current || [];
    if (points.length === 0) return;

    const currentZoom = map.getZoom();
    const clusters =
      currentZoom >= 15.2
        ? points.map((pt) => ({ lat: pt.lat, lng: pt.lng, items: [pt] }))
        : clusterPointsByPixelDistance(map, points, 34);

    clusters.forEach((cl) => {
      if (cl.items.length > 1) {
        const hasLiveInCluster = cl.items.some((i) => i.liveNow);
        const el = document.createElement('button');
        el.type = 'button';
        el.style.cssText = `width:30px;height:30px;border-radius:9999px;background:${
          hasLiveInCluster ? '#047857' : '#1E4635'
        };color:#ffffff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;border:2.5px solid #ffffff;box-shadow:0 3px 10px rgba(0,0,0,0.32);cursor:pointer`;
        el.textContent = String(cl.items.length);
        el.title = `${cl.items.length} helyi szakember ezen a környéken`;
        el.onclick = (ev) => {
          ev.stopPropagation();
          map.flyTo({
            center: [cl.lng, cl.lat],
            zoom: Math.min(16.5, map.getZoom() + 2),
            duration: 380
          });
        };

        const mk = new maplibregl.Marker({ element: el })
          .setLngLat([cl.lng, cl.lat])
          .addTo(map);
        markersLayer.current.push(mk);
      } else {
        const item = cl.items[0];
        const p = item.pro;
        const isSelected = previewProIdRef.current === p.id;
        const grp = normalizeServiceGroup(p.category);
        const svgIcon = GROUP_ICON_SVGS[grp] || GROUP_ICON_SVGS.otthon;
        const bg = isSelected
          ? '#C86446'
          : item.liveNow
          ? '#047857'
          : item.hasExactPin
          ? '#1E4635'
          : '#5C6B62';

        const el = document.createElement('button');
        el.type = 'button';
        el.style.cssText = `position:relative;width:${isSelected ? '32px' : '28px'};height:${
          isSelected ? '32px' : '28px'
        };border-radius:9999px;background:${bg};color:#ffffff;display:flex;align-items:center;justify-content:center;border:2px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.34);cursor:pointer;transition:transform 0.12s`;
        el.innerHTML = item.liveNow
          ? `${svgIcon}<span style="position:absolute;top:-2px;right:-2px;width:8px;height:8px;border-radius:9999px;background:#34D399;border:1.5px solid #ffffff"></span>`
          : svgIcon;
        el.title = `${p.business_name} (${p.profession_name || ''})`;
        el.onclick = (ev) => {
          ev.stopPropagation();
          setPreviewPro(p);
        };

        const mk = new maplibregl.Marker({ element: el })
          .setLngLat([item.lng, item.lat])
          .addTo(map);
        markersLayer.current.push(mk);
      }
    });
  };

  useEffect(() => {
    if (!showMap || !mapRef.current || mapInstance.current) return;
    let map = null;
    try {
      map = new maplibregl.Map({
        container: mapRef.current,
        style: VECTOR_STYLE_URL,
        center: [19.066, 47.674],
        zoom: 13,
        attributionControl: false
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
      map.on('load', () => {
        map.resize();
        setMapReady(true);
      });
      map.on('zoomend', () => {
        renderClusteredMarkers();
      });
      map.on('click', () => {
        setPreviewPro(null);
      });
      mapInstance.current = map;
      markersLayer.current = [];
    } catch {}

    return () => {
      (markersLayer.current || []).forEach((m) => m.remove());
      markersLayer.current = [];
      if (mapInstance.current) {
        try {
          mapInstance.current.remove();
        } catch {}
        mapInstance.current = null;
      }
      setMapReady(false);
    };
  }, [showMap]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !showMap || !mapReady) return;

    const bounds = new maplibregl.LngLatBounds();
    const resolvedList = [];

    filteredPros.forEach((p, idx) => {
      const liveNow = isLivePresenceActive(p);
      let coord = null;
      let hasExactPin = false;

      if (liveNow) {
        coord = { lat: Number(p.live_lat), lng: Number(p.live_lng) };
        hasExactPin = true;
      } else if (p.lat && p.lng) {
        coord = { lat: Number(p.lat), lng: Number(p.lng) };
        hasExactPin = true;
      } else {
        const fallbackText = p.address_text || p.active_zone_today || p.base_zone;
        const resolved = resolveCoordsFromText(fallbackText);
        if (resolved) {
          coord = {
            lat: resolved.lat + ((idx % 4) - 1.5) * 0.0005,
            lng: resolved.lng + ((idx % 3) - 1) * 0.0005
          };
        }
      }

      if (!coord || isNaN(coord.lat) || isNaN(coord.lng)) return;
      resolvedList.push({
        pro: p,
        lat: coord.lat,
        lng: coord.lng,
        liveNow,
        hasExactPin
      });
      bounds.extend([coord.lng, coord.lat]);
    });

    resolvedPointsRef.current = resolvedList;

    if (resolvedList.length === 1) {
      map.flyTo({ center: bounds.getCenter(), zoom: 15, duration: 350 });
    } else if (resolvedList.length > 1) {
      map.fitBounds(bounds, { padding: 36, maxZoom: 14.2, duration: 350 });
    }

    renderClusteredMarkers();
  }, [filteredPros, showMap, mapReady]);

  useEffect(() => {
    if (mapReady) {
      renderClusteredMarkers();
    }
  }, [previewPro?.id, mapReady]);

  const handleToggleLivePresence = async (pro) => {
    if (!supabase || !currentUserId) return;
    const currentlyLive = isLivePresenceActive(pro);

    if (currentlyLive) {
      setTogglingLiveId(pro.id);
      await supabase
        .from('local_pros')
        .update({ live_lat: null, live_lng: null, live_until: null })
        .eq('id', pro.id);
      setTogglingLiveId(null);
      if (onRefreshPros) await onRefreshPros();
      return;
    }

    if (!navigator.geolocation) {
      setProBanner('A böngésződ nem támogatja a GPS-helymeghatározást.');
      return;
    }

    setTogglingLiveId(pro.id);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const fourHoursLater = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
        const { error } = await supabase
          .from('local_pros')
          .update({
            live_lat: pos.coords.latitude,
            live_lng: pos.coords.longitude,
            live_until: fourHoursLater
          })
          .eq('id', pro.id);

        setTogglingLiveId(null);
        if (error) {
          setProBanner(`Hiba az élő jelenlét bekapcsolásakor: ${error.message}`);
          return;
        }
        if (onRefreshPros) await onRefreshPros();
      },
      () => {
        setTogglingLiveId(null);
        setProBanner('Engedélyezd a helymeghatározást a böngészőben az élő jelenlét megosztásához.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleRecordInteraction = async (pro, type = 'call') => {
    if (!currentUserId) return;
    setInteractionsByPro((prev) => ({
      ...prev,
      [pro.id]: prev[pro.id] || {
        pro_id: pro.id,
        interaction_type: type,
        created_at: new Date().toISOString()
      }
    }));

    if (supabase) {
      await supabase
        .from('pro_interactions')
        .upsert(
          { pro_id: pro.id, user_id: currentUserId, interaction_type: type },
          { onConflict: 'pro_id,user_id', ignoreDuplicates: true }
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

  const getEndorsementEligibility = (pro) => {
    if (!currentUserId) {
      return { canEndorse: false, reason: 'Jelentkezz be az ajánláshoz.' };
    }
    if (pro.owner_id === currentUserId) {
      return { canEndorse: false, reason: 'Saját adatlapot nem ajánlhatsz.' };
    }
    if (endorsedProIds.has(pro.id)) {
      return { canEndorse: false, alreadyEndorsed: true, reason: 'Már ajánlottad ezt a szakembert.' };
    }

    const agr = agreementsByPro[pro.id];
    const inter = interactionsByPro[pro.id];

    if (agr && agr.status === 'completed') {
      return { canEndorse: true };
    }

    if (inter && (inter.interaction_type === 'call' || !pro.owner_id)) {
      const elapsedMs = Date.now() - new Date(inter.created_at).getTime();
      const twentyFourHoursMs = 24 * 60 * 60 * 1000;
      if (elapsedMs >= twentyFourHoursMs) {
        return { canEndorse: true };
      }
      const hoursLeft = Math.max(1, Math.ceil((twentyFourHoursMs - elapsedMs) / (60 * 60 * 1000)));
      return {
        canEndorse: false,
        reason: `Kapcsolatfelvétel rögzítve. A hitelesség érdekében ${hoursLeft} óra múlva (24 óra elteltével) írhatsz ajánlást.`
      };
    }

    if (pro.owner_id && agr) {
      return {
        canEndorse: false,
        reason:
          agr.status === 'agreed'
            ? 'A szaki elvállalta a munkát. A befejezés után a chatben nyomj az „Elkészült, ajánlom” gombra.'
            : 'Egyeztess a szakival az üzenetekben – amint elvállalja és elkészül a munka, megnyílik az ajánlás.'
      };
    }

    return {
      canEndorse: false,
      reason: 'Ajánlást telefonos vagy chat-egyeztetés és a munka elvégzése után írhatsz.'
    };
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
        await supabase
          .from('local_pros')
          .update({ endorsement_count: (pro.endorsement_count || 0) + 1 })
          .eq('id', pro.id);
      }

      setEndorsedProIds((prev) => new Set([...prev, pro.id]));
      setSelectedTags([]);
      setEndorseNote('');
      await loadInteractionAndEndorsementState();
      if (onRefreshPros) await onRefreshPros();
    } catch (err) {
      setProBanner(`Nem sikerült menteni az ajánlást: ${err.message}`);
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
    setBizAddress('');
    setBizCoords(null);
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
    setBizAddress(pro.address_text || '');
    setBizCoords(pro.lat && pro.lng ? { lat: pro.lat, lng: pro.lng } : null);
    setBizActiveToday(Boolean(pro.active_zone_today));
    setFormError(null);
    setShowFormModal(true);
  };

  const handleCapturePinFromGps = () => {
    if (!navigator.geolocation) return;
    setLocatingAddress(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setBizCoords({ lat, lng });
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=hu`
          );
          const data = await res.json();
          const addr = data?.address || {};
          const city = addr.city || addr.town || addr.village || 'Szentendre';
          const road = addr.road || addr.pedestrian || addr.suburb || '';
          const house = addr.house_number ? ` ${addr.house_number}.` : '';
          if (road) {
            setBizAddress(`${city}, ${road}${house}`);
          }
        } catch {}
        setLocatingAddress(false);
      },
      () => {
        setLocatingAddress(false);
        setFormError('Nem sikerült lekérni a GPS-pozíciót.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
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
      let resolvedCoords = bizCoords;
      if (!resolvedCoords && bizAddress.trim()) {
        const hit = resolveCoordsFromText(bizAddress.trim());
        if (hit) resolvedCoords = { lat: hit.lat, lng: hit.lng };
      }

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
        address_text: bizAddress.trim() || null,
        lat: resolvedCoords?.lat || null,
        lng: resolvedCoords?.lng || null,
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
    if (confirmDeleteProId !== proId) {
      setConfirmDeleteProId(proId);
      setTimeout(() => setConfirmDeleteProId(null), 3500);
      return;
    }
    setConfirmDeleteProId(null);
    setSelectedPro(null);
    if (supabase) {
      const { error } = await supabase.from('local_pros').delete().eq('id', proId);
      if (error) {
        setProBanner(`Törlési hiba: ${error.message}`);
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
      {proBanner && (
        <div className="bg-amber-50 border border-amber-300 text-amber-950 text-xs font-semibold px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-2">
          <span>{proBanner}</span>
          <button type="button" onClick={() => setProBanner(null)} className="font-bold px-1">✕</button>
        </div>
      )}
      <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] shadow-sm space-y-2.5 box-border">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display font-bold text-base text-[#18261F] truncate">
            Helyi szakemberek és szolgáltatások
          </h2>
          <button
            type="button"
            onClick={() => {
              setPreviewPro(null);
              setShowMap((v) => !v);
            }}
            className="shrink-0 text-xs font-bold text-pilis bg-pilis-soft px-2.5 py-1 rounded-lg"
          >
            {showMap ? 'Térkép elrejtése' : 'Térkép'}
          </button>
        </div>

        <div className="flex items-center gap-2 bg-limestone border border-[#DFD9CE] focus-within:border-pilis rounded-xl px-3 py-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setPreviewPro(null);
              setSearchQuery(e.target.value);
            }}
            placeholder="Keress szakmára vagy névre (pl. fodrász, ötvös, autószerelő)..."
            className="w-full text-base bg-transparent focus:outline-none text-[#18261F]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setPreviewPro(null);
                setSearchQuery('');
              }}
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
                setPreviewPro(null);
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
              onClick={() => {
                setPreviewPro(null);
                setProfessionFilter('all');
              }}
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
                onClick={() => {
                  setPreviewPro(null);
                  setProfessionFilter(
                    professionFilter === profName ? 'all' : profName
                  );
                }}
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
          <div className="relative rounded-xl overflow-hidden border border-[#DFD9CE] bg-[#ECE7DC]">
            <div ref={mapRef} className="w-full h-52 sm:h-64" />

            {previewPro && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-2.5 left-2.5 right-2.5 z-20 bg-white/95 backdrop-blur rounded-2xl p-3 shadow-xl border border-[#DFD9CE] flex items-center justify-between gap-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold bg-pilis-soft text-pilis px-2 py-0.5 rounded-full shrink-0">
                      {previewPro.profession_name}
                    </span>
                    <span className="text-[11px] font-bold text-[#5C6B62] truncate">
                      • {previewPro.endorsement_count || 0} ajánlás
                    </span>
                  </div>
                  <div className="font-display font-bold text-sm text-[#18261F] truncate mt-0.5">
                    {previewPro.business_name}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={`tel:${previewPro.phone}`}
                    onClick={() => handleRecordInteraction(previewPro, 'call')}
                    className="bg-pilis hover:bg-pilis-light text-white font-bold text-xs px-3 py-2 rounded-xl transition"
                  >
                    Hívás
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      const target = previewPro;
                      setPreviewPro(null);
                      setSelectedTags([]);
                      setEndorseNote('');
                      setSelectedPro(target);
                    }}
                    className="bg-limestone hover:bg-[#E5DFD3] text-[#18261F] border border-[#DFD9CE] font-bold text-xs px-2.5 py-2 rounded-xl transition"
                  >
                    Adatlap ›
                  </button>
                </div>
              </div>
            )}
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
          const liveNow = isLivePresenceActive(pro);
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
                    {liveNow ? (
                      <a
                        href={buildNavigationUrl(pro)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[11px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-0.5 rounded-full inline-flex items-center gap-1"
                      >
                        <span>● Most a közelben ({formatRemainingLiveTime(pro.live_until)})</span>
                        <span>↗</span>
                      </a>
                    ) : pro.address_text ? (
                      <a
                        href={buildNavigationUrl(pro)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[11px] font-semibold bg-limestone hover:bg-[#E5DFD3] text-[#18261F] px-2.5 py-0.5 rounded-full border border-[#DFD9CE] inline-flex items-center gap-1"
                      >
                        <span>{pro.address_text}</span>
                        <span className="text-pilis font-bold">↗</span>
                      </a>
                    ) : pro.active_zone_today ? (
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

              {isOwner && (
                <div onClick={(e) => e.stopPropagation()} className="pt-1">
                  <button
                    type="button"
                    disabled={togglingLiveId === pro.id}
                    onClick={() => handleToggleLivePresence(pro)}
                    className={`w-full text-xs font-bold py-2 px-3 rounded-xl border transition ${
                      liveNow
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        : 'bg-pilis-soft/70 hover:bg-pilis text-pilis hover:text-white border-pilis/20'
                    }`}
                  >
                    {togglingLiveId === pro.id
                      ? 'GPS helyzet lekérése...'
                      : liveNow
                      ? `Élő jelenlét aktív (${formatRemainingLiveTime(pro.live_until)}) – Leállítás`
                      : 'Most itt dolgozom (4 órára a térképre)'}
                  </button>
                </div>
              )}

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
                      className={`${
                        confirmDeleteProId === pro.id
                          ? 'bg-red-700 text-white border-red-700'
                          : 'bg-red-50 hover:bg-red-100 text-red-800 border-red-200'
                      } border font-bold text-xs px-2.5 py-2 rounded-xl transition`}
                    >
                      {confirmDeleteProId === pro.id ? 'Biztos? ✕' : 'Törlés'}
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

      {selectedPro && (() => {
        const isOwner = Boolean(currentUserId && selectedPro.owner_id === currentUserId);
        const liveNow = isLivePresenceActive(selectedPro);
        const eligibility = getEndorsementEligibility(selectedPro);
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
                    {liveNow
                      ? `Most a közelben van (${formatRemainingLiveTime(selectedPro.live_until)})`
                      : selectedPro.address_text || selectedPro.base_zone || 'Szentendre'}
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

              {buildNavigationUrl(selectedPro) && (
                <a
                  href={buildNavigationUrl(selectedPro)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 bg-white hover:bg-pilis-soft/40 border border-[#DFD9CE] rounded-2xl px-3.5 py-2.5 transition"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-[#5C6B62] uppercase tracking-wide">
                      {liveNow ? 'Élő helyszín (4 órás jelenlét)' : 'Telephely / cím'}
                    </div>
                    <div className="text-xs font-bold text-[#18261F] truncate">
                      {liveNow
                        ? `Szentendre • Most a közelben (${formatRemainingLiveTime(selectedPro.live_until)})`
                        : selectedPro.address_text || selectedPro.base_zone}
                    </div>
                  </div>
                  <span className="shrink-0 bg-pilis-soft text-pilis font-bold text-xs px-3 py-1.5 rounded-xl">
                    Navigáció ↗
                  </span>
                </a>
              )}

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
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={togglingLiveId === selectedPro.id}
                    onClick={() => handleToggleLivePresence(selectedPro)}
                    className={`w-full text-xs font-bold py-2.5 px-3 rounded-xl border transition ${
                      liveNow
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        : 'bg-pilis text-white border-pilis'
                    }`}
                  >
                    {liveNow
                      ? `Élő jelenlét aktív (${formatRemainingLiveTime(selectedPro.live_until)}) – Leállítás`
                      : 'Most itt dolgozom (4 órára a térképre)'}
                  </button>
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
                      className={`${
                        confirmDeleteProId === selectedPro.id
                          ? 'bg-red-700 text-white border-red-700'
                          : 'bg-red-50 text-red-800 border-red-200'
                      } border font-bold text-xs py-2.5 rounded-xl transition`}
                    >
                      {confirmDeleteProId === selectedPro.id ? 'Biztosan törlöd? ✕' : 'Adatlap törlése'}
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#18261F]">
                    Helyi ajánlások ({selectedPro.endorsement_count || 0})
                  </span>
                  {eligibility.alreadyEndorsed && (
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                      Ajánlva ✓
                    </span>
                  )}
                </div>

                {!isOwner && !eligibility.alreadyEndorsed && (
                  eligibility.canEndorse ? (
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
                    <div className="text-xs text-[#5C6B62] bg-limestone p-2.5 rounded-xl leading-relaxed">
                      {eligibility.reason}
                    </div>
                  )
                )}

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
                  onClick={handleCapturePinFromGps}
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
