import React, { useState, useEffect, useRef } from 'react';
import { searchAddressSuggestions } from '../constants/szentendreData.js';

export default function AddressAutocompleteInput({
  value,
  onChange,
  onSelectPlace,
  onFocus,
  placeholder,
  dotColor = 'border-pilis',
  isSolidDot = false
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const q = (value || '').trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const results = await searchAddressSuggestions(q);
      if (!cancelled) {
        setSuggestions(results);
        setLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value]);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl border border-transparent focus-within:border-pilis focus-within:bg-pilis-soft/15 transition">
        <span
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
            isSolidDot ? 'bg-terracotta' : `border-[2.5px] ${dotColor}`
          }`}
        />
        <input
          type="text"
          value={value}
          onFocus={() => {
            setOpen(true);
            if (onFocus) onFocus();
          }}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          placeholder={placeholder}
          className="w-full text-sm font-medium bg-transparent focus:outline-none text-[#18261F] placeholder:text-[#7A867E]"
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setSuggestions([]);
              if (onSelectPlace) onSelectPlace(null);
            }}
            className="text-xs text-[#5C6B62] hover:text-black px-1"
          >
            ✕
          </button>
        )}
      </div>

      {open && (suggestions.length > 0 || loading) && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-[#DFD9CE] z-50 overflow-hidden">
          {loading && suggestions.length === 0 && (
            <div className="px-3.5 py-2.5 text-xs text-[#5C6B62]">
              Címek keresése...
            </div>
          )}
          {suggestions.map((item, idx) => (
            <button
              key={`${item.name}-${idx}`}
              type="button"
              onClick={() => {
                onChange(item.name);
                if (onSelectPlace) onSelectPlace(item);
                setOpen(false);
              }}
              className="w-full text-left px-3.5 py-2.5 hover:bg-limestone flex items-center justify-between gap-2 border-b last:border-b-0 border-[#ECE7DC] transition"
            >
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#18261F] truncate">
                  {item.name}
                </div>
                <div className="text-[11px] text-[#5C6B62] truncate">
                  {item.subtitle}
                </div>
              </div>
              <span className="text-[11px] font-semibold text-pilis shrink-0">
                Kiválaszt ›
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
