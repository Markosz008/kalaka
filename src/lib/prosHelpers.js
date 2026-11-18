export const VECTOR_STYLE_URL = 'https://tiles.openfreemap.org/styles/bright';

export const ENDORSEMENT_STRENGTH_TAGS = [
  'Pontos',
  'Szépen dolgozik',
  'Korrekt ár',
  'Segítőkész'
];

export const GROUP_ICON_SVGS = {
  otthon:
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  szepseg_egeszseg:
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  auto_muhely:
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>',
  kezmuves_gasztro:
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/></svg>',
  mozgas_oktatas:
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>'
};

export function registerMapCategoryIcons(map) {
  Object.entries(GROUP_ICON_SVGS).forEach(([key, svg]) => {
    const iconName = `cat-icon-${key}`;
    if (map.hasImage(iconName)) return;
    const img = new Image(32, 32);
    img.onload = () => {
      if (!map.hasImage(iconName)) {
        map.addImage(iconName, img, { pixelRatio: 2 });
      }
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

export function getSavedProIds(userId) {
  const key = `kalaka_fav_pros_${userId || 'guest'}`;
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

export function isLivePresenceActive(pro) {
  if (!pro?.live_until || !pro?.live_lat || !pro?.live_lng) return false;
  return new Date(pro.live_until).getTime() > Date.now();
}

export function formatRemainingLiveTime(liveUntil) {
  if (!liveUntil) return '';
  const diffMs = new Date(liveUntil).getTime() - Date.now();
  if (diffMs <= 0) return '';
  const mins = Math.ceil(diffMs / 60000);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h} óra ${m} p` : `${h} óra`;
  }
  return `${mins} perc`;
}

export function buildNavigationUrl(pro) {
  if (!pro) return null;
  const liveNow = isLivePresenceActive(pro);
  if (liveNow) {
    return `https://www.google.com/maps/dir/?api=1&destination=${pro.live_lat},${pro.live_lng}`;
  }
  if (pro.lat && pro.lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${pro.lat},${pro.lng}`;
  }
  if (pro.address_text && pro.address_text.trim()) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pro.address_text.trim())}`;
  }
  return null;
}
