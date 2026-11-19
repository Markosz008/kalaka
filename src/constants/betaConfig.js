export const BETA_INVITE_ONLY = true;

const PENDING_INVITE_KEY = 'kalaka_pending_invite_code';

export function getPendingInviteCode() {
  try {
    return (localStorage.getItem(PENDING_INVITE_KEY) || '').trim().toUpperCase();
  } catch {
    return '';
  }
}

export function savePendingInviteCode(code) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return;
  try {
    localStorage.setItem(PENDING_INVITE_KEY, clean);
  } catch {}
}

export function clearPendingInviteCode() {
  try {
    localStorage.removeItem(PENDING_INVITE_KEY);
  } catch {}
}

export function captureInviteFromUrl() {
  if (typeof window === 'undefined') return '';
  try {
    const url = new URL(window.location.href);
    const param = (url.searchParams.get('meghivo') || url.searchParams.get('invite') || '')
      .trim()
      .toUpperCase();
    if (!param) return '';
    savePendingInviteCode(param);
    url.searchParams.delete('meghivo');
    url.searchParams.delete('invite');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    return param;
  } catch {
    return '';
  }
}
