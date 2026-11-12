import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const STATUS_LABELS = {
  chatting: 'Egyeztetés alatt',
  agreed: 'Megbeszélve',
  started: 'Folyamatban',
  arrived: 'Megérkezett',
  completed: 'Lezárva'
};

export default function AgreementChatModal({
  agreement,
  currentUser,
  onClose,
  onStatusChange,
  onSendKudos
}) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [kudosSent, setKudosSent] = useState(false);

  const isRequester = currentUser?.id === agreement?.requester_id;

  useEffect(() => {
    if (!agreement?.id) return;

    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('agreement_id', agreement.id)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);

      const { data: existingKudos } = await supabase
        .from('kudos')
        .select('agreement_id')
        .eq('agreement_id', agreement.id)
        .maybeSingle();
      if (existingKudos) setKudosSent(true);
    };

    loadMessages();

    const channel = supabase
      .channel(`messages:${agreement.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `agreement_id=eq.${agreement.id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agreement?.id]);

  if (!agreement) return null;

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const body = newMessage.trim();
    setNewMessage('');
    await supabase.from('messages').insert({
      agreement_id: agreement.id,
      sender_id: currentUser.id,
      body,
      is_system_event: false
    });
  };

  const handleKudos = async () => {
    const ok = await onSendKudos(agreement);
    if (ok) setKudosSent(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-xl flex flex-col max-h-[85vh]">
        <div className="px-4 py-3 bg-pilis text-white flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">Közvetlen egyeztetés</h3>
            <span className="text-xs text-pilis-soft">{STATUS_LABELS[agreement.status] || agreement.status}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25"
          >
            Bezárás
          </button>
        </div>

        <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {agreement.status === 'chatting' && (
              <button
                type="button"
                onClick={() => onStatusChange(agreement.id, 'agreed')}
                className="px-3 py-1 rounded-lg text-xs font-semibold bg-pilis text-white"
              >
                Megbeszéltük
              </button>
            )}
            {(agreement.status === 'agreed' || agreement.status === 'chatting') && (
              <button
                type="button"
                onClick={() => onStatusChange(agreement.id, 'started')}
                className="px-3 py-1 rounded-lg text-xs font-semibold bg-amber-600 text-white"
              >
                Elindultunk
              </button>
            )}
            {agreement.status !== 'completed' && (
              <button
                type="button"
                onClick={() => onStatusChange(agreement.id, 'completed')}
                className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-700 text-white"
              >
                Sikeresen lezárva
              </button>
            )}
          </div>

          {agreement.status === 'completed' && isRequester && !kudosSent && (
            <button
              type="button"
              onClick={handleKudos}
              className="px-3 py-1 rounded-lg text-xs font-semibold bg-terracotta text-white hover:opacity-95"
            >
              ♥ Köszönet küldése
            </button>
          )}

          {kudosSent && (
            <span className="text-xs font-medium text-emerald-700">Köszönet elküldve ✓</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-stone-50/40">
          {messages.length === 0 ? (
            <p className="text-xs text-stone-400 text-center py-8">
              Írd meg, hol és hány órakor találkoztok!
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === currentUser?.id;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs sm:text-sm ${
                      mine ? 'bg-pilis text-white rounded-br-sm' : 'bg-white border border-stone-200 text-stone-800 rounded-bl-sm'
                    }`}
                  >
                    {m.body}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={handleSend} className="p-3 border-t border-stone-200 bg-white flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Üzenet írása..."
            className="flex-1 px-3 py-2 text-sm rounded-xl border border-stone-300 focus:outline-none focus:border-pilis"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-pilis text-white hover:bg-pilis-light"
          >
            Küldés
          </button>
        </form>
      </div>
    </div>
  );
}
