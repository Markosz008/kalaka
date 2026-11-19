import React from 'react';

export default function KalakaLogo({ className = 'w-16 h-16', onClick }) {
  return (
    <svg
      className={className}
      onClick={onClick}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Háttér kerekített négyzet */}
      <rect width="512" height="512" rx="128" fill="#1c3a27" />
      
      {/* Vékony belső kontúr elhagyva a maximális minimalizmusért, de a K-formák precízen pozicionálva */}
      {/* Bal oldali szár - házikóként megnyújtva és tetővel ellátva */}
      <path
        d="M160 376V144C160 144 186 144 186 144V376H160Z"
        fill="#f4f1ea"
      />
      {/* Háztető (Roof) */}
      <path
        d="M130 220L225 125L265 165L245 185L225 165L160 230V240L130 220Z"
        fill="#f4f1ea"
      />
      {/* Jobb oldali ág - átlós szár */}
      <path
        d="M196 260L330 140H365L232 292L196 260Z"
        fill="#f4f1ea"
      />
      {/* Jobb oldali ág - útvonal/kanyar (route curve) */}
      <path
        d="M245 285L335 375C350 390 385 365 385 340V300H360V340C360 345 350 350 345 345L270 270L245 285Z"
        fill="#f4f1ea"
      />
      {/* Terrakotta helyszín-pin (Map Pin) */}
      <path
        d="M340 228C315 228 300 245 300 268C300 295 340 338 340 338C340 338 380 295 380 268C380 245 365 228 340 228ZM340 258C332.8 258 327 252.2 327 245C327 237.8 332.8 232 340 232C347.2 232 353 237.8 353 245C353 252.2 347.2 258 340 258Z"
        fill="#c05334"
      />
    </svg>
  );
}
