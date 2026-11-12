import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';

export default function AgreementChatModal({
  agreement,
  currentUser,
  onClose,
  onAgreementUpdated
}) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [status, setStatus] = useState(agreement?.status || 'chatting');
  const [busy, setBusy] = useState(false);
  const [errorBanner, setErrorBanner] = useState(null);
  const bottomRef = useRef(null);

  const isUuid = (val) =>
    typeof val === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  const isLiveDbAgreement = Boolean(supabase && isUuid(agreement?.id));
  const isRequester = agreement?.requester_id === currentUser?.id;
  const isProInquiry = Boolean(agreement?.pro_id);

  useEffect(() => {
    if (!agreement) return;
    setStatus(agreement.status || 'chatting');
    setErrorBanner(null);

    if (!isLiveDbAgreement) {
      setMessages(agreement.messages || []);
      return;
    }

    let channel;
    (async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('agreement_id', agreement.id)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);

      channel = supabase
        .channel(`agreement-room-${agreement.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `agreement_id=eq.${agreement.id}` },
          (payload) => {
            setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]));
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'agreements', filter: `id=eq.${agreement.id}` },
          (payload) => {
            setStatus(payload.new.status);
            if (onAgreementUpdated) onAgreementUpdated(payload.new);
          }
        )
        .subscribe();
    })();

    return () => {
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, [agreement?.id, isLiveDbAgreement]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  if (!agreement) return null;

  const sendMessage = async (bodyText) => {
    const clean = (bodyText || '').trim();
    if (!clean) return;

    if (!isLiveDbAgreement) {
      setMessages((prev) => [...prev, { id: `local-${Date.now()}`, sender_id: currentUser.id, body: clean }]);
      return;
    }

    const { error } = await supabase.from('messages').insert({
      agreement_id: agreement.id,
      sender_id: currentUser.id,
      body: clean,
      is_system_event: false
    });
    if (error) setErrorBanner(error.message);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const msg = text;
    setText('');
    await sendMessage(msg);
  };

  const handleUpdateStatus = async (nextStatus) => {
    setBusy(true);
    setErrorBanner(null);
    const systemTexts = {
      agreed: 'Megállapodás rögzítve.',
      started: 'A szomszéd elindult.',
      arrived: 'Megérkezés rögzítve.'
    };

    try {
      if (isLiveDbAgreement) {
        const patch = { status: nextStatus };
        if (nextStatus === 'started') patch.started_at = new Date().toISOString();
        if (nextStatus === 'arrived') patch.arrived_at = new Date().toISOString();

        const { data, error } = await supabase
          .from('agreements')
          .update(patch)
          .eq('id', agreement.id)
          .select('*')
          .single();
        if (error) throw error;

        await supabase.from('messages').insert({
          agreement_id: agreement.id,
          sender_id: currentUser.id,
          body: systemTexts[nextStatus] || nextStatus,
          is_system_event: true
        });

        setStatus(data.status);
        if (onAgreementUpdated) onAgreementUpdated(data);
      }
    } catch (err) {
      setErrorBanner(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleGiveKudos = async () => {
    setBusy(true);
    setErrorBanner(null);
    const isRide = Boolean(agreement.ride_id);

    try {
      if (isLiveDbAgreement) {
        const { error } = await supabase.from('kudos').insert({
          agreement_id: agreement.id,
          giver_id: currentUser.id,
          receiver_id: agreement.helper_id,
          kudos_type: isRide ? 'ride' : 'favor'
        });
        if (error) throw error;

        await supabase.from('messages').insert({
          agreement_id: agreement.id,
          sender_id: currentUser.id,
          body: 'Segítség visszaigazolva.',
          is_system_event: true
        });

        setStatus('completed');
        if (onAgreementUpdated) onAgreementUpdated({ ...agreement, status: 'completed' });
      }
    } catch (err) {
      setErrorBanner(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleReport = async () => {
    const reason = window.prompt('Írd le röviden a problémát:');
    if (!reason || reason.trim().length < 5) return;

    if (isLiveDbAgreement) {
      const reportedUserId =
        agreement.requester_id === currentUser.id ? agreement.helper_id : agreement.requester_id;
      if (reportedUserId) {
        const { error } = await supabase.from('reports').insert({
          agreement_id: agreement.id,
          reporter_id: currentUser.id,
          reported_user_id: reportedUserId,
          reason: reason.trim()
        });
        if (error) {
          setErrorBanner(error.message);
          return;
        }
      }
    }
    onClose();
  };

  const quickReplies = isProInquiry
    ? ['Szia! Mikor lenne szabad időpontod?', 'Szentendrén belül kiszállással is vállalod?', 'Köszönöm a gyors választ!']
    : ['Ott leszek a megállóban.', '2 perc és érkezem.', 'Köszönöm a segítséget!'];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-limestone w-full max-w-lg h-[92vh] sm:h-[640px] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl border border-[#DFD9CE] pb-[env(safe-area-inset-bottom)]">
        <div className="bg-white px-4 py-3 border-b border-[#DFD9CE] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button onClick={onClose} className="text-2xl font-bold text-[#18261F] px-1.5">
              ‹
            </button>
            <div className="w-9 h-9 rounded-full bg-pilis text-white font-bold text-sm grid place-items-center shrink-0">
              {agreement.partner_name?.[0] || 'S'}
            </div>
            <div className="truncate">
              <div className="font-bold text-sm truncate">{agreement.partner_name}</div>
              <div className="text-[11px] text-[#5C6B62] truncate">
                {agreement.title}
                {agreement.pickup_stop_name ? ` • ${agreement.pickup_stop_name}` : ''}
              </div>
            </div>
          </div>

          {!isProInquiry && status !== 'chatting' && (
            <button
              onClick={handleReport}
              className="text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg shrink-0"
            >
              Jelentés
            </button>
          )}
        </div>

        {errorBanner && (
          <div className="bg-red-100 text-red-900 text-xs font-semibold px-4 py-2 border-b border-red-200">
            {errorBanner}
          </div>
        )}

        {!isProInquiry && (
          <div className="bg-[#ECE7DC] px-4 py-2.5 border-b border-[#DFD9CE] flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-[#18261F]">
              {status === 'chatting' && 'Egyeztessétek a találkozót'}
              {status === 'agreed' && 'Megállapodva'}
              {status === 'started' && 'Úton'}
              {status === 'arrived' && (isRequester ? 'Megérkeztetek' : 'Várakozás a visszaigazolásra')}
              {status === 'completed' && 'Lezárva'}
            </div>

            <div className="shrink-0">
              {status === 'chatting' && (
                <button disabled={busy} onClick={() => handleUpdateStatus('agreed')} className="bg-pilis text-white text-xs font-bold px-3 py-1.5 rounded-xl">
                  Megállapodtunk
                </button>
              )}
              {status === 'agreed' && (
                <button disabled={busy} onClick={() => handleUpdateStatus('started')} className="bg-pilis text-white text-xs font-bold px-3 py-1.5 rounded-xl">
                  Elindultam
                </button>
              )}
              {status === 'started' && (
                <button disabled={busy} onClick={() => handleUpdateStatus('arrived')} className="bg-terracotta text-white text-xs font-bold px-3 py-1.5 rounded-xl">
                  Megérkeztem
                </button>
              )}
              {status === 'arrived' && isRequester && (
                <button disabled={busy} onClick={handleGiveKudos} className="bg-emerald-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow">
                  Segített nekem
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm ${
                m.is_system_event
                  ? 'mx-auto bg-emerald-50 text-emerald-900 text-xs font-semibold text-center border border-emerald-200'
                  : m.sender_id === currentUser?.id
                  ? 'ml-auto bg-pilis text-white rounded-br-sm'
                  : 'bg-white text-[#18261F] border border-[#DFD9CE] rounded-bl-sm'
              }`}
            >
              {m.body}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-4 pb-2">
          {quickReplies.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => sendMessage(q)}
              className="shrink-0 text-xs bg-white border border-[#DFD9CE] px-3 py-1.5 rounded-full hover:border-pilis"
            >
              {q}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-[#DFD9CE] flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Üzenet írása..."
            className="flex-1 min-w-0 bg-limestone border border-[#DFD9CE] rounded-full px-4 py-2.5 text-base focus:outline-none focus:border-pilis"
          />
          <button type="submit" className="shrink-0 bg-pilis text-white font-bold text-sm px-5 py-2.5 rounded-full">
            Küldés
          </button>
        </form>
      </div>
    </div>
  );
}

