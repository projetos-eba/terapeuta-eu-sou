"use client";

import { Menu, X } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { ShellSidebar } from "./shell-sidebar";
import { ShellTopbar } from "./shell-topbar";

export type ShellNavigationItem = {
  badge?: number;
  href: string;
  icon: "calendar" | "heart" | "home" | "message" | "search" | "user";
  label: string;
};

export type ShellUser = {
  avatarUrl?: string | null;
  name: string;
  roleLabel: string;
};

type AuthenticatedShellProps = {
  children: ReactNode;
  helpHref: string;
  helpLabel?: string;
  logoutAction?: () => void | Promise<void>;
  logoutHref?: string;
  navigation: ShellNavigationItem[];
  notificationCount?: number;
  user: ShellUser;
};

export function AuthenticatedShell({
  children,
  helpHref,
  helpLabel,
  logoutAction,
  logoutHref,
  navigation,
  notificationCount = 0,
  user,
}: AuthenticatedShellProps) {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--tes-color-background)] text-tesText-primary">
      <aside
        aria-label="Navegação principal"
        className={cn(
          "fixed inset-y-0 left-0 z-overlay w-[var(--tes-layout-auth-sidebar-width)] border-r border-[var(--tes-color-border)] bg-white transition-transform lg:z-sticky lg:translate-x-0",
          isNavigationOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <ShellSidebar
          helpHref={helpHref}
          helpLabel={helpLabel}
          logoutAction={logoutAction}
          logoutHref={logoutHref}
          navigation={navigation}
          onNavigate={() => setIsNavigationOpen(false)}
        />
      </aside>

      {isNavigationOpen ? (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-sticky bg-brand-deep/20 lg:hidden"
          onClick={() => setIsNavigationOpen(false)}
          type="button"
        />
      ) : null}

      <div className="lg:pl-[var(--tes-layout-auth-sidebar-width)]">
        <ShellTopbar
          notificationCount={notificationCount}
          user={user}
          onOpenNavigation={() => setIsNavigationOpen(true)}
        />
        <main className="min-h-[calc(100vh-var(--tes-layout-auth-topbar-height))] px-4 py-5 sm:px-6 lg:px-4 lg:py-0">
          {children}
        </main>
      </div>
    </div>
  );
}

export function ShellNavigationToggle({
  isOpen,
  onClick,
}: {
  isOpen: boolean;
  onClick: () => void;
}) {
  const Icon = isOpen ? X : Menu;

  return (
    <button
      aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
      className="inline-flex size-11 items-center justify-center rounded-md text-brand-primary outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20 lg:hidden"
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" size={22} />
    </button>
  );
}
