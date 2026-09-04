"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { useEffect, useState } from "react";

const SCROLL_POSITION_KEY = "tes:pending-navigation-scroll";

type SavedScrollPosition = {
  href: string;
  scrollY: number;
};

export function PendingNavigationLink({
  children,
  className,
  href,
  pendingLabel = "Carregando…",
}: {
  children: ReactNode;
  className?: string;
  href: string;
  pendingLabel?: string;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    const saved = readSavedScrollPosition();
    const currentHref = `${window.location.pathname}${window.location.search}`;

    if (!saved || saved.href !== currentHref) return;

    window.sessionStorage.removeItem(SCROLL_POSITION_KEY);
    setIsPending(false);
    window.requestAnimationFrame(() => {
      window.scrollTo({ behavior: "auto", top: saved.scrollY });
    });
  }, [href]);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.button !== 0 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }

    event.preventDefault();
    if (isPending) return;

    window.sessionStorage.setItem(
      SCROLL_POSITION_KEY,
      JSON.stringify({ href, scrollY: window.scrollY }),
    );
    setIsPending(true);
    router.push(href, { scroll: false });
  }

  return (
    <Link
      aria-busy={isPending}
      aria-disabled={isPending}
      className={className}
      href={href}
      onClick={handleClick}
      scroll={false}
    >
      <span aria-live="polite">{isPending ? pendingLabel : children}</span>
    </Link>
  );
}

function readSavedScrollPosition(): SavedScrollPosition | null {
  try {
    const value = window.sessionStorage.getItem(SCROLL_POSITION_KEY);
    if (!value) return null;

    const parsed = JSON.parse(value) as Partial<SavedScrollPosition>;
    if (typeof parsed.href !== "string" || typeof parsed.scrollY !== "number") {
      return null;
    }

    return { href: parsed.href, scrollY: parsed.scrollY };
  } catch {
    return null;
  }
}
