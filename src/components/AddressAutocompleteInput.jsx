import React, { useState, useEffect, useRef } from 'react';
import { LOCAL_PLACES, SZENTENDRE_ZONES } from '../constants/szentendreData.js';

export function stripAccents(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function deduplicateCityInLabel(label) {
  const m = (label || '').match(/^([^,]+),\s*(.+)$/);
  if (!m) return label || '';
  const city = m[1].trim();
  const rest = m[2].trim();
  const escapedCity = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cleanedRest = rest.replace(new RegExp(`\\b${escapedCity}\\s+`, 'gi'), '').trim();
  return cleanedRest ? `${city}, ${cleanedRest}` : city;
}

function expandStreetAbbreviations(addrStr) {
  return (addrStr || '')
    .replace(/\bu\.\s*/gi, 'utca ')
    .replace(/\bu\s+(?=\d)/gi, 'utca ')
    .replace(/\bkrt\.?\s*/gi, 'körút ')
    .replace(/\bstny\.?\s*/gi, 'sétány ')
    .trim();
}

function extractHouseNumber(rawQuery) {
  const m = (rawQuery || '').trim().match(/^(.*?)\s+(\d+[a-zA-Z/-]*)\.?$/);
  if (!m || m[1].trim().length < 2) {
    return { streetPart: (rawQuery || '').trim(), houseNum: '' };
  }
  return { streetPart: m[1].trim(), houseNum: `${m[2]}.` };
}

function findLocalMatches(queryText, houseNum = '') {
  const normQ = stripAccents(queryText);
  if (normQ.length < 2) return [];

  const results = [];
  const seen = new Set();

  for (const z of SZENTENDRE_ZONES) {
    if (stripAccents(z.name).includes(normQ)) {
      const lbl = `Szentendre, ${z.name}`;
      if (!seen.has(lbl)) {
        seen.add(lbl);
        results.push({
          source: 'local',
          label: lbl,
          subtitle: 'Szentendre városrész',
          lat: z.lat,
          lng: z.lng
        });
      }
    }
  }

  for (const p of LOCAL_PLACES) {
    const normName = stripAccents(p.name);
    const normSub = stripAccents(p.subtitle || '');
    if (normName.includes(normQ) || normSub.includes(normQ)) {
      const baseLabel = deduplicateCityInLabel(p.name);
      const finalLabel =
        houseNum && !/\d/.test(baseLabel) && !baseLabel.toLowerCase().includes('hév')
          ? `${baseLabel} ${houseNum}`
          : baseLabel;

      if (!seen.has(finalLabel)) {
        seen.add(finalLabel);
        results.push({
          source: 'local',
          label: finalLabel,
          subtitle: p.subtitle || 'Szentendre',
          lat: p.lat,
          lng: p.lng
        });
      }
    }
    if (results.length >= 4) break;
  }

  return results;
}

function formatPhotonFeature(feat, fallbackHouseNum = '') {
  const p = feat?.properties || {};
  const [lng, lat] = feat?.geometry?.coordinates || [];
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  const countryCode = (p.countrycode || '').toUpperCase();
  if (countryCode && countryCode !== 'HU') return null;

  const city = p.city || p.town || p.village || p.municipality || '';
  const streetBase = p.street || p.name || '';
  const house = p.housenumber ? `${p.housenumber}.` : fallbackHouseNum;
  const withHouse =
    streetBase && house && !/\d/.test(streetBase)
      ? `${streetBase} ${house}`
      : streetBase || city;
  if (!withHouse) return null;

  const rawLabel =
    city && !stripAccents(withHouse).includes(stripAccents(city))
      ? `${city}, ${withHouse}`
      : withHouse;

  return {
    source: 'photon',
    label: deduplicateCityInLabel(rawLabel),
    subtitle: [p.postcode, city, p.district || p.suburb].filter(Boolean).join(' • ') || 'Magyarország',
    lat,
    lng
  };
}

export default function AddressAutocompleteInput({
  value,
  onChange,
  onSelectPlace,
  onFocus,
  isSavedPlace = false,
  onToggleSavePlace = null,
  placeholder = 'Cím vagy megálló...',
  dotColor = 'border-terracotta',
  isSolidDot = false,
  cityContext = 'Szentendre',
  biasCoords = { lat: 47.6694, lng: 19.0756 }
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const isUserTypingRef = useRef(false);

  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, []);

  useEffect(() => {
    if (!isUserTypingRef.current) return;

    const q = (value || '').trim();
    if (q.length < 2) {
      isUserTypingRef.current = false;
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const { streetPart, houseNum } = extractHouseNumber(q);
    const localHits = findLocalMatches(streetPart, houseNum);
    if (localHits.length > 0) {
      setSuggestions(localHits);
      setOpen(true);
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      isUserTypingRef.current = false;
      setLoading(true);
      try {
        const expandedStreet = expandStreetAbbreviations(streetPart);
        const normQ = stripAccents(expandedStreet);
        const normCity = stripAccents(cityContext);
        const photonQ =
          normCity &&
          !normQ.includes(normCity) &&
          !normQ.includes('budapest') &&
          !normQ.includes('pomaz') &&
          !normQ.includes('leanyfalu')
            ? `${cityContext}, ${expandedStreet}`
            : expandedStreet;

        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(photonQ)}&lat=${
            biasCoords.lat
          }&lon=${biasCoords.lng}&limit=6`,
          { signal: controller.signal }
        );
        const data = await res.json();
        const remoteHits = (data?.features || [])
          .map((f) => formatPhotonFeature(f, houseNum))
          .filter(Boolean);

        const merged = [...localHits];
        const seenLabels = new Set(merged.map((m) => stripAccents(m.label)));
        for (const rItem of remoteHits) {
          const k = stripAccents(rItem.label);
          if (!seenLabels.has(k)) {
            seenLabels.add(k);
            merged.push(rItem);
          }
          if (merged.length >= 6) break;
        }

        setSuggestions(merged);
        setOpen(merged.length > 0);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setSuggestions(localHits);
          setOpen(localHits.length > 0);
        }
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, cityContext, biasCoords.lat, biasCoords.lng]);

  const handleSelect = (item) => {
    isUserTypingRef.current = false;
    setSuggestions([]);
    setOpen(false);
    onChange(item.label);
    if (onSelectPlace) {
      onSelectPlace(
        typeof item.lat === 'number' && typeof item.lng === 'number'
          ? { ...item, lat: item.lat, lng: item.lng }
          : null
      );
    }
  };

  return (
    <div ref={containerRef} className="relative w-full min-w-0">
      <div className="flex items-center gap-2 px-2 py-2">
        {isSolidDot ? (
          <span className="w-2.5 h-2.5 rounded-full bg-terracotta shrink-0" />
        ) : (
          <span className={`w-2.5 h-2.5 rounded-full border-2 ${dotColor} shrink-0`} />
        )}
        <input
          type="text"
          value={value}
          onFocus={() => {
            if (onFocus) onFocus();
          }}
          onChange={(e) => {
            isUserTypingRef.current = true;
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full min-w-0 bg-transparent text-sm sm:text-base font-medium text-[#18261F] placeholder:text-[#4A5850] focus:outline-none"
        />
        {loading && (
          <span className="text-xs font-bold text-[#4A5850] shrink-0">…</span>
        )}
        {value && value.trim().length >= 3 && onToggleSavePlace && (
          <button
            type="button"
            onClick={onToggleSavePlace}
            title={isSavedPlace ? 'Eltávolítás a saját helyek közül' : 'Mentés a saját helyek közé'}
            aria-label={isSavedPlace ? 'Eltávolítás a saját helyek közül' : 'Mentés a saját helyek közé'}
            className={`w-8 h-8 rounded-lg grid place-items-center text-base font-bold shrink-0 transition ${
              isSavedPlace ? 'text-amber-500' : 'text-[#5C6B62] hover:text-amber-500'
            }`}
          >
            {isSavedPlace ? '★' : '☆'}
          </button>
        )}
        {value && (
          <button
            type="button"
            aria-label="Mező törlése"
            onClick={() => {
              isUserTypingRef.current = false;
              onChange('');
              setSuggestions([]);
              setOpen(false);
              if (onSelectPlace) onSelectPlace(null);
            }}
            className="w-8 h-8 rounded-lg grid place-items-center text-xs font-bold text-[#4A5850] hover:text-[#18261F] shrink-0"
          >
            ✕
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 bg-white rounded-2xl shadow-2xl border border-[#DFD9CE] z-[1000] overflow-hidden divide-y divide-[#ECE7DC]"
        >
          {suggestions.map((item, idx) => (
            <li key={`${item.label}-${idx}`}>
              <button
                type="button"
                onClick={() => handleSelect(item)}
                className="w-full text-left px-3.5 py-3 hover:bg-limestone transition flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-[#18261F] truncate">
                    {item.label}
                  </div>
                  <div className="text-xs text-[#4A5850] truncate">
                    {item.subtitle}
                  </div>
                </div>
                <span className="text-xs font-bold text-pilis shrink-0">
                  Kiválaszt ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
