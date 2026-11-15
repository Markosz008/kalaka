import React, { useState, useEffect, useRef } from 'react';

export function stripAccents(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function extractHouseNumber(rawQuery) {
  const m = (rawQuery || '').trim().match(/^(.*?)\s+(\d+[a-zA-Z/-]*)\.?$/);
  if (!m || m[1].trim().length < 2) {
    return { streetPart: (rawQuery || '').trim(), houseNum: '' };
  }
  return { streetPart: m[1].trim(), houseNum: `${m[2]}.` };
}

function formatPhotonFeature(feat, fallbackHouseNum = '') {
  const p = feat?.properties || {};
  const [lng, lat] = feat?.geometry?.coordinates || [];
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  const city = p.city || p.town || p.village || p.municipality || '';
  const effectiveHouse = p.housenumber ? `${p.housenumber}.` : fallbackHouseNum;
  const streetBase = p.street || p.name || '';
  if (!streetBase && !city) return null;

  const withHouse =
    streetBase && effectiveHouse && !/\d/.test(streetBase)
      ? `${streetBase} ${effectiveHouse}`
      : streetBase || city;

  const label =
    city && !stripAccents(withHouse).includes(stripAccents(city))
      ? `${city}, ${withHouse}`
      : withHouse;

  const subParts = [p.postcode, city, p.district || p.suburb].filter(Boolean);
  const subtitle = Array.from(new Set(subParts)).join(' • ');

  return {
    label,
    subtitle: subtitle || 'Magyarország',
    cityNorm: stripAccents(city),
    lat,
    lng
  };
}

function formatNominatimItem(item, cityContext, fallbackHouseNum = '') {
  const lat = Number(item?.lat);
  const lng = Number(item?.lon);
  if (isNaN(lat) || isNaN(lng)) return null;

  const addr = item.address || {};
  const city = addr.city || addr.town || addr.village || addr.municipality || cityContext || '';
  const road = addr.road || addr.pedestrian || addr.suburb || item.name || '';
  const effectiveHouse = addr.house_number ? `${addr.house_number}.` : fallbackHouseNum;
  if (!road) return null;

  const withHouse = effectiveHouse && !/\d/.test(road) ? `${road} ${effectiveHouse}` : road;
  const label =
    city && !stripAccents(withHouse).includes(stripAccents(city))
      ? `${city}, ${withHouse}`
      : withHouse;

  const subParts = [addr.postcode, city, addr.suburb || addr.neighbourhood].filter(Boolean);
  return {
    label,
    subtitle: Array.from(new Set(subParts)).join(' • ') || 'Magyarország',
    cityNorm: stripAccents(city),
    lat,
    lng
  };
}

export default function AddressAutocompleteInput({
  value,
  onChange,
  onSelectPlace,
  onFocus,
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
  const skipNextFetchRef = useRef(false);

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
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }

    const q = (value || '').trim();
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const normQ = stripAccents(q);
        const normCity = stripAccents(cityContext);
        const { streetPart, houseNum } = extractHouseNumber(q);

        const baseStreet =
          stripAccents(streetPart) === 'hev' || stripAccents(streetPart).endsWith(' hev')
            ? `${streetPart} megálló`
            : streetPart;

        const hasCityInQuery = normCity && normQ.includes(normCity);
        const localPhotonQ = hasCityInQuery ? baseStreet : `${cityContext}, ${baseStreet}`;

        const [photonLocalRes, photonBroadRes, nominatimLocalRes] = await Promise.all([
          fetch(
            `https://photon.komoot.io/api/?q=${encodeURIComponent(localPhotonQ)}&lat=${
              biasCoords.lat
            }&lon=${biasCoords.lng}&limit=6`,
            { signal: controller.signal }
          )
            .then((r) => r.json())
            .catch(() => ({ features: [] })),
          !hasCityInQuery
            ? fetch(
                `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${
                  biasCoords.lat
                }&lon=${biasCoords.lng}&limit=4`,
                { signal: controller.signal }
              )
                .then((r) => r.json())
                .catch(() => ({ features: [] }))
            : Promise.resolve({ features: [] }),
          fetch(
            `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=hu&limit=5&q=${encodeURIComponent(
              hasCityInQuery ? streetPart : `${cityContext}, ${streetPart}`
            )}`,
            { signal: controller.signal }
          )
            .then((r) => r.json())
            .catch(() => [])
        ]);

        const localItems = [
          ...(photonLocalRes?.features || []).map((f) => formatPhotonFeature(f, houseNum)),
          ...(Array.isArray(nominatimLocalRes)
            ? nominatimLocalRes.map((n) => formatNominatimItem(n, cityContext, houseNum))
            : [])
        ].filter(Boolean);

        const broadItems = (photonBroadRes?.features || [])
          .map((f) => formatPhotonFeature(f, ''))
          .filter(Boolean);

        const seen = new Set();
        const combined = [...localItems, ...broadItems]
          .filter((item) => {
            const key = `${stripAccents(item.label)}_${item.lat.toFixed(3)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .sort((a, b) => {
            const aLocal =
              normCity &&
              (a.cityNorm === normCity || stripAccents(a.label).startsWith(normCity))
                ? 1
                : 0;
            const bLocal =
              normCity &&
              (b.cityNorm === normCity || stripAccents(b.label).startsWith(normCity))
                ? 1
                : 0;
            return bLocal - aLocal;
          })
          .slice(0, 5);

        setSuggestions(combined);
        setOpen(combined.length > 0);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setSuggestions([]);
        }
      } finally {
        setLoading(false);
      }
    }, 260);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, cityContext, biasCoords.lat, biasCoords.lng]);

  const handleSelect = (item) => {
    skipNextFetchRef.current = true;
    onChange(item.label);
    setSuggestions([]);
    setOpen(false);
    if (onSelectPlace) onSelectPlace(item);
  };

  return (
    <div ref={containerRef} className="relative w-full min-w-0">
      <div className="flex items-center gap-2 px-2 py-1.5">
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
            if (suggestions.length > 0) setOpen(true);
          }}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full min-w-0 bg-transparent text-sm sm:text-base font-medium text-[#18261F] placeholder:text-[#7A867E] focus:outline-none"
        />
        {loading && (
          <span className="text-[10px] font-bold text-[#7A867E] shrink-0">…</span>
        )}
        {value && (
          <button
            type="button"
            aria-label="Mező törlése"
            onClick={() => {
              onChange('');
              setSuggestions([]);
              setOpen(false);
              if (onSelectPlace) onSelectPlace(null);
            }}
            className="text-xs font-bold text-[#7A867E] hover:text-[#18261F] px-1 shrink-0"
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
                className="w-full text-left px-3.5 py-2.5 hover:bg-limestone transition flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-[#18261F] truncate">
                    {item.label}
                  </div>
                  <div className="text-[11px] text-[#5C6B62] truncate">
                    {item.subtitle}
                  </div>
                </div>
                <span className="text-[11px] font-bold text-pilis shrink-0">
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
