import React from 'react';

export default function LegalModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Házirend és Adatkezelési tájékoztató"
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-limestone w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-3.5 border border-[#DFD9CE] shadow-2xl max-h-[88vh] overflow-y-auto box-border"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display font-extrabold text-lg text-[#18261F]">
            Házirend és Adatvédelem (GDPR)
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-[#5C6B62] hover:text-black bg-white px-2.5 py-1.5 rounded-xl border border-[#DFD9CE]"
          >
            Bezárás ✕
          </button>
        </div>

        <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-2 text-xs text-[#18261F] leading-relaxed">
          <div className="font-bold text-sm text-pilis">
            1. Közösségi alapelvek (Kaláka Szentendre)
          </div>
          <p>
            A Kaláka Szentendre egy helyi, szívességi alapú szomszédsági közösség, nem üzletszerű személyszállító vagy fuvarozó szolgáltatás. A felületen a szentendrei lakosok saját útjaikat vagy szomszédsági segítségkéréseiket oszthatják meg egymással.
          </p>
          <ul className="list-disc pl-4 space-y-1 text-[#5C6B62]">
            <li>A pontos házszámok a nyilvános kártyákon automatikusan rejtve maradnak, csak az utcanév látszik.</li>
            <li>A megbeszélt időpontokat tartsd be; ha közbejön valami, a chatben a „Lemondás” gombbal jelezd időben.</li>
            <li>Valótlan vagy zaklató bejegyzés a közösségből való felfüggesztést vonja maga után.</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-2 text-xs text-[#18261F] leading-relaxed">
          <div className="font-bold text-sm text-pilis">
            2. Adatkezelés és technikai biztonság
          </div>
          <ul className="list-disc pl-4 space-y-1 text-[#5C6B62]">
            <li><strong>Kezelt adatok:</strong> e-mail cím (belépéshez), megjelenő becenév/keresztnév, választott szentendrei városrész, opcionális bemutatkozás és gépjármű megnevezés.</li>
            <li><strong>Helyadatok (GPS):</strong> kizárólag a felhasználó kifejezett gombnyomására (pl. indulási pont kitöltése vagy aktív út alatti helyzetmegosztás) használjuk, az út lezárásakor (`arrived`) a koordináták automatikusan törlődnek.</li>
            <li><strong>Harmadik fél:</strong> az oldal nem használ reklámkövető sütiket vagy külső betűtípus-szervereket.</li>
            <li><strong>Adattörlés joga:</strong> saját profilodban (jobb felső sarok) bármikor, egyetlen gombnyomással véglegesen törölheted a fiókodat és minden hozzád tartozó hirdetést.</li>
          </ul>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full bg-pilis text-white font-bold text-xs py-3 rounded-xl"
        >
          Rendben, értem
        </button>
      </div>
    </div>
  );
}
