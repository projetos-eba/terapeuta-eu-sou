"use client";

import { useEffect } from "react";

import {
  getSessionMarkerStorageKey,
  getSessionMarkerTabStorageKey,
  readSessionMarkerCookie,
  type AuthenticatedRole,
} from "@/lib/auth/session-marker";

export function AuthSessionGuard({
  loginHref,
  role,
}: {
  loginHref: string;
  role: AuthenticatedRole;
}) {
  useEffect(() => {
    const tabKey = getSessionMarkerTabStorageKey(role);
    const sharedKey = getSessionMarkerStorageKey(role);
    let redirected = false;

    const redirectToLogin = () => {
      if (redirected) return;
      redirected = true;
      window.location.assign(`${loginHref}?reason=session_changed`);
    };

    const reconcile = () => {
      const cookieMarker = readSessionMarkerCookie(role);
      const tabMarker = window.sessionStorage.getItem(tabKey);

      if (tabMarker && tabMarker !== cookieMarker) {
        redirectToLogin();
        return;
      }

      if (!cookieMarker) {
        if (tabMarker) redirectToLogin();
        return;
      }

      if (!tabMarker) {
        window.sessionStorage.setItem(tabKey, cookieMarker);
      }

      if (window.localStorage.getItem(sharedKey) !== cookieMarker) {
        window.localStorage.setItem(sharedKey, cookieMarker);
      }
    };

    reconcile();

    const onStorage = (event: StorageEvent) => {
      if (event.key !== sharedKey) return;
      const currentMarker = window.sessionStorage.getItem(tabKey);
      if (!event.newValue || event.newValue !== currentMarker) {
        redirectToLogin();
      }
    };
    const onFocus = () => reconcile();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") reconcile();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loginHref, role]);

  return null;
}
