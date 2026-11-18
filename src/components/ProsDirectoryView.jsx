import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { supabase } from '../lib/supabase.js';
import {
  SERVICE_GROUPS,
  DEFAULT_PROFESSIONS,
  normalizeServiceGroup,
  resolveCoordsFromText
} from '../constants/szentendreData.js';
import ProFormModal from './ProFormModal.jsx';
import ProCard from './ProCard.jsx';
import ProDetailModal from './ProDetailModal.jsx';
import {
  VECTOR_STYLE_URL,
  registerMapCategoryIcons,
  getSavedProIds,
  isLivePresenceActive,
  formatRemainingLiveTime,
  buildNavigationUrl
} from '../lib/prosHelpers.js';

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
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [favoriteProIds, setFavoriteProIds] = useState(() => getSavedProIds(currentUserId));
  const [showMap, setShowMap] = useState(true);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
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
  const [bizIsSelfProvider, setBizIsSelfProvider] = useState(false);
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
  const [claimRequests, setClaimRequests] = useState([]);
  const [showClaimFormForId, setShowClaimFormForId] = useState(null);
  const [claimPhone, setClaimPhone] = useState('');
  const [claimNote, setClaimNote] = useState('');
  const [claimSaving, setClaimSaving] = useState(false);
  const [reviewingClaimId, setReviewingClaimId] = useState(null);
  const isAdminUser = Boolean(profile?.is_admin);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const userLocationMarkerRef = useRef(null);
  const prosByIdRef = useRef({});
  const lastFilterKeyRef = useRef('');

  useEffect(() => {
    setFavoriteProIds(getSavedProIds(currentUserId));
  }, [currentUserId]);

  const toggleFavoritePro = (e, proId) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const idStr = String(proId);
    const key = `kalaka_fav_pros_${currentUserId || 'guest'}`;
    setFavoriteProIds((prev) => {
      const exists = prev.includes(idStr);
      const next = exists ? prev.filter((x) => x !== idStr) : [idStr, ...prev];
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    const lookup = {};
    (pros || []).forEach((p) => {
      lookup[String(p.id)] = p;
    });
    prosByIdRef.current = lookup;
  }, [pros]);

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

      let claimQuery = supabase
        .from('pro_claim_requests')
        .select('*, claimant:profiles!pro_claim_requests_claimant_id_fkey(display_name, zone), pro:local_pros(business_name, phone)')
        .order('created_at', { ascending: false });

      if (isAdminUser) {
        claimQuery = claimQuery.eq('status', 'pending');
      } else {
        claimQuery = claimQuery.eq('claimant_id', currentUserId);
      }

      const { data: claimsData } = await claimQuery;
      setClaimRequests(claimsData || []);
    } else {
      setInteractionsByPro({});
      setAgreementsByPro({});
      setEndorsedProIds(new Set());
      setClaimRequests([]);
    }
  };

  useEffect(() => {
    loadInteractionAndEndorsementState();
  }, [currentUserId, isAdminUser, pros?.length]);

  const handleSubmitClaim = async (e, pro) => {
    e.preventDefault();
    if (!currentUserId) {
      onOpenAuthModal();
      return;
    }
    if (!claimPhone.trim()) return;
    setClaimSaving(true);
    const { error } = await supabase.from('pro_claim_requests').insert({
      pro_id: pro.id,
      claimant_id: currentUserId,
      contact_phone: claimPhone.trim(),
      verification_note: claimNote.trim() || null
    });
    setClaimSaving(false);
    if (error) {
      setProBanner(`Nem sikerült beküldeni az igénylést: ${error.message}`);
      return;
    }
    setShowClaimFormForId(null);
    setClaimPhone('');
    setClaimNote('');
    setProBanner('Profilátvételi kérelmedet rögzítettük, hamarosan ellenőrizzük.');
    loadInteractionAndEndorsementState();
  };

  const handleReviewClaim = async (requestId, approve) => {
    setReviewingClaimId(requestId);
    const { error } = await supabase.rpc('review_pro_claim', {
      p_request_id: requestId,
      p_approve: approve
    });
    setReviewingClaimId(null);
    if (error) {
      setProBanner(`Hiba az elbírálásnál: ${error.message}`);
      return;
    }
    setProBanner(approve ? 'Profilátvétel jóváhagyva ✓' : 'Profilátvétel elutasítva');
    await loadInteractionAndEndorsementState();
    if (onRefresh) onRefresh();
  };

  useEffect(() => {
    if (!selectedPro) return;
    const updated = (pros || []).find((p) => p.id === selectedPro.id);
    if (updated) setSelectedPro(updated);
  }, [pros]);

  const filteredPros = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (pros || []).filter((p) => {
      if (onlyFavorites && !favoriteProIds.includes(String(p.id))) return false;
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
  }, [pros, groupFilter, professionFilter, searchQuery, onlyFavorites, favoriteProIds]);

  const geoJsonData = useMemo(() => {
    const features = [];
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

      const grp = normalizeServiceGroup(p.category);
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [coord.lng, coord.lat]
        },
        properties: {
          id: String(p.id),
          group: grp,
          iconImage: `cat-icon-${grp}`,
          shortLabel: (p.profession_name || p.business_name || '').slice(0, 16),
          liveNow,
          hasExactPin,
          isSelected: previewPro?.id === p.id
        }
      });
    });

    return { type: 'FeatureCollection', features };
  }, [filteredPros, previewPro?.id]);

  useEffect(() => {
    if (!showMap || !mapRef.current || mapInstance.current) return;
    setIsMapExpanded(false);
  }, [showMap]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isMapExpanded && showMap) {
      document.body.classList.add('kalaka-map-expanded');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.classList.remove('kalaka-map-expanded');
      document.body.style.overflow = '';
    }

    const t = setTimeout(() => mapInstance.current?.resize(), 30);
    const onKey = (e) => {
      if (e.key === 'Escape' && isMapExpanded) setIsMapExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.body.classList.remove('kalaka-map-expanded');
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [isMapExpanded, showMap]);

  useEffect(() => {
    if (!showMap || !mapRef.current || mapInstance.current) return;
    lastFilterKeyRef.current = '';
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
        registerMapCategoryIcons(map);

        map.addSource('pros-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 34
        });

        map.addLayer({
          id: 'pros-clusters',
          type: 'circle',
          source: 'pros-source',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#1E4635',
            'circle-radius': 15,
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#FFFFFF'
          }
        });

        map.addLayer({
          id: 'pros-cluster-count',
          type: 'symbol',
          source: 'pros-source',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['Noto Sans Bold'],
            'text-size': 12
          },
          paint: {
            'text-color': '#FFFFFF'
          }
        });

        map.addLayer({
          id: 'pros-unclustered-point',
          type: 'circle',
          source: 'pros-source',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': [
              'case',
              ['boolean', ['get', 'isSelected'], false],
              '#C86446',
              ['match', ['get', 'group'],
                'otthon', '#1E4635',
                'szepseg_egeszseg', '#9D174D',
                'auto_muhely', '#1E3A8A',
                'kezmuves_gasztro', '#B45309',
                'mozgas_oktatas', '#0F766E',
                '#1E4635'
              ]
            ],
            'circle-radius': [
              'case',
              ['boolean', ['get', 'isSelected'], false],
              15,
              13
            ],
            'circle-stroke-width': [
              'case',
              ['boolean', ['get', 'liveNow'], false],
              3,
              2
            ],
            'circle-stroke-color': [
              'case',
              ['boolean', ['get', 'liveNow'], false],
              '#34D399',
              '#FFFFFF'
            ]
          }
        });

        map.addLayer({
          id: 'pros-unclustered-icon',
          type: 'symbol',
          source: 'pros-source',
          filter: ['!', ['has', 'point_count']],
          layout: {
            'icon-image': ['get', 'iconImage'],
            'icon-size': 0.9,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          }
        });

        map.addLayer({
          id: 'pros-unclustered-label',
          type: 'symbol',
          source: 'pros-source',
          minzoom: 15.2,
          filter: ['!', ['has', 'point_count']],
          layout: {
            'text-field': ['get', 'shortLabel'],
            'text-font': ['Noto Sans Bold'],
            'text-size': 11,
            'text-offset': [0, 1.5],
            'text-anchor': 'top',
            'text-allow-overlap': false
          },
          paint: {
            'text-color': '#18261F',
            'text-halo-color': '#FFFFFF',
            'text-halo-width': 2
          }
        });

        map.on('click', 'pros-clusters', async (e) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['pros-clusters'] });
          if (!features.length) return;
          const clusterId = features[0].properties.cluster_id;
          try {
            const zoom = await map.getSource('pros-source').getClusterExpansionZoom(clusterId);
            map.easeTo({
              center: features[0].geometry.coordinates,
              zoom: zoom + 0.5,
              duration: 320
            });
          } catch {}
        });

        map.on('click', 'pros-unclustered-point', (e) => {
          const feat = e.features?.[0];
          if (!feat) return;
          const proId = String(feat.properties?.id || '');
          const hit = prosByIdRef.current[proId];
          if (hit) {
            setPreviewPro(hit);
          }
        });

        map.on('click', (e) => {
          const hits = map.queryRenderedFeatures(e.point, {
            layers: ['pros-clusters', 'pros-unclustered-point']
          });
          if (!hits.length) {
            setPreviewPro(null);
          }
        });

        ['pros-clusters', 'pros-unclustered-point'].forEach((layerId) => {
          map.on('mouseenter', layerId, () => {
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', layerId, () => {
            map.getCanvas().style.cursor = '';
          });
        });

        map.resize();
        setMapReady(true);
      });

      mapInstance.current = map;
    } catch {}

    return () => {
      if (userLocationMarkerRef.current) {
        try {
          userLocationMarkerRef.current.remove();
        } catch {}
        userLocationMarkerRef.current = null;
      }
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
    const src = map.getSource('pros-source');
    if (!src) return;

    src.setData(geoJsonData);

    const filterKey = `${onlyFavorites}|${groupFilter}|${professionFilter}|${searchQuery.trim().toLowerCase()}|${geoJsonData.features.length}`;
    if (lastFilterKeyRef.current === filterKey) return;
    lastFilterKeyRef.current = filterKey;

    if (geoJsonData.features.length === 1) {
      map.flyTo({
        center: geoJsonData.features[0].geometry.coordinates,
        zoom: 15,
        duration: 350
      });
    } else if (geoJsonData.features.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      geoJsonData.features.forEach((f) => bounds.extend(f.geometry.coordinates));
      map.fitBounds(bounds, { padding: 36, maxZoom: 14.2, duration: 350 });
    }
  }, [geoJsonData, onlyFavorites, groupFilter, professionFilter, searchQuery, showMap, mapReady]);

  const handleCenterUserGps = () => {
    if (!navigator.geolocation || !mapInstance.current) {
      setProBanner('A böngésződ nem támogatja a helymeghatározást.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const map = mapInstance.current;
        if (!map) return;

        if (!userLocationMarkerRef.current) {
          const el = document.createElement('div');
          el.style.cssText =
            'width:16px;height:16px;border-radius:9999px;background:#2563EB;border:3px solid #FFFFFF;box-shadow:0 0 0 4px rgba(37,99,235,0.28)';
          userLocationMarkerRef.current = new maplibregl.Marker({ element: el })
            .setLngLat([lng, lat])
            .addTo(map);
        } else {
          userLocationMarkerRef.current.setLngLat([lng, lat]);
        }

        map.flyTo({ center: [lng, lat], zoom: 15.2, duration: 400 });
      },
      () => {
        setProBanner('Engedélyezd a helymeghatározást a böngészőben.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

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
          .insert({
            ...payload,
            owner_id: bizIsSelfProvider ? currentUserId : null,
            endorsement_count: 0
          });
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

      {isAdminUser && claimRequests.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 space-y-2.5">
          <div className="text-xs font-extrabold uppercase tracking-wide text-amber-900">
            Függőben lévő szaki profilátvételek ({claimRequests.length})
          </div>
          {claimRequests.map((req) => (
            <div key={req.id} className="bg-white rounded-xl p-3 border border-amber-200 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-[#18261F]">
                    {req.pro?.business_name || 'Szaki adatlap'}
                  </div>
                  <div className="text-[11px] text-[#5C6B62]">
                    Igénylő: <span className="font-semibold text-[#18261F]">{req.claimant?.display_name || 'Felhasználó'}</span> ({req.claimant?.zone || 'Szentendre'})
                  </div>
                  <div className="text-[11px] text-[#5C6B62]">
                    Megadott telefon: <a href={`tel:${req.contact_phone}`} className="font-bold text-pilis underline">{req.contact_phone}</a>
                    {req.pro?.phone ? ` (Kártyán: ${req.pro.phone})` : ''}
                  </div>
                  {req.verification_note && (
                    <div className="text-[11px] text-[#18261F] bg-limestone px-2 py-1 rounded-lg mt-1">
                      {req.verification_note}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={reviewingClaimId === req.id}
                  onClick={() => handleReviewClaim(req.id, true)}
                  className="flex-1 bg-pilis hover:bg-pilis-light text-white font-bold text-xs py-2 rounded-xl transition"
                >
                  Jóváhagyás ✓
                </button>
                <button
                  type="button"
                  disabled={reviewingClaimId === req.id}
                  onClick={() => handleReviewClaim(req.id, false)}
                  className="bg-white hover:bg-red-50 text-red-700 border border-red-200 font-bold text-xs px-3 py-2 rounded-xl transition"
                >
                  Elutasítás ✕
                </button>
              </div>
            </div>
          ))}
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
          <button
            type="button"
            onClick={() => {
              setPreviewPro(null);
              setOnlyFavorites((v) => !v);
            }}
            className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border transition flex items-center gap-1 ${
              onlyFavorites
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-limestone text-[#5C6B62] border-[#DFD9CE] hover:border-amber-400'
            }`}
          >
            <span>{onlyFavorites ? '★' : '☆'}</span>
            <span>Kedvenceim{favoriteProIds.length > 0 ? ` (${favoriteProIds.length})` : ''}</span>
          </button>

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
          <div
            className={
              isMapExpanded
                ? 'fixed inset-0 z-[9999] w-screen h-[100dvh] bg-[#ECE7DC]'
                : 'relative rounded-xl overflow-hidden border border-[#DFD9CE] bg-[#ECE7DC]'
            }
          >
            <div
              ref={mapRef}
              className={isMapExpanded ? 'w-full h-full' : 'w-full h-52 sm:h-64'}
            />

            <div
              className={`absolute right-2.5 z-10 flex items-center gap-1.5 pointer-events-auto ${
                isMapExpanded ? 'top-[calc(0.75rem+env(safe-area-inset-top))]' : 'top-2.5'
              }`}
            >
              <button
                type="button"
                onClick={handleCenterUserGps}
                className="bg-white/95 backdrop-blur hover:bg-limestone text-[#18261F] text-xs font-bold px-2.5 py-2 rounded-xl shadow-sm border border-[#DFD9CE]"
              >
                Saját helyzet
              </button>

              <button
                type="button"
                onClick={() => setIsMapExpanded((v) => !v)}
                aria-label={isMapExpanded ? 'Térkép kicsinyítése' : 'Térkép nagyítása'}
                title={isMapExpanded ? 'Bezárás' : 'Nagyítás'}
                className="bg-white/95 backdrop-blur hover:bg-limestone text-[#18261F] text-xs font-bold px-2.5 py-2 rounded-xl shadow-sm border border-[#DFD9CE]"
              >
                {isMapExpanded ? 'Bezárás ✕' : '⛶'}
              </button>
            </div>

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
                  <button
                    type="button"
                    onClick={(e) => toggleFavoritePro(e, previewPro.id)}
                    aria-label="Kedvenc"
                    className={`w-8 h-8 rounded-xl border grid place-items-center text-sm font-bold transition ${
                      favoriteProIds.includes(String(previewPro.id))
                        ? 'bg-amber-50 text-amber-500 border-amber-300'
                        : 'bg-limestone text-[#7A867E] border-[#DFD9CE]'
                    }`}
                  >
                    {favoriteProIds.includes(String(previewPro.id)) ? '★' : '☆'}
                  </button>
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
            {onlyFavorites
              ? 'Még nincs kedvencnek jelölt szakembered.'
              : 'Nincs találat erre a szűrésre.'}
          </div>
          <p className="text-xs text-[#5C6B62]">
            {onlyFavorites
              ? 'Jelöld meg csillaggal (☆) a bevált szakikat, és itt azonnal elérheted őket.'
              : 'Ismerős vagy te magad dolgozol ezen a területen Szentendrén? Vedd fel új szakmaként!'}
          </p>
          {onlyFavorites ? (
            <button
              type="button"
              onClick={() => setOnlyFavorites(false)}
              className="bg-limestone text-[#18261F] border border-[#DFD9CE] font-bold text-xs px-4 py-2 rounded-xl"
            >
              Összes szaki mutatása
            </button>
          ) : (
            <button
              type="button"
              onClick={openCreateForm}
              className="bg-pilis text-white font-bold text-xs px-4 py-2.5 rounded-xl"
            >
              + Új szakma és szolgáltató felvétele
            </button>
          )}
        </div>
      ) : (
        filteredPros.map((pro) => (
          <ProCard
            key={pro.id}
            pro={pro}
            isOwner={Boolean(currentUserId && pro.owner_id === currentUserId)}
            isFav={favoriteProIds.includes(String(pro.id))}
            firstRecommender={(endorsementsByPro[pro.id] || [])[0]}
            togglingLiveId={togglingLiveId}
            confirmDeleteProId={confirmDeleteProId}
            onSelectPro={(item) => {
              setSelectedTags([]);
              setEndorseNote('');
              setSelectedPro(item);
            }}
            onToggleFavorite={toggleFavoritePro}
            onToggleLivePresence={handleToggleLivePresence}
            onOpenEditForm={openEditForm}
            onDeletePro={handleDeletePro}
            onMessageClick={handleMessageClick}
            onRecordInteraction={handleRecordInteraction}
          />
        ))
      )}

      <ProDetailModal
        pro={selectedPro}
        currentUserId={currentUserId}
        isFav={selectedPro ? favoriteProIds.includes(String(selectedPro.id)) : false}
        eligibility={selectedPro ? getEndorsementEligibility(selectedPro) : { canEndorse: false, alreadyEndorsed: false }}
        proEndorsements={selectedPro ? endorsementsByPro[selectedPro.id] || [] : []}
        claimRequests={claimRequests}
        showClaimFormForId={showClaimFormForId}
        setShowClaimFormForId={setShowClaimFormForId}
        claimPhone={claimPhone}
        setClaimPhone={setClaimPhone}
        claimNote={claimNote}
        setClaimNote={setClaimNote}
        claimSaving={claimSaving}
        togglingLiveId={togglingLiveId}
        confirmDeleteProId={confirmDeleteProId}
        selectedTags={selectedTags}
        endorseNote={endorseNote}
        setEndorseNote={setEndorseNote}
        endorseSaving={endorseSaving}
        onClose={() => setSelectedPro(null)}
        onOpenAuthModal={onOpenAuthModal}
        onToggleFavorite={toggleFavoritePro}
        onMessageClick={handleMessageClick}
        onRecordInteraction={handleRecordInteraction}
        onSubmitClaim={handleSubmitClaim}
        onToggleLivePresence={handleToggleLivePresence}
        onOpenEditForm={openEditForm}
        onDeletePro={handleDeletePro}
        onToggleStrengthTag={toggleStrengthTag}
        onSubmitEndorsement={handleSubmitEndorsement}
      />

      <ProFormModal
        isOpen={showFormModal}
        editingProId={editingProId}
        formError={formError}
        bizGroup={bizGroup}
        setBizGroup={setBizGroup}
        professionInput={professionInput}
        setProfessionInput={setProfessionInput}
        showProfessionDropdown={showProfessionDropdown}
        setShowProfessionDropdown={setShowProfessionDropdown}
        exactProfessionExists={exactProfessionExists}
        matchingProfessionsInForm={matchingProfessionsInForm}
        bizName={bizName}
        setBizName={setBizName}
        bizExperienceYears={bizExperienceYears}
        setBizExperienceYears={setBizExperienceYears}
        bizSpec={bizSpec}
        setBizSpec={setBizSpec}
        bizAddress={bizAddress}
        setBizAddress={setBizAddress}
        bizCoords={bizCoords}
        setBizCoords={setBizCoords}
        locatingAddress={locatingAddress}
        onCapturePinFromGps={handleCapturePinFromGps}
        bizBio={bizBio}
        setBizBio={setBizBio}
        bizPhone={bizPhone}
        setBizPhone={setBizPhone}
        bizBaseZone={bizBaseZone}
        setBizBaseZone={setBizBaseZone}
        bizIsSelfProvider={bizIsSelfProvider}
        setBizIsSelfProvider={setBizIsSelfProvider}
        formSaving={formSaving}
        onClose={() => setShowFormModal(false)}
        onSubmit={handleSaveProForm}
      />
    </div>
  );
}
