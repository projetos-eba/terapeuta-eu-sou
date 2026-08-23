export type AuthenticatedRole = "admin" | "patient" | "therapist";

export function getSessionMarkerCookieName(role: AuthenticatedRole) {
  return `tes_${role}_session_marker`;
}

export function getSessionMarkerStorageKey(role: AuthenticatedRole) {
  return `tes:auth-session:${role}`;
}

export function getSessionMarkerTabStorageKey(role: AuthenticatedRole) {
  return `tes:auth-session-tab:${role}`;
}

export function readSessionMarkerCookie(role: AuthenticatedRole) {
  if (typeof document === "undefined") return null;

  const name = `${encodeURIComponent(getSessionMarkerCookieName(role))}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(name));

  return cookie ? decodeURIComponent(cookie.slice(name.length)) : null;
}

export function announceAuthSession(role: AuthenticatedRole) {
  if (typeof window === "undefined") return;

  const marker = readSessionMarkerCookie(role);
  if (!marker) return;

  window.sessionStorage.setItem(getSessionMarkerTabStorageKey(role), marker);
  window.localStorage.setItem(getSessionMarkerStorageKey(role), marker);
}
