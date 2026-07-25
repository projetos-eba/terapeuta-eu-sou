"use client";

import Image from "next/image";
import { ChevronDown, UserRound } from "lucide-react";

import type { ShellUser } from "./authenticated-shell";

export function ShellUserMenu({
  planLabel,
  user,
}: {
  planLabel?: string;
  user: ShellUser;
}) {
  return (
    <button
      aria-label="Abrir menu do perfil"
      className="flex min-h-12 items-center gap-2 rounded-md px-1 text-left outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
      type="button"
    >
      <span className="relative inline-flex size-[54px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-soft text-brand-primary">
        {user.avatarUrl ? (
          <Image
            alt=""
            className="object-cover"
            fill
            sizes="54px"
            src={user.avatarUrl}
          />
        ) : (
          <UserRound aria-hidden="true" className="size-6" />
        )}
      </span>
      <span className="hidden min-w-0 sm:block">
        <span className="block truncate text-sm font-semibold text-[var(--tes-color-primary-dark)]">
          Olá, {user.name}
        </span>
        {(planLabel ?? user.planLabel) ? (
          <span className="mt-1 inline-flex rounded-full bg-status-warningBg px-2 py-0.5 text-[9px] font-semibold text-brand-deep">
            TES {planLabel ?? user.planLabel}
          </span>
        ) : (
          <span className="mt-0.5 block text-xs text-[var(--tes-color-text-secondary-app)]">
            {user.roleLabel}
          </span>
        )}
      </span>
      <ChevronDown aria-hidden="true" className="ml-1 hidden size-4 sm:block" />
    </button>
  );
}
