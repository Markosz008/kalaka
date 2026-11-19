let deferredInstallPrompt = null;
const promptListeners = new Set();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    promptListeners.forEach((cb) => cb(true));
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    promptListeners.forEach((cb) => cb(false));
  });
}

export function onInstallPromptChange(cb) {
  promptListeners.add(cb);
  return () => promptListeners.delete(cb);
}

export function hasNativeInstallPrompt() {
  return Boolean(deferredInstallPrompt);
}

export async function triggerNativeInstall() {
  if (!deferredInstallPrompt) return false;
  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  promptListeners.forEach((cb) => cb(false));
  return choice?.outcome === 'accepted';
}

export function getDeviceInstallInfo() {
  if (typeof window === 'undefined') {
    return {
      isStandalone: false,
      isIOS: false,
      isAndroid: false,
      isInAppBrowser: false,
      supportsPush: false,
      permission: 'default'
    };
  }
  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isInAppBrowser = /FBAN|FBAV|Instagram|Messenger|Line\/|MicroMessenger/i.test(ua);
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator.standalone === true;
  const supportsPush =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const permission =
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';

  return { isStandalone, isIOS, isAndroid, isInAppBrowser, supportsPush, permission };
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out;
}

async function resolveVapidPublicKey() {
  try {
    const res = await fetch('/api/radar-push', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data?.publicKey) return String(data.publicKey).trim();
    }
  } catch {}
  return (import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim();
}

export async function getCurrentPushSubscription() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function subscribeToWebPush(supabase, userId, categories) {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Ezen a böngészőn nem érhető el a háttér-értesítés.');
  }

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    throw new Error('Az értesítések nincsenek engedélyezve a telefonon.');
  }

  const vapidPublicKey = await resolveVapidPublicKey();
  if (!vapidPublicKey) {
    throw new Error('Az értesítési kulcs nem érhető el a szerverről.');
  }

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });
  }

  const subJson = sub.toJSON();
  const p256dh = subJson?.keys?.p256dh;
  const auth = subJson?.keys?.auth;
  if (!subJson?.endpoint || !p256dh || !auth) {
    throw new Error('Nem sikerült kiolvasni az eszköz értesítési azonosítóját.');
  }

  const cats = Array.isArray(categories) && categories.length > 0
    ? categories
    : ['traffic', 'transit', 'utility', 'local'];

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: subJson.endpoint,
      p256dh,
      auth,
      categories: cats
    },
    { onConflict: 'endpoint' }
  );
  if (error) throw error;
  return sub;
}

export async function updatePushCategories(supabase, userId, endpoint, categories) {
  if (!supabase || !userId || !endpoint) return;
  const cats = categories.length > 0 ? categories : ['traffic'];
  const { error } = await supabase
    .from('push_subscriptions')
    .update({ categories: cats })
    .eq('user_id', userId)
    .eq('endpoint', endpoint);
  if (error) throw error;
}

export async function unsubscribeFromWebPush(supabase, userId) {
  const sub = await getCurrentPushSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => {});
    if (supabase && userId && endpoint) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', endpoint);
    }
  }
}

async function callRadarPushEndpoint(supabase, payload) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Bejelentkezés szükséges');
  const res = await fetch('/api/radar-push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || 'Nem sikerült elküldeni az értesítést');
  }
  return json;
}

export async function sendTestPush(supabase) {
  return callRadarPushEndpoint(supabase, { mode: 'test' });
}

export function triggerRadarPushIfNeeded(supabase, alertId) {
  if (!supabase || !alertId) return;
  callRadarPushEndpoint(supabase, { mode: 'alert', alert_id: alertId }).catch(() => {});
}
