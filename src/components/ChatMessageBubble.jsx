import React from 'react';

export default function ChatMessageBubble({
  message,
  isOwn,
  isMenuOpen,
  isBeingEdited,
  isConfirmingDelete,
  onToggleMenu,
  onStartEdit,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete
}) {
  if (message.is_system_event) {
    return (
      <div className="max-w-[85%] mx-auto px-3.5 py-2 rounded-2xl bg-emerald-50 text-emerald-900 text-xs font-semibold text-center border border-emerald-200">
        {message.body}
      </div>
    );
  }

  const isDeleted = Boolean(message.deleted_at);
  const canModify = isOwn && !isDeleted;

  return (
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
      <div
        role={canModify ? 'button' : undefined}
        tabIndex={canModify ? 0 : undefined}
        onClick={canModify ? onToggleMenu : undefined}
        onKeyDown={
          canModify
            ? (ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault();
                  onToggleMenu();
                }
              }
            : undefined
        }
        title={canModify ? 'Koppints a szerkesztéshez vagy törléshez' : undefined}
        className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm break-words transition ${
          isDeleted
            ? 'bg-[#ECE7DC] text-[#5C6B62] italic border border-[#DFD9CE]'
            : isOwn
            ? `bg-pilis text-white rounded-br-sm cursor-pointer ${
                isBeingEdited || isMenuOpen ? 'ring-2 ring-pilis/40 ring-offset-1' : ''
              }`
            : 'bg-white text-[#18261F] border border-[#DFD9CE] rounded-bl-sm'
        }`}
      >
        <span>{isDeleted ? 'Üzenet törölve' : message.body}</span>
        {!isDeleted && message.edited_at && (
          <span
            className={`block text-[10px] mt-0.5 ${
              isOwn ? 'text-white/70 text-right' : 'text-[#5C6B62]'
            }`}
          >
            szerkesztve
          </span>
        )}
      </div>

      {canModify && isMenuOpen && (
        <div className="mt-1 flex items-center gap-1.5 text-[11px]">
          {isConfirmingDelete ? (
            <>
              <span className="text-[#5C6B62] font-semibold">Törlöd?</span>
              <button
                type="button"
                onClick={onConfirmDelete}
                className="px-2.5 py-1 rounded-lg bg-red-700 text-white font-bold"
              >
                Igen
              </button>
              <button
                type="button"
                onClick={onCancelDelete}
                className="px-2 py-1 rounded-lg bg-white border border-[#DFD9CE] text-[#5C6B62] font-bold"
              >
                Mégse
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onStartEdit}
                className="px-2.5 py-1 rounded-lg bg-white border border-[#DFD9CE] text-[#18261F] font-bold hover:border-pilis"
              >
                Szerkesztés
              </button>
              <button
                type="button"
                onClick={onRequestDelete}
                className="px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700 font-bold hover:bg-red-100"
              >
                Törlés
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
