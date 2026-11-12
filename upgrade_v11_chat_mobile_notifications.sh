#!/bin/bash
set -e

python3 - << 'EOF_PATCH'
# 1. AgreementChatModal.jsx: teljes képernyős mobil nézet (100dvh + safe-area) és tiszta fejléc
with open("src/components/AgreementChatModal.jsx", "r", encoding="utf-8") as f:
    chat_code = f.read()

old_wrapper = """  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-limestone w-full max-w-lg h-[92vh] sm:h-[660px] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl border border-[#DFD9CE] pb-[env(safe-area-inset-bottom)]">"""

new_wrapper = """  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-limestone w-full max-w-lg h-[100dvh] sm:h-[660px] rounded-none sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl border-0 sm:border sm:border-[#DFD9CE] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">"""

assert old_wrapper in chat_code, "old_wrapper not found in AgreementChatModal.jsx"
chat_code = chat_code.replace(old_wrapper, new_wrapper)

with open("src/components/AgreementChatModal.jsx", "w", encoding="utf-8") as f:
    f.write(chat_code)

# 2. App.jsx: olvasatlan üzenet számláló (piros badge), felugró értesítés (toast), hang/rezgés és lezárt beszélgetés elrejtése
with open("src/App.jsx", "r", encoding="utf-8") as f:
    app_code = f.read()

# Segédfüggvények beszúrása az App komponens elé
helper_block = """function getReadTimestamps(userId) {
  if (!userId) return {};
  try {
    return JSON.parse(localStorage.getItem(`kalaka_read_${userId}`) || '{}');
  } catch {
    return {};
  }
}

function markAgreementReadStorage(userId, agreementId) {
  if (!userId || !agreementId) return;
  try {
    const map = getReadTimestamps(userId);
    map[agreementId] = new Date().toISOString();
    localStorage.setItem(`kalaka_read_${userId}`, JSON.stringify(map));
  } catch {}
}

function getHiddenAgreements(userId) {
  if (!userId) return [];
  try {
    return JSON.parse(localStorage.getItem(`kalaka_hidden_${userId}`) || '[]');
  } catch {
    return [];
  }
}

function playSoftNotificationTone() {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([120, 60, 120]);
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch {}
}

export default function App() {"""

if "function getReadTimestamps" not in app_code:
    app_code = app_code.replace("export default function App() {", helper_block)

# Új állapotok hozzáadása (toast értesítés + olvasottság frissítő tick + rejtett beszélgetések)
old_state_anchor = "  const [activeAgreement, setActiveAgreement] = useState(null);"
new_state_anchor = """  const [activeAgreement, setActiveAgreement] = useState(null);
  const [incomingToast, setIncomingToast] = useState(null);
  const [readVersion, setReadVersion] = useState(0);
  const [hiddenAgreementIds, setHiddenAgreementIds] = useState([]);"""

if "incomingToast" not in app_code:
    app_code = app_code.replace(old_state_anchor, new_state_anchor)

# Rejtett beszélgetések betöltése bejelentkezéskor
app_code = app_code.replace(
    "    if (data) setProfile(data);",
    "    if (data) {\n      setProfile(data);\n      setHiddenAgreementIds(getHiddenAgreements(data.id));\n    }"
)

# myAgreements lekérdezés kiegészítése az utolsó üzenettel (last_message, last_message_at, unread)
old_agr_select = """        .or(`requester_id.eq.${currentUserId},helper_id.eq.${currentUserId}`)
        .order('created_at', { ascending: false });

      if (agrRows) {
        setMyAgreements(
          agrRows.map((a) => {
            const isReq = a.requester_id === currentUserId;
            return {
              ...a,
              partner_name: a.pro
                ? a.pro.business_name
                : isReq
                ? a.helper?.display_name || 'Szomszéd'
                : a.requester?.display_name || 'Szomszéd',
              post_owner_id: a.ride?.user_id || a.helper_id,
              title: a.ride
                ? `${a.ride.origin_text} → ${a.ride.dest_text}`
                : a.pro
                ? a.pro.profession_name || 'Szakmai megkeresés'
                : a.favor?.title || 'Egyeztetés'
            };
          })
        );
      }"""

new_agr_select = """        .or(`requester_id.eq.${currentUserId},helper_id.eq.${currentUserId}`)
        .order('created_at', { ascending: false });

      if (agrRows) {
        const agrIds = agrRows.map((x) => x.id);
        let latestMsgByAgr = {};
        if (agrIds.length > 0) {
          const { data: recentMsgs } = await supabase
            .from('messages')
            .select('agreement_id, sender_id, body, created_at')
            .in('agreement_id', agrIds)
            .order('created_at', { ascending: false })
            .limit(80);
          (recentMsgs || []).forEach((m) => {
            if (!latestMsgByAgr[m.agreement_id]) {
              latestMsgByAgr[m.agreement_id] = m;
            }
          });
        }

        const readMap = getReadTimestamps(currentUserId);
        const mappedAgrs = agrRows.map((a) => {
          const isReq = a.requester_id === currentUserId;
          const lastMsg = latestMsgByAgr[a.id] || null;
          const lastActivityAt = lastMsg?.created_at || a.created_at;
          const lastReadAt = readMap[a.id];
          const isUnread = Boolean(
            lastMsg &&
            lastMsg.sender_id !== currentUserId &&
            (!lastReadAt || new Date(lastMsg.created_at) > new Date(lastReadAt))
          );

          return {
            ...a,
            partner_name: a.pro
              ? a.pro.business_name
              : isReq
              ? a.helper?.display_name || 'Szomszéd'
              : a.requester?.display_name || 'Szomszéd',
            post_owner_id: a.ride?.user_id || a.helper_id,
            title: a.ride
              ? `${a.ride.origin_text} → ${a.ride.dest_text}`
              : a.pro
              ? a.pro.profession_name || 'Szakmai megkeresés'
              : a.favor?.title || 'Egyeztetés',
            last_message_body: lastMsg?.body || '',
            last_activity_at: lastActivityAt,
            has_unread: isUnread
          };
        });

        mappedAgrs.sort(
          (x, y) => new Date(y.last_activity_at) - new Date(x.last_activity_at)
        );
        setMyAgreements(mappedAgrs);
      }"""

assert old_agr_select in app_code, "old_agr_select not found in App.jsx"
app_code = app_code.replace(old_agr_select, new_agr_select)

# Globális Realtime figyelő kiegészítése az új bejövő üzenetek azonnali értesítésére
old_channel = """      .on('postgres_changes', { event: '*', schema: 'public', table: 'agreements' }, () =>
        fetchAllLiveData(session?.user?.id)
      )"""

new_channel = """      .on('postgres_changes', { event: '*', schema: 'public', table: 'agreements' }, () =>
        fetchAllLiveData(session?.user?.id)
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const uid = session?.user?.id;
        const msg = payload.new;
        if (!uid || !msg) return;
        fetchAllLiveData(uid);
        if (msg.sender_id !== uid) {
          // Ha el volt rejtve a beszélgetés, újra megjelenítjük
          setHiddenAgreementIds((prev) => {
            if (!prev.includes(msg.agreement_id)) return prev;
            const next = prev.filter((id) => id !== msg.agreement_id);
            localStorage.setItem(`kalaka_hidden_${uid}`, JSON.stringify(next));
            return next;
          });
          playSoftNotificationTone();
          setIncomingToast({
            agreement_id: msg.agreement_id,
            body: msg.body
          });
        }
      })"""

assert old_channel in app_code, "old_channel not found in App.jsx"
app_code = app_code.replace(old_channel, new_channel)

# Olvasatlan szám kiszámítása és beszélgetés megnyitása / elrejtése
old_return = "  return (\n    <div className=\"w-full max-w-xl mx-auto min-h-screen pb-28 overflow-x-hidden\">"
new_return = """  const visibleAgreements = myAgreements.filter(
    (a) => !hiddenAgreementIds.includes(a.id) || a.has_unread
  );
  const unreadCount = visibleAgreements.filter((a) => a.has_unread).length;

  const handleOpenAgreement = (agr) => {
    if (session?.user?.id && agr?.id) {
      markAgreementReadStorage(session.user.id, agr.id);
      setReadVersion((v) => v + 1);
      setMyAgreements((prev) =>
        prev.map((item) =>
          item.id === agr.id ? { ...item, has_unread: false } : item
        )
      );
    }
    setIncomingToast(null);
    setActiveAgreement(agr);
  };

  const handleHideCompletedAgreement = (e, agrId) => {
    e.stopPropagation();
    const uid = session?.user?.id;
    if (!uid) return;
    const next = Array.from(new Set([...hiddenAgreementIds, agrId]));
    setHiddenAgreementIds(next);
    localStorage.setItem(`kalaka_hidden_${uid}`, JSON.stringify(next));
  };

  return (
    <div className="w-full max-w-xl mx-auto min-h-screen pb-28 overflow-x-hidden">
      {/* Felugró értesítés új bejövő üzenetkor (ha a chat nincs megnyitva) */}
      {incomingToast && activeAgreement?.id !== incomingToast.agreement_id && (
        <div
          onClick={() => {
            const target = myAgreements.find((a) => a.id === incomingToast.agreement_id);
            if (target) handleOpenAgreement(target);
            else {
              setActiveTab('messages');
              setIncomingToast(null);
            }
          }}
          className="fixed top-3 left-3 right-3 max-w-md mx-auto z-50 bg-[#18261F] text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-400/40 flex items-center justify-between gap-3 cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-terracotta animate-ping shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-emerald-300">
                Új üzenet érkezett
              </div>
              <div className="text-xs font-medium truncate">
                {incomingToast.body}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIncomingToast(null);
            }}
            className="text-xs font-bold text-white/70 hover:text-white px-1.5 shrink-0"
          >
            ✕
          </button>
        </div>
      )}"""

assert old_return in app_code, "old_return not found in App.jsx"
app_code = app_code.replace(old_return, new_return)

# Beszélgetéseim fül frissítése (olvasatlan pötty, utolsó üzenet, lezártak elrejtése)
old_msg_tab = """        {activeTab === 'messages' && (
          <div className="space-y-2.5">
            <h2 className="font-display font-extrabold text-lg">
              Beszélgetéseim ({myAgreements.length})
            </h2>
            {myAgreements.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center text-xs text-[#5C6B62] border border-[#DFD9CE]">
                Még nincs aktív beszélgetésed.
              </div>
            ) : (
              myAgreements.map((agr) => (
                <div
                  key={agr.id}
                  onClick={() => setActiveAgreement(agr)}
                  className="bg-white rounded-2xl p-4 border border-[#DFD9CE] shadow-sm flex items-center justify-between gap-3 cursor-pointer hover:border-pilis transition"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate">{agr.partner_name}</div>
                    <div className="text-xs text-[#5C6B62] truncate">{agr.title}</div>
                  </div>
                  <span className="shrink-0 text-xs font-bold bg-pilis-soft text-pilis px-3 py-1 rounded-full">
                    Megnyitás ›
                  </span>
                </div>
              ))
            )}
          </div>
        )}"""

new_msg_tab = """        {activeTab === 'messages' && (
          <div className="space-y-2.5">
            <h2 className="font-display font-extrabold text-lg">
              Beszélgetéseim ({visibleAgreements.length})
            </h2>
            {visibleAgreements.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center text-xs text-[#5C6B62] border border-[#DFD9CE]">
                Még nincs aktív beszélgetésed.
              </div>
            ) : (
              visibleAgreements.map((agr) => {
                const isDone = agr.status === 'completed' || agr.status === 'cancelled';
                return (
                  <div
                    key={agr.id}
                    onClick={() => handleOpenAgreement(agr)}
                    className={`bg-white rounded-2xl p-3.5 sm:p-4 border shadow-sm flex items-center justify-between gap-3 cursor-pointer transition ${
                      agr.has_unread
                        ? 'border-terracotta ring-1 ring-terracotta/30'
                        : 'border-[#DFD9CE] hover:border-pilis'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {agr.has_unread && (
                        <span className="w-2.5 h-2.5 rounded-full bg-terracotta mt-1.5 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-[#18261F] truncate">
                            {agr.partner_name}
                          </span>
                          {isDone && (
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full shrink-0">
                              Lezárva
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#5C6B62] truncate">
                          {agr.title}
                        </div>
                        {agr.last_message_body && (
                          <div
                            className={`text-xs mt-1 truncate ${
                              agr.has_unread
                                ? 'font-bold text-[#18261F]'
                                : 'text-[#5C6B62]'
                            }`}
                          >
                            {agr.last_message_body}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isDone && (
                        <button
                          type="button"
                          onClick={(e) => handleHideCompletedAgreement(e, agr.id)}
                          className="text-[11px] font-bold text-[#5C6B62] hover:text-red-700 bg-limestone px-2.5 py-1.5 rounded-xl border border-[#DFD9CE]"
                        >
                          Elrejtés
                        </button>
                      )}
                      <span
                        className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                          agr.has_unread
                            ? 'bg-terracotta text-white'
                            : 'bg-pilis-soft text-pilis'
                        }`}
                      >
                        {agr.has_unread ? 'Új üzenet' : 'Megnyitás ›'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}"""

assert old_msg_tab in app_code, "old_msg_tab not found in App.jsx"
app_code = app_code.replace(old_msg_tab, new_msg_tab)

# Alsó navigációs sávban piros olvasatlan jelvény az Üzenet fülön
old_nav_msg = """          <button
            onClick={() => setActiveTab('messages')}
            className={`py-3 text-xs font-bold border-t-2 transition truncate px-1 ${
              activeTab === 'messages'
                ? 'border-pilis text-pilis'
                : 'border-transparent text-[#5C6B62]'
            }`}
          >
            Üzenet{myAgreements.length ? ` (${myAgreements.length})` : ''}
          </button>"""

new_nav_msg = """          <button
            onClick={() => setActiveTab('messages')}
            className={`relative py-3 text-xs font-bold border-t-2 transition px-1 flex items-center justify-center gap-1 ${
              activeTab === 'messages'
                ? 'border-pilis text-pilis'
                : 'border-transparent text-[#5C6B62]'
            }`}
          >
            <span>Üzenet</span>
            {unreadCount > 0 && (
              <span className="bg-terracotta text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full leading-tight">
                {unreadCount}
              </span>
            )}
          </button>"""

assert old_nav_msg in app_code, "old_nav_msg not found in App.jsx"
app_code = app_code.replace(old_nav_msg, new_nav_msg)

# Chat bezárásakor is frissítsük az olvasottsági időbélyeget
old_chat_close = "        onClose={() => setActiveAgreement(null)}"
new_chat_close = """        onClose={() => {
          if (session?.user?.id && activeAgreement?.id) {
            markAgreementReadStorage(session.user.id, activeAgreement.id);
            setMyAgreements((prev) =>
              prev.map((x) =>
                x.id === activeAgreement.id ? { ...x, has_unread: false } : x
              )
            );
          }
          setActiveAgreement(null);
        }}"""

assert old_chat_close in app_code, "old_chat_close not found in App.jsx"
app_code = app_code.replace(old_chat_close, new_chat_close)

with open("src/App.jsx", "w", encoding="utf-8") as f:
    f.write(app_code)

print("App.jsx & AgreementChatModal.jsx updated successfully.")
EOF_PATCH
