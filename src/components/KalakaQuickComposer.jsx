import React, { useState, useEffect } from 'react';
import { VALIDITY_OPTIONS } from '../constants/szentendreData.js';

const PLACEHOLDERS_ASK = [
  'Pl. Kölcsönkérnék egy magasabb létrát ma délutánra...',
  'Pl. Valaki be tudna ugrani a patikába a belvárosban?',
  'Pl. Keresek 8-as imbuszkulcsot vagy fúrót 1 órára...'
];

const PLACEHOLDERS_OFFER = [
  'Pl. Megmaradt 10 tő paradicsompalánta, szívesen odaadom...',
  'Pl. Délután megyek a belvárosba, elhozok csomagot...',
  'Pl. Van egy szabad utánfutóm hétvégére, ha valakinek kell...'
];

export default function KalakaQuickComposer({
  userZone = 'Pismány',
  onSubmitFavor
}) {
  const [mode, setMode] = useState('ask');
  const [title, setTitle] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [note, setNote] = useState('');
  const [validMins, setValidMins] = useState(1440);
  const [minHearts, setMinHearts] = useState(0);
  const [saving, setSaving] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % 3);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const currentPlaceholder =
    mode === 'offer'
      ? PLACEHOLDERS_OFFER[placeholderIdx]
      : PLACEHOLDERS_ASK[placeholderIdx];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const clean = title.trim();
    if (!clean || saving) return;

    setSaving(true);
    try {
      const prefix = mode === 'offer' ? '[Felajánlás] ' : '[Kérés] ';
      const ok = await onSubmitFavor({
        title: `${prefix}${clean}`,
        description: note.trim(),
        validMins: Number(validMins) || 1440,
        minHearts: Number(minHearts) || 0
      });
      if (ok) {
        setTitle('');
        setNote('');
        setMinHearts(0);
        setShowMore(false);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] shadow-sm space-y-2.5"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex bg-limestone p-1 rounded-xl border border-[#DFD9CE] text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode('ask')}
            className={`px-3 py-1 rounded-lg transition ${
              mode === 'ask'
                ? 'bg-terracotta text-white shadow-sm'
                : 'text-[#5C6B62]'
            }`}
          >
            Segítséget kérek
          </button>
          <button
            type="button"
            onClick={() => setMode('offer')}
            className={`px-3 py-1 rounded-lg transition ${
              mode === 'offer'
                ? 'bg-pilis text-white shadow-sm'
                : 'text-[#5C6B62]'
            }`}
          >
            Felajánlok
          </button>
        </div>

        <span className="text-[11px] font-semibold text-[#5C6B62] truncate">
          📍 {userZone}
        </span>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={currentPlaceholder}
          className="flex-1 min-w-0 bg-limestone border border-[#DFD9CE] focus:border-pilis rounded-xl px-3.5 py-2.5 text-sm font-medium text-[#18261F] placeholder:text-[#7A867E] focus:outline-none"
        />
        <button
          type="submit"
          disabled={!title.trim() || saving}
          className="shrink-0 bg-pilis hover:bg-pilis-light disabled:opacity-40 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition active:scale-95"
        >
          {saving ? '...' : 'Kiírom'}
        </button>
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="font-bold text-[#5C6B62] hover:text-pilis"
        >
          {showMore ? 'Kevesebb opció ▴' : 'Részletek, időtartam vagy feltétel ▾'}
        </button>
        <span className="text-[#7A867E]">
          {VALIDITY_OPTIONS.find((o) => o.minutes === Number(validMins))?.label || '24 óráig'}
        </span>
      </div>

      {showMore && (
        <div className="pt-2 border-t border-[#ECE7DC] space-y-2.5">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Rövid részletek (mikor, pontosan hol érdemes átvenni)..."
            className="w-full bg-limestone border border-[#DFD9CE] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-pilis"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="bg-limestone border border-[#DFD9CE] rounded-xl px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#18261F]">Érvényesség</span>
              <select
                value={validMins}
                onChange={(e) => setValidMins(Number(e.target.value))}
                className="text-xs font-bold text-pilis bg-white px-2 py-1 rounded-lg border border-[#DFD9CE]"
              >
                {VALIDITY_OPTIONS.map((opt) => (
                  <option key={opt.minutes} value={opt.minutes}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-limestone border border-[#DFD9CE] rounded-xl px-3 py-2 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-[#18261F]">Ki jelentkezhet?</span>
                <span className="font-bold text-pilis">
                  {Number(minHearts) === 0 ? 'Bárki' : `Min. ${minHearts} visszaigazolt segítség`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={minHearts}
                onChange={(e) => setMinHearts(Number(e.target.value))}
                className="w-full accent-pilis"
              />
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
