import React, { useState } from 'react';

export default function LegalModal({ isOpen, onClose }) {
  const [tab, setTab] = useState('aszf');

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="ÁSZF, Házirend, Adatkezelési tájékoztató és Impresszum"
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
              Kaláka Szentendre • Hatályos: 2026. november 20-tól
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-[#ECE7DC] p-1 rounded-xl text-[11px] font-bold shrink-0">
          {[
            ['aszf', 'ÁSZF & Házirend'],
            ['gdpr', 'Adatkezelés'],
            ['cookies', 'Sütik'],
            ['impresszum', 'Impresszum & DSA']
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`py-2 px-1.5 rounded-lg transition truncate ${
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
                  A <strong>Kaláka Szentendre</strong> egy ingyenes, nem üzletszerű helyi közösségi információs felület, amely az elektronikus kereskedelmi szolgáltatásokról szóló <strong>2001. évi CVIII. törvény (Ekertv.)</strong> és az EU <strong>2022/2065 (DSA)</strong> rendelete szerinti <strong>tárhelyszolgáltatónak / közvetítő szolgáltatónak</strong> minősül. Az üzemeltető kizárólag a technikai felületet biztosítja, nem válik részévé a felhasználók közötti megállapodásoknak. A felületet kizárólag <strong>18. életévüket betöltött</strong> személyek használhatják.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-1.5">
                <div className="font-bold text-sm text-pilis">
                  2. Telekocsi (Utak) felelősségkizárás
                </div>
                <ul className="list-disc pl-4 space-y-1 text-[#5C6B62]">
                  <li>A felületen <strong>üzletszerű, haszonszerzési célú személyszállítás (2012. évi XLI. tv. szerinti engedélyköteles taxizás vagy fuvarozás) szigorúan tilos</strong>. Az utak kizárólag szomszédsági szívességi vagy önköltség-megosztásos alapon szervezhetők.</li>
                  <li>Az üzemeltető nem ellenőrzi a járművek műszaki állapotát, a KGFB érvényességét, sem a sofőrök jogosítványát. A profilon látható szentendrei helyi igazolás kizárólag helyi tartózkodást jelez, <strong>nem személyazonosság- vagy erkölcsi ellenőrzés</strong>.</li>
                  <li>Az együttutazásban mindenki saját felelősségére vesz részt. Az üzemeltető kizár minden felelősséget az elmaradt fuvarokból, késésekből, balesetekből, illetve személyi vagy vagyoni károkból eredő igényekkel szemben.</li>
                </ul>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-1.5">
                <div className="font-bold text-sm text-pilis">
                  3. Kaláka (Szívesség) és Helyi Szakik
                </div>
                <ul className="list-disc pl-4 space-y-1 text-[#5C6B62]">
                  <li><strong>Szomszédsági segítség és kölcsönadás:</strong> a lakosok közötti segítségnyújtás és eszközkölcsönzés a Ptk. szerinti szívességi használatnak minősül. A kölcsönadott tárgyak épségéért, visszaadásáért vagy a munkavégzés közbeni károkért az üzemeltető nem felel.</li>
                  <li><strong>Helyi Szakik könyvtár:</strong> a helyi lakosok által ajánlott, kizárólag nyilvánosan közzétett üzleti elérhetőségek gyűjteménye. A felület csak pozitív ajánlásokat kezel, negatív minősítésre nincs lehetőség. Az üzemeltető nem vizsgálja a szakemberek végzettségét vagy számlázási gyakorlatát; a megbízás kizárólag a megrendelő és a szakember között jön létre.</li>
                </ul>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-1.5">
                <div className="font-bold text-sm text-pilis">
                  4. Városi Radar, Értesítések és Közösségi Házirend
                </div>
                <ul className="list-disc pl-4 space-y-1 text-[#5C6B62]">
                  <li>A Városi Radar lakossági bejelentéseken alapuló, tájékoztató jellegű helyzetkép, a telefonos push értesítések pedig külső értesítési hálózatokon (Apple/Google/Mozilla) keresztül érkeznek; az adatok pontosságáért, illetve az értesítések késéséért vagy kimaradásáért az üzemeltető nem vállal felelősséget.</li>
                  <li><strong>Szigorúan tilos</strong> más személy rendszámát, nevét, arcképét vagy pontos lakcímét engedély nélkül közzétenni, illetve bűncselekménnyel gyanúsítani vagy zaklatni bárkit. Vészhelyzetben mindig a <strong>112</strong>-t hívd.</li>
                  <li>Meghiúsult találkozó vagy fuvar esetén a chatben a <strong>Lemondás</strong> gombbal jelezd a partnerednek. A házirendet sértő tartalmakat az üzemeltető eltávolíthatja, súlyos vagy ismétlődő jogsértés esetén a fiókot felfüggesztheti.</li>
                </ul>
              </div>
            </>
          )}

          {tab === 'gdpr' && (
            <>
              <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-1.5">
                <div className="font-bold text-sm text-pilis">
                  1. Adatkezelő és kezelt adatok (GDPR 6. és 13–14. cikk)
                </div>
                <p className="text-[#5C6B62]">
                  Adatkezelő: <strong>Kardos Márk</strong> (2000 Szentendre, Egres út 131/C; e-mail: <strong>info@kalakazz.hu</strong>).
                </p>
                <ul className="list-disc pl-4 space-y-1 text-[#5C6B62]">
                  <li><strong>Fiók, utak, kaláka, chat és radar jelzések</strong> (<em>szerződés teljesítése – 6. cikk (1) b</em>): e-mail cím (nem nyilvános), megjelenő név, városrész, opcionális bemutatkozás és autó megnevezés, közzétett bejegyzések és üzenetek. <em>Megőrzés:</em> a fiók törléséig; a Városi Radar jelzései 45 perc – 6 óra elteltével automatikusan lejárnak.</li>
                  <li><strong>Profilkép</strong> (<em>önkéntes hozzájárulás – 6. cikk (1) a; Ptk. 2:48. §</em>): a feltöltött arckép a többi belépett felhasználó számára látható. <em>Megőrzés:</em> cseréig vagy fióktörlésig.</li>
                  <li><strong>Helyadatok és élő GPS</strong> (<em>önkéntes hozzájárulás – 6. cikk (1) a</em>): a pontos házszámok a nyilvános kártyákon automatikusan maszkolva jelennek meg. Az élő GPS-megosztás csak külön gombnyomásra indul, és a fuvar lezárásakor („Megérkeztem”) azonnal törlődik.</li>
                  <li><strong>Telefonos push értesítések</strong> (<em>önkéntes hozzájárulás – 6. cikk (1) a</em>): az eszköz egyedi értesítési végpontja, a Web Push titkosítási kulcsok és a választott Városi Radar témák. Bármikor módosítható vagy kikapcsolható a <strong>Profilodban</strong>; kikapcsoláskor, kijelentkezéskor vagy fióktörléskor azonnal törlődik.</li>
                  <li><strong>Helyi Szakik nyilvános üzleti adatai</strong> (<em>jogos érdek – 6. cikk (1) f; GDPR 14. cikk</em>): helyi lakosok által megadott, a szolgáltató által nyilvánosan közzétett név, szakma, városrész és üzleti telefonszám. Az érintett vállalkozó a GDPR 21. cikke alapján bármikor kérheti adatlapja módosítását vagy azonnali törlését.</li>
                </ul>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-1.5">
                <div className="font-bold text-sm text-pilis">
                  2. Adatfeldolgozók és harmadik országba (USA) továbbítás
                </div>
                <ul className="list-disc pl-4 space-y-1 text-[#5C6B62]">
                  <li><strong>Supabase, Inc.:</strong> adatbázis, hitelesítés és profilkép-tárhely.</li>
                  <li><strong>Cloudflare, Inc.:</strong> webes tárhelyszolgáltatás (Cloudflare Pages), hálózati védelem és Web Push küldő szerverfunkció.</li>
                  <li><strong>Google LLC / Apple Inc. / Mozilla:</strong> opcionális Google-belépés, címkiegészítés (Google Places), valamint a bekapcsolt telefonos értesítések kézbesítése (APNs / FCM).</li>
                  <li><strong>Térkép- és útvonalszerverek:</strong> a böngésző a térkép és útvonal megjelenítéséhez közvetlenül hívja az OpenFreeMap, OpenStreetMap (Photon), OSRM és Esri szervereit — ezek technikai okból látják az IP-címedet, fiókadatot viszont nem kapnak.</li>
                  <li>Az EGT-n kívüli (USA) szolgáltatók felé történő adattovábbítás garanciája az <strong>EU–USA Adatvédelmi Keretrendszer (DPF)</strong> és az Európai Bizottság <strong>Általános Szerződési Feltételei (SCC)</strong>.</li>
                </ul>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-1.5">
                <div className="font-bold text-sm text-pilis">
                  3. Érintetti jogok, azonnali törlés és jogorvoslat
                </div>
                <p className="text-[#5C6B62]">
                  A GDPR 15–21. cikkei alapján kérhetsz hozzáférést, helyesbítést, törlést, korlátozást, adathordozhatóságot, tiltakozhatsz a jogos érdeken alapuló kezelés ellen, és bármikor visszavonhatod hozzájárulásodat. A <strong>Profilom</strong> ablak alján található <em>„Fiók és adatok végleges törlése”</em> gombbal azonnal törölheted a fiókodat, profilképedet, bejegyzéseidet és értesítéseidet.
                </p>
                <p className="text-[#5C6B62]">
                  <strong>Panasz és jogorvoslat:</strong> jogsérelem esetén a <strong>Nemzeti Adatvédelmi és Információszabadság Hatósághoz (NAIH)</strong> fordulhatsz (1055 Budapest, Falk Miksa u. 9–11.; levélcím: 1363 Budapest, Pf. 9.; e-mail: ugyfelszolgalat@naih.hu; www.naih.hu), illetve bírósági utat is igénybe vehetsz.
                </p>
              </div>
            </>
          )}

          {tab === 'cookies' && (
            <>
              <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-1.5">
                <div className="font-bold text-sm text-pilis">
                  Sütik és helyi böngészőtárolás (Eht. 155. §)
                </div>
                <p className="text-[#5C6B62]">
                  A Kaláka Szentendre <strong>nem használ reklám-, marketing- vagy analitikai követő sütiket</strong>, ezért nem jelenítünk meg süti-elfogadó sávot. Kizárólag a működéshez elengedhetetlen helyi tárolást használjuk a böngésződben:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-[#5C6B62]">
                  <li><strong>Bejelentkezési munkamenet (sb-*-auth-token):</strong> hogy ne léptessen ki minden oldalfrissítéskor.</li>
                  <li><strong>Saját beállítások és olvasottság (kalaka_routines_*, kalaka_read_*, kalaka_hidden_*, kalaka_*):</strong> elmentett szokásos útvonalaid, olvasott/elrejtett üzeneteid és helyi szűrőállapotok.</li>
                  <li><strong>Ideiglenes útvonal-gyorsítótár (osrm_v2_*):</strong> a térképi útvonal gyorsabb betöltéséhez, kizárólag az aktuális böngésző-munkamenet végéig.</li>
                  <li><strong>Service Worker és alkalmazás-gyorsítótár (sw.js / Cache API):</strong> a főképernyőre telepített (PWA) működéshez és a háttérben érkező telefonos értesítések fogadásához.</li>
                </ul>
                <p className="text-[#5C6B62]">
                  Ezeket a tárolt adatokat a böngésződ beállításaiban bármikor törölheted, fióktörléskor pedig az alkalmazás is eltávolítja őket.
                </p>
              </div>
            </>
          )}

          {tab === 'impresszum' && (
            <>
              <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-1.5">
                <div className="font-bold text-sm text-pilis">
                  1. Impresszum (Ekertv. 4. §)
                </div>
                <ul className="list-disc pl-4 space-y-1 text-[#5C6B62]">
                  <li><strong>Üzemeltető és adatkezelő:</strong> Kardos Márk (magánszemély, nem üzletszerű közösségi működtetés)</li>
                  <li><strong>Levelezési cím:</strong> 2000 Szentendre, Egres út 131/C</li>
                  <li><strong>Kapcsolat, adatvédelem és jogi bejelentések:</strong>{' '}
                    <a href="mailto:info@kalakazz.hu" className="text-pilis font-bold underline">
                      info@kalakazz.hu
                    </a>
                  </li>
                  <li><strong>Tárhelyszolgáltató:</strong> Cloudflare, Inc. (101 Townsend St, San Francisco, CA 94107, USA)</li>
                  <li><strong>Adatbázis-szolgáltató:</strong> Supabase, Inc. (970 Toa Payoh North #07-04, Singapore 318992)</li>
                </ul>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-[#DFD9CE] space-y-1.5">
                <div className="font-bold text-sm text-pilis">
                  2. Jogsértő tartalom bejelentése és adattörlés (EU DSA)
                </div>
                <p className="text-[#5C6B62]">
                  Ha bármelyik fülön (Utak, Kaláka, Városi Radar, Szakik vagy Chat) jogellenes, valótlan, személyiségi jogot sértő vagy adatvédelmi szempontból aggályos tartalmat találsz, jelezd a chat <strong>Jelentés</strong> gombjával, vagy írj közvetlenül ide:
                </p>
                <a
                  href="mailto:info@kalakazz.hu?subject=Kal%C3%A1ka%20Szentendre%20%E2%80%93%20Tartalom%20vagy%20adatlap%20bejelent%C3%A9se"
                  className="inline-block bg-limestone hover:bg-pilis-soft text-pilis font-bold px-3 py-2 rounded-xl border border-[#DFD9CE] transition"
                >
                  Bejelentés küldése e-mailben →
                </a>
                <p className="text-[#5C6B62]">
                  A bejelentéseket legfeljebb 72 órán belül kivizsgáljuk; jogos panasz esetén a tartalmat haladéktalanul eltávolítjuk, az érintett felhasználót pedig rövid indokolással értesítjük.
                </p>
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
