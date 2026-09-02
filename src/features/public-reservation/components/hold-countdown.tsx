"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function formatRemaining(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function HoldCountdown({
  expiresAt,
  onExpire,
  serverNow,
}: {
  expiresAt: string;
  onExpire: () => void;
  serverNow: string;
}) {
  const offsetRef = useRef(new Date(serverNow).getTime() - Date.now());
  const expiredRef = useRef(false);
  const calculateRemaining = useCallback(
    () =>
      Math.max(
        0,
        Math.ceil(
          (new Date(expiresAt).getTime() - (Date.now() + offsetRef.current)) /
            1000,
        ),
      ),
    [expiresAt],
  );
  const [remaining, setRemaining] = useState(calculateRemaining);

  useEffect(() => {
    const update = () => {
      const next = calculateRemaining();
      setRemaining(next);
      if (next === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }
    };
    update();
    const interval = window.setInterval(update, 1_000);
    document.addEventListener("visibilitychange", update);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, [calculateRemaining, onExpire]);

  return (
    <span className="font-extrabold text-brand-primary" aria-live="polite">
      {formatRemaining(remaining)}
    </span>
  );
}
