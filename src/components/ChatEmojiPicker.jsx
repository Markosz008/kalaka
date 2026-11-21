import React from 'react';

const CHAT_EMOJIS = [
  '😊', '😄', '😅', '🙏', '👍', '👌', '👋', '🤝',
  '❤️', '👏', '🚗', '📍', '⏱️', '✅', '🎉', '🙌',
  '😉', '😎', '🤔', '🏃', '☕', '🌧️', '☀️', '🐾'
];

export default function ChatEmojiPicker({ onSelect, onClose }) {
  return (
    <div className="bg-white border-t border-[#DFD9CE] px-3 py-2.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-[#5C6B62]">Hangulatjelek</span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-bold text-[#5C6B62] hover:text-black px-1.5 py-0.5"
        >
          Bezárás ✕
        </button>
      </div>
      <div className="grid grid-cols-8 gap-1">
        {CHAT_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSelect(emoji)}
            className="h-9 rounded-xl text-xl flex items-center justify-center hover:bg-limestone active:scale-95 transition"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
