import React, { useState, useEffect, useRef } from 'react';

const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || '';

export function stripAccents(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function createSessionToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function cleanHungarianAddress(rawText) {
  return (rawText || '')
    .replace(/,\s*Magyarország$/i, '')
    .replace(/,\s*Hungary$/i, '')
    .trim();
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

function formatPhotonFallback(feat, fallbackHouseNum = '') {
  const p = feat?.properties || {};
  const [lng, lat] = feat?.geometry?.coordinates || [];
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  const city = p.city || p.town || p.village || p.municipality || '';
  const streetBase = p.street || p.name || '';
  const house = p.housenumber ? `${p.housenumber}.` : fallbackHouseNum;
  const withHouse =
    streetBase && house && !/\d/.test(streetBase)
      ? `${streetBase} ${house}`
      : streetBase || city;
  if (!withHouse) return null;

  const label =
    city && !stripAccents(withHouse).includes(stripAccents(city))
      ? `${city}, ${withHouse}`
      : withHouse;

  return {
    source: 'photon',
    label,
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
  const sessionTokenRef = useRef(createSessionToken());

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
    if (!isUserTypingRef.current) {
      return;
    }

    const q = (value || '').trim();
    if (q.length < 2) {
      isUserTypingRef.current = false;
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      isUserTypingRef.current = false;
      setLoading(true);
      try {
        const normQ = stripAccents(q);
        const normCity = stripAccents(cityContext);
        const biasedInput =
          normCity && !normQ.includes(normCity) && q.length >= 2
            ? `${cityContext}, ${q}`
            : q;

        if (GOOGLE_PLACES_KEY) {
          const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': GOOGLE_PLACES_KEY
            },
            body: JSON.stringify({
              input: biasedInput,
              languageCode: 'hu',
              includedRegionCodes: ['hu'],
              sessionToken: sessionTokenRef.current,
              locationBias: {
                circle: {
                  center: {
                    latitude: biasCoords.lat,
                    longitude: biasCoords.lng
                  },
                  radius: 18000.0
                }
              }
            })
          });

          if (res.ok) {
            const data = await res.json();
            const parsedGoogle = (data?.suggestions || [])
              .map((s) => s.placePrediction)
              .filter(Boolean)
              .map((pred) => {
                const fullClean = cleanHungarianAddress(pred.text?.text);
                const mainText = pred.structuredFormat?.mainText?.text || fullClean;
                const secondaryText = cleanHungarianAddress(
                  pred.structuredFormat?.secondaryText?.text || ''
                );

                const cityPrefix =
                  secondaryText &&
                  !stripAccents(mainText).includes(stripAccents(secondaryText.split(',')[0]))
                    ? `${secondaryText.split(',')[0].trim()}, ${mainText}`
                    : fullClean || mainText;

                return {
                  source: 'google',
                  placeId: pred.placeId,
                  label: cityPrefix,
                  subtitle: secondaryText || fullClean
                };
              })
              .slice(0, 5);

            if (parsedGoogle.length > 0) {
              setSuggestions(parsedGoogle);
              setOpen(true);
              setLoading(false);
              return;
            }
          }
        }

        const { streetPart, houseNum } = extractHouseNumber(q);
        const expandedStreet = expandStreetAbbreviations(streetPart);
        const photonQ =
          normCity && !stripAccents(expandedStreet).includes(normCity)
            ? `${cityContext}, ${expandedStreet}`
            : expandedStreet;

        const fallbackRes = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(photonQ)}&lat=${
            biasCoords.lat
          }&lon=${biasCoords.lng}&limit=5`,
          { signal: controller.signal }
        );
        const fallbackData = await fallbackRes.json();
        const parsedFallback = (fallbackData?.features || [])
          .map((f) => formatPhotonFallback(f, houseNum))
          .filter(Boolean)
          .slice(0, 5);

        setSuggestions(parsedFallback);
        setOpen(parsedFallback.length > 0);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setSuggestions([]);
        }
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, cityContext, biasCoords.lat, biasCoords.lng]);

  const resolveItemCoordinates = async (item) => {
    if (typeof item.lat === 'number' && typeof item.lng === 'number') {
      return { lat: item.lat, lng: item.lng };
    }

    if (item.source === 'google' && item.placeId && GOOGLE_PLACES_KEY) {
      sessionTokenRef.current = createSessionToken();
      try {
        const detailRes = await fetch(
          `https://places.googleapis.com/v1/places/${encodeURIComponent(item.placeId)}`,
          {
            headers: {
              'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
              'X-Goog-FieldMask': 'location'
            }
          }
        );
        if (detailRes.ok) {
          const detail = await detailRes.json();
          const lat = detail?.location?.latitude;
          const lng = detail?.location?.longitude;
          if (typeof lat === 'number' && typeof lng === 'number') {
            return { lat, lng };
          }
        }
      } catch {}
    }

    const expandedFull = expandStreetAbbreviations(item.label);
    const { streetPart } = extractHouseNumber(expandedFull);
    const candidates = [expandedFull, streetPart];

    for (const queryCandidate of candidates) {
      if (!queryCandidate) continue;
      try {
        const nomRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=hu&limit=1&q=${encodeURIComponent(
            queryCandidate
          )}`
        );
        const nomArr = await nomRes.json();
        if (Array.isArray(nomArr) && nomArr[0]) {
          const lat = Number(nomArr[0].lat);
          const lng = Number(nomArr[0].lon);
          if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
        }
      } catch {}

      try {
        const phRes = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(queryCandidate)}&lat=${
            biasCoords.lat
          }&lon=${biasCoords.lng}&limit=1`
        );
        const phData = await phRes.json();
        const coords = phData?.features?.[0]?.geometry?.coordinates;
        if (Array.isArray(coords) && coords.length >= 2) {
          return { lat: Number(coords[1]), lng: Number(coords[0]) };
        }
      } catch {}
    }

    return null;
  };

  const handleSelect = async (item) => {
    isUserTypingRef.current = false;
    setSuggestions([]);
    setOpen(false);
    setLoading(true);

    const coords = await resolveItemCoordinates(item);
    setLoading(false);

    isUserTypingRef.current = false;
    onChange(item.label);
    if (onSelectPlace) {
      onSelectPlace(coords ? { ...item, lat: coords.lat, lng: coords.lng } : null);
    }
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
          }}
          onChange={(e) => {
            isUserTypingRef.current = true;
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full min-w-0 bg-transparent text-sm sm:text-base font-medium text-[#18261F] placeholder:text-[#7A867E] focus:outline-none"
        />
        {loading && (
          <span className="text-[10px] font-bold text-[#7A867E] shrink-0">…</span>
        )}
        {value && value.trim().length >= 3 && onToggleSavePlace && (
          <button
            type="button"
            onClick={onToggleSavePlace}
            title={isSavedPlace ? 'Eltávolítás a saját helyek közül' : 'Mentés a saját helyek közé'}
            aria-label={isSavedPlace ? 'Eltávolítás a saját helyek közül' : 'Mentés a saját helyek közé'}
            className={`text-sm font-bold px-1 shrink-0 transition ${
              isSavedPlace ? 'text-amber-500' : 'text-[#9AA59E] hover:text-amber-500'
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
            <li key={`${item.placeId || item.label}-${idx}`}>
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
