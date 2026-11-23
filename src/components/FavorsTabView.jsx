import React from 'react';
import { supabase } from '../lib/supabase.js';
import KalakaQuickComposer from './KalakaQuickComposer.jsx';
import FavorCard from './FavorCard.jsx';

const FavorsMap = React.lazy(() => import('./FavorsMap.jsx'));

export default function FavorsTabView({
  favors,
  myAgreements,
  kudosCountByUser,
  session,
  profile,
  onOpenAuthModal,
  onInspectUser,
  onStartFavorAgreement,
  onEditFavor,
  onDeleteFavor,
  onRefreshData,
  showNotice
}) {
  return (
    <>
      <KalakaQuickComposer
        userZone={profile?.zone || 'Pismány'}
        onSubmitFavor={async ({ title, description, validMins, minHearts }) => {
          if (!session?.user) {
            onOpenAuthModal();
            return false;
          }
          const expIso = new Date(Date.now() + validMins * 60 * 1000).toISOString();
          const { error } = await supabase.from('favors').insert({
            user_id: session.user.id,
            title,
            description,
            zone: profile?.zone || 'Pismány',
            min_favor_hearts: minHearts,
            expires_at: expIso
          });
          if (error) {
            showNotice(`Mentési hiba: ${error.message}`, 'err');
            return false;
          }
          showNotice('Kaláka-kiírás közzétéve ✓');
          await onRefreshData(session.user.id);
          return true;
        }}
      />

      <React.Suspense fallback={<div className="h-14 rounded-2xl bg-[#EAE5DC] border border-[#DFD9CE]" />}>
        <FavorsMap favors={favors} onSelectFavor={onStartFavorAgreement} />
      </React.Suspense>

      {favors.length === 0 ? (
        <div className="bg-white rounded-2xl p-5 text-center border border-[#DFD9CE]">
          <div className="text-sm font-bold text-[#18261F]">
            Még nincs aktív Kaláka-kérés.
          </div>
        </div>
      ) : (
        favors.map((fav) => (
          <FavorCard
            key={fav.id}
            favor={fav}
            hasExistingAgreement={myAgreements.some((a) => a.favor_id === fav.id)}
            kudosCount={kudosCountByUser[fav.user_id] || 0}
            onInspectUser={onInspectUser}
            currentUserId={session?.user?.id || profile.id}
            currentUserZone={profile?.zone || ''}
            userFavorHearts={profile.favor_hearts}
            onStartFavorAgreement={onStartFavorAgreement}
            onEditFavor={onEditFavor}
            onDeleteFavor={onDeleteFavor}
          />
        ))
      )}
    </>
  );
}
