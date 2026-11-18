import React, { useState } from 'react';

export default function AvatarBadge({
  src,
  name = 'S',
  sizeClass = 'w-8 h-8 text-xs',
  bgClass = 'bg-pilis text-white'
}) {
  const [broken, setBroken] = useState(false);
  const initial = (name || 'S').trim()[0]?.toUpperCase() || 'S';

  if (src && !broken) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setBroken(true)}
        className={`${sizeClass} rounded-full object-cover shrink-0 border border-black/10`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full ${bgClass} font-bold grid place-items-center shrink-0`}
    >
      {initial}
    </div>
  );
}
