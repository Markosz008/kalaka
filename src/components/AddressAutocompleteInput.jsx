import React, { useState, useEffect, useRef } from 'react';

export function stripAccents(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatPhotonFeature(feat) {
  const p = feat?.properties || {};
  const [lng, lat] = feat?.geometry?.coordinates || [];
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  const city = p.city || p.town || p.village || p.municipality || '';
  const streetLine = p.street
    ? `${p.street}${p.housenumber ? ` ${p.housenumber}.` : ''}`
    : '';
  const primaryName = p.name || streetLine || city;
  if (!primaryName) return null;

  const label =
    city && !stripAccents(primaryName).includes(stripAccents(city))
      ? `${city}, ${primaryName}`
      : primaryName;

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
        const baseQuery =
          normQ === 'hev' || normQ.endsWith(' hev') ? `${q} megálló` : q;

        // Ha a user még nem írta be a város nevét, párhuzamosan kérdezzük le a városhoz kötött és az általános találatokat
        const queries =
          normCity && !normQ.includes(normCity)
            ? [`${cityContext}, ${baseQuery}`, baseQuery]
            : [baseQuery];

        const responses = await Promise.all(
          queries.map((qry) =>
            fetch(
              `https://photon.komoot.io/api/?q=${encodeURIComponent(qry)}&lat=${
                biasCoords.lat
              }&lon=${biasCoords.lng}&limit=6`,
              { signal: controller.signal }
            )
              .then((r) => r.json())
              .catch(() => ({ features: [] }))
          )
        );

        const rawFeatures = responses.flatMap((d) => d?.features || []);
        const seen = new Set();

        const parsed = rawFeatures
          .map(formatPhotonFeature)
          .filter((item) => {
            if (!item) return false;
            const key = `${stripAccents(item.label)}_${item.lat.toFixed(3)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .sort((a, b) => {
            const aLocal = normCity && (a.cityNorm === normCity || stripAccents(a.label).startsWith(normCity)) ? 1 : 0;
            const bLocal = normCity && (b.cityNorm === normCity || stripAccents(b.label).startsWith(normCity)) ? 1 : 0;
            return bLocal - aLocal;
          })
          .slice(0, 5);

        setSuggestions(parsed);
        setOpen(parsed.length > 0);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setSuggestions([]);
        }
      } finally {
        setLoading(false);
      }
    }, 250);

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
