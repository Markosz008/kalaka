import React, { useState, useEffect, useRef, useMemo } from 'react';
import { searchSzentendreAddresses, PRESET_LOCATIONS } from '../constants/szentendreData';

export default function AddressAutocompleteInput({
  label,
  placeholder,
  value,
  onSelect,
  transitStops = []
}) {
  const [query, setQuery] = useState(value || '');
  const [remoteResults, setRemoteResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allLocalOptions = useMemo(() => {
    const dbStops = (transitStops || [])
      .filter((s) => s.name)
      .map((s) => ({
        label: s.name,
        category: s.corridor || 'Találkozópont',
        lat: s.lat || null,
        lng: s.lng || null
      }));
    const merged = [...PRESET_LOCATIONS];
    dbStops.forEach((stop) => {
      if (!merged.some((m) => m.label.toLowerCase() === stop.label.toLowerCase())) {
        merged.push(stop);
      }
    });
    return merged;
  }, [transitStops]);

  const filteredLocal = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allLocalOptions.slice(0, 12);
    return allLocalOptions
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          (item.shortLabel && item.shortLabel.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [query, allLocalOptions]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!open || trimmed.length < 2) {
      setRemoteResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      const items = await searchSzentendreAddresses(trimmed);
      setRemoteResults(items);
      setLoading(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [query, open]);

  const combinedResults = useMemo(() => {
    const list = [...filteredLocal];
    remoteResults.forEach((rem) => {
      if (!list.some((loc) => loc.label.toLowerCase() === rem.label.toLowerCase())) {
        list.push(rem);
      }
    });
    return list;
  }, [filteredLocal, remoteResults]);

  return (
    <div ref={wrapperRef} className="relative">
      {label && <label className="block text-xs font-semibold text-stone-700 mb-1">{label}</label>}
      <div className="relative">
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            setOpen(true);
            const exactMatch = allLocalOptions.find(
              (o) => o.label.toLowerCase() === val.trim().toLowerCase()
            );
            if (exactMatch) {
              onSelect(exactMatch);
            } else {
              onSelect({ label: val, lat: null, lng: null });
            }
          }}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-8 text-sm rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-pilis"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              onSelect({ label: '', lat: null, lng: null });
              setOpen(true);
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs"
            title="Mező törlése"
          >
            ✕
          </button>
        )}
      </div>

      {open && (loading || combinedResults.length > 0) && (
        <div className="absolute z-40 left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-stone-200 max-h-60 overflow-y-auto">
          {combinedResults.map((item, idx) => (
            <button
              key={`${item.label}-${idx}`}
              type="button"
              onClick={() => {
                setQuery(item.label);
                setOpen(false);
                onSelect(item);
              }}
              className="w-full text-left px-3 py-2 text-xs sm:text-sm text-stone-800 hover:bg-pilis-soft/60 border-b border-stone-100 last:border-b-0 flex items-center justify-between gap-2"
            >
              <span className="truncate font-medium">{item.label}</span>
              {item.category && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 shrink-0">
                  {item.category}
                </span>
              )}
            </button>
          ))}
          {loading && (
            <div className="px-3 py-2 text-xs text-stone-500 bg-stone-50">
              További utcák és házszámok keresése...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
