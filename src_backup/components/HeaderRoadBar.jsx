import React, { useState } from 'react';
import { formatRelativeTime } from '../constants/szentendreData';

const STATUS_META = {
  ok: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    label: 'Jól járható'
  },
  warn: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-900 border-amber-200',
    label: 'Torlódás'
  },
  danger: {
    dot: 'bg-red-600',
    badge: 'bg-red-50 text-red-900 border-red-200',
    label: 'Fennakadás'
  }
};

export default function HeaderRoadBar({ latestAlert, onReportAlert, currentUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const [statusLevel, setStatusLevel] = useState('warn');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentStatus = latestAlert ? STATUS_META[latestAlert.status_level] || STATUS_META.ok : STATUS_META.ok;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    await onReportAlert(statusLevel, message.trim());
    setSubmitting(false);
    setMessage('');
    setIsOpen(false);
  };

  return (
    <div className="bg-white border-b border-stone-200">
      <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-between gap-2 text-xs sm:text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${currentStatus.dot}`} />
          <span className="font-semibold text-stone-800 shrink-0">11-es út:</span>
          {latestAlert ? (
            <span className="text-stone-700 truncate">
              <strong className="font-medium">{currentStatus.label}</strong> – {latestAlert.message}
              <span className="text-stone-400 ml-1.5">({formatRelativeTime(latestAlert.created_at)})</span>
            </span>
          ) : (
            <span className="text-stone-600 truncate">Jól járható, nincs friss bejelentés</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="shrink-0 text-xs font-medium text-pilis hover:text-pilis-light px-2.5 py-1 rounded-lg bg-pilis-soft/70 transition"
        >
          {isOpen ? 'Bezárás' : 'Úthelyzet jelzése'}
        </button>
      </div>

      {isOpen && (
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 pb-3 pt-1 border-t border-stone-100 bg-stone-50/70">
          {!currentUser ? (
            <p className="text-xs text-stone-600 py-1">Az úthelyzet jelzéséhez jelentkezz be.</p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex gap-1.5">
                {Object.entries(STATUS_META).map(([key, meta]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatusLevel(key)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                      statusLevel === key ? meta.badge + ' ring-1 ring-current' : 'bg-white text-stone-600 border-stone-200'
                    }`}
                  >
                    {meta.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-1 gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Pl. A Luppa-szigetnél áll a belső sáv..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:border-pilis"
                  required
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 bg-pilis text-white text-xs font-medium rounded-lg hover:bg-pilis-light disabled:opacity-50"
                >
                  Küldés
                </button>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
