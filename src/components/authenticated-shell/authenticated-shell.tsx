"use client";

import { Menu, X } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { ShellSidebar } from "./shell-sidebar";
import { ShellTopbar } from "./shell-topbar";

export type ShellNavigationItem = {
  accessState?: "enabled" | "hidden" | "locked";
  badge?: number;
  href: string;
  icon:
    | "brain"
    | "calendar"
    | "chart"
    | "credit-card"
    | "heart"
    | "help"
    | "home"
    | "message"
    | "route"
    | "search"
    | "settings"
    | "sparkles"
    | "star"
    | "user"
    | "user-pen"
    | "wallet";
  label: string;
  planLabel?: "Premium" | "Premium Plus";
  upgradeHref?: string;
};

export type ShellUser = {
  avatarUrl?: string | null;
  name: string;
  planLabel?: string;
  roleLabel: string;
};

type AuthenticatedShellProps = {
  children: ReactNode;
  helpCardVariant?: "default" | "priority" | "therapist";
  helpHref: string;
  helpLabel?: string;
  logoutAction?: () => void | Promise<void>;
  logoutHref?: string;
  navigation: ShellNavigationItem[];
  notificationCount?: number;
  notificationHref?: string;
  planLabel?: string;
  user: ShellUser;
  variant?: "admin" | "patient" | "therapist";
};

export function AuthenticatedShell({
  children,
  helpCardVariant = "default",
  helpHref,
  helpLabel,
  logoutAction,
  logoutHref,
  navigation,
  notificationCount = 0,
  notificationHref,
  planLabel,
  user,
  variant = "patient",
}: AuthenticatedShellProps) {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--tes-color-background)] text-tesText-primary">
      <aside
        aria-label="Navegação principal"
        className={cn(
          "fixed inset-y-0 left-0 z-overlay w-[var(--tes-layout-auth-sidebar-width)] border-r border-[var(--tes-color-border)] bg-white transition-transform lg:z-sticky lg:translate-x-0",
          isNavigationOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <ShellSidebar
          helpCardVariant={helpCardVariant}
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
          notificationHref={
            notificationHref ?? getDefaultNotificationHref(variant)
          }
          notificationCount={notificationCount}
          planLabel={planLabel}
          user={user}
          variant={variant}
          onOpenNavigation={() => setIsNavigationOpen(true)}
        />
        <main
          className={cn(
            "px-4 py-5 sm:px-6",
            variant === "therapist"
              ? "min-h-[calc(100vh-96px)] lg:px-7 lg:py-6"
              : "min-h-[calc(100vh-var(--tes-layout-auth-topbar-height))] lg:px-4 lg:py-0",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function getDefaultNotificationHref(
  variant: NonNullable<AuthenticatedShellProps["variant"]>,
) {
  if (variant === "therapist")
    return "/terapeuta/mensagens?context=notificacoes";
  if (variant === "admin") return "/admin/suporte";

  return "/app/mensagens?context=notificacoes";
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
