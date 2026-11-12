import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { SZENTENDRE_ZONES, PRO_CATEGORIES, resolveCoordsFromText } from '../constants/szentendreData.js';

export default function ProsDirectoryView({
  pros,
  profile,
  onCheckInProZone,
  onEndorsePro,
  onRegisterNewPro
}) {
  const [catFilter, setCatFilter] = useState('all');
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [selectedProId, setSelectedProId] = useState(pros[0]?.id || '');
  const [checkInZone, setCheckInZone] = useState(profile?.zone || 'Felső-Pismány');

  const [showAddProModal, setShowAddProModal] = useState(false);
  const [bizName, setBizName] = useState('');
  const [bizCat, setBizCat] = useState('villany');
  const [bizSpec, setBizSpec] = useState('');
  const [bizTax, setBizTax] = useState('');
  const [bizPhone, setBizPhone] = useState('');

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersLayer = useRef(null);

  const filteredPros = pros.filter((p) => {
    if (catFilter !== 'all' && p.category !== catFilter) return false;
    return true;
  });

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, {
      center: [47.676, 19.062],
      zoom: 13,
      zoomControl: false
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri, OpenStreetMap'
    }).addTo(map);

    markersLayer.current = L.layerGroup().addTo(map);
    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    const group = markersLayer.current;
    if (!group) return;
    group.clearLayers();

    filteredPros.forEach((p, idx) => {
      if (!p.active_zone_today) return;
      const coord = resolveCoordsFromText(p.active_zone_today);
      if (!coord) return;

      const lat = coord.lat + (idx % 3) * 0.0008;
      const lng = coord.lng + (idx % 2) * 0.0008;

      const pin = L.divIcon({
        className: '',
        html: `<div style="background:#1E4635;color:#fff;font-weight:700;font-size:11px;padding:3px 8px;border-radius:99px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);white-space:nowrap">${p.business_name}</div>`,
        iconSize: [120, 24],
        iconAnchor: [60, 12]
      });

      L.marker([lat, lng], { icon: pin })
        .bindTooltip(`${p.business_name} • Ma itt dolgozik: ${p.active_zone_today}`, {
          direction: 'top'
        })
        .addTo(group);
    });
  }, [filteredPros]);

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] shadow-sm space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display font-bold text-base text-[#18261F]">
              Szentendrei szakik térképe
            </h2>
            <p className="text-xs text-[#5C6B62]">
              A térképen azok a szakik látszanak, akik ma bejelentkeztek egy városrészbe.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!selectedProId && pros[0]?.id) setSelectedProId(pros[0].id);
              setShowCheckInModal(true);
            }}
            className="shrink-0 bg-pilis-soft text-pilis hover:bg-pilis hover:text-white font-bold text-xs px-3 py-2 rounded-xl transition"
          >
            Mai munkazóna
          </button>
        </div>

        <div className="rounded-xl overflow-hidden border border-[#DFD9CE]">
          <div ref={mapRef} className="w-full h-44" />
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex gap-1.5 overflow-x-auto">
            {PRO_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCatFilter(c.id)}
                className={`shrink-0 text-xs font-semibold px-3 py-1 rounded-full border transition ${
                  catFilter === c.id
                    ? 'bg-pilis text-white border-pilis'
                    : 'bg-limestone text-[#5C6B62] border-[#DFD9CE]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowAddProModal(true)}
            className="shrink-0 text-xs font-bold text-pilis underline"
          >
            + Új szaki
          </button>
        </div>
      </div>

      {filteredPros.map((pro) => (
        <article
          key={pro.id}
          className="bg-white rounded-2xl p-4 border border-[#DFD9CE] shadow-sm flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            {pro.active_zone_today ? (
              <span className="inline-block text-[11px] font-bold bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full mb-1">
                Ma itt dolgozik: {pro.active_zone_today}
              </span>
            ) : (
              <span className="inline-block text-[11px] font-medium bg-limestone text-[#5C6B62] px-2.5 py-0.5 rounded-full mb-1">
                Előjegyzéssel hívható
              </span>
            )}
            <h3 className="font-display font-bold text-base text-[#18261F]">
              {pro.business_name}
            </h3>
            <p className="text-xs text-[#5C6B62] mt-0.5">{pro.specialty}</p>
            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                onClick={() => onEndorsePro(pro)}
                className="text-xs font-bold text-pilis bg-pilis-soft hover:bg-pilis hover:text-white px-2.5 py-1 rounded-lg transition"
              >
                Ajánlom ({pro.endorsement_count || 0})
              </button>
            </div>
          </div>

          <a
            href={`tel:${pro.phone}`}
            className="shrink-0 bg-pilis hover:bg-pilis-light text-white font-bold text-xs px-4 py-2.5 rounded-xl transition"
          >
            Hívás
          </a>
        </article>
      ))}

      {showCheckInModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-limestone w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-3 border border-[#DFD9CE] shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="font-display font-extrabold text-base">
                Mai munkazóna kitűzése
              </h3>
              <button
                onClick={() => setShowCheckInModal(false)}
                className="text-sm font-bold text-[#5C6B62]"
              >
                Bezárás ✕
              </button>
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">Melyik szaki?</label>
              <select
                value={selectedProId}
                onChange={(e) => setSelectedProId(e.target.value)}
                className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-sm font-semibold"
              >
                {pros.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.business_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">
                Városrész
              </label>
              <select
                value={checkInZone}
                onChange={(e) => setCheckInZone(e.target.value)}
                className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-sm font-semibold"
              >
                <option value="">Ma nincs kint terepen</option>
                {SZENTENDRE_ZONES.map((z) => (
                  <option key={z.id} value={z.name}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                onCheckInProZone(selectedProId || pros[0]?.id, checkInZone || null);
                setShowCheckInModal(false);
              }}
              className="w-full bg-pilis text-white font-bold py-3 rounded-xl text-sm"
            >
              Mentés
            </button>
          </div>
        </div>
      )}

      {showAddProModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onRegisterNewPro({
                business_name: bizName.trim(),
                category: bizCat,
                specialty: bizSpec.trim(),
                tax_number: bizTax.trim() || '12345678-1-13',
                phone: bizPhone.trim(),
                active_zone_today: profile?.zone || 'Belváros'
              });
              setShowAddProModal(false);
              setBizName('');
              setBizSpec('');
              setBizPhone('');
            }}
            className="bg-limestone w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-2.5 border border-[#DFD9CE] shadow-2xl"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-display font-extrabold text-base">
                Helyi szaki felvétele
              </h3>
              <button
                type="button"
                onClick={() => setShowAddProModal(false)}
                className="text-sm font-bold text-[#5C6B62]"
              >
                Bezárás ✕
              </button>
            </div>
            <input
              type="text"
              required
              value={bizName}
              onChange={(e) => setBizName(e.target.value)}
              placeholder="Vállalkozás vagy szakember neve"
              className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-sm"
            />
            <select
              value={bizCat}
              onChange={(e) => setBizCat(e.target.value)}
              className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-sm font-semibold"
            >
              {PRO_CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              value={bizSpec}
              onChange={(e) => setBizSpec(e.target.value)}
              placeholder="Szakterület (pl. Hibaelhárítás, bojler, kertgondozás)"
              className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-sm"
            />
            <input
              type="tel"
              required
              value={bizPhone}
              onChange={(e) => setBizPhone(e.target.value)}
              placeholder="Telefonszám (pl. +36301234567)"
              className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-sm"
            />
            <input
              type="text"
              value={bizTax}
              onChange={(e) => setBizTax(e.target.value)}
              placeholder="Adószám (formátum: 12345678-1-13)"
              className="w-full bg-white border border-[#DFD9CE] rounded-xl px-3.5 py-2.5 text-sm font-mono"
            />
            <button
              type="submit"
              className="w-full bg-pilis text-white font-bold py-3 rounded-xl text-sm"
            >
              Mentés
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
