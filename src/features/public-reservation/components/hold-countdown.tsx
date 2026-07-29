"use client";

import { useEffect, useState } from "react";

function formatRemaining(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function HoldCountdown({ seconds = 600 }: { seconds?: number }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <span className="font-extrabold text-brand-primary" aria-live="polite">
      {formatRemaining(remaining)}
    </span>
  );
}
