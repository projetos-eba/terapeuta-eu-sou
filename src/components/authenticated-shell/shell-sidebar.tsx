import Image from "next/image";
import { LogOut } from "lucide-react";

import { ShellHelpCard } from "./shell-help-card";
import type { ShellNavigationItem } from "./authenticated-shell";
import { ShellNavItem } from "./shell-nav-item";

type ShellSidebarProps = {
  helpCardVariant?: "default" | "priority" | "therapist";
  helpHref: string;
  helpLabel?: string;
  logoutAction?: () => void | Promise<void>;
  logoutHref?: string;
  navigation: ShellNavigationItem[];
  onNavigate?: () => void;
};

export function ShellSidebar({
  helpCardVariant,
  helpHref,
  helpLabel,
  logoutAction,
  logoutHref = "/cliente/login",
  navigation,
  onNavigate,
}: ShellSidebarProps) {
  return (
    <div className="flex h-full flex-col overflow-y-auto px-[13px] pb-4 pt-3">
      <div className="flex h-[74px] items-center px-3">
        <Image
          alt="Terapeuta Eu Sou"
          height={70}
          priority
          src="/logo-oficial-terapeuta-eu-sou.png"
          width={174}
        />
      </div>

      <nav aria-label="Seções do ambiente" className="mt-3 space-y-1">
        {navigation
          .filter((item) => item.accessState !== "hidden")
          .map((item) => (
            <ShellNavItem item={item} key={item.href} onNavigate={onNavigate} />
          ))}
      </nav>

      <div className="mt-8">
        {logoutAction ? (
          <form action={logoutAction}>
            <button
              className="flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-tesText-secondary outline-none transition hover:bg-surface-soft hover:text-brand-primary focus-visible:ring-4 focus-visible:ring-ring/20"
              type="submit"
            >
              <LogOut aria-hidden="true" className="size-5" strokeWidth={1.8} />
              Sair
            </button>
          </form>
        ) : (
          <a
            className="flex min-h-12 items-center gap-3 rounded-md px-3 text-sm font-medium text-tesText-secondary outline-none transition hover:bg-surface-soft hover:text-brand-primary focus-visible:ring-4 focus-visible:ring-ring/20"
            href={logoutHref}
          >
            <LogOut aria-hidden="true" className="size-5" strokeWidth={1.8} />
            Sair
          </a>
        )}
      </div>

      <div className="mt-auto pt-8">
        <ShellHelpCard
          href={helpHref}
          label={helpLabel}
          variant={helpCardVariant}
        />
      </div>
    </div>
  );
}
