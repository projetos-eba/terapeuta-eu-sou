"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";

const SCROLL_POSITION_KEY = "tes:pending-navigation-scroll";

type SavedScrollPosition = {
  documentMinHeight: string;
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const currentHref = `${pathname}${search ? `?${search}` : ""}`;

  useEffect(() => {
    const saved = readSavedScrollPosition();

    if (!saved || saved.href !== currentHref) return;

    window.sessionStorage.removeItem(SCROLL_POSITION_KEY);
    window.requestAnimationFrame(() => {
      window.scrollTo({ behavior: "auto", top: saved.scrollY });
      window.requestAnimationFrame(() => {
        document.documentElement.style.minHeight = saved.documentMinHeight;
      });
    });
  }, [currentHref]);

  return (
    <Link
      className={className}
      href={href}
      onNavigate={() => saveScrollPosition(href)}
      scroll={false}
    >
      <PendingNavigationLabel pendingLabel={pendingLabel}>
        {children}
      </PendingNavigationLabel>
    </Link>
  );
}

function PendingNavigationLabel({
  children,
  pendingLabel,
}: {
  children: ReactNode;
  pendingLabel: string;
}) {
  const { pending } = useLinkStatus();

  return (
    <span aria-busy={pending} aria-live="polite">
      {pending ? pendingLabel : children}
    </span>
  );
}

function saveScrollPosition(href: string) {
  try {
    window.sessionStorage.setItem(
      SCROLL_POSITION_KEY,
      JSON.stringify({
        documentMinHeight: document.documentElement.style.minHeight,
        href,
        scrollY: window.scrollY,
      }),
    );
    document.documentElement.style.minHeight = `${document.documentElement.scrollHeight}px`;
  } catch {
    // Native Link navigation with scroll={false} remains functional when storage is unavailable.
  }
}

function readSavedScrollPosition(): SavedScrollPosition | null {
  try {
    const value = window.sessionStorage.getItem(SCROLL_POSITION_KEY);
    if (!value) return null;

    const parsed = JSON.parse(value) as Partial<SavedScrollPosition>;
    if (typeof parsed.href !== "string" || typeof parsed.scrollY !== "number") {
      return null;
    }

    return {
      documentMinHeight:
        typeof parsed.documentMinHeight === "string"
          ? parsed.documentMinHeight
          : "",
      href: parsed.href,
      scrollY: parsed.scrollY,
    };
  } catch {
    return null;
  }
}
