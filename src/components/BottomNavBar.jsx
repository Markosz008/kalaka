import React from 'react';

export default function BottomNavBar({
  activeTab,
  setActiveTab,
  unreadCount,
  actionRequiredCount,
  onOpenNewModal
}) {
  const tabBtnClass = (isActive) =>
    `py-2 text-[11px] font-bold border-t-2 transition flex flex-col items-center gap-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pilis ${
      isActive ? 'border-pilis text-pilis' : 'border-transparent text-[#5C6B62]'
    }`;

  return (
    <nav
      aria-label="Fő navigáció"
      className="fixed bottom-0 inset-x-0 md:max-w-xl md:mx-auto bg-white/95 backdrop-blur border-t md:border-x md:rounded-t-2xl md:shadow-lg border-[#DFD9CE] pb-[env(safe-area-inset-bottom)] z-30"
    >
      <div className="max-w-xl mx-auto grid grid-cols-5 items-center">
        <button
          type="button"
          onClick={() => setActiveTab('rides')}
          className={tabBtnClass(activeTab === 'rides')}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2" />
            <circle cx="6.5" cy="16.5" r="2.5" />
            <circle cx="16.5" cy="16.5" r="2.5" />
          </svg>
          <span>Utak</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('favors')}
          className={tabBtnClass(activeTab === 'favors')}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
          <span>Kaláka</span>
        </button>

        <div className="flex justify-center py-1.5">
          <button
            type="button"
            aria-label="Új kiírás létrehozása"
            onClick={onOpenNewModal}
            className="bg-terracotta hover:bg-[#b55538] text-white font-display font-extrabold text-xs px-4 py-2 rounded-full shadow-md transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-terracotta"
          >
            + Új
          </button>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('messages')}
          className={`relative ${tabBtnClass(activeTab === 'messages')}`}
        >
          <div className="relative">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {(unreadCount > 0 || actionRequiredCount > 0) && (
              <span className="absolute -top-1.5 -right-3 bg-terracotta text-white text-[9px] font-extrabold px-1.5 rounded-full leading-tight">
                {unreadCount > 0 ? unreadCount : `${actionRequiredCount}!`}
              </span>
            )}
          </div>
          <span>Üzenet</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pros')}
          className={tabBtnClass(activeTab === 'pros')}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
          <span>Szakik</span>
        </button>
      </div>
    </nav>
  );
}
