import React, { useState } from 'react';

export default function LegalModal({ isOpen, onClose }) {
  const [tab, setTab] = useState('aszf');

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="ÁSZF, Házirend és Adatkezelési tájékoztató"
      className="fixed inset-0 bg-black/60 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-limestone w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-3 border border-[#DFD9CE] shadow-2xl max-h-[90vh] flex flex-col box-border"
      >
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div>
            <h3 className="font-display font-extrabold text-lg text-[#18261F]">
              Jogi feltételek és Adatvédelem
            </h3>
            <p className="text-[11px] text-[#5C6B62]">
              Kaláka Szentendre • Hatályos: 2026. november 15-től
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-[#5C6B62] hover:text-black bg-white px-2.5 py-1.5 rounded-xl border border-[#DFD9CE] shrink-0"
          >
            Bezárás ✕
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1 bg-[#ECE7DC] p-1 rounded-xl text-xs font-bold shrink-0">
          {[
            ['aszf', 'ÁSZF & Felelősség'],
            ['gdpr', 'Adatkezelés (GDPR)'],
            ['cookies', 'Sütik & Házirend']
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`py-2 px-1 rounded-lg transition truncate ${
                tab === id ? 'bg-white text-pilis shadow-sm' : 'text-[#5C6B62]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto space-y-3 pr-1 text-xs text-[#18261F] leading-relaxed flex-1">
          {tab === 'aszf' && (
            <>
              <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-1.5">
                <div className="font-bold text-sm text-pilis">
                  1. A szolgáltatás jellege és közvetítői státusz
                </div>
                <p className="text-[#5C6B62]">
                  A <strong>Kaláka Szentendre</strong> egy helyi, nem üzletszerű közösségi információs felület, amely az elektronikus kereskedelmi szolgáltatásokról szóló <strong>2001. évi CVIII. törvény (Ekertv.)</strong>, valamint az EU Digitális Szolgáltatásokról szóló Rendelete (DSA) szerinti <strong>közvetítő szolgáltatónak</strong> minősül. Az üzemeltető kizárólag a technikai felületet biztosítja, a felhasználók által közzétett tartalmakért és megállapodásokért nem vállal felelősséget.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-1.5">
                <div className="font-bold text-sm text-pilis">
                  2. Telekocsi (Utak) felelősségkizárás
                </div>
                <ul className="list-disc pl-4 space-y-1 text-[#5C6B62]">
                  <li>A felületen <strong>üzletszerű személyszállítás (engedélyköteles taxizás vagy fuvarozás) nem végezhető</strong>. A meghirdetett utak szomszédsági szívességi alapon jönnek létre.</li>
                  <li>Az üzemeltető nem ellenőrzi a gépjárművek műszaki állapotát, a kötelező felelősségbiztosítás meglétét vagy a sofőrök vezetési jogosultságát.</li>
                  <li>Az üzemeltető kizár minden kártérítési felelősséget az elmaradt fuvarokból, késésekből, útközbeni balesetekből vagy személyi és vagyoni károkból eredő igényekkel szemben.</li>
                </ul>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-1.5">
                <div className="font-bold text-sm text-pilis">
                  3. Kaláka (Szívesség) és Helyi Szakemberek (Szakik)
                </div>
                <ul className="list-disc pl-4 space-y-1 text-[#5C6B62]">
                  <li><strong>Szomszédsági segítség és kölcsönadás:</strong> A lakosok közötti eszköz- vagy szerszámkölcsönzés a Ptk. szerinti szívességi használatnak minősül. A kölcsönadott tárgyak meghibásodásáért, elmaradt visszaadásáért vagy a munkavégzés közbeni balesetekért az üzemeltető nem felel.</li>
                  <li><strong>Szakemberkereső:</strong> A „Szakik” fülön szereplő szolgáltatók saját nevükben és felelősségükre hirdetnek. Az üzemeltető nem vizsgálja a szakemberek szakképesítését vagy számlázási gyakorlatát; a szerződés kizárólag a megrendelő és a szakember között jön létre.</li>
                </ul>
              </div>
            </>
          )}

          {tab === 'gdpr' && (
            <>
              <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-1.5">
                <div className="font-bold text-sm text-pilis">
                  1. Kezelt személyes adatok és jogalap (GDPR 6. cikk)
                </div>
                <ul className="list-disc pl-4 space-y-1 text-[#5C6B62]">
                  <li><strong>Fiókadatok (szerződés teljesítése – 6. cikk (1) b):</strong> e-mail cím (kizárólag belépéshez, nem nyilvános), választott megjelenő név, városrész, opcionális bemutatkozás és gépjármű megnevezés.</li>
                  <li><strong>Cím- és helyadatok (hozzájárulás – 6. cikk (1) a):</strong> a nyilvános kártyákon és a jóváhagyás előtti egyeztetésekben a pontos házszámok automatikusan maszkolva jelennek meg. Az élő GPS-pozíció kizárólag a felhasználó kifejezett gombnyomására aktiválódik, és a fuvar lezárásakor (`Megérkeztem`) azonnal törlődik az adatbázisból.</li>
                </ul>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-1.5">
                <div className="font-bold text-sm text-pilis">
                  2. Igénybe vett adatfeldolgozók és külső szolgáltatók
                </div>
                <ul className="list-disc pl-4 space-y-1 text-[#5C6B62]">
                  <li><strong>Supabase Inc.:</strong> adatbázis-kezelés és hitelesítés (titkosított csatornán).</li>
                  <li><strong>Cloudflare Inc.:</strong> statikus tárhelyszolgáltatás (Cloudflare Pages) és hálózati védelem.</li>
                  <li><strong>Térkép és címkereső API-k:</strong> a címkereséshez és útvonaltervezéshez a böngésző közvetlenül a Google Places API, az OpenStreetMap (Nominatim / Photon), az OSRM és az Esri térképszervereit hívja meg (személyes profiladatok átadása nélkül).</li>
                </ul>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-1.5">
                <div className="font-bold text-sm text-pilis">
                  3. Érintetti jogok és azonnali adattörlés
                </div>
                <p className="text-[#5C6B62]">
                  A GDPR 15–21. cikkei alapján jogosult vagy adataidhoz hozzáférni, azokat helyesbíteni vagy törölni. A <strong>Profilom</strong> ablak alján található <em>„Fiók és adatok végleges törlése”</em> gombbal bármikor, önkiszolgáló módon, azonnal törölheted a profilodat és az összes hozzád tartozó bejegyzést.
                </p>
              </div>
            </>
          )}

          {tab === 'cookies' && (
            <>
              <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-1.5">
                <div className="font-bold text-sm text-pilis">
                  1. Sütik (Cookies) és LocalStorage használata
                </div>
                <p className="text-[#5C6B62]">
                  A Kaláka Szentendre <strong>nem használ reklám-, marketing- vagy analitikai követő sütiket</strong>, ezért nem jelenítünk meg zavaró süti-elfogadó ablakokat. Kizárólag a működéshez elengedhetetlen technikai böngészőtárolást (`localStorage` / `sessionStorage`) használjuk:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-[#5C6B62]">
                  <li><strong>sb-*-auth-token:</strong> a bejelentkezett munkamenet fenntartása.</li>
                  <li><strong>kalaka_routines_*:</strong> a saját magad által rögzített szokásos útvonal helyi tárolása.</li>
                  <li><strong>kalaka_read_* / kalaka_hidden_*:</strong> az olvasott és elrejtett üzenetek állapota.</li>
                  <li><strong>osrm_v2_*:</strong> a térképi útvonalvonalak ideiglenes gyorsítótára a gyorsabb betöltésért.</li>
                </ul>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-1.5">
                <div className="font-bold text-sm text-pilis">
                  2. Közösségi házirend és panaszkezelés (DSA)
                </div>
                <ul className="list-disc pl-4 space-y-1 text-[#5C6B62]">
                  <li>A felületet csak <strong>18. életévüket betöltött</strong> személyek használhatják.</li>
                  <li>Ha egy megbeszélt út vagy találkozó meghiúsul, a chatben a <strong>Lemondás</strong> gombbal jelezd a partnerednek.</li>
                  <li>Jogellenes, valótlan vagy zaklató magatartás esetén a chat fejlécében található <strong>Jelentés</strong> gombbal küldhetsz bejelentést, amelyet az üzemeltető kivizsgál, és jogos panasz esetén a vétkes fiókot felfüggeszti.</li>
                </ul>
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full bg-pilis hover:bg-pilis-light text-white font-bold text-xs py-3 rounded-xl shrink-0 transition"
        >
          Elolvastam, bezárás
        </button>
      </div>
    </div>
  );
}
