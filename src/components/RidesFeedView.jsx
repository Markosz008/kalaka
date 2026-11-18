import React from 'react';
import SzentendrePulseBar from './SzentendrePulseBar.jsx';
import RideCard from './RideCard.jsx';
import { resolveCoordsFromText } from '../constants/szentendreData.js';

export default function RidesFeedView({
  nowTick,
  profile,
  session,
  rides,
  filteredRides,
  activeTimeRides,
  displayedRides,
  showingCityFallbackRides,
  initialLoading,
  rideKindFilter,
  setRideKindFilter,
  filterFrom,
  setFilterFrom,
  filterTo,
  setFilterTo,
  fromCoords,
  setFromCoords,
  toCoords,
  setToCoords,
  savedPlaces,
  personalRoutines,
  hasRouteFilter,
  hasBothRouteEnds,
  onClearRouteInputs,
  setInlineSeats,
  setInlineComposerMode,
  showMap,
  setShowMap,
  selectedRideForMap,
  setSelectedRideForMap,
  myAgreements,
  kudosCountByUser,
  onInspectUser,
  onStartRideAgreement,
  onEditRide,
  onDeleteRide,
  onOpenNewRideModal
}) {
  return (
    <>
      <SzentendrePulseBar
        nowTick={nowTick}
        userZone={profile?.zone || 'Pismány'}
        rides={rides}
        onSelectHevRoute={async (zoneName, direction = 'to_hev') => {
          const hevLabel = 'Szentendre HÉV-végállomás';
          const hevCoords = resolveCoordsFromText(hevLabel);
          const isHevText = (t) => {
            const low = (t || '').toLowerCase();
            return low.includes('hév') || low.includes('hev') || low.includes('állomás');
          };

          const typedHomeText =
            direction === 'from_hev'
              ? filterTo && !isHevText(filterTo)
                ? filterTo.trim()
                : ''
              : filterFrom && !isHevText(filterFrom)
              ? filterFrom.trim()
              : '';
          const typedHomeCoords = direction === 'from_hev' ? toCoords : fromCoords;

          const savedHome = savedPlaces.find((p) => !isHevText(p.label));
          const routineHome = personalRoutines
            .map((r) =>
              !isHevText(r.origin)
                ? { label: r.origin, coords: r.originCoords }
                : !isHevText(r.dest)
                ? { label: r.dest, coords: r.destCoords }
                : null
            )
            .find(Boolean);

          let homeLabel =
            typedHomeText || savedHome?.label || routineHome?.label || '';
          let homeCoords =
            typedHomeCoords ||
            (savedHome?.lat && savedHome?.lng
              ? { lat: Number(savedHome.lat), lng: Number(savedHome.lng) }
              : null) ||
            routineHome?.coords ||
            (homeLabel ? resolveCoordsFromText(homeLabel) : null);

          const applyHevFields = (finalLabel, finalCoords) => {
            if (direction === 'from_hev') {
              setFilterFrom(hevLabel);
              setFromCoords(hevCoords);
              setFilterTo(finalLabel);
              setToCoords(finalCoords);
            } else {
              setFilterFrom(finalLabel);
              setFromCoords(finalCoords);
              setFilterTo(hevLabel);
              setToCoords(hevCoords);
            }
          };

          setInlineSeats(1);
          setInlineComposerMode('ask');
          setShowMap(true);

          if (homeLabel) {
            applyHevFields(homeLabel, homeCoords || resolveCoordsFromText(homeLabel));
            return;
          }

          const fallbackLabel = `Szentendre, ${zoneName}`;
          const fallbackCoords = resolveCoordsFromText(zoneName);
          applyHevFields(fallbackLabel, fallbackCoords);

          if (typeof navigator !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              async (pos) => {
                const { latitude: lat, longitude: lng } = pos.coords;
                let gpsLabel = `${fallbackLabel} (aktuális helyzet)`;
                try {
                  const res = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=hu`
                  );
                  const data = await res.json();
                  const addr = data?.address || {};
                  const city = addr.city || addr.town || addr.village || 'Szentendre';
                  const road = addr.road || addr.pedestrian || addr.suburb || '';
                  const house = addr.house_number ? ` ${addr.house_number}.` : '';
                  if (road) gpsLabel = `${city}, ${road}${house}`;
                } catch {}
                applyHevFields(gpsLabel, { lat, lng });
              },
              () => {},
              { enableHighAccuracy: true, timeout: 6000 }
            );
          }
        }}
        onSelectRide={(rideObj) => {
          setSelectedRideForMap(rideObj);
          setShowMap(true);
        }}
      />

      <div className="flex items-center justify-between gap-1.5 bg-white p-1 rounded-xl border border-[#DFD9CE] shadow-sm">
        {[
          ['all', `Minden út (${filteredRides.length})`],
          ['offer', `Van hely (${filteredRides.filter((r) => r.kind === 'offer').length})`],
          ['ask', `Utat keres (${filteredRides.filter((r) => r.kind === 'ask').length})`]
        ].map(([k, lbl]) => (
          <button
            key={k}
            type="button"
            onClick={() => setRideKindFilter(k)}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition ${
              rideKindFilter === k
                ? 'bg-pilis text-white shadow-sm'
                : 'text-[#5C6B62] hover:text-[#18261F]'
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>

      {showingCityFallbackRides && (
        <div className="bg-pilis-soft/60 border border-pilis/20 rounded-xl px-3.5 py-2 flex items-center justify-between gap-2 text-xs text-[#18261F]">
          <span>
            Erre a pontos szakaszra most nincs kiírt út — mutatjuk a többi{' '}
            <strong>{activeTimeRides.length} aktív szentendrei utat</strong>.
          </span>
          <button
            type="button"
            onClick={onClearRouteInputs}
            className="shrink-0 font-bold text-pilis underline"
          >
            Keresés törlése
          </button>
        </div>
      )}

      {initialLoading ? (
        <div className="space-y-2.5">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="bg-white rounded-2xl p-4 border border-[#DFD9CE] animate-pulse space-y-3"
            >
              <div className="flex justify-between">
                <div className="h-6 w-24 bg-[#ECE7DC] rounded-lg" />
                <div className="h-6 w-16 bg-[#ECE7DC] rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-3/4 bg-[#ECE7DC] rounded" />
                <div className="h-4 w-2/3 bg-[#ECE7DC] rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : displayedRides.length === 0 ? (
        <div className="bg-white rounded-2xl p-5 sm:p-6 text-center border border-[#DFD9CE] space-y-2.5">
          <div className="text-sm font-bold text-[#18261F]">
            {hasRouteFilter || rideKindFilter !== 'all'
              ? 'Nincs aktív út erre a szűrésre.'
              : 'Még nincs kiírt út a következő órákra.'}
          </div>
          <p className="text-xs text-[#5C6B62] leading-relaxed">
            {hasRouteFilter || rideKindFilter !== 'all'
              ? 'Válts vissza az összes útra, vagy töröld a keresést.'
              : 'Indulsz valahová Szentendrén belül vagy a HÉV-hez? Írd ki 10 másodperc alatt!'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            {(hasRouteFilter || rideKindFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  onClearRouteInputs();
                  setRideKindFilter('all');
                }}
                className="bg-limestone hover:bg-[#E5DFD3] text-[#18261F] border border-[#DFD9CE] font-bold text-xs px-3.5 py-2 rounded-xl"
              >
                Szűrés törlése
              </button>
            )}
            {!hasBothRouteEnds && (
              <button
                type="button"
                onClick={onOpenNewRideModal}
                className="bg-pilis text-white font-bold text-xs px-4 py-2 rounded-xl"
              >
                + Útvonal kiírása
              </button>
            )}
          </div>
        </div>
      ) : (
        displayedRides.map((ride) => (
          <RideCard
            key={ride.id}
            ride={ride}
            hasExistingAgreement={myAgreements.some((a) => a.ride_id === ride.id)}
            kudosCount={kudosCountByUser[ride.user_id] || 0}
            onInspectUser={onInspectUser}
            currentUserId={session?.user?.id || profile.id}
            onStartAgreement={onStartRideAgreement}
            isSelectedOnMap={Boolean(showMap && selectedRideForMap?.id === ride.id)}
            onShowOnMap={(r) => {
              if (showMap && selectedRideForMap?.id === r.id) {
                setSelectedRideForMap(null);
                setShowMap(false);
              } else {
                setSelectedRideForMap(r);
                setShowMap(true);
              }
            }}
            onEditRide={onEditRide}
            onDeleteRide={onDeleteRide}
          />
        ))
      )}
    </>
  );
}
